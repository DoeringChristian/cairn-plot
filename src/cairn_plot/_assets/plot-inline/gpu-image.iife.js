var Wc=Object.defineProperty;var Hc=(f,c,ot)=>c in f?Wc(f,c,{enumerable:!0,configurable:!0,writable:!0,value:ot}):f[c]=ot;var fe=(f,c,ot)=>Hc(f,typeof c!="symbol"?c+"":c,ot);(function(f,c){"use strict";const ot=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function jn(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:ot}),{hdr:!1,format:n}}function ts(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:ot}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:ot}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return jn(e,t)}}}const ns=`
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
`,rs=`
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
`;class os extends Error{constructor(n){super(n);fe(this,"deviceLost",!0);this.name="DeviceLostError"}}async function Qn(e,t){try{await e.mapAsync(GPUMapMode.READ)}catch(n){if((n instanceof Error?n.name:"")==="AbortError"){const o=t.info;throw new os("webgpu readback: buffer map aborted — device lost or destroyed mid-readback"+(o?` (reason=${String(o.reason)}${o.message?`: ${o.message}`:""})`:"")+`: ${n instanceof Error?n.message:String(n)}`)}throw n instanceof Error?n:new Error(String(n))}}function ln(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Jn(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function ss(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const as={texture:0,sampler:1,uniform:2};function un(e,t){return e*3+as[t]}const is={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function cs(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),s=r[2]!==void 0,a=r[3].trim();if(s){const u=is[a];if(u===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${a}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:u})}else a==="sampler"||a==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class er{constructor(t,n,r,o){fe(this,"width");fe(this,"height");fe(this,"format");fe(this,"gpuTexture");fe(this,"device");fe(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:ln(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*Jn(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class tr{constructor(t){fe(this,"_s");fe(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class ls{constructor(t,n,r,o,s){fe(this,"_p");fe(this,"gpuPipeline");fe(this,"bindings");fe(this,"bindGroupLayout");fe(this,"variants");fe(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=s,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function us(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class fs{constructor(t){fe(this,"_c");fe(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class ds{constructor(t,n,r,o,s){fe(this,"width");fe(this,"height");fe(this,"paramsBuffer");fe(this,"bindGroup");fe(this,"buffers");fe(this,"destroyed",!1);this.width=t,this.height=n,this.buffers=r,this.paramsBuffer=o,this.bindGroup=s}destroy(){if(!this.destroyed){for(const t of this.buffers)t.destroy();this.paramsBuffer.destroy(),this.destroyed=!0}}}class ps{constructor(t,n){fe(this,"_b");fe(this,"gpuBindGroup");fe(this,"ownedBuffers");fe(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class hs{constructor(t,n,r,o){fe(this,"canvas");fe(this,"hdr");fe(this,"format");fe(this,"context");fe(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function Bt(e){return"canvas"in e}async function ms(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function s(p){return Bt(p)?p.getCurrentTextureView():p.gpuTexture.createView()}function a(p){if(Bt(p))return{width:p.canvas.width,height:p.canvas.height};const E=p;return{width:E.width,height:E.height}}let u=!1;const i={};t.lost.then(p=>{i.info=p},()=>{});let l=null;function d(){var E,_;if(l!==null)return l;let p=!1;try{if(typeof document<"u"){const v=document.createElement("canvas");v.width=1,v.height=1;const C=v.getContext("webgpu");if(C)try{C.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:GPUTextureUsage.RENDER_ATTACHMENT});const T=(E=C.getConfiguration)==null?void 0:E.call(C);p=((_=T==null?void 0:T.toneMapping)==null?void 0:_.mode)==="extended"}catch{p=!1}finally{try{C.unconfigure()}catch{}}}}catch{p=!1}return l=p,p}const x=256;let h=null,b=null;function y(){if(!h||!b){const p=t.createShaderModule({code:ns});b=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const E=t.createPipelineLayout({bindGroupLayouts:[b]});h=t.createComputePipeline({layout:E,compute:{module:p,entryPoint:"cs_main"}})}return{pipeline:h,layout:b}}let w=null,S=null;function m(){if(!w||!S){const p=t.createShaderModule({code:rs});S=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});const E=t.createPipelineLayout({bindGroupLayouts:[S]});w=t.createRenderPipeline({layout:E,vertex:{module:p,entryPoint:"vs_main"},fragment:{module:p,entryPoint:"fs_main",targets:[{format:"rgba16float"}]},primitive:{topology:"triangle-list"}})}return{pipeline:w,layout:S}}return{backend:"webgpu",capabilities:n,probeExtendedToneMapping:d,createTexture(p,E,_){return new er(t,p,E,_)},createSampler(p){const E=(p==null?void 0:p.filter)==="linear"?"linear":"nearest",_=t.createSampler({magFilter:E,minFilter:E,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new tr(_)},createRenderPipeline(p){const E=t.createShaderModule({code:p.shaderWGSL}),_=cs(p.shaderWGSL),v=ln(p.targetFormat),C=us(t,_),T=t.createPipelineLayout({bindGroupLayouts:[C]}),M=P=>t.createRenderPipeline({layout:T,vertex:{module:E,entryPoint:"vs_main"},fragment:{module:E,entryPoint:"fs_main",targets:[{format:P}]},primitive:{topology:"triangle-list"}}),A=M(v);return new ls(A,_,C,v,M)},createComputePipeline(p){const E=t.createShaderModule({code:p.shaderWGSL}),_=t.createComputePipeline({layout:"auto",compute:{module:E,entryPoint:"cs_main"}});return new fs(_)},createBindGroup(p,E){const _=p,v=new Map,C=[];for(const[M,A]of _.bindings)if(A.kind==="uniform"){const P=t.createBuffer({size:A.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});C.push(P),v.set(M,{binding:M,resource:{buffer:P}})}else A.kind==="sampler"&&v.set(M,{binding:M,resource:o()});for(const M of E){const A=M.resource;if(A instanceof er){const P=un(M.binding,"texture");_.bindings.has(P)&&v.set(P,{binding:P,resource:A.gpuTexture.createView()})}else if(A instanceof tr){const P=un(M.binding,"sampler");_.bindings.has(P)&&v.set(P,{binding:P,resource:A.gpuSampler})}else{const P=un(M.binding,"uniform"),O=_.bindings.get(P);if(O&&O.kind==="uniform"){const R=A.uniform,B=t.createBuffer({size:Math.max(O.sizeBytes,R.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(B,0,R.buffer,R.byteOffset,R.byteLength),C.push(B),v.set(P,{binding:P,resource:{buffer:B}})}}}const T=t.createBindGroup({layout:_.bindGroupLayout,entries:Array.from(v.values())});return new ps(T,C)},createSurface(p,E){const _=p.getContext("webgpu");if(!_)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const v=E.hdr&&n.hdr,C=()=>v?ts(_,t):jn(_,t),T=C();return new hs(p,_,T,C)},renderFullscreen(p,E,_){const v=E,C=_,T=s(p),{width:M,height:A}=a(p),P=Bt(p)?p.format:ln(p.format),O=v.pipelineFor(P),R=t.createCommandEncoder(),B=R.beginRenderPass({colorAttachments:[{view:T,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});B.setPipeline(O),B.setBindGroup(0,C.gpuBindGroup),B.setViewport(0,0,M,A,0,1),B.draw(3),B.end(),t.queue.submit([R.finish()])},createDeepSampleBuffers(p){const{layout:E}=m(),_=P=>{const O=t.createBuffer({size:P.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});return t.queue.writeBuffer(O,0,P.buffer,P.byteOffset,P.byteLength),O},v=_(p.offsets),C=_(p.colors),T=_(p.zs),M=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),A=t.createBindGroup({layout:E,entries:[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:C}},{binding:2,resource:{buffer:T}},{binding:3,resource:{buffer:M}}]});return new ds(p.width,p.height,[v,C,T],M,A)},compositeDeep(p,E,_,v){const C=p,T=E,{pipeline:M}=m();t.queue.writeBuffer(C.paramsBuffer,0,new Float32Array([C.width,C.height,v,_]));const A=t.createCommandEncoder(),P=A.beginRenderPass({colorAttachments:[{view:T.gpuTexture.createView(),loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});P.setPipeline(M),P.setBindGroup(0,C.bindGroup),P.setViewport(0,0,T.width,T.height,0,1),P.draw(3),P.end(),t.queue.submit([A.finish()])},async readback(p){const E=Bt(p),{width:_,height:v}=a(p),C=E?p.hdr?"rgba16float":"rgba8unorm":p.format,T=E&&p.format==="bgra8unorm",M=E?p.getCurrentGPUTexture():p.gpuTexture,A=Jn(C),P=_*A,O=256,R=Math.ceil(P/O)*O,B=R*v,N=t.createBuffer({size:B,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),$=t.createCommandEncoder();$.copyTextureToBuffer({texture:M},{buffer:N,bytesPerRow:R,rowsPerImage:v},{width:_,height:v,depthOrArrayLayers:1}),t.queue.submit([$.finish()]);try{await Qn(N,i)}catch(I){try{N.destroy()}catch{}throw I}const Q=new Uint8Array(N.getMappedRange()),V=new Uint8Array(P*v);for(let I=0;I<v;I++){const J=I*R,X=I*P;V.set(Q.subarray(J,J+P),X)}if(N.unmap(),N.destroy(),C==="rgba8unorm"){if(T)for(let I=0;I<V.length;I+=4){const J=V[I],X=V[I+2];V[I]=X,V[I+2]=J}return V}if(C==="rgba16float"){const I=new Uint16Array(V.buffer,V.byteOffset,V.byteLength/2),J=new Float32Array(I.length);for(let X=0;X<I.length;X++)J[X]=ss(I[X]);return J}return new Float32Array(V.buffer,V.byteOffset,V.byteLength/4)},async reduceDiffSumSquaredAbs(p,E,_,v){const C=p,T=E,M=Math.max(0,_*v),A=Math.max(1,Math.ceil(M/x)),{pipeline:P,layout:O}=y(),R=A*2*4,B=t.createBuffer({size:R,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),N=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(N,0,new Uint32Array([Math.max(1,_),Math.max(1,v),M,0]));const $=t.createBindGroup({layout:O,entries:[{binding:0,resource:C.gpuTexture.createView()},{binding:1,resource:T.gpuTexture.createView()},{binding:2,resource:{buffer:B}},{binding:3,resource:{buffer:N}}]}),Q=t.createBuffer({size:R,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),V=t.createCommandEncoder(),I=V.beginComputePass();I.setPipeline(P),I.setBindGroup(0,$),I.dispatchWorkgroups(A),I.end(),V.copyBufferToBuffer(B,0,Q,0,R),t.queue.submit([V.finish()]);try{await Qn(Q,i)}catch(ge){for(const z of[Q,B,N])try{z.destroy()}catch{}throw ge}const X=new Float32Array(Q.getMappedRange()).slice();Q.unmap(),Q.destroy(),B.destroy(),N.destroy();let _e=0,ae=0;for(let ge=0;ge<A;ge++)_e+=X[ge*2],ae+=X[ge*2+1];return{sumSq:_e,sumAbs:ae}},destroy(){u||(t.destroy(),u=!0)},isContextLost(){return!1}}}let fn=null;async function gs(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return ms()}function Nt(){return fn||(fn=gs()),fn}function xs(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function bs(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),s=Math.floor(o),a=Math.min(s+1,e.length-1),u=o-s,[i,l,d]=xs(e[s],e[a],u);t[n*3]=Math.round(i),t[n*3+1]=Math.round(l),t[n*3+2]=Math.round(d)}return t}const dn={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},vs=Object.keys(dn),ws={viridis:"Viridis",plasma:"Plasma",magma:"Magma","red-green":"Red–Green","red-blue":"Red–Blue"},ys=vs.map(e=>({id:e,label:ws[e]})),Es=new Set(["red-green","red-blue"]),nr=new Map;function pn(e){let t=nr.get(e);if(!t){const n=dn[e]??dn.viridis;t=bs(n),nr.set(e,t)}return t}function ft(e,t,n){return e<t?t:e>n?n:e}function Be(e){return e<0?0:e>1?1:e}function It(e,t,n){return ft(Math.floor(e),t,n)}const hn=e=>{const t=e<0?0:e;return t/(1+t)},mn=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return Be(n/r)},rr=4,_s=1,Ms=16,Ss=.5,or={linear:([e,t,n])=>[Be(e),Be(t),Be(n)],srgb:([e,t,n])=>[Be(e),Be(t),Be(n)],gamma:([e,t,n])=>[Be(e),Be(t),Be(n)],reinhard:([e,t,n])=>[hn(e),hn(t),hn(n)],aces:([e,t,n])=>[mn(e),mn(t),mn(n)],extended:([e,t,n])=>[e,t,n]},sr="srgb",ar=["linear","srgb","gamma","reinhard","aces"],Ts=["srgb","gamma","linear"],ir=["extended","extended-clamp","extended-reinhard","extended-aces"],As=["extended-clamp","extended-reinhard","extended-aces"];function cr(e){return!!e&&ir.includes(e)}function Ps(e){return!!e&&As.includes(e)}const lr={extended:"linear","extended-clamp":"linear","extended-reinhard":"reinhard","extended-aces":"aces"};function Rs(e){return e&&or[e]||or[sr]}function St(e){return e&&lr[e]?lr[e]:e&&ar.includes(e)?e:sr}function Cs(e,t){return t?cr(e)?e:"extended":St(e)}function Ft(e,t,n){return e*2**t+n}function Ds(e){const t=Be(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function gn(e){const t=Be(e);return t<=.04045?t/12.92:Math.pow((t+.055)/1.055,2.4)}function vt(e,t){return typeof t=="number"&&t>0?Be(Math.pow(Be(e),1/t)):Ds(e)}const Tt=2.2,xn=.5,bn=4,vn=.1;function Gt(e){return e==="gamma"}function Ut(e,t){if(e==="gamma")return t>0?t:Tt;if(e==="linear")return 1}function wn(e,t,n="linear",r=0,o=0){const s=pn(t),a=new ImageData(e.width,e.height),u=e.data,i=a.data,l=r!==0||o!==0;for(let d=0;d<u.length;d+=4){let x=(u[d]+u[d+1]+u[d+2])/3;l&&(x=Math.max(0,Math.min(255,Ft(x/255,r,o)*255)));let h;n==="positive"?h=Math.round(128+x/255*127):h=Math.round(x),h=Math.max(0,Math.min(255,h)),i[d]=s[h*3],i[d+1]=s[h*3+1],i[d+2]=s[h*3+2],i[d+3]=u[d+3]}return a}function ks(e,t){return e==="signed"||e==="relative"?"signed":yn(t)}function yn(e){return Es.has(e??"")?"positive":"linear"}function ur(e,t){const n=new Map;return{get(r){const o=n.get(r);if(o!==void 0)return n.delete(r),n.set(r,o),o},set(r,o){for(n.get(r)!==void 0&&n.delete(r),n.set(r,o);n.size>e;){const a=n.keys().next().value;if(a===void 0)break;n.get(a),n.delete(a)}},has(r){return n.has(r)},get size(){return n.size}}}const fr=ur(50);function En(e){return fr.get(e)}function _n(e,t){fr.set(e,t)}const dr=ur(100);function Ls(e){return dr.get(e)}function Os(e,t){dr.set(e,t)}function Bs(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),s=new ImageData(r,o);for(let a=0;a<o;a++)for(let u=0;u<r;u++){const i=(a*e.width+u)*4,l=(a*t.width+u)*4,d=(a*r+u)*4;for(let x=0;x<3;x++){const h=e.data[i+x],b=t.data[l+x],y=h-b,w=Math.abs(y),S=Math.max(h,1);let m;switch(n){case"signed":m=(y+255)/2;break;case"absolute":m=w;break;case"squared":m=y*y/255;break;case"relative_signed":m=(y/S+1)*127.5;break;case"relative_absolute":m=w/S*255;break;case"relative_squared":m=y*y/(S*S)*255;break}s.data[d+x]=Math.min(255,Math.max(0,Math.round(m)))}s.data[d+3]=255}return s}async function st(e){const t=Ls(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const s=o.getContext("2d");if(!s){n(null);return}s.drawImage(r,0,0);const a=s.getImageData(0,0,o.width,o.height);Os(e,a),n(a)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const Ns={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},Is={linear:0,signed:1,positive:2},Fs=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,Gs=`#version 300 es
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
}`;let dt=null,se=null,Le=null,zt=null;function Us(){if(se)return se;try{if(typeof OffscreenCanvas<"u"?dt=new OffscreenCanvas(1,1):dt=document.createElement("canvas"),se=dt.getContext("webgl2",{preserveDrawingBuffer:!0}),!se)return console.warn("[cairn] WebGL 2 not available"),null;const e=se.createShader(se.VERTEX_SHADER);if(se.shaderSource(e,Fs),se.compileShader(e),!se.getShaderParameter(e,se.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",se.getShaderInfoLog(e)),null;const t=se.createShader(se.FRAGMENT_SHADER);if(se.shaderSource(t,Gs),se.compileShader(t),!se.getShaderParameter(t,se.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",se.getShaderInfoLog(t)),null;if(Le=se.createProgram(),se.attachShader(Le,e),se.attachShader(Le,t),se.linkProgram(Le),!se.getProgramParameter(Le,se.LINK_STATUS))return console.error("[cairn] WebGL program link:",se.getProgramInfoLog(Le)),null;zt=se.createVertexArray(),se.bindVertexArray(zt);const n=se.createBuffer();se.bindBuffer(se.ARRAY_BUFFER,n),se.bufferData(se.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),se.STATIC_DRAW);const r=se.getAttribLocation(Le,"a_pos");return se.enableVertexAttribArray(r),se.vertexAttribPointer(r,2,se.FLOAT,!1,0,0),se.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),se}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function pr(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function zs(e,t,n){const r=new Uint8Array(1024);for(let s=0;s<256;s++)r[s*4]=t[s*3],r[s*4+1]=t[s*3+1],r[s*4+2]=t[s*3+2],r[s*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function Vs(e,t,n,r){const o=Us();if(!o||!Le||!zt||!dt)return null;const s=Math.min(e.width,t.width),a=Math.min(e.height,t.height);dt.width=s,dt.height=a,o.viewport(0,0,s,a);const u=pr(o,e,0),i=pr(o,t,1);let l=null;n.colormap?l=zs(o,n.colormap,2):(l=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,l),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(Le),o.uniform1i(o.getUniformLocation(Le,"u_baseline"),0),o.uniform1i(o.getUniformLocation(Le,"u_other"),1),o.uniform1i(o.getUniformLocation(Le,"u_lut"),2),o.uniform1i(o.getUniformLocation(Le,"u_diff_mode"),Ns[n.diffMode]),o.uniform1i(o.getUniformLocation(Le,"u_cmap_mode"),Is[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(Le,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(zt),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=s,r.height=a;const d=r.getContext("2d");return d&&(d.save(),d.scale(1,-1),d.drawImage(dt,0,0,s,a,0,-a,s,a),d.restore()),o.deleteTexture(u),o.deleteTexture(i),o.deleteTexture(l),{width:s,height:a}}const $s="cairn:render-mode";function Xs(){try{const e=localStorage.getItem($s);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const Ws=.299,Hs=.587,Ys=.114;function At(e,t,n){return(Ws*e+Hs*t+Ys*n)/255}const Vt=15360;function $t(e){const t=e&32768?-1:1,n=e>>10&31,r=e&1023;return n===0?r===0?t*0:t*r*2**-24:n===31?r===0?t*(1/0):NaN:t*2**(n-15)*(1+r/1024)}const hr=globalThis.Float16Array;function mr(e,t=e.length){if(hr){const r=new hr(e.buffer,e.byteOffset,t);return Float32Array.from(r)}const n=new Float32Array(t);for(let r=0;r<t;r++)n[r]=$t(e[r]);return n}const He=new Uint32Array(512),Ye=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(He[e]=0,He[e|256]=32768,Ye[e]=24,Ye[e|256]=24):t<-14?(He[e]=1024>>-t-14,He[e|256]=1024>>-t-14|32768,Ye[e]=-t-1,Ye[e|256]=-t-1):t<=15?(He[e]=t+15<<10,He[e|256]=t+15<<10|32768,Ye[e]=13,Ye[e|256]=13):t<128?(He[e]=31744,He[e|256]=64512,Ye[e]=24,Ye[e|256]=24):(He[e]=31744,He[e|256]=64512,Ye[e]=13,Ye[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var Pt=Uint8Array,gr=Uint16Array,Ks=Int32Array,qs=new Pt([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),Zs=new Pt([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),xr=function(e,t){for(var n=new gr(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new Ks(n[30]),r=1;r<30;++r)for(var s=n[r];s<n[r+1];++s)o[s]=s-n[r]<<5|r;return{b:n,r:o}},br=xr(qs,2),js=br.b,Qs=br.r;js[28]=258,Qs[258]=28,xr(Zs,0);for(var Js=new gr(32768),ye=0;ye<32768;++ye){var at=(ye&43690)>>1|(ye&21845)<<1;at=(at&52428)>>2|(at&13107)<<2,at=(at&61680)>>4|(at&3855)<<4,Js[ye]=((at&65280)>>8|(at&255)<<8)>>1}for(var Xt=new Pt(288),ye=0;ye<144;++ye)Xt[ye]=8;for(var ye=144;ye<256;++ye)Xt[ye]=9;for(var ye=256;ye<280;++ye)Xt[ye]=7;for(var ye=280;ye<288;++ye)Xt[ye]=8;for(var ea=new Pt(32),ye=0;ye<32;++ye)ea[ye]=5;var ta=new Pt(0),na=typeof TextDecoder<"u"&&new TextDecoder,ra=0;try{na.decode(ta,{stream:!0}),ra=1}catch{}const vr=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function Mn(e){const t=vr.length;return vr[(e%t+t)%t]}function oa(e){const n=c.useRef(null),[r,o]=c.useState({w:0,h:0}),s=c.useRef(null),a=c.useRef(null),u=c.useRef(null),i=c.useCallback((l,d)=>{o(x=>x.w===l&&x.h===d?x:{w:l,h:d})},[]);return c.useLayoutEffect(()=>{const l=n.current;if(!l||l===u.current)return;const d=l.getBoundingClientRect();(d.width>0||d.height>0)&&(u.current=l,i(d.width,d.height))}),c.useEffect(()=>{var x;const l=n.current;if(l===a.current||((x=s.current)==null||x.disconnect(),s.current=null,a.current=l,!l))return;const d=new ResizeObserver(h=>{for(const b of h)i(b.contentRect.width,b.contentRect.height)});s.current=d,d.observe(l)}),c.useEffect(()=>()=>{var l;return(l=s.current)==null?void 0:l.disconnect()},[]),{ref:n,size:r}}function sa(){const[e,t]=c.useState(!1);return c.useEffect(()=>{const n=s=>{(s.key==="Alt"||s.key==="Control"||s.key==="Meta")&&t(!0)},r=s=>{(s.key==="Alt"||s.key==="Control"||s.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const aa=.001;function ia(e,t=aa){return Math.exp(-e*t)}function wr(e,t){return Math.hypot(e.x-t.x,e.y-t.y)}function yr(e,t){return{x:(e.x+t.x)/2,y:(e.y+t.y)/2}}function ca(e,t,n,r,o,s,a){const u=t>0&&r>0?r/t:1,i=Math.max(s,Math.min(a,e.zoom*u)),l=(n.x-e.pan.x)/e.zoom,d=(n.y-e.pan.y)/e.zoom;return{zoom:i,pan:{x:o.x-l*i,y:o.y-d*i}}}const la=.25,Sn=64;function Tn(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return Sn;const o=Math.min(n/e,r/t);return o<=0?Sn:Math.max(Math.max(n,r)/o,8)}function Er(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:s=la,maxZoom:a=Sn,naturalWidth:u,naturalHeight:i}=e,l=sa(),d=c.useRef(l);d.current=l;const x=c.useRef({zoom:n,pan:r});x.current={zoom:n,pan:r};const h=c.useRef(o);h.current=o,c.useEffect(()=>{const T=t.current;if(!T||!o)return;const M=A=>{var J;if(!A.ctrlKey&&!d.current)return;A.preventDefault(),A.stopPropagation();const P=ia(A.deltaY),O=x.current,R=T.getBoundingClientRect(),B=u&&i?Tn(u,i,R.width,R.height):a,N=Math.max(s,Math.min(B,O.zoom*P));if(O.zoom===N)return;const $=A.clientX-R.left,Q=A.clientY-R.top,V=$-($-O.pan.x)/O.zoom*N,I=Q-(Q-O.pan.y)/O.zoom*N;(J=h.current)==null||J.call(h,{zoom:N,pan:{x:V,y:I}})};return T.addEventListener("wheel",M,{passive:!1}),()=>T.removeEventListener("wheel",M)},[t,!!o,s,a,u,i]);const b=c.useRef(new Map),y=c.useRef(null),w=c.useRef(null),S=c.useCallback((T,M,A)=>{const P=T.getBoundingClientRect();return{x:M-P.left,y:A-P.top}},[]),m=c.useCallback(T=>{if(!u||!i)return a;const M=T.getBoundingClientRect();return Tn(u,i,M.width,M.height)},[u,i,a]),g=c.useCallback((T,M)=>{const A=b.current,P=A.get(T),O=A.get(M);!P||!O||(y.current=null,w.current={idA:T,idB:M,startDist:wr(P,O),startMid:yr(P,O),startZoom:x.current.zoom,startPan:{...x.current.pan}})},[]),p=c.useCallback(T=>{const M=b.current.get(T);M&&(y.current={pointerId:T,startX:M.x,startY:M.y,panX:x.current.pan.x,panY:x.current.pan.y})},[]),E=c.useCallback(T=>{if(!h.current)return;const M=T.pointerType==="touch";if(!M&&!d.current)return;const A=T.currentTarget;if(A.setPointerCapture(T.pointerId),b.current.set(T.pointerId,S(A,T.clientX,T.clientY)),M&&b.current.size>=2){const P=[...b.current.keys()];g(P[P.length-2],P[P.length-1]);return}p(T.pointerId)},[S,g,p]),_=c.useCallback(T=>{var R,B;const M=T.currentTarget,A=b.current.get(T.pointerId);if(A){const N=S(M,T.clientX,T.clientY);A.x=N.x,A.y=N.y}const P=w.current;if(P){const N=b.current.get(P.idA),$=b.current.get(P.idB);if(!N||!$)return;const Q=ca({zoom:P.startZoom,pan:P.startPan},P.startDist,P.startMid,wr(N,$),yr(N,$),s,m(M));(R=h.current)==null||R.call(h,Q);return}const O=y.current;!O||O.pointerId!==T.pointerId||!A||(B=h.current)==null||B.call(h,{zoom:x.current.zoom,pan:{x:O.panX+(A.x-O.startX),y:O.panY+(A.y-O.startY)}})},[S,s,m]),v=c.useCallback(T=>{var A;try{T.currentTarget.releasePointerCapture(T.pointerId)}catch{}b.current.delete(T.pointerId);const M=w.current;if(M&&(T.pointerId===M.idA||T.pointerId===M.idB)){w.current=null;const P=[...b.current.keys()];P.length===1&&p(P[0]);return}((A=y.current)==null?void 0:A.pointerId)===T.pointerId&&(y.current=null)},[p]);return{containerProps:{onPointerDown:E,onPointerMove:_,onPointerUp:v,onPointerCancel:v,style:{cursor:l&&!!o?"move":void 0,touchAction:o?"none":void 0}},modifierActive:l}}function An(){const[e,t]=c.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return c.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),s())};function s(){if(n)return;const a=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${a}dppx)`),r.addEventListener("change",o,{once:!0})}return s(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function Ne(e){const t=c.useRef(e),[n,r]=c.useState(e),o=c.useCallback(()=>r(t.current),[]);return[n,r,{reset:o,isModified:!Object.is(n,t.current),default:t.current}]}function ua(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function _r(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function Pn({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:s}=oa(),a=c.useRef(null),u=c.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),i=c.useMemo(()=>{const w=s.w,S=s.h;if(w<=0||S<=0||n<=0||r<=0)return null;const m=Math.min(w/n,S/r),g=n*m,p=r*m;return{left:(w-g)/2,top:(S-p)/2,width:g,height:p}},[s.w,s.h,n,r]),l=e.masks,d=t.showMasks&&!!l&&l.length>0,x=c.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(c.useEffect(()=>{if(!d||!l)return;const w=a.current;if(!w)return;(w.width!==n||w.height!==r)&&(w.width=n,w.height=r);const S=w.getContext("2d");if(!S)return;S.clearRect(0,0,w.width,w.height);let m=!1;const g=S.createImageData(n,r),p=g.data;let E=l.length,_=!1;const v=()=>{m||_&&S.putImageData(g,0,0)},C=document.createElement("canvas");C.width=n,C.height=r;const T=C.getContext("2d",{willReadFrequently:!0});for(const M of l){const A=new Image;A.onload=()=>{if(!m){if(T){T.clearRect(0,0,n,r),T.drawImage(A,0,0,n,r);const P=T.getImageData(0,0,n,r).data;for(let O=0;O<n*r;O++){const R=P[O*4];if(R===0||u.has(R))continue;const[B,N,$]=ua(Mn(R));p[O*4]=B,p[O*4+1]=N,p[O*4+2]=$,p[O*4+3]=255,_=!0}}E-=1,E===0&&v()}},A.onerror=()=>{E-=1,E===0&&v()},A.src=`data:image/png;base64,${M.png_b64}`}return()=>{m=!0}},[d,l,n,r,x]),!i)return f.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const h=e.boxes??[],b=t.showBoxes&&h.length>0,y=e.class_labels??{};return f.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[d&&f.jsx("canvas",{ref:a,className:"absolute",style:{left:i.left,top:i.top,width:i.width,height:i.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),b&&f.jsx("svg",{className:"absolute",style:{left:i.left,top:i.top,width:i.width,height:i.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:h.map((w,S)=>{if(!_r(w,t,u))return null;const m=w.domain==="pixel"?1:n,g=w.domain==="pixel"?1:r,p=w.position.minX*m,E=w.position.minY*g,_=(w.position.maxX-w.position.minX)*m,v=(w.position.maxY-w.position.minY)*g;return f.jsx("rect",{x:p,y:E,width:_,height:v,fill:"none",stroke:Mn(w.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},S)})}),b&&f.jsx("div",{className:"absolute",style:{left:i.left,top:i.top,width:i.width,height:i.height},children:h.map((w,S)=>{if(!_r(w,t,u))return null;const m=w.domain==="pixel"?1/n:1,g=w.domain==="pixel"?1/r:1,p=w.position.minX*m*100,E=w.position.minY*g*100,_=w.label??y[String(w.class_id)]??`#${w.class_id}`,v=w.score!=null?` ${(w.score*100).toFixed(0)}%`:"";return!_&&!v?null:f.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${p}%`,top:`${E}%`,transform:"translateY(-100%)",backgroundColor:Mn(w.class_id)},children:f.jsxs("span",{className:"mono",children:[_,v]})},S)})})]})}function fa(e,t){const n=t==null?void 0:t.precision,r=da(e,n);return t!=null&&t.minus?r.replace("-","−"):r}function da(e,t){if(!Number.isFinite(e))return String(e);if(e===0)return"0";const n=Math.abs(e);return n>=1e3||n<.001?e.toExponential(Math.max(0,t-2)):Number(e.toPrecision(t)).toString()}const pa={x:0,y:0,w:1,h:1};function Wt(e){const t=e.sourceWindow??pa,n=t.x*e.naturalWidth,r=t.y*e.naturalHeight,o=t.w*e.naturalWidth,s=t.h*e.naturalHeight,a=Math.min(e.box.width/o,e.box.height/s),u=o*a,i=s*a;return{scale:a,imgLeft:e.box.left+(e.box.width-u)/2,imgTop:e.box.top+(e.box.height-i)/2,srcOriginX:n,srcOriginY:r,visibleW:o,visibleH:s}}function ha(e){return Wt(e).scale}function Mr(e,t,n){const r=Wt(n);return{x:r.srcOriginX+(e-r.imgLeft)/r.scale,y:r.srcOriginY+(t-r.imgTop)/r.scale}}function Sr(e,t,n){const r=Wt(n);return{x:r.imgLeft+(e-r.srcOriginX)*r.scale,y:r.imgTop+(t-r.srcOriginY)*r.scale}}function ma(e,t){const n=Sr(e.x0,e.y0,t),r=Sr(e.x1+1,e.y1+1,t);return{left:n.x,top:n.y,width:r.x-n.x,height:r.y-n.y}}function Tr(e,t,n,r,o){const s=Mr(e,t,o),a=Mr(n,r,o),u=o.naturalWidth-1,i=o.naturalHeight-1,l=Math.min(s.x,a.x),d=Math.max(s.x,a.x),x=Math.min(s.y,a.y),h=Math.max(s.y,a.y);return d<0||l>u||h<0||x>i?null:{x0:It(l,0,u),y0:It(x,0,i),x1:It(d,0,u),y1:It(h,0,i)}}const Rn=30,Ht=["#ff5a5a","#39d353","#5b9bff"];function Cn(e){return fa(e,{precision:3})}function wt(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):Cn(e/255):Cn(n==="int"?e*255:e)}function pt(e,t,n,r){return e.length===1?{lines:[wt(e[0],t,n)],luminance:r}:{lines:e.map(o=>wt(o,t,n)),luminance:r,colors:e.map((o,s)=>Ht[s]??null)}}const ga={x:0,y:0,w:1,h:1};function ht({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:s,notation:a="decimal",version:u=0,onActiveChange:i,sourceWindow:l=ga}){const d=c.useRef(null),x=c.useRef(!1),h=An(),b=c.useRef(i);b.current=i;const y=c.useCallback(S=>{var m;S!==x.current&&(x.current=S,(m=b.current)==null||m.call(b,S))},[]),w=c.useCallback(()=>{var re;const S=d.current,m=e.current;if(!S)return;const g=window.devicePixelRatio||1,p=S.clientWidth,E=S.clientHeight;if(p===0||E===0)return;S.width!==Math.round(p*g)&&(S.width=Math.round(p*g)),S.height!==Math.round(E*g)&&(S.height=Math.round(E*g));const _=S.getContext("2d");if(!_)return;if(_.setTransform(g,0,0,g,0,0),_.clearRect(0,0,p,E),!m||t<=0||n<=0){y(!1);return}const v=m.getBoundingClientRect(),C=S.getBoundingClientRect();if(v.width===0||v.height===0){y(!1);return}const M=Wt({box:v,naturalWidth:t,naturalHeight:n,sourceWindow:l}),{srcOriginX:A,srcOriginY:P,visibleW:O,visibleH:R,scale:B}=M;if(O<=0||R<=0){y(!1);return}if(B<Rn){y(!1);return}const N=M.imgLeft-C.left,$=M.imgTop-C.top,Q=Math.max(Math.floor(A),Math.floor(A+(0-N)/B)),V=Math.min(Math.ceil(A+O),Math.ceil(A+(p-N)/B)),I=Math.max(Math.floor(P),Math.floor(P+(0-$)/B)),J=Math.min(Math.ceil(P+R),Math.ceil(P+(E-$)/B));if(V<=Q||J<=I){y(!1);return}y(!0);const X=N+(0-A)*B,_e=$+(0-P)*B,ae=N+(t-A)*B,ge=$+(n-P)*B;_.save(),_.beginPath(),_.rect(X,_e,ae-X,ge-_e),_.clip(),_.textAlign="center",_.textBaseline="middle",_.lineJoin="round";const z=B*.14,K=B-z*2;for(let ee=I;ee<J;ee++)for(let ie=Q;ie<V;ie++){if(ie<0||ee<0||ie>=t||ee>=n)continue;const Y=s(ie,ee,a);if(!Y||Y.lines.length===0)continue;const oe=Y.lines.length;let xe=1;for(const Re of Y.lines)Re.length>xe&&(xe=Re.length);const Ee=K/(oe*1.15),q=K/(xe*.62)||Ee,Se=Math.min(Ee,q,24);if(Se<6)continue;const be=N+(ie-A+.5)*B,ve=$+(ee-P+.5)*B,pe=Se*1.15,Te=Y.luminance<=.55,Pe=Te?"#ffffff":"#000000";_.font=`${Se}px ui-monospace, SFMono-Regular, Menlo, monospace`,_.lineWidth=Math.max(1.4,Se*.16),_.strokeStyle=Te?"rgba(0,0,0,0.85)":"rgba(255,255,255,0.9)";let Ge=ve-oe*pe/2+pe/2;for(let Re=0;Re<Y.lines.length;Re++){const We=Y.lines[Re];_.strokeText(We,be,Ge),_.fillStyle=((re=Y.colors)==null?void 0:re[Re])??Pe,_.fillText(We,be,Ge),Ge+=pe}}_.restore()},[e,t,n,s,a,y,l]);return c.useEffect(()=>{w()},[w,r,o.x,o.y,u,a,l,h]),c.useEffect(()=>{const S=d.current;if(!S)return;const m=new ResizeObserver(()=>w());return m.observe(S),()=>m.disconnect()},[w]),f.jsx("canvas",{ref:d,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function Ar({notation:e,onChange:t,className:n=""}){return f.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const xa=`
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
// Logical binding 9 (uniform f32: hdrEncodeLegacy, 0/1) -> native binding 9*3+2 = 29.
// *** TEMPORARY A/B SEAM (remove once the extended encode is visually validated
// on a real HDR display against tev). *** When 1 AND hdrOut, the shader RESTORES
// the OLD raw-scene-linear behavior (skips the extended output-encode) so the
// user can flip ?hdrEncode=legacy to compare old-vs-new on their HDR panel.
// Default 0 (zero-filled when the caller omits it) = the CORRECT extended encode.
@group(0) @binding(29) var<uniform> u_bind9: f32;

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
  let hdrEncodeLegacy = u_bind9 > 0.5;

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

  // 4) output-encode.
  let hasGamma = gamma > 0.0;
  if (hdrOut) {
    // EXTENDED HDR surface (rgba16float, srgb/display-p3): the canvas stores
    // TRANSFER-ENCODED (non-linear) signals per W3C ColorWeb-CG, so ENCODE the
    // display-linear light the operator produced — the extended (unclamped,
    // origin-mirrored) sRGB OETF, or the extended power curve for the Gamma
    // operator (hasGamma). Values above 1 / below 0 survive as extended
    // brightness. See extendedOutputEncodeF + image/tonemap.ts's doc block.
    // TEMPORARY A/B: hdrEncodeLegacy restores the OLD raw-scene-linear write.
    if (hdrEncodeLegacy) {
      return vec4<f32>(rgb, 1.0);
    }
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
`,Rt=`
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
`,ba=`
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
`,Yt=`
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
`;function Pr(e){return`
${ze}
${mt}
${ba}

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
`}const va=Pr("select(colorB, colorA, uv.x < split)"),wa=Pr("mix(colorA, colorB, alpha)");function ya(e){switch(e){case"center":return{v:"center",h:"center"};case"top-right":return{v:"top",h:"right"};case"bottom-left":return{v:"bottom",h:"left"};case"bottom-right":return{v:"bottom",h:"right"};case"top-left":default:return{v:"top",h:"left"}}}function Rr(e,t,n){const{v:r,h:o}=ya(n),s=e.w-t.w,a=e.h-t.h,u=o==="left"?0:o==="right"?s:Math.floor(s/2),i=r==="top"?0:r==="bottom"?a:Math.floor(a/2);return{x:u,y:i}}function Ct(e,t,n,r,o="b"){if(r==="fill"){const a=o==="a"?{w:e.w,h:e.h}:{w:t.w,h:t.h};return{fit:r,result:a,offsetA:{x:0,y:0},offsetB:{x:0,y:0}}}const s={w:Math.min(e.w,t.w),h:Math.min(e.h,t.h)};return{fit:r,result:s,offsetA:Rr(e,s,n),offsetB:Rr(t,s,n)}}function Dn(e){return`${e.fit}:${e.result.w}x${e.result.h}:${e.offsetA.x},${e.offsetA.y}:${e.offsetB.x},${e.offsetB.y}`}const kn={linear:0,srgb:1,reinhard:2,aces:3,extended:4,"extended-reinhard":5,"extended-aces":6,"extended-clamp":7,gamma:8},Cr=new WeakMap;function Ea(e,t){let n=Cr.get(e);n||(n=new Map,Cr.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:xa,targetFormat:t}),n.set(t,r)),r}function Dr(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function kr(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function _a(e,t,n,r){var g;const o=Dr(t),s=Ea(e,o),a=kr(e,r.isScalar?r.colormap:void 0),u=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,i=kn[r.operator]??kn.srgb,l=new Float32Array([r.exposureEV,i,u,r.isScalar?1:0]),d=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),x=new Float32Array([r.hdrOut?1:0]),h=new Float32Array([r.filter==="nearest"?0:1]),b=new Float32Array([r.offset??0]),y=new Float32Array([r.peak??rr]),w=new Float32Array([r.srgbDecode?1:0]),S=new Float32Array([r.hdrEncodeLegacy?1:0]);let m;try{m=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:a},{binding:2,resource:{uniform:l}},{binding:3,resource:{uniform:d}},{binding:4,resource:{uniform:x}},{binding:5,resource:{uniform:h}},{binding:6,resource:{uniform:b}},{binding:7,resource:{uniform:y}},{binding:8,resource:{uniform:w}},{binding:9,resource:{uniform:S}}]),e.renderFullscreen(t,s,m)}finally{(g=m==null?void 0:m.destroy)==null||g.call(m),a.destroy()}}const Lr=new WeakMap;function Ma(e,t,n){let r=Lr.get(e);r||(r=new Map,Lr.set(e,r));const o=`${t}:${n}`;let s=r.get(o);return s||(s=e.createRenderPipeline({shaderWGSL:t==="split"?va:wa,targetFormat:n}),r.set(o,s)),s}function Sa(e,t,n,r,o){var w;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const s=Dr(t),a=Ma(e,o.mode,s),u=kr(e,void 0),i=o.gamma,l=kn[o.operator],d=new Float32Array([o.exposureEV,l,i,0]),x=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),h=new Float32Array([o.split,o.alpha,0,o.filter==="nearest"?0:1]),b=new Float32Array([o.offset??0,0,0,0]);let y;try{y=e.createBindGroup(a,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:u},{binding:3,resource:{uniform:d}},{binding:4,resource:{uniform:x}},{binding:5,resource:{uniform:h}},{binding:6,resource:{uniform:b}}]),e.renderFullscreen(t,a,y)}finally{(w=y==null?void 0:y.destroy)==null||w.call(y),u.destroy()}}function Or(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,s=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:s,mae:o}}async function Br(e,t,n,r){const o=r??Ct({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),s=o.result.w,a=o.result.h,u=s*a*3;if(u<=0)return{mse:0,psnr:1/0,mae:0};if(o.fit==="crop"&&o.offsetA.x===0&&o.offsetA.y===0&&o.offsetB.x===0&&o.offsetB.y===0&&e.reduceDiffSumSquaredAbs){const{sumSq:p,sumAbs:E}=await e.reduceDiffSumSquaredAbs(t,n,s,a);return Or(p,E,u)}const l=await e.readback(t),d=await e.readback(n),x=l instanceof Uint8Array?255:1,h=d instanceof Uint8Array?255:1,b=Kt(l,t.width,t.height,x,o.offsetA,o.fit==="fill",s,a),y=Kt(d,n.width,n.height,h,o.offsetB,o.fit==="fill",s,a);let w=0,S=0;const m=[0,0,0],g=[0,0,0];for(let p=0;p<a;p++)for(let E=0;E<s;E++){b(E,p,m),y(E,p,g);for(let _=0;_<3;_++){const v=m[_]-g[_];w+=v*v,S+=Math.abs(v)}}return Or(w,S,u)}function Kt(e,t,n,r,o,s,a,u){const i=(x,h,b)=>e[(h*t+x)*4+b]??0;if(!s)return(x,h,b)=>{const y=Math.min(Math.max(x+o.x,0),t-1),w=Math.min(Math.max(h+o.y,0),n-1);b[0]=i(y,w,0)/r,b[1]=i(y,w,1)/r,b[2]=i(y,w,2)/r};const l=t-1,d=n-1;return(x,h,b)=>{const y=(x+.5)/a,w=(h+.5)/u,S=y*t-.5,m=w*n-.5,g=Math.floor(S),p=Math.floor(m),E=S-g,_=m-p,v=Math.min(Math.max(g,0),l),C=Math.min(Math.max(g+1,0),l),T=Math.min(Math.max(p,0),d),M=Math.min(Math.max(p+1,0),d);for(let A=0;A<3;A++){const P=i(v,T,A),O=i(C,T,A),R=i(v,M,A),B=i(C,M,A),N=P+(O-P)*E,$=R+(B-R)*E;b[A]=(N+($-N)*_)/r}}}function Nr(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const Ta=12,it=[];function Ir(e){const t=it.indexOf(e);t!==-1&&it.splice(t,1),it.push(e)}function Aa(e){const t=it.indexOf(e);t!==-1&&it.splice(t,1)}function qt(e){e.parked||(Aa(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),e.surface=null,e.parked=!0)}function Fr(e){for(;it.length>Ta;){const t=it.find(n=>n!==e&&!n.visible)??it.find(n=>n!==e);if(!t)break;qt(t)}}function Gr(e){var o,s,a,u;if(e.disposed)return;if(Nr())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){Ir(e),Fr(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||((s=e.deep)==null?void 0:s.width)||1,r=e.backingHeight||((a=e.source)==null?void 0:a.height)||((u=e.deep)==null?void 0:u.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.deep){const i=t.createTexture(e.deep.width,e.deep.height,"rgba16float");e.srcTexture=i,e.deepBuffers=t.createDeepSampleBuffers(e.deep),t.compositeDeep(e.deepBuffers,i,e.deepZNear,e.deepZFar)}else if(e.source){const i=t.createTexture(e.source.width,e.source.height,e.source.format);i.write(e.source.data),e.srcTexture=i}e.parked=!1,Ir(e),Fr(e)}function Pa(e,t){if(e.disposed||!e.source&&!e.deep)return!0;try{return Gr(e),!e.surface||!e.srcTexture?!1:(_a(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,qt(e),!1}}function Ra(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,e.deep=null,e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},setDeepSource(t,n,r){if(!e.disposed&&(e.deep=t,e.deepZNear=n,e.deepZFar=r,e.source=null,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy(),e.deepBuffers&&e.deepBuffers.destroy();const o=e.device.createTexture(t.width,t.height,"rgba16float");e.srcTexture=o,e.deepBuffers=e.device.createDeepSampleBuffers(t),e.device.compositeDeep(e.deepBuffers,o,n,r)}},setDeepWindow(t,n){e.disposed||(e.deepZNear=t,e.deepZFar=n,!e.parked&&e.deepBuffers&&e.srcTexture&&e.device.compositeDeep(e.deepBuffers,e.srcTexture,t,n))},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return Pa(e,t)},park(){e.disposed||qt(e)},restore(){e.disposed||!e.source&&!e.deep||Gr(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(qt(e),e.source=null,e.deep=null,e.disposed=!0)}}}async function Ca(e,t){const n=await Nt(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,deep:null,deepZNear:-1/0,deepZFar:1/0,deepBuffers:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return Ra(r)}function Ur(e){e.dispose()}function zr({title:e,body:t,className:n}){return f.jsx("div",{className:n??"relative h-full w-full",children:f.jsxs("div",{className:"flex h-full w-full flex-col items-center justify-center gap-1 rounded bg-bg-hover p-4 text-center",children:[f.jsx("div",{className:"text-sm font-semibold text-fg",children:e}),f.jsx("div",{className:"text-xs text-fg-muted",children:t})]})})}function Da(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:s}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...s?["invert(1)"]:[]].join(" ")}function Vr(e){const n=`cairn-gamma-${c.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:s,exposure:a,offset:u,flipSign:i}=e,l=c.useMemo(()=>Da(e,n),[n,r,o,a,i]);return{gammaFilterId:n,filterStr:l,gamma:s,offset:u}}function $r({id:e,gamma:t,offset:n}){return f.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:f.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:f.jsxs("feComponentTransfer",{children:[f.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),f.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),f.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}const ka=["nw","n","ne","e","se","s","sw","w"];function La(e,t,n,r,o,s=1){const a=o.w-1,u=o.h-1,i=Math.round(n),l=Math.round(r);if(t==="move"){const g=e.x1-e.x0,p=e.y1-e.y0,E=ft(e.x0+i,0,a-g),_=ft(e.y0+l,0,u-p);return{x0:E,y0:_,x1:E+g,y1:_+p}}let{x0:d,y0:x,x1:h,y1:b}=e;const y=t==="nw"||t==="w"||t==="sw",w=t==="ne"||t==="e"||t==="se",S=t==="nw"||t==="n"||t==="ne",m=t==="sw"||t==="s"||t==="se";return y&&(d=ft(d+i,0,h-(s-1))),w&&(h=ft(h+i,d+(s-1),a)),S&&(x=ft(x+l,0,b-(s-1))),m&&(b=ft(b+l,x+(s-1),u)),{x0:d,y0:x,x1:h,y1:b}}function Xr(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function Oa({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=Xr(e),s=Xr(t),a=[];for(let g=0;g<=e;g+=o)a.push(g);const u=[];for(let g=0;g<=t;g+=s)u.push(g);const i=1/n,l=8*i,d=-12*i,x=-2*i,h=r==null?void 0:r.current;let b=0,y=0,w=0,S=0;if(h){const g=h.clientWidth,p=h.clientHeight,E=g/e,_=p/t,v=Math.min(E,_);w=e*v,S=t*v,b=(g-w)/2,y=(p-S)/2}const m=h&&w>0;return f.jsxs(f.Fragment,{children:[f.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:m?y:0,transform:`translateY(${d}px)`,fontSize:l},children:a.map(g=>f.jsx("span",{className:"mono",style:{position:"absolute",left:m?b+g/e*w:`${g/e*100}%`,transform:"translateX(-50%)"},children:g},g))}),f.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:m?b:0,transform:`translateX(${x}px)`,fontSize:l},children:u.map(g=>f.jsx("span",{className:"mono",style:{position:"absolute",top:m?y+g/t*S:`${g/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*i}px`},children:g},g))})]})}function Ln({label:e,corner:t="bottom-left",isDraggable:n=!1,grip:r=n,onDragStart:o}){const s=t==="bottom-right"?"bottom-1 right-1":"bottom-1 left-1";return f.jsxs("span",{className:`absolute ${s} z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${n?" cairn-drag-grip":""}`,draggable:n,onDragStart:o,style:{cursor:n?"grab":void 0},children:[r&&f.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const Ba=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function Wr(e,t){const n=getComputedStyle(e),r=Ba.map(i=>`${i}:${n.getPropertyValue(i)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const s=e.children,a=t.children,u=Math.min(s.length,a.length);for(let i=0;i<u;i++)Wr(s[i],a[i])}function On(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function Bn(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function Nn(e,t,n,r,o){const s=document.createElement("canvas");s.width=Math.max(1,Math.round(e*n)),s.height=Math.max(1,Math.round(t*n));const a=s.getContext("2d");if(!a)throw new Error("plot-to-png: 2D canvas context unavailable");return a.scale(n,n),r&&(a.fillStyle=r,a.fillRect(0,0,e,t)),o(a),await new Promise((u,i)=>s.toBlob(l=>l?u(l):i(new Error("plot-to-png: toBlob returned null")),"image/png"))}function Na(e,t,n){const r=e.cloneNode(!0);Wr(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),s="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((a,u)=>{const i=new Image;i.onload=()=>a(i),i.onerror=()=>u(new Error("plot-to-png: SVG rasterization failed")),i.src=s})}async function Hr(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,s=(t==null?void 0:t.background)??On(e);return Nn(r,o,Bn(t),s,a=>a.drawImage(e,0,0,r,o))}async function Ia(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,s=(t==null?void 0:t.background)??On(e);try{return await Nn(r,o,Bn(t),s,a=>a.drawImage(e,0,0,r,o))}catch(a){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${a instanceof Error?a.message:String(a)})`)}}function Fa(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const s=o.getBoundingClientRect(),a=s.width*s.height;a>r&&(r=a,n=o)}return n}async function Ga(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),s=o.width||300,a=o.height||150,u=(t==null?void 0:t.background)??On(e);if(n){const l=n.getBoundingClientRect(),d=await Na(n,l.width||s,l.height||a);return Nn(s,a,Bn(t),u,x=>{for(const h of r){const b=h.getBoundingClientRect();x.drawImage(h,b.left-o.left,b.top-o.top,b.width,b.height)}x.drawImage(d,l.left-o.left,l.top-o.top,l.width,l.height)})}if(r.length)return Hr(r[0],t);const i=Fa(e);if(i)return Ia(i,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function Ua(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const za=8;function Va(e,t,n,r=za){return!(t>0)||!(e>0)?n:e<t+r}function Yr(e,t){return Math.max(0,e.findIndex(n=>n.id===t))}function $a(e){const t=e.trim();if(t==="")return null;const n=t.replace(/−/g,"-").replace(",","."),r=Number(n);return Number.isFinite(r)?r:null}function Xa(e,t){const n=$a(e);return n===null?t:n}function Wa(e){return String(e)}const Ha={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},Ya={boxZoom:f.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:f.jsxs(f.Fragment,{children:[f.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),f.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),f.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),f.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 2v20M2 12h20"}),f.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),f.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),f.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:f.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:f.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),f.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:f.jsx("path",{d:"M6 9l6 6 6-6"}),ellipsis:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"5",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),f.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),f.jsx("circle",{cx:"19",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"})]}),sun:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"12",cy:"12",r:"4"}),f.jsx("path",{d:"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"})]}),plusminus:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M4 7h6M7 4v6"}),f.jsx("path",{d:"M14 17h6"}),f.jsx("path",{d:"M6 20l12-16"})]}),layers:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 3l9 5-9 5-9-5 9-5z"}),f.jsx("path",{d:"M3 13l9 5 9-5"})]})};function Qe({name:e}){return f.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:Ya[e]??null})}function Kr({icon:e,label:t,title:n,active:r,disabled:o,onClick:s}){return f.jsx("button",{type:"button",disabled:o,onClick:a=>{a.stopPropagation(),!o&&s()},onPointerDown:a=>a.stopPropagation(),onDoubleClick:a=>a.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?f.jsx("span",{"aria-hidden":"true",children:t}):f.jsx(Qe,{name:e??""})})}function qr(){return f.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function Zr(e,t,n){const r=c.useRef(n);r.current=n,c.useEffect(()=>{if(!e)return;const o=a=>{t.current&&!t.current.contains(a.target)&&r.current()},s=a=>{a.key==="Escape"&&(a.stopPropagation(),r.current())};return document.addEventListener("pointerdown",o,!0),document.addEventListener("keydown",s,!0),()=>{document.removeEventListener("pointerdown",o,!0),document.removeEventListener("keydown",s,!0)}},[e,t])}function Ka({icon:e,title:t,menu:n}){var S;const{options:r,value:o,onSelect:s}=n,[a,u]=c.useState(!1),[i,l]=c.useState(0),d=c.useRef(null),x=Yr(r,o),h=e?void 0:((S=r[x])==null?void 0:S.label)??"",b=c.useCallback(()=>{u(m=>{const g=!m;return g&&l(x),g})},[x]),y=c.useCallback(m=>{s(m),u(!1)},[s]);Zr(a,d,()=>u(!1));const w=m=>{if(!a){(m.key==="ArrowDown"||m.key==="Enter"||m.key===" ")&&(m.preventDefault(),l(x),u(!0));return}if(m.key==="ArrowDown")m.preventDefault(),l(g=>(g+1)%r.length);else if(m.key==="ArrowUp")m.preventDefault(),l(g=>(g-1+r.length)%r.length);else if(m.key==="Enter"||m.key===" "){m.preventDefault();const g=r[i];g&&y(g.id)}};return f.jsxs("div",{ref:d,className:"relative inline-flex",onPointerDown:m=>m.stopPropagation(),children:[f.jsxs("button",{type:"button",onClick:m=>{m.stopPropagation(),b()},onDoubleClick:m=>m.stopPropagation(),onKeyDown:w,"aria-haspopup":"listbox","aria-expanded":a,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",h?"px-1.5 text-[10px] font-mono":"px-1 text-xs",a?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[h?f.jsx("span",{"aria-hidden":"true",children:h}):f.jsx(Qe,{name:e??""}),f.jsx(Qe,{name:"caret"})]}),a&&f.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((m,g)=>{const p=m.id===o,E=g===i;return f.jsx("li",{role:"option","aria-selected":p,children:f.jsx("button",{type:"button",onClick:_=>{_.stopPropagation(),y(m.id)},onPointerEnter:()=>l(g),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",E?"bg-bg-hover":"",p?"text-accent font-medium":"text-fg"].join(" "),children:m.label})},m.id)})})]})}const qa=e=>e.format?e.format(e.value):String(e.value);function jr({spec:e}){const[t,n]=c.useState(!1),[r,o]=c.useState(""),s=c.useRef(null),a=c.useCallback(()=>{o(Wa(e.value)),n(!0)},[e.value]);c.useEffect(()=>{t&&s.current&&(s.current.focus(),s.current.select())},[t]);const u=c.useCallback(()=>{n(l=>(l&&e.onChange(Xa(r,e.value)),!1))},[r,e]),i=c.useCallback(()=>n(!1),[]);return f.jsxs("label",{className:"inline-flex items-center gap-1 text-fg-muted",title:e.title,onPointerDown:l=>l.stopPropagation(),onDoubleClick:l=>{l.stopPropagation(),t||a()},children:[e.icon?f.jsx("span",{"aria-hidden":"true",className:"inline-flex",children:f.jsx(Qe,{name:e.icon})}):f.jsx("span",{"aria-hidden":"true",className:"text-[9px] font-mono",children:e.label}),t?f.jsx("input",{ref:s,type:"text",inputMode:"decimal","aria-label":`${e.title} (numeric entry)`,value:r,onChange:l=>o(l.target.value),onPointerDown:l=>l.stopPropagation(),onDoubleClick:l=>l.stopPropagation(),onKeyDown:l=>{l.stopPropagation(),l.key==="Enter"?(l.preventDefault(),u()):l.key==="Escape"&&(l.preventDefault(),i())},onBlur:u,className:"cairn-plot-toolbar-slider-entry h-3.5 w-[6.5rem] rounded border border-border bg-bg px-1 text-[9px] font-mono tabular-nums text-fg outline-none focus:border-accent"}):f.jsxs(f.Fragment,{children:[f.jsx("input",{type:"range","aria-label":e.title,min:e.min,max:e.max,step:e.step,value:e.value,onChange:l=>e.onChange(Number(l.target.value)),onPointerDown:l=>l.stopPropagation(),className:"cairn-plot-toolbar-slider h-1 w-16 cursor-pointer accent-accent"}),f.jsx("span",{"aria-hidden":"true",className:"w-8 text-right text-[9px] font-mono tabular-nums",children:qa(e)})]})]})}function Za({icon:e,title:t,menu:n,onClose:r}){var x;const{options:o,value:s,onSelect:a}=n,[u,i]=c.useState(!1),l=Yr(o,s),d=((x=o[l])==null?void 0:x.label)??"";return f.jsxs("div",{children:[f.jsxs("button",{type:"button","aria-haspopup":"menu","aria-expanded":u,"aria-label":t,onClick:h=>{h.stopPropagation(),i(b=>!b)},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",u?"text-accent":"text-fg hover:bg-bg-hover"].join(" "),children:[e?f.jsx(Qe,{name:e}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{className:"flex-1",children:t}),f.jsx("span",{className:"font-mono text-[10px] text-fg-muted",children:d}),f.jsx("span",{className:u?"rotate-180 transition-transform":"transition-transform",children:f.jsx(Qe,{name:"caret"})})]}),u&&o.map(h=>{const b=h.id===s;return f.jsxs("button",{type:"button",role:"menuitemradio","aria-checked":b,"data-menu-option":"",onClick:y=>{y.stopPropagation(),a(h.id),r()},className:["flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-[11px]",b?"text-accent font-medium bg-bg-hover/40":"text-fg hover:bg-bg-hover"].join(" "),children:[f.jsx("span",{"aria-hidden":"true",className:"w-3 text-center text-accent",children:b?"✓":""}),f.jsx("span",{children:h.label})]},h.id)})]})}function ja({actions:e,leading:t,sliders:n}){const[r,o]=c.useState(!1),s=c.useRef(null);return Zr(r,s,()=>o(!1)),f.jsxs("div",{ref:s,className:"relative inline-flex",onPointerDown:a=>a.stopPropagation(),children:[f.jsx("button",{type:"button",onClick:a=>{a.stopPropagation(),o(u=>!u)},onDoubleClick:a=>a.stopPropagation(),"aria-haspopup":"menu","aria-expanded":r,"aria-label":"More controls",title:"More controls",className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded text-xs",r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:f.jsx(Qe,{name:"ellipsis"})}),r&&f.jsxs("div",{role:"menu",className:["absolute right-0 top-full z-40 mt-1 min-w-[10rem] max-h-80 overflow-auto","rounded border border-border bg-bg-elevated py-1 shadow-md"].join(" "),children:[t.map(a=>a.menu?f.jsx(Za,{icon:a.icon,title:a.title,menu:a.menu,onClose:()=>o(!1)},a.id):f.jsxs("button",{type:"button",disabled:a.disabled,onClick:u=>{var i;u.stopPropagation(),!a.disabled&&((i=a.onClick)==null||i.call(a),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",a.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",a.active?"text-accent":""].join(" "),children:[a.icon?f.jsx(Qe,{name:a.icon}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{children:a.label??a.title})]},a.id)),t.length>0&&e.length>0&&f.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),e.map(a=>f.jsxs("button",{type:"button",role:"menuitem",disabled:a.disabled,onClick:u=>{u.stopPropagation(),!a.disabled&&(a.onClick(),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",a.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",a.active?"text-accent":""].join(" "),children:[a.icon?f.jsx(Qe,{name:a.icon}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{children:a.title})]},a.id)),n.length>0&&(e.length>0||t.length>0)&&f.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),n.map(a=>f.jsx("div",{className:"px-2 py-1",children:f.jsx(jr,{spec:a})},a.id))]})]})}function Qa({controller:e,config:t}){var P,O;const n=c.useRef(null),[r,o]=c.useState(!1),s=c.useRef(r);s.current=r;const a=c.useRef(0),u=`${((P=t==null?void 0:t.leadingButtons)==null?void 0:P.length)??0}:${((O=t==null?void 0:t.sliders)==null?void 0:O.length)??0}:${(t==null?void 0:t.visibility)??"hover"}`;if(c.useEffect(()=>{const R=n.current,B=R==null?void 0:R.parentElement;if(!B)return;const N=()=>{const I=B.clientWidth;if(!s.current&&n.current){const J=n.current.scrollWidth;J>0&&(a.current=J)}o(Va(I,a.current,s.current))};let $=0;const Q=()=>{$||($=requestAnimationFrame(()=>{$=0,N()}))},V=new ResizeObserver(Q);return V.observe(B),N(),()=>{V.disconnect(),$&&cancelAnimationFrame($)}},[u]),(t==null?void 0:t.enabled)===!1)return null;const i=e.capabilities,l=t==null?void 0:t.buttons,d=(R,B)=>B&&(l==null?void 0:l[R])!==!1,x=R=>()=>e.setDragMode(R),h=()=>{e.toPNG({filename:"plot"}).then(R=>Ua(R,"plot.png")).catch(()=>{})},b=[];d("zoom",i.zoom)&&b.push({id:"zoom",icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:x("zoom")}),d("pan",i.pan)&&b.push({id:"pan",icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:x("pan")}),d("select",i.select)&&b.push({id:"select",icon:"select",title:"Box select",active:e.dragMode==="select",onClick:x("select")}),d("lasso",i.lasso)&&b.push({id:"lasso",icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:x("lasso")});const y=[];d("zoomIn",i.zoom)&&y.push({id:"zoomIn",icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),d("zoomOut",i.zoom)&&y.push({id:"zoomOut",icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()});const w=[];d("autoscale",i.autoscale)&&w.push({id:"autoscale",icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),d("reset",i.reset)&&w.push({id:"reset",icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()});const S=[];d("screenshot",i.screenshot)&&S.push({id:"screenshot",icon:"camera",title:"Download plot as PNG",onClick:h});const m=[b,y,w,S].filter(R=>R.length>0),g=m.flat(),p=(t==null?void 0:t.leadingButtons)??[],E=(t==null?void 0:t.sliders)??[];if(!p.length&&g.length===0&&E.length===0)return null;const _=(t==null?void 0:t.position)??"top-right",v=(t==null?void 0:t.visibility)==="always",C=_==="top-right"||_==="bottom-right",M=["cairn-plot-toolbar z-30 rounded border border-border bg-bg-elevated/90 shadow-sm backdrop-blur-sm transition-opacity",v?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),A={position:"absolute",pointerEvents:"auto",...Ha[_]};return r?f.jsx("div",{ref:n,style:A,className:`${M} inline-flex px-0.5 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:f.jsx(ja,{actions:g,leading:p,sliders:E})}):f.jsxs("div",{ref:n,style:A,className:`${M} flex flex-col gap-0.5 px-1 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:[f.jsxs("div",{className:`flex items-center gap-0.5 ${C?"justify-end":"justify-start"}`,children:[p.length>0&&f.jsxs(f.Fragment,{children:[p.map(R=>R.menu?f.jsx(Ka,{icon:R.icon,title:R.title,menu:R.menu},R.id):f.jsx(Kr,{icon:R.icon,label:R.label,title:R.title,active:R.active,disabled:R.disabled,onClick:R.onClick??(()=>{})},R.id)),m.length>0&&f.jsx(qr,{})]}),m.map((R,B)=>f.jsxs("span",{className:"inline-flex items-center gap-0.5",children:[B>0&&f.jsx(qr,{}),R.map(N=>f.jsx(Kr,{icon:N.icon,title:N.title,active:N.active,disabled:N.disabled,onClick:N.onClick},N.id))]},R[0].id))]}),E.length>0&&f.jsx("div",{className:`flex items-center gap-2 ${C?"justify-end":"justify-start"}`,children:E.map(R=>f.jsx(jr,{spec:R},R.id))})]})}const Ja={zoom:1,pan:{x:0,y:0}},Qr=1.3,ei=.25,ti=64,ni={buttons:{zoom:!1}};function ri(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const oi=[{id:"none",label:"None"},...ys];function Dt(e,t){return{id:"colormap",title:"Colormap",menu:{options:oi,value:e,onSelect:t}}}const In={linear:"Linear",srgb:"sRGB",gamma:"Gamma",reinhard:"Reinhard",aces:"ACES",extended:"Extended · Linear","extended-clamp":"Extended · Linear (managed)","extended-reinhard":"Extended · Reinhard","extended-aces":"Extended · ACES"},Jr=ar.map(e=>({id:e,label:In[e]})),si=ir.map(e=>({id:e,label:In[e]}));function eo(e,t,n){return{id:"tonemap",title:"Tone-mapping operator",menu:{options:n?[...Jr,...si]:Jr,value:e,onSelect:t}}}const ai=Ts.map(e=>({id:e,label:In[e]}));function to(e,t){return{id:"tonemap",title:"Display transfer (sRGB · Gamma · Linear)",menu:{options:ai,value:e,onSelect:t}}}function ii({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:s,naturalHeight:a,minZoom:u=ei,maxZoom:i=ti,requestRender:l,onReset:d,extraModified:x=!1}){const h=c.useCallback(v=>{var $;if(!o)return;const C=($=e.current)==null?void 0:$.getBoundingClientRect(),T=(C==null?void 0:C.width)??0,M=(C==null?void 0:C.height)??0,A=s&&a&&T>0&&M>0?Tn(s,a,T,M):i,P=Math.max(u,Math.min(A,n*v));if(P===n)return;const O=T/2,R=M/2,B=O-(O-r.x)/n*P,N=R-(R-r.y)/n*P;o({zoom:P,pan:{x:B,y:N}})},[o,e,s,a,i,u,n,r.x,r.y]),b=c.useCallback(()=>h(Qr),[h]),y=c.useCallback(()=>h(1/Qr),[h]),w=c.useCallback(()=>{o==null||o(Ja),d==null||d()},[o,d]),S=c.useCallback(v=>{const C={scale:v==null?void 0:v.scale,filename:v==null?void 0:v.filename};l==null||l();const T=t==null?void 0:t.current;if(T)return Hr(T,C);const M=e.current;return M?Ga(M,C):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,l]),m=c.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),g=n!==1||r.x!==0||r.y!==0||x,p=c.useCallback(v=>{},[]),E=c.useCallback(v=>{},[]),_=c.useCallback(()=>{},[]);return c.useMemo(()=>({capabilities:m,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:g,setDragMode:p,setHoverMode:E,toggleSpikelines:_,zoomIn:b,zoomOut:y,autoscale:w,reset:w,toPNG:S}),[m,g,p,E,_,b,y,w,S])}const ci={zoom:1,pan:{x:0,y:0}};function Zt({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:s,pan:a,onViewportChange:u,naturalDims:i,checkerboard:l,wrapperClassName:d,wrapperStyle:x,viewportPadding:h,header:b,surface:y,showAxes:w,overlayNode:S,overlay:m,notationSeed:g,exportCanvasRef:p,requestRender:E,leadingMenus:_,displayAdjust:v,depthSliders:C,extraSliders:T,regionSelect:M,onReset:A,extraModified:P,label:O,showLabelChip:R,isDraggable:B=!1,onDragStart:N,extraChips:$}){const[Q,V]=c.useState(g),[I,J]=c.useState(!1),[X,_e]=c.useState(!1),ae="render"in m?null:m,ge=!!M&&!!ae,{containerProps:z}=Er({containerRef:r,zoom:s,pan:a,onViewportChange:u,naturalWidth:i==null?void 0:i.w,naturalHeight:i==null?void 0:i.h}),K=c.useCallback(()=>{v==null||v.onExposureChange(0),v==null||v.onOffsetChange(0),A==null||A()},[v,A]),re=c.useCallback(()=>{u==null||u(ci),K()},[u,K]),ee=ii({rootRef:r,canvasRef:p,zoom:s,pan:a,onViewportChange:u,naturalWidth:i==null?void 0:i.w,naturalHeight:i==null?void 0:i.h,requestRender:E,onReset:K,extraModified:((v==null?void 0:v.exposureEV)??0)!==0||((v==null?void 0:v.offset)??0)!==0||!!P}),ie=c.useMemo(()=>{const be=[];if(C&&be.push(...C),!v)return T&&be.push(...T),be.length?be:void 0;const ve=(pe,Te)=>`${pe>=0?"+":"−"}${Math.abs(pe).toFixed(Te)}`;return be.push({id:"exposure",icon:"sun",label:"EV",title:"Exposure (EV stops) — color × 2^EV. Double-click to type a value (may exceed the slider range).",min:-8,max:8,step:.1,value:v.exposureEV,onChange:v.onExposureChange,format:pe=>ve(pe,1)},{id:"offset",icon:"plusminus",label:"OFF",title:"Offset — added after exposure (before tonemap). Double-click to type a value (may exceed the slider range).",min:-1,max:1,step:.01,value:v.offset,onChange:v.onOffsetChange,format:pe=>ve(pe,2)}),T&&be.push(...T),be},[v,C,T]),Y=c.useMemo(()=>ge?{id:"region-depth",icon:"select",title:"Select depth from region — drag a rectangle to set the Z window to the samples it covers (Esc to cancel)",active:X,onClick:()=>_e(be=>!be)}:null,[ge,X]),oe=c.useMemo(()=>({...ni,leadingButtons:[..._??[],...Y?[Y]:[],...I?[ri(Q,V)]:[]],sliders:ie}),[I,Q,_,Y,ie]),xe=" cairn-checkerboard",Ee="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(l==="pane"?xe:""),q=d+(l==="wrapper"?xe:""),Se="render"in m?m.render({notation:Q,setOverlayActive:J}):m.hasSource&&i?f.jsx(ht,{imageElRef:m.displayElRef,naturalWidth:i.w,naturalHeight:i.h,zoom:s,pan:a,sourceWindow:m.sourceWindow,sample:m.sample,notation:Q,version:m.version,onActiveChange:J}):null;return f.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[b,n&&f.jsx(Qa,{controller:ee,config:oe}),f.jsxs("div",{ref:r,className:Ee,style:{padding:h,...z.style},onPointerDown:z.onPointerDown,onPointerMove:z.onPointerMove,onPointerUp:z.onPointerUp,onPointerCancel:z.onPointerCancel,onDoubleClick:re,...t,children:[f.jsxs("div",{ref:o,className:q,style:x,children:[y,w&&i&&f.jsx(Oa,{naturalWidth:i.w,naturalHeight:i.h,zoom:s,containerRef:o}),S]}),Se,!n&&I&&f.jsx(Ar,{notation:Q,onChange:V}),X&&M&&ae&&i&&f.jsx(li,{imageElRef:ae.displayElRef,naturalDims:i,sourceWindow:ae.sourceWindow,onQueryLive:M.queryLive,onSelect:(be,ve,pe,Te)=>{_e(!1),M.commit(be,ve,pe,Te)},onExit:()=>_e(!1)}),!X&&(M==null?void 0:M.rect)&&ae&&i&&f.jsx(fi,{rect:M.rect,imageElRef:ae.displayElRef,naturalDims:i,sourceWindow:ae.sourceWindow,zoom:s,pan:a,onQueryLive:M.queryLive,onCommit:M.commit,onRemove:M.remove})]}),R&&f.jsx(Ln,{label:O,isDraggable:B,onDragStart:N}),$]})}function li({imageElRef:e,naturalDims:t,sourceWindow:n,onQueryLive:r,onSelect:o,onExit:s}){var S;const a=c.useRef(null),u=c.useRef(null),[i,l]=c.useState(null),d=c.useCallback((m,g,p,E)=>{const _=e.current;return _?Tr(m,g,p,E,{box:_.getBoundingClientRect(),naturalWidth:t.w,naturalHeight:t.h,sourceWindow:n}):null},[e,t,n]);c.useEffect(()=>{const m=g=>{g.key==="Escape"&&s()};return window.addEventListener("keydown",m),()=>window.removeEventListener("keydown",m)},[s]);const x=c.useCallback(m=>{var g,p;(p=(g=m.target).setPointerCapture)==null||p.call(g,m.pointerId),u.current={x:m.clientX,y:m.clientY},l({x0:m.clientX,y0:m.clientY,x1:m.clientX,y1:m.clientY})},[]),h=c.useCallback(m=>{const g=u.current;if(!g)return;l({x0:g.x,y0:g.y,x1:m.clientX,y1:m.clientY});const p=d(g.x,g.y,m.clientX,m.clientY);p&&r(p.x0,p.y0,p.x1,p.y1)},[d,r]),b=c.useCallback(m=>{const g=u.current;u.current=null,l(null);const p=e.current;if(!g||!p){s();return}if(Math.abs(m.clientX-g.x)<3&&Math.abs(m.clientY-g.y)<3){s();return}const E=p.getBoundingClientRect(),_=Tr(g.x,g.y,m.clientX,m.clientY,{box:E,naturalWidth:t.w,naturalHeight:t.h,sourceWindow:n});if(!_){s();return}o(_.x0,_.y0,_.x1,_.y1)},[e,t,n,o,s]),y=(S=a.current)==null?void 0:S.getBoundingClientRect(),w=i&&y?{left:Math.min(i.x0,i.x1)-y.left,top:Math.min(i.y0,i.y1)-y.top,width:Math.abs(i.x1-i.x0),height:Math.abs(i.y1-i.y0)}:null;return f.jsx("div",{ref:a,className:"absolute inset-0 z-20",style:{cursor:"crosshair",touchAction:"none"},onPointerDown:x,onPointerMove:h,onPointerUp:b,children:w&&f.jsx("div",{className:"absolute border-2 border-dashed border-sky-400 bg-sky-400/15 pointer-events-none",style:w})})}const ui={nw:{cursor:"nwse-resize",fx:0,fy:0},n:{cursor:"ns-resize",fx:.5,fy:0},ne:{cursor:"nesw-resize",fx:1,fy:0},e:{cursor:"ew-resize",fx:1,fy:.5},se:{cursor:"nwse-resize",fx:1,fy:1},s:{cursor:"ns-resize",fx:.5,fy:1},sw:{cursor:"nesw-resize",fx:0,fy:1},w:{cursor:"ew-resize",fx:0,fy:.5}};function fi({rect:e,imageElRef:t,naturalDims:n,sourceWindow:r,zoom:o,pan:s,onQueryLive:a,onCommit:u,onRemove:i}){const l=c.useRef(null),[d,x]=c.useState(null),h=c.useRef(null),[b,y]=c.useState(null),w=d??e;c.useLayoutEffect(()=>{const p=()=>{const v=t.current,C=l.current;if(!v||!C)return;const T=v.getBoundingClientRect(),M=C.getBoundingClientRect(),A=ma(w,{box:T,naturalWidth:n.w,naturalHeight:n.h,sourceWindow:r});y({left:A.left-M.left,top:A.top-M.top,width:A.width,height:A.height})};p();const E=t.current;if(!E||typeof ResizeObserver>"u")return;const _=new ResizeObserver(p);return _.observe(E),()=>_.disconnect()},[w,n.w,n.h,r,o,s.x,s.y]);const S=c.useCallback(p=>E=>{var _,v;E.stopPropagation(),(v=(_=E.target).setPointerCapture)==null||v.call(_,E.pointerId),h.current={handle:p,sx:E.clientX,sy:E.clientY,start:w},x(w)},[w]),m=c.useCallback(p=>{const E=h.current,_=t.current;if(!E||!_)return;const v=ha({box:_.getBoundingClientRect(),naturalWidth:n.w,naturalHeight:n.h,sourceWindow:r}),C=(p.clientX-E.sx)/(v||1),T=(p.clientY-E.sy)/(v||1),M=La(E.start,E.handle,C,T,{w:n.w,h:n.h},1);x(M),a(M.x0,M.y0,M.x1,M.y1)},[t,n.w,n.h,r,a]),g=c.useCallback(()=>{const p=h.current;h.current=null;const E=d;x(null),p&&E&&u(E.x0,E.y0,E.x1,E.y1)},[d,u]);return b?f.jsxs("div",{ref:l,className:"absolute inset-0 z-20 pointer-events-none",style:{touchAction:"none"},children:[f.jsx("div",{className:"absolute border-2 border-sky-400 bg-sky-400/10 pointer-events-auto",style:{...b,cursor:"move",touchAction:"none"},onPointerDown:S("move"),onPointerMove:m,onPointerUp:g}),ka.map(p=>{const E=ui[p];return f.jsx("div",{className:"absolute pointer-events-auto flex items-center justify-center",style:{left:b.left+E.fx*b.width-12,top:b.top+E.fy*b.height-12,width:24,height:24,cursor:E.cursor,touchAction:"none"},onPointerDown:S(p),onPointerMove:m,onPointerUp:g,children:f.jsx("div",{className:"w-2.5 h-2.5 rounded-sm bg-sky-400 border border-white/80"})},p)}),f.jsx("button",{type:"button","aria-label":"Remove depth region",title:"Remove region (reset the depth window)",className:"absolute pointer-events-auto flex items-center justify-center rounded-full text-white",style:{left:b.left+b.width-8,top:b.top-32,width:40,height:40},onPointerDown:p=>p.stopPropagation(),onClick:i,children:f.jsx("span",{className:"flex items-center justify-center w-5 h-5 rounded-full bg-slate-800/90 border border-white/70 text-[11px] leading-none",children:"×"})})]}):f.jsx("div",{ref:l,className:"absolute inset-0 z-20 pointer-events-none"})}const Fn={inFlight:!1,pending:null};function no(e,t){return e.inFlight?{state:{inFlight:!0,pending:t},launch:null}:{state:{inFlight:!0,pending:null},launch:t}}function ro(e){return e.pending!=null?{state:{inFlight:!0,pending:null},launch:e.pending}:{state:Fn,launch:null}}const di=1e3,pi=typeof requestAnimationFrame=="function"?e=>requestAnimationFrame(()=>e()):e=>setTimeout(e,0),oo=typeof cancelAnimationFrame=="function"?cancelAnimationFrame:e=>clearTimeout(e);function so(e,t){const n=e.deep,r=(n==null?void 0:n.zMin)??0,o=(n==null?void 0:n.zMax)??0,s=t!=null,[a,u,i]=Ne(r),[l,d,x]=Ne(o),[h,b]=c.useState(null),[y,w]=c.useState(null),S=c.useRef(n);S.current=n;const m=c.useRef(r);m.current=r;const g=c.useRef(o);g.current=o;const p=c.useRef(a);p.current=a;const E=c.useRef(l);E.current=l;const _=c.useRef({near:a,far:l,ver:0}),v=c.useRef(0),C=c.useRef(!0),T=c.useRef(Fn),M=c.useRef(null),A=u,P=d,O=c.useCallback(()=>{const z=S.current;if(!z)return;const{near:K,far:re,ver:ee}=_.current,ie=()=>{const Y=ro(T.current);T.current=Y.state,Y.launch!=null&&O()};z.flatten(K,re).then(Y=>{_.current.ver===ee&&!C.current&&(M.current!=null&&oo(M.current),M.current=pi(()=>{M.current=null,b(Y)})),ie()}).catch(ie)},[]),R=c.useCallback(()=>{const z=no(T.current,1);T.current=z.state,z.launch!=null&&O()},[O]);c.useEffect(()=>()=>{M.current!=null&&oo(M.current),n==null||n.dispose()},[n]),c.useEffect(()=>{if(!n)return;const z=a<=r&&l>=o;if(C.current=z,v.current+=1,_.current={near:a,far:l,ver:v.current},s){t(a,l);return}if(z){b(null);return}R()},[n,a,l,r,o,R,s,t]);const B=c.useMemo(()=>n&&!s&&h!=null?{...e,data:h}:e,[e,n,s,h]),N=n!=null&&r>0&&o/r>di,$=c.useMemo(()=>{if(!n||!(o>r))return;const z=re=>Math.abs(re)>=1e3||Math.abs(re)<.01&&re!==0?re.toExponential(2):re.toFixed(3),K=(re,ee,ie,Y,oe)=>{if(N){const xe=Math.log10(r),Ee=Math.log10(o);return{id:re,icon:"layers",label:ee,title:`${ie} (log scale). Double-click to type a Z.`,min:xe,max:Ee,step:(Ee-xe)/200,value:Math.log10(Math.max(r,Math.min(Y,o))),onChange:q=>oe(10**q),format:q=>z(10**q)}}return{id:re,icon:"layers",label:ee,title:`${ie}. Double-click to type a Z.`,min:r,max:o,step:(o-r)/200,value:Y,onChange:oe,format:z}};return[K("depth-near","ZN","Depth window NEAR — composite only samples with Z ≥ this",a,A),K("depth-far","ZF","Depth window FAR — composite only samples with Z ≤ this",l,P)]},[n,r,o,a,l,N,A,P]),Q=c.useCallback(z=>{if(z.count===0){const ee=m.current,ie=g.current,Y=ie>ee?0:1;u(ie+Y),d(ee-Y);return}const K=g.current-m.current,re=Math.max(Math.abs(K)*1e-4,1e-4);u(z.zMin-re),d(z.zMax+re)},[u,d]),V=c.useRef(null),I=c.useRef(Fn),J=c.useCallback(()=>{const z=S.current,K=V.current,re=()=>{const ee=ro(I.current);I.current=ee.state,ee.launch!=null&&J()};if(!z||!K){re();return}z.zRangeInRect(K.x0,K.y0,K.x1,K.y1).then(ee=>{Q(ee),re()}).catch(re)},[Q]),X=c.useCallback((z,K,re,ee)=>{V.current={x0:z,y0:K,x1:re,y1:ee};const ie=no(I.current,1);I.current=ie.state,ie.launch!=null&&J()},[J]),_e=c.useCallback((z,K,re,ee)=>{w({x0:z,y0:K,x1:re,y1:ee}),X(z,K,re,ee)},[X]),ae=c.useCallback(()=>{w(null),i.reset(),x.reset(),b(null)},[i,x]),ge=c.useCallback(()=>{i.reset(),x.reset(),w(null),b(null)},[i,x]);return{hdr:B,sliders:$,hasDeep:n!=null,region:y,queryRegionWindow:X,commitRegion:_e,removeRegion:ae,reset:ge,isModified:i.isModified||x.isModified}}function ao(e){return"hdr"in e&&e.hdr!=null}function io(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function De(e){return Number.isFinite(e)?e:0}const hi={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function mi(e,t,n,r,o=0){const{h:s,w:a,c:u}=io(e.shape),i=e.precision==="f16-bits"?mr(e.data):e.data,l=Rs(t),d=new Uint8ClampedArray(a*s*4);for(let x=0;x<a*s;x++){const h=x*u;let b,y,w,S=1;u===1?b=y=w=De(i[h]):u===3?(b=De(i[h]),y=De(i[h+1]),w=De(i[h+2])):(b=De(i[h]),y=De(i[h+1]),w=De(i[h+2]),S=De(i[h+3]));const m=[Ft(b,n,o),Ft(y,n,o),Ft(w,n,o)],[g,p,E]=l(m),_=x*4;d[_]=255*vt(g,r),d[_+1]=255*vt(p,r),d[_+2]=255*vt(E,r),d[_+3]=255*(S<0?0:S>1?1:S)}return new ImageData(d,a,s)}function gi(e,t,n){const r=Ut(t,n??Tt),o=new Uint8ClampedArray(e.data.length),s=e.data;for(let a=0;a<s.length;a+=4)o[a]=255*vt(gn(s[a]/255),r),o[a+1]=255*vt(gn(s[a+1]/255),r),o[a+2]=255*vt(gn(s[a+2]/255),r),o[a+3]=s[a+3];return new ImageData(o,e.width,e.height)}function xi(e){var bt,rt;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:s="auto",colormap:a="none",tonemap:u,gamma:i,showAxes:l=!1,processing:d=hi,zoom:x=1,pan:h={x:0,y:0},onViewportChange:b,onNaturalSize:y,label:w,isDraggable:S=!1,onDragStart:m,overlay:g,overlaySettings:p,pixelValueNotation:E="decimal",toolbar:_=!0}=e,[v,C,T]=Ne(a);c.useEffect(()=>{C(a)},[a,C]);const M=(()=>{const F=St(u);return F==="gamma"||F==="linear"?F:"srgb"})(),[A,P,O]=Ne(M);c.useEffect(()=>{P(M)},[u]);const[R,B,N]=Ne(i&&i>0?i:Tt);c.useEffect(()=>{i&&i>0&&B(i)},[i,B]);const $=c.useRef(null),Q=c.useRef(null),V=c.useRef(null),[I,J]=c.useState(!1),X=c.useRef(null),_e=c.useRef(null),ae=c.useRef(null),ge=c.useRef(null),z=c.useRef(null),[K,re]=c.useState(0),ee=c.useCallback(()=>re(F=>F+1),[]),ie=c.useMemo(()=>({get current(){const F=ae.current;return F instanceof HTMLCanvasElement?F:null}}),[]),Y=c.useCallback(F=>{$.current=F,F&&(ae.current=F)},[]),oe=c.useCallback(F=>{Q.current=F,F&&(ae.current=F)},[]),xe=c.useCallback(F=>{V.current=F,F&&(ae.current=F)},[]),Ee=c.useCallback(F=>{F&&(ae.current=F)},[]),[q,Se]=c.useState(!1),[be,ve]=c.useState(!1),[pe,Te]=c.useState(!1),[Pe,Ge]=c.useState(null),{flipSign:Re}=d,{gammaFilterId:We,filterStr:gt,gamma:Je,offset:Ve}=Vr(d),Ue=!r&&o!=="none"&&n!=null&&t!=null,Et=o!=="none"&&n!=null,Ze=v!=="none"&&!Ue&&!(r&&Et)&&t!=null;c.useEffect(()=>{if(!Ze||!t){Te(!1);return}let F=!1;Te(!1);const te=`${t}::${v}`,D=En(te);if(D){const U=Q.current;if(U){U.width=D.width,U.height=D.height;const k=U.getContext("2d");k&&k.putImageData(D,0,0),z.current=D,ee(),Ge({w:D.width,h:D.height}),y==null||y(D.width,D.height),Te(!0)}return}const G=new Image;return G.onload=()=>{if(F)return;const U=document.createElement("canvas");U.width=G.naturalWidth,U.height=G.naturalHeight;const k=U.getContext("2d");if(!k)return;k.drawImage(G,0,0);const ne=k.getImageData(0,0,U.width,U.height),W=yn(v),ue=wn(ne,v,W);_n(te,ue);const ce=Q.current;if(!ce||F)return;ce.width=ue.width,ce.height=ue.height;const we=ce.getContext("2d");we&&we.putImageData(ue,0,0),z.current=ue,ee(),Ge({w:ue.width,h:ue.height}),y==null||y(ue.width,ue.height),Te(!0)},G.src=t,()=>{F=!0}},[Ze,t,v]);const et=t!=null&&!Ue&&!Ze&&A!=="srgb";c.useEffect(()=>{if(!et||!t){J(!1);return}let F=!1;return J(!1),st(t).then(te=>{if(F||!te)return;const D=gi(te,A,R),G=V.current;if(!G)return;G.width=D.width,G.height=D.height;const U=G.getContext("2d");U&&U.putImageData(D,0,0),z.current=D,ee(),Ge({w:D.width,h:D.height}),y==null||y(D.width,D.height),J(!0)}),()=>{F=!0}},[et,t,A,R]);const tt=c.useCallback((F,te)=>{Ge(D=>D&&D.w===F&&D.h===te?D:{w:F,h:te}),y==null||y(F,te)},[]);c.useEffect(()=>{if(!t){ge.current=null,z.current=null,ee();return}let F=!1;return st(t).then(te=>{F||(ge.current=te,v==="none"&&(z.current=te),ee())}),()=>{F=!0}},[t,v,ee]);const xt=c.useCallback((F,te,D)=>{const G=ge.current;if(!G||F<0||te<0||F>=G.width||te>=G.height)return null;const U=(te*G.width+F)*4,k=G.data[U],ne=G.data[U+1],W=G.data[U+2],ue=z.current;let ce=k,we=ne,le=W;if(ue&&ue.width===G.width&&ue.height===G.height){const Fe=(te*ue.width+F)*4;ce=ue.data[Fe],we=ue.data[Fe+1],le=ue.data[Fe+2]}const ke=At(ce,we,le);return pt(v!=="none"||k===ne&&ne===W?[k]:[k,ne,W],"uint8",D,ke)},[v]);c.useEffect(()=>{if(ve(!1),!Ue){Se(!1);return}let F=!1;const te=Xs(),D=te==="gpu"||te==="auto",G=`${n}::${t}::${o}::${v}`;if(te!=="gpu"){const U=En(G);if(U){const k=$.current;if(k){(k.width!==U.width||k.height!==U.height)&&(k.width=U.width,k.height=U.height);const ne=k.getContext("2d");ne&&ne.putImageData(U,0,0),tt(U.width,U.height),Se(!0)}return}}return(async()=>{const[U,k]=await Promise.all([st(n),st(t)]);if(F||!U||!k)return;const W=o.includes("signed")?"signed":"positive",ue=v!=="none"?pn(v):null,ce={diffMode:o,colormap:ue,cmapMode:W};if(D)try{const Ce=$.current;if(Ce){const Fe=Vs(U,k,ce,Ce);if(Fe){if(F)return;tt(Fe.width,Fe.height),Se(!0);return}}}catch(Ce){console.warn("[cairn] WebGL 2 diff error:",Ce)}if(te==="gpu"){F||ve(!0);return}let we=Bs(U,k,o);v!=="none"&&(we=wn(we,v,W)),_n(G,we);const le=$.current;if(!le||F)return;(le.width!==we.width||le.height!==we.height)&&(le.width=we.width,le.height=we.height);const ke=le.getContext("2d");ke&&ke.putImageData(we,0,0),tt(we.width,we.height),Se(!0)})(),()=>{F=!0}},[n,t,o,Ue,v,y]);const $e=s==="auto"?void 0:s,Ie=Re?{filter:"invert(1)"}:{},nt=g&&(p!=null&&p.enabled)&&Pe&&t&&((((bt=g.boxes)==null?void 0:bt.length)??0)>0||(((rt=g.masks)==null?void 0:rt.length)??0)>0)?f.jsx(Pn,{data:g,settings:p,naturalWidth:Pe.w,naturalHeight:Pe.h}):void 0,Ot=t?Ue&&be?f.jsx(zr,{title:"WebGL 2 unavailable",body:"GPU render mode needs WebGL 2 here — switch render mode to Auto or CPU."}):Ue?f.jsxs(f.Fragment,{children:[!q&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),f.jsx("canvas",{ref:Y,className:"w-full h-full object-contain block",style:{display:q?"block":"none",imageRendering:$e,...Ie}})]}):Ze?f.jsxs(f.Fragment,{children:[!pe&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),f.jsx("canvas",{ref:oe,className:"w-full h-full object-contain block",style:{display:pe?"block":"none",imageRendering:$e,...Ie}})]}):et?f.jsxs(f.Fragment,{children:[!I&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying transfer..."}),f.jsx("canvas",{ref:xe,className:"w-full h-full object-contain block",style:{display:I?"block":"none",imageRendering:$e,...Ie}})]}):f.jsx("img",{ref:Ee,src:t,alt:w,className:"w-full h-full object-contain block",draggable:!1,style:{filter:gt,imageRendering:$e},onLoad:F=>{const te=F.currentTarget;Ge({w:te.naturalWidth,h:te.naturalHeight}),y==null||y(te.naturalWidth,te.naturalHeight)}}):f.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return f.jsx(Zt,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:_,paneRef:X,wrapperRef:_e,zoom:x,pan:h,onViewportChange:b,naturalDims:Pe,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${h.x}px, ${h.y}px) scale(${x})`,transformOrigin:"0 0"},viewportPadding:l&&Pe?"16px 4px 4px 28px":"4px",header:f.jsx($r,{id:We,gamma:Je,offset:Ve}),surface:Ot,showAxes:l,overlayNode:nt,overlay:{displayElRef:ae,sample:xt,version:K,hasSource:!!t},notationSeed:E,exportCanvasRef:ie,leadingMenus:v==="none"?[Dt(v,F=>C(F)),to(A,F=>P(F))]:[Dt(v,F=>C(F))],extraSliders:v==="none"&&Gt(A)?[{id:"gamma",label:"γ",title:"Display gamma γ for the Gamma transfer — display = clamp(value)^(1/γ), tev-style. Default 2.2 (close to sRGB, not identical). Double-click to type a value.",min:xn,max:bn,step:vn,value:R,onChange:B,format:F=>F.toFixed(1)}]:void 0,onReset:()=>{T.reset(),O.reset(),N.reset()},extraModified:T.isModified||O.isModified||N.isModified,label:w,showLabelChip:!!w,isDraggable:S,onDragStart:m})}function bi(e){const{tonemap:t="srgb",exposure:n=0,gamma:r,showAxes:o=!1,label:s="",interpolation:a="auto",zoom:u=1,pan:i={x:0,y:0},onViewportChange:l,pixelValueNotation:d="decimal",toolbar:x=!0}=e,h=so(e.hdr),b=h.hdr,[y,w,S]=Ne(St(t));c.useEffect(()=>{w(St(t))},[t,w]);const[m,g,p]=Ne(r&&r>0?r:Tt);c.useEffect(()=>{r&&r>0&&g(r)},[r,g]);const E=c.useRef(null),_=c.useRef(null),v=c.useRef(null),[C,T]=c.useState(null),M=c.useRef(null),[A,P]=c.useState(0),[O,R]=c.useState(0),[B,N]=c.useState(0);c.useEffect(()=>{const V=E.current;if(!V)return;let I;try{I=mi(b,y,n+O,Ut(y,m),B)}catch(X){console.error("[cairn] HDR tone-map error:",X);return}(V.width!==I.width||V.height!==I.height)&&(V.width=I.width,V.height=I.height);const J=V.getContext("2d");J&&(J.putImageData(I,0,0),M.current=I,P(X=>X+1),T(X=>X&&X.w===I.width&&X.h===I.height?X:{w:I.width,h:I.height}))},[b,y,n,m,O,B]);const $=c.useCallback((V,I,J)=>{const X=C;if(!X||V<0||I<0||V>=X.w||I>=X.h)return null;const _e=b.shape.length===2?1:b.shape[2]??1,ae=(I*X.w+V)*_e,ge=b.data,z=b.precision==="f16-bits"?ie=>$t(ge[ie]??0):ie=>ge[ie]??0,K=M.current;let re=.5;if(K&&K.width===X.w&&K.height===X.h){const ie=(I*X.w+V)*4;re=At(K.data[ie],K.data[ie+1],K.data[ie+2])}const ee=_e===1?[z(ae)]:[z(ae),z(ae+1),z(ae+2)];return pt(ee,"unit",J,re)},[b,C]),Q=a==="auto"?void 0:a;return f.jsx(Zt,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:x,paneRef:_,wrapperRef:v,zoom:u,pan:i,onViewportChange:l,naturalDims:C,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${i.x}px, ${i.y}px) scale(${u})`,transformOrigin:"0 0"},viewportPadding:o&&C?"16px 4px 4px 28px":"4px",surface:f.jsx("canvas",{ref:E,className:"w-full h-full object-contain block",style:{imageRendering:Q}}),showAxes:o,overlay:{displayElRef:E,sample:$,version:A,hasSource:!0},notationSeed:d,exportCanvasRef:E,leadingMenus:[eo(y,V=>w(V),!1)],displayAdjust:{exposureEV:O,offset:B,onExposureChange:R,onOffsetChange:N},extraSliders:Gt(y)?[{id:"gamma",label:"γ",title:"Display gamma γ for the Gamma transfer — display = clamp(value)^(1/γ), tev-style. Default 2.2 (close to sRGB, not identical). Double-click to type a value.",min:xn,max:bn,step:vn,value:m,onChange:g,format:V=>V.toFixed(1)}]:void 0,depthSliders:h.sliders,regionSelect:h.hasDeep?{rect:h.region,queryLive:h.queryRegionWindow,commit:h.commitRegion,remove:h.removeRegion}:void 0,onReset:()=>{h.reset(),S.reset(),p.reset()},extraModified:h.isModified||S.isModified||p.isModified,label:s,showLabelChip:!!s})}function Gn(e){return ao(e)?f.jsx(bi,{...e}):f.jsx(xi,{...e})}const co={"no-webgpu":0,"no-hdr-browser":1,"no-hdr-display":2},vi="https://github.com/doeringchristian/cairn-plot/blob/main/docs/browser-support.md";function wi(e,t=!1){const n=e||"";return t?"brave":/firefox/i.test(n)?"firefox":/safari/i.test(n)&&!/chrome|chromium|crios|android/i.test(n)?"safari":/linux/i.test(n)&&/chrome|chromium/i.test(n)?"chromium-linux":"chromium"}function yi(e){const t=e||"";return/mac os x|macintosh/i.test(t)?"macos":/windows/i.test(t)?"windows":"other"}function Ei(e,t){if(e==="no-hdr-display")switch(yi(t.userAgent)){case"macos":return"macOS: EDR engages automatically on HDR-capable displays — confirm your display supports HDR.";case"windows":return"Windows: turn on Settings → System → Display → Use HDR.";default:return"Enable HDR in your display and OS settings."}const n=wi(t.userAgent,t.isBrave);if(e==="no-hdr-browser")switch(n){case"firefox":return"Firefox has no extended-tone-mapping canvas path at all — true HDR output is impossible until Firefox implements it (fundamental browser limitation).";case"safari":return"Safari's WebGPU HDR canvas tone-mapping is still maturing — update to the latest Safari 26+.";default:return"Chrome/Edge 129+ is required for HDR canvas output (toneMapping: extended) — update your browser."}switch(n){case"firefox":return"Firefox: about:config → dom.webgpu.enabled (HDR output is not available in Firefox at all — browser limitation).";case"safari":return"Safari: Develop → Feature Flags → WebGPU (Safari 26+ has it by default).";case"brave":return"Brave: check Shields fingerprint blocking + brave://flags.";case"chromium-linux":return"Chromium on Linux: enable chrome://flags/#enable-unsafe-webgpu.";case"chromium":default:return"Chrome/Edge: enable chrome://flags/#enable-unsafe-webgpu and hardware acceleration."}}function _i(e){switch(e){case"no-webgpu":return"GPU renderer unavailable → CPU fallback active; FLIP kernels + HDR compare disabled.";case"no-hdr-browser":return"True HDR output is unsupported by this browser — a fundamental browser limitation, not a cairn-plot bug → HDR images tone-mapped to SDR.";case"no-hdr-display":return"Your display/OS is not in HDR mode → HDR images tone-mapped to SDR."}}function lo(e,t){return`cairn-plot:capnotice:${e}:${t}`}const uo=new Set;function fo(e){try{if(window.localStorage.getItem(e)==="1")return!0}catch{}try{if(window.sessionStorage.getItem(e)==="1")return!0}catch{}return uo.has(e)}function Mi(e){try{window.localStorage.setItem(e,"1");return}catch{}try{window.sessionStorage.setItem(e,"1");return}catch{}uo.add(e)}const po=new Set;let jt=null,yt=null;function ho(){yt&&yt.parentNode&&yt.parentNode.removeChild(yt),yt=null,jt=null}function Si(e){const t=lo(e,window.location.pathname),n=Ei(e,{userAgent:navigator.userAgent,isBrave:!!navigator.brave}),r=document.createElement("div");r.setAttribute("role","status"),r.setAttribute("data-cairn-plot-capnotice",e),Object.assign(r.style,{position:"fixed",bottom:"12px",right:"12px",zIndex:"2147483000",maxWidth:"340px",boxSizing:"border-box",padding:"10px 30px 10px 12px",borderRadius:"6px",border:"1px solid var(--color-border, #d0d7de)",background:"rgb(var(--color-bg-elevated-rgb, 246 248 250) / 0.9)",color:"var(--color-fg-muted, #656d76)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",boxShadow:"0 4px 12px rgba(0, 0, 0, 0.18)",font:"12px/1.4 system-ui, sans-serif"});const o=document.createElement("div");o.textContent=_i(e),Object.assign(o.style,{fontWeight:"600",color:"var(--color-fg, #1f2328)",marginBottom:"4px"});const s=document.createElement("div");s.textContent=n,s.style.marginBottom="4px";const a=document.createElement("a");a.href=vi,a.target="_blank",a.rel="noopener noreferrer",a.textContent="Learn more",Object.assign(a.style,{color:"var(--color-accent, #0969da)",textDecoration:"none"});const u=document.createElement("button");u.type="button",u.textContent="×",u.setAttribute("aria-label","Dismiss browser capability notice"),u.title="Dismiss",Object.assign(u.style,{position:"absolute",top:"4px",right:"6px",padding:"0 4px",border:"0",background:"transparent",color:"var(--color-fg-subtle, #8b949e)",cursor:"pointer",fontSize:"16px",lineHeight:"1"}),u.addEventListener("click",()=>{Mi(t),ho()}),r.appendChild(o),r.appendChild(s),r.appendChild(a),r.appendChild(u),document.body.appendChild(r),yt=r,jt=e}function mo(e){if(typeof document>"u"||typeof window>"u"||po.has(e))return;po.add(e);const t=lo(e,window.location.pathname);if(fo(t))return;const n=()=>{if(!fo(t)){if(jt!==null)if(co[e]<co[jt])ho();else return;Si(e)}};document.body?n():window.addEventListener("DOMContentLoaded",n,{once:!0})}const Ti={data:new Float32Array(0),shape:[0,0],dtype:"<f4"};function Ai(e){const{h:t,w:n,c:r}=io(e.shape);if(e.precision==="f16-bits"){const a=e.data,u=new Uint16Array(n*t*4);for(let i=0;i<n*t;i++){const l=i*r,d=i*4;if(r===1){const x=a[l];u[d]=x,u[d+1]=x,u[d+2]=x,u[d+3]=Vt}else u[d]=a[l],u[d+1]=a[l+1],u[d+2]=a[l+2],u[d+3]=r>=4?a[l+3]:Vt}return{data:u,width:n,height:t,format:"rgba16float"}}const o=e.data,s=new Float32Array(n*t*4);for(let a=0;a<n*t;a++){const u=a*r;let i,l,d,x=1;r===1?i=l=d=De(o[u]):r===3?(i=De(o[u]),l=De(o[u+1]),d=De(o[u+2])):(i=De(o[u]),l=De(o[u+1]),d=De(o[u+2]),x=De(o[u+3]));const h=a*4;s[h]=i,s[h+1]=l,s[h+2]=d,s[h+3]=x}return{data:s,width:n,height:t,format:"rgba32float"}}function go(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),s=n*o,a=r*o,u=(t.width-s)/2,i=(t.height-a)/2,l=Math.max(e.zoom,1e-6),d=t.width/(l*s),x=t.height/(l*a),h=-u/s-e.pan.x/(l*s),b=-i/a-e.pan.y/(l*a);return{x:h,y:b,w:d,h:x}}function xo(e,t,n,r){const o=e.w*n,s=e.h*r;return o<=0||s<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/s)}const Pi=(()=>{try{return new URLSearchParams(window.location.search).get("hdrEncode")==="legacy"}catch{return!1}})();function Ri(e){var rt,F,te;const t=ao(e),n=c.useRef(null),r=c.useRef(null),o=c.useRef(null),s=c.useRef(null),a=c.useRef(null),u=t&&!!((rt=e.hdr)!=null&&rt.deep),i=c.useCallback((D,G)=>{var U,k;(U=s.current)==null||U.setDeepWindow(D,G),(k=a.current)==null||k.call(a)},[]),l=so(t?e.hdr:Ti,u?i:void 0),d=c.useRef(!1),[x,h]=c.useState(!1),[b,y]=c.useState(!1),[w,S]=c.useState(!1),[m,g]=c.useState(null),[p,E]=c.useState(0),[_,v]=c.useState(0),[C,T]=c.useState({x:0,y:0,w:1,h:1}),M=c.useRef(null),A=c.useRef(null),[P,O]=c.useState(0),R=e.zoom??1,B=e.pan??{x:0,y:0},N=e.onViewportChange,$=t?"none":e.colormap??"none",[Q,V,I]=Ne($);c.useEffect(()=>{V($)},[$,V]);const J=t?"none":Q,X=t?e.tonemap:void 0,[_e,ae]=c.useState(null);c.useEffect(()=>{ae(null)},[X]);const ge=Cs(X,x),z=_e??ge,K=_e!==null&&_e!==ge,re=c.useCallback(()=>ae(null),[]),[ee,ie,Y]=Ne(rr),oe=e.gamma,[xe,Ee,q]=Ne(oe&&oe>0?oe:Tt);c.useEffect(()=>{oe&&oe>0&&Ee(oe)},[oe,Ee]);const Se=t?void 0:e.tonemap,be=(()=>{const D=St(Se);return D==="gamma"||D==="linear"?D:"srgb"})(),[ve,pe,Te]=Ne(be);c.useEffect(()=>{pe(be)},[Se]);const[Pe,Ge]=c.useState(0),[Re,We]=c.useState(0),gt=An();c.useEffect(()=>{const D=n.current;if(!D)return;let G=!1;return Nt().then(U=>{var ue;if(G)return;const k=((ue=U.probeExtendedToneMapping)==null?void 0:ue.call(U))??!1,ne=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,W=k&&ne&&t;d.current=W,h(W),t&&!W&&mo(k?"no-hdr-display":"no-hdr-browser"),Ca(D,{hdr:W}).then(ce=>{if(G){Ur(ce);return}s.current=ce,S(!0)}).catch(ce=>{G||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",ce),y(!0))})}).catch(U=>{G||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",U),y(!0))}),()=>{G=!0,s.current&&(Ur(s.current),s.current=null)}},[]),c.useEffect(()=>{const D=r.current;if(!D)return;const G=new ResizeObserver(()=>v(U=>U+1));return G.observe(D),()=>G.disconnect()},[]),c.useEffect(()=>{const D=r.current;if(!D)return;const G=new IntersectionObserver(U=>{const k=U[0];if(!k)return;const ne=s.current;ne&&(ne.setVisible(k.isIntersecting),k.isIntersecting?ne.isParked&&(ne.restore(),v(W=>W+1)):ne.park())},{threshold:0});return G.observe(D),()=>G.disconnect()},[]),c.useEffect(()=>{var U;if(!t||!w||u)return;const D=l.hdr;M.current=D;const G=Ai(D);(U=s.current)==null||U.setSource(G),g(k=>k&&k.w===G.width&&k.h===G.height?k:{w:G.width,h:G.height}),O(k=>k+1),E(k=>k+1)},[t,w,u,t?l.hdr:null]),c.useEffect(()=>{if(!t||!w||!u)return;const D=e.hdr,G=D.deep;M.current=D;let U=!1;return G.getGpuCsr().then(k=>{var ne;U||((ne=s.current)==null||ne.setDeepSource(k,G.zMin,G.zMax),g(W=>W&&W.w===k.width&&W.h===k.height?W:{w:k.width,h:k.height}),O(W=>W+1),E(W=>W+1))}).catch(k=>{U||console.warn("[cairn] deep GPU CSR upload failed:",k)}),()=>{U=!0}},[t,w,u,t?e.hdr.deep:null]),c.useEffect(()=>{if(t||!w)return;const D=e,G=D.imageUrl,U=Q;if(!G){A.current=null,g(null),O(ne=>ne+1);return}let k=!1;return st(G).then(ne=>{var ce,we;if(k||!ne)return;let W=ne;if(U!=="none"){const le=`gpu::${G}::${U}::ev${Pe}::off${Re}`,ke=En(le);if(ke)W=ke;else{const Ce=yn(U);W=wn(ne,U,Ce,Pe,Re),_n(le,W)}}A.current=ne;const ue={data:W.data,width:W.width,height:W.height,format:"rgba8unorm"};(ce=s.current)==null||ce.setSource(ue),g(le=>le&&le.w===W.width&&le.h===W.height?le:{w:W.width,h:W.height}),(we=D.onNaturalSize)==null||we.call(D,W.width,W.height),O(le=>le+1),E(le=>le+1)}),()=>{k=!0}},[t,w,t?null:e.imageUrl,t?null:Q,t?0:Pe,t?0:Re]);const Je=t?e.exposure??0:0,Ve=!t&&J==="none",Ue=c.useCallback(()=>{const D=s.current;if(!D||!w||!m)return;const G=r.current,U=o.current,k=U?U.getBoundingClientRect():G?G.getBoundingClientRect():{width:m.w,height:m.h},ne=go({zoom:R,pan:B},k,m.w,m.h);T(le=>le.x===ne.x&&le.y===ne.y&&le.w===ne.w&&le.h===ne.h?le:ne),k.width>0&&k.height>0&&D.resize(Math.round(k.width*gt),Math.round(k.height*gt));const W=xo(ne,k,m.w,m.h)>=Rn?"nearest":"linear",ue=ne,ce=d.current&&cr(z),we=t?{exposureEV:Je+Pe,offset:Re,operator:z,gamma:Ut(z,xe),isScalar:!1,hdrOut:ce,hdrEncodeLegacy:Pi,peak:ee,uv:ue,filter:W}:{exposureEV:Ve?Pe:0,offset:Ve?Re:0,operator:Ve?ve:"linear",gamma:Ve?Ut(ve,xe):1,isScalar:!1,hdrOut:!1,srgbDecode:Ve,uv:ue,filter:W};try{D.render(we)||y(!0)}catch(le){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",le),y(!0)}},[w,m,R,B.x,B.y,Je,Pe,Re,z,ee,xe,ve,Ve,t,J,gt]);a.current=Ue,c.useEffect(()=>{Ue()},[Ue,p,_]);const Et=c.useCallback((D,G,U)=>{if(t){const ke=M.current,Ce=m;if(!ke||!Ce||D<0||G<0||D>=Ce.w||G>=Ce.h)return null;const Fe=ke.shape.length===2?1:ke.shape[2]??1,ut=(G*Ce.w+D)*Fe,on=ke.data,_t=ke.precision==="f16-bits"?Mt=>$t(on[Mt]??0):Mt=>on[Mt]??0,sn=.5,qn=Fe===1?[_t(ut)]:[_t(ut),_t(ut+1),_t(ut+2)];return pt(qn,"unit",U,sn)}const k=A.current;if(!k||D<0||G<0||D>=k.width||G>=k.height)return null;const ne=(G*k.width+D)*4,W=k.data[ne],ue=k.data[ne+1],ce=k.data[ne+2],we=At(W,ue,ce);return pt(J!=="none"||W===ue&&ue===ce?[W]:[W,ue,ce],"uint8",U,we)},[t,m,J]),Ze=e.showAxes??!1,et=t?e.label??"":e.label,tt=e.interpolation??"auto",xt=tt==="auto"?void 0:tt,$e=t?void 0:e.overlay,Ie=t?void 0:e.overlaySettings,nt=t?!1:e.isDraggable??!1,Ot=t?void 0:e.onDragStart;if(b)return t?f.jsx(Gn,{...e}):f.jsx(Gn,{...e});const bt=$e&&(Ie!=null&&Ie.enabled)&&m&&((((F=$e.boxes)==null?void 0:F.length)??0)>0||(((te=$e.masks)==null?void 0:te.length)??0)>0)?f.jsx(Pn,{data:$e,settings:Ie,naturalWidth:m.w,naturalHeight:m.h}):void 0;return f.jsx(Zt,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":w},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:r,wrapperRef:o,zoom:R,pan:B,onViewportChange:N,naturalDims:m,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:Ze&&m?"16px 4px 4px 28px":0,surface:f.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:xt},"data-gpu-image-canvas":!0}),showAxes:Ze,overlayNode:bt,overlay:{displayElRef:n,sample:Et,version:P,hasSource:!0,sourceWindow:C},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:Ue,leadingMenus:t?[eo(z,D=>ae(D),x)]:Ve?[Dt(J,D=>V(D)),to(ve,D=>pe(D))]:[Dt(J,D=>V(D))],displayAdjust:{exposureEV:Pe,offset:Re,onExposureChange:Ge,onOffsetChange:We},extraSliders:t&&Ps(z)?[{id:"peak",label:"PK",title:"Peak white (×SDR white) — HDR shoulder for the extended Reinhard/ACES operators, or the managed-linear hard ceiling for Extended · Linear (managed). Double-click to type a value.",min:_s,max:Ms,step:Ss,value:ee,onChange:ie,format:D=>`${D.toFixed(1)}×`}]:(t?Gt(z):Ve&&Gt(ve))?[{id:"gamma",label:"γ",title:"Display gamma γ for the Gamma transfer — display = clamp(value)^(1/γ), tev-style. Default 2.2 (close to sRGB, not identical). Double-click to type a value.",min:xn,max:bn,step:vn,value:xe,onChange:Ee,format:D=>D.toFixed(1)}]:void 0,depthSliders:l.sliders,regionSelect:u?{rect:l.region,queryLive:l.queryRegionWindow,commit:l.commitRegion,remove:l.removeRegion}:void 0,onReset:()=>{I.reset(),re(),Y.reset(),q.reset(),Te.reset(),l.reset()},extraModified:I.isModified||K||Y.isModified||q.isModified||Te.isModified||l.isModified,label:et,showLabelChip:!!et,isDraggable:nt,onDragStart:Ot})}const Qt=new Map;function Ke(e){if(Qt.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);Qt.set(e.id,e)}function ct(e){return Qt.get(e)}function Ci(){return Array.from(Qt.values())}function bo(e,t){return{...e.params??{},...t??{}}}const Di={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},ki={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},Li={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},Oi={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},Bi={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},Ni={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},vo=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];Fi(vo);const Un=[1.052156925,1,.91835767],Ii=.7;function Fi(e){const[t,n,r]=e[0],[o,s,a]=e[1],[u,i,l]=e[2],d=s*l-a*i,x=-(o*l-a*u),h=o*i-s*u,y=1/(t*d+n*x+r*h);return[[d*y,-(n*l-r*i)*y,(n*a-r*s)*y],[x*y,(t*l-r*u)*y,-(t*a-r*o)*y],[h*y,-(t*i-n*u)*y,(t*s-n*o)*y]]}function Gi(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const zn=6/29;function Vn(e){return e>zn**3?Math.cbrt(e):e/(3*zn*zn)+4/29}function wo(e,t,n){const[r,o,s]=Gi(vo,e,t,n),a=Vn(r*Un[0]),u=Vn(o*Un[1]),i=Vn(s*Un[2]),l=116*u-16,d=500*(a-u),x=200*(u-i);return[l,.01*l*d,.01*l*x]}function Ui(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function zi(){const e=wo(0,1,0),t=wo(0,0,1);return Math.pow(Ui(e,t),Ii)}const yo=zi(),Vi=.082;function Eo(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],s=Math.max(...n,...o),a=Math.ceil(3*Math.sqrt(s/(2*Math.PI**2))*e),u=1/e,i=Math.PI**2,l=[0,0,0];for(let d=-a;d<=a;d++)for(let x=-a;x<=a;x++){const h=(x*u)**2+(d*u)**2;for(let b=0;b<3;b++)l[b]+=t[b]*Math.sqrt(Math.PI/n[b])*Math.exp(-i*h/n[b])+r[b]*Math.sqrt(Math.PI/o[b])*Math.exp(-i*h/o[b])}return{r:a,deltaX:u,sums:l}}function _o(e){const t=.5*Vi*e,n=Math.ceil(3*t);let r=0,o=0,s=0;for(let a=-n;a<=n;a++)for(let u=-n;u<=n;u++){const i=Math.exp(-(u*u+a*a)/(2*t*t)),l=-u*i,d=(u*u/(t*t)-1)*i;l>0&&(r+=l),d>0?o+=d:s-=d}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:s}}const $i=`
${ze}
${Yt}
${mt}
${Rt}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_map0: vec4<f32>; // offX, offY, fitFill, 0
@group(0) @binding(8) var<uniform> u_map1: vec4<f32>; // resultW, resultH, 0, 0
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = mapSample(src, px, u_map0.x, u_map0.y, u_map1.x, u_map1.y, u_map0.z);
  return vec4<f32>(flip_rgb2ycxcz(s.rgb), 1.0);
}
`,Xi=`
${ze}
${Yt}
${mt}
${Rt}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_map0: vec4<f32>; // offX, offY, fitFill, 0
@group(0) @binding(8) var<uniform> u_map1: vec4<f32>; // resultW, resultH, 0, 0
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = mapSample(src, px, u_map0.x, u_map0.y, u_map1.x, u_map1.y, u_map0.z);
  return vec4<f32>(flip_linrgb2ycxcz(clamp(s.rgb, vec3<f32>(0.0), vec3<f32>(1.0))), 1.0);
}
`,Jt=`
${ze}
${Yt}
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
`,Mo=`
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
`;function qe(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function en(e,t,n){const r=n.sourceMap,o=r?t==="a"?r.offsetA:r.offsetB:{x:0,y:0},s=r!=null&&r.fill?1:0;return[qe(e,[o.x,o.y,s,0]),qe(e+1,[n.width,n.height,0,0])]}function tn(e){return[qe(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),qe(2,[e.sums[2],0,0,0])]}function So(e){return[qe(4,[yo,e.sd,e.r,e.edgeNorm]),qe(5,[e.pointPos,e.pointNeg,0,0])]}function To(e,t,n,r,o,s=""){const a=Eo(e),u=_o(e),i=`ycxczA${s}`,l=`ycxczB${s}`,d=`labA${s}`,x=`labB${s}`,h=`flip${s}`;return{passes:[{name:i,shader:t,inputs:[n],output:i,uniforms:()=>en(1,"a",o)},{name:l,shader:t,inputs:[r],output:l,uniforms:()=>en(1,"b",o)},{name:d,shader:Jt,inputs:[i],output:d,uniforms:()=>tn(a)},{name:x,shader:Jt,inputs:[l],output:x,uniforms:()=>tn(a)},{name:h,shader:Mo,inputs:[d,x,i,l],output:h,uniforms:()=>So(u)}],flipRef:h}}const Wi={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=To(t,$i,"srcA","srcB",e);return{passes:n,final:r}}},Hi={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=To(t,Xi,"srcA","srcB",e);return{passes:n,final:r}}},Ao=`
${ze}
${Yt}
${mt}
${Rt}
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
`,Yi=`
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
`,Ki={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",output:"scalar",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),s=(r-n)/Math.max(o-1,1),a=Eo(t),u=_o(t),i=[];let l=null;for(let d=0;d<o;d++){const x=n+d*s,h=`_e${d}`,b=`ycxczA${h}`,y=`ycxczB${h}`,w=`labA${h}`,S=`labB${h}`,m=`acc${h}`;i.push({name:b,shader:Ao,inputs:["srcA"],output:b,uniforms:()=>[qe(1,[x,0,0,0]),...en(2,"a",e)]},{name:y,shader:Ao,inputs:["srcB"],output:y,uniforms:()=>[qe(1,[x,0,0,0]),...en(2,"b",e)]},{name:w,shader:Jt,inputs:[b],output:w,uniforms:()=>tn(a)},{name:S,shader:Jt,inputs:[y],output:S,uniforms:()=>tn(a)}),l===null?i.push({name:m,shader:Mo,inputs:[w,S,b,y],output:m,uniforms:()=>So(u)}):i.push({name:m,shader:Yi,inputs:[w,S,b,y,l],output:m,uniforms:()=>[qe(5,[yo,u.sd,u.r,u.edgeNorm]),qe(6,[u.pointPos,u.pointNeg,0,0])]}),l=m}return{passes:i,final:l}}},Po=.01,Ro=.03,nn=1,$n=1.5,lt=5,Xn=[.2126,.7152,.0722];function Wn(e){return e<=.04045?e/12.92:Math.pow((e+.055)/1.055,2.4)}function Co(e,t,n){const r=Xn[0]*Wn(e)+Xn[1]*Wn(t)+Xn[2]*Wn(n);return Math.min(1,Math.max(0,r))}function qi(e,t){const n=2*t+1,r=new Float64Array(n);let o=0;for(let s=-t,a=0;s<=t;s++,a++){const u=Math.exp(-.5*s*s/(e*e));r[a]=u,o+=u}for(let s=0;s<n;s++)r[s]=r[s]/o;return r}function Do(e,t){if(t===1)return 0;const n=2*t;let r=(e%n+n)%n;return r>=t&&(r=n-1-r),r}const ko=()=>new Promise(e=>{typeof setTimeout=="function"?setTimeout(e,0):Promise.resolve().then(e)}),Hn=64;async function kt(e,t,n,r,o,s){const a=new Float64Array(t*n);for(let i=0;i<n;i++){for(let l=0;l<t;l++){let d=0;for(let x=-o,h=0;x<=o;x++,h++)d+=r[h]*e[i*t+Do(l+x,t)];a[i*t+l]=d}(i+1)%Hn===0&&await s()}const u=new Float64Array(t*n);for(let i=0;i<n;i++){for(let l=0;l<t;l++){let d=0;for(let x=-o,h=0;x<=o;x++,h++)d+=r[h]*a[Do(i+x,n)*t+l];u[i*t+l]=d}(i+1)%Hn===0&&await s()}return u}async function Zi(e,t,n,r,o=ko){const s=n*r;if(s<=0)return NaN;const a=qi($n,lt),u=new Float64Array(s),i=new Float64Array(s),l=new Float64Array(s);for(let g=0;g<s;g++)u[g]=e[g]*e[g],i[g]=t[g]*t[g],l[g]=e[g]*t[g];const d=await kt(e,n,r,a,lt,o),x=await kt(t,n,r,a,lt,o),h=await kt(u,n,r,a,lt,o),b=await kt(i,n,r,a,lt,o),y=await kt(l,n,r,a,lt,o),w=(Po*nn)**2,S=(Ro*nn)**2;let m=0;for(let g=0;g<s;g++){const p=h[g]-d[g]*d[g],E=b[g]-x[g]*x[g],_=y[g]-d[g]*x[g],v=2*d[g]*x[g]+w,C=2*_+S,T=d[g]*d[g]+x[g]*x[g]+w,M=p+E+S;m+=v*C/(T*M)}return m/s}const Lo=`
${ze}

fn ssim_srgb2linear(c: f32) -> f32 {
  if (c <= 0.04045) { return c / 12.92; }
  return pow((c + 0.055) / 1.055, 2.4);
}
fn ssim_luma(srgb: vec3<f32>) -> f32 {
  let lin = vec3<f32>(ssim_srgb2linear(srgb.r), ssim_srgb2linear(srgb.g), ssim_srgb2linear(srgb.b));
  return clamp(dot(lin, vec3<f32>(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
}

${mt}
${Rt}
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
`,ji=`
${Lo}
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let y = ssim_moment_luma(in);
  return vec4<f32>(y.x, y.y, y.x * y.x, y.y * y.y);
}
`,Qi=`
${Lo}
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let y = ssim_moment_luma(in);
  return vec4<f32>(y.x * y.y, 0.0, 0.0, 0.0);
}
`,Oo=`
${ze}
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
`,Ji=`
${ze}
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
`;function Lt(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function Bo(e){const t=e.sourceMap,n=t?t.offsetA:{x:0,y:0},r=t?t.offsetB:{x:0,y:0},o=t!=null&&t.fill?1:0;return[Lt(2,[n.x,n.y,r.x,r.y]),Lt(3,[e.width,e.height,o,0])]}function No(e,t){const n=`${t}H`,r=`${t}V`;return{passes:[{name:n,shader:Oo,inputs:[e],output:n,uniforms:()=>[Lt(1,[1,0,lt,$n])]},{name:r,shader:Oo,inputs:[n],output:r,uniforms:()=>[Lt(1,[0,1,lt,$n])]}],out:r}}const ec={kind:"multipass",id:"ssim",label:"SSIM (1−SSIM)",publicName:"ssim",displayRange:"unit",output:"scalar",buildPasses(e){const t=(Po*nn)**2,n=(Ro*nn)**2,r=No("momA","statsA"),o=No("momB","statsB");return{passes:[{name:"momA",shader:ji,inputs:["srcA","srcB"],output:"momA",uniforms:Bo},{name:"momB",shader:Qi,inputs:["srcA","srcB"],output:"momB",uniforms:Bo},...r.passes,...o.passes,{name:"ssim",shader:Ji,inputs:[r.out,o.out],output:"ssim",uniforms:()=>[Lt(2,[t,n,0,0])]}],final:"ssim"}}};let Io=!1;function tc(){Io||(Io=!0,Ke(ki),Ke(Di),Ke(Li),Ke(Bi),Ke(Oi),Ke(Ni),Ke(Wi),Ke(Ki),Ke(Hi),Ke(ec))}tc();function Fo(){const e=[];for(const n of Ci())n.kind==="pointwise"&&e.push({id:n.id,label:n.label});e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"});const t=ct("ssim");return t&&e.push({id:t.id,label:t.label}),e}function nc(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}function rc(e,t,n){const r=t*n;if(r<=0)return NaN;let o=0;for(let s=0;s<r;s++)o+=e[s*4]??0;return 1-o/r}function Go(e){return e==null||Number.isNaN(e)?"—":e.toFixed(4)}const Uo=new WeakMap;function oc(e,t,n){let r=Uo.get(e);r||(r=new Map,Uo.set(e,r));const o=r.get(t);if(o)return o;const s=n().catch(a=>{throw r.get(t)===s&&r.delete(t),a});return r.set(t,s),s}const zo=new WeakMap;function Yn(e,t,n,r){let o=zo.get(e);o||(o=new Map,zo.set(e,o));const s=`${t}::${r}`;let a=o.get(s);return a||(a=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(s,a)),a}function sc(e){return`
${ze}
${mt}
${Rt}
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
`}const rn="rgba16float";function ac(e,t,n,r,o,s){var S,m;const a=ct(r);if(!a)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const u=s??Ct({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),i=u.result.w,l=u.result.h,d=u.fit==="fill"?1:0,x=bo(a,o);if(a.kind==="pointwise"){const g=e.createTexture(i,l,rn),p=Yn(e,`pw:${a.id}`,sc(a.source),rn),E=new Float32Array([u.offsetA.x,u.offsetA.y,u.offsetB.x,u.offsetB.y]),_=new Float32Array([i,l,d,0]);let v;try{v=e.createBindGroup(p,[{binding:0,resource:t},{binding:1,resource:n},{binding:2,resource:{uniform:E}},{binding:3,resource:{uniform:_}}]),e.renderFullscreen(g,p,v)}finally{(S=v==null?void 0:v.destroy)==null||S.call(v)}return g}const h={width:i,height:l,params:x,sourceMap:{fill:u.fit==="fill",offsetA:u.offsetA,offsetB:u.offsetB}},b=a.buildPasses(h),y=new Map([["srcA",t],["srcB",n]]),w=[];try{for(const p of b.passes){const E=e.createTexture(i,l,rn);w.push(E),y.set(p.output,E);const _=Yn(e,`mp:${a.id}:${p.name}`,p.shader,rn),v=p.inputs.map((T,M)=>{const A=y.get(T);if(!A)throw new Error(`computeDiff: pass "${p.name}" input "${T}" not produced yet`);return{binding:M,resource:A}});p.uniforms&&v.push(...p.uniforms(h));let C;try{C=e.createBindGroup(_,v),e.renderFullscreen(E,_,C)}finally{(m=C==null?void 0:C.destroy)==null||m.call(C)}}const g=y.get(b.final);if(!g)throw new Error(`computeDiff: final ref "${b.final}" not produced`);for(const p of w)p!==g&&p.destroy();return g}catch(g){for(const p of w)p.destroy();throw g}}const ic=8,cc=256*1024*1024;class lc{constructor(t=ic,n=cc){fe(this,"map",new Map);fe(this,"totalBytes",0);fe(this,"maxEntries");fe(this,"maxBytes");this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}accountReadbackBytes(t,n){let r=!1;for(const o of this.map.values())if(o===t){r=!0;break}r&&(t.bytes+=n,this.totalBytes+=n,this.evict())}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const Vo=new WeakMap;function $o(e){let t=Vo.get(e);return t||(t=new lc,Vo.set(e,t)),t}function uc(e,t){const n=bo(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function fc(e,t,n,r,o){const s=ct(n),a=s?uc(s,r):"",u=o?Dn(o):"";return`${e}|${t}|${n}|${a}|${u}`}function Xo(e,t,n,r,o,s,a,u){const i=ct(r);if(!i)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const l=$o(e),d=u??Ct({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),x=fc(s,a,r,o,d),h=l.get(x);if(h)return h;const b=ac(e,t,n,r,o,d),y=d.result.w,w=d.result.h,S={texture:b,width:y,height:w,displayRange:i.displayRange,bytes:y*w*8};return l.set(x,S),S}function dc(e,t,n){return`${e}|${t}|${n?Dn(n):""}`}function pc(e,t,n,r,o,s){return oc(e,dc(r,o,s),()=>hc(e,t,n,r,o,s))}async function hc(e,t,n,r,o,s){try{const a=Xo(e,t,n,"ssim",void 0,r,o,s);return a.ssimMean!==void 0?a.ssimMean:(a.ssimMeanPending||(a.ssimMeanPending=Wo(e,a).then(u=>{const i=rc(u,a.width,a.height);return a.ssimMean=i,i})),await a.ssimMeanPending)}catch{return mc(e,t,n,s)}}async function mc(e,t,n,r){const o=r??Ct({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),s=o.result.w,a=o.result.h,u=s*a;if(u<=0)return NaN;const i=await e.readback(t),l=await e.readback(n),d=i instanceof Uint8Array?255:1,x=l instanceof Uint8Array?255:1,h=o.fit==="fill",b=Kt(i,t.width,t.height,d,o.offsetA,h,s,a),y=Kt(l,n.width,n.height,x,o.offsetB,h,s,a),w=new Float64Array(u),S=new Float64Array(u),m=[0,0,0],g=[0,0,0];for(let p=0;p<a;p++){for(let E=0;E<s;E++){b(E,p,m),y(E,p,g);const _=p*s+E;w[_]=Co(m[0],m[1],m[2]),S[_]=Co(g[0],g[1],g[2])}(p+1)%Hn===0&&await ko()}return Zi(w,S,s,a)}async function gc(e,t,n,r,o){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=Br(e,n,r,o).then(s=>(t.scalars=s,s))),t.scalarsPending)}async function Wo(e,t){return t.resultSamples?t.resultSamples:(t.resultSamplesPending||(t.resultSamplesPending=e.readback(t.texture).then(n=>{const r=n instanceof Float32Array?n:Float32Array.from(n);return t.resultSamples=r,$o(e).accountReadbackBytes(t,r.byteLength),r})),t.resultSamplesPending)}const xc=`
${ze}
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
`,bc={unit:0,signed:1,relative:2},vc={linear:0,signed:1,positive:2};function wc(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function yc(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function Ec(e,t,n,r,o){var b,y,w;const s=yc(t),a=Yn(e,"diff-display",xc,s),u=wc(e,o.colormap),i=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),l=new Float32Array([bc[r],vc[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]),d=new Float32Array([o.exposureEV??0,o.offset??0,0,0]),x=new Float32Array([((b=o.sourceDims)==null?void 0:b.w)??0,((y=o.sourceDims)==null?void 0:y.h)??0,0,0]);let h;try{h=e.createBindGroup(a,[{binding:0,resource:n},{binding:1,resource:u},{binding:2,resource:{uniform:i}},{binding:3,resource:{uniform:l}},{binding:4,resource:{uniform:d}},{binding:5,resource:{uniform:x}}]),e.renderFullscreen(t,a,h)}finally{(w=h==null?void 0:h.destroy)==null||w.call(h),u.destroy()}}const Ho=.6*.6*2.51,_c=.6*.03,Mc=0,Yo=.6*.6*2.43,Sc=.6*.59,Tc=.14;function Ko(e){const t=(_c-Sc*e)/(Ho-Yo*e),n=(Mc-Tc*e)/(Ho-Yo*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const Ac=.85,Pc=.85,qo=11920928955078125e-23,Kn=[.2126,.7152,.0722];function Rc(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function Cc(e,t,n,r=3,o={}){const s=t*n,a=Ko(Ac),u=Ko(Pc),i=new Float64Array(s);let l=0;for(let g=0;g<s;g++){const[p,E,_]=Rc(e,g,r),v=p*Kn[0]+E*Kn[1]+_*Kn[2];i[g]=v,v>l&&(l=v)}const d=Float64Array.from(i).sort(),x=s>>1,h=s%2===1?d[x]:d[x-1],b=Math.max(h,qo),y=Math.max(l,qo),w=o.startExposure??Math.log2(a/y),S=o.stopExposure??Math.log2(u/b),m=Math.max(2,Math.ceil(S-w));return{startExposure:w,stopExposure:S,numExposures:m}}const Dc="absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm pointer-events-none select-none",kc="REF";function Zo(){return f.jsx("span",{className:Dc,children:kc})}function jo({splitPosition:e,onChange:t,onReset:n}){return f.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${e*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:r=>{r.stopPropagation(),n==null||n()},onPointerDown:r=>{r.stopPropagation(),r.preventDefault();const o=r.currentTarget;try{o.setPointerCapture(r.pointerId)}catch{}const a=o.parentElement.getBoundingClientRect(),u=l=>{t==null||t(Math.max(0,Math.min(1,(l.clientX-a.left)/a.width)))},i=()=>{window.removeEventListener("pointermove",u),window.removeEventListener("pointerup",i)};window.addEventListener("pointermove",u),window.addEventListener("pointerup",i)},children:f.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})}const Lc={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Oc({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:s,zoom:a,pan:u,onViewportChange:i,processing:l=Lc,interpolation:d="auto",label:x="",isDraggable:h=!1,onDragStart:b,overlay:y,overlaySettings:w,pixelValueNotation:S="decimal"}){var ee,ie;const m=c.useRef(null),[g,p]=c.useState(null),[E,_]=c.useState(null),[v,C]=c.useState(S),[T,M]=c.useState(!1),A=c.useRef(null),P=c.useRef(null),O=c.useRef(null),R=c.useRef(null),[B,N]=c.useState(0);c.useEffect(()=>{if(!e){O.current=null,N(oe=>oe+1);return}let Y=!1;return st(e).then(oe=>{Y||(O.current=oe,N(xe=>xe+1))}),()=>{Y=!0}},[e]),c.useEffect(()=>{if(!t){R.current=null,N(oe=>oe+1);return}let Y=!1;return st(t).then(oe=>{Y||(R.current=oe,N(xe=>xe+1))}),()=>{Y=!0}},[t]);const $=Y=>(oe,xe,Ee)=>{const q=Y.current;if(!q||oe<0||xe<0||oe>=q.width||xe>=q.height)return null;const Se=(xe*q.width+oe)*4,be=q.data[Se],ve=q.data[Se+1],pe=q.data[Se+2],Te=At(be,ve,pe);return be===ve&&ve===pe?{lines:[wt(be,"uint8",Ee)],luminance:Te}:{lines:[wt(be,"uint8",Ee),wt(ve,"uint8",Ee),wt(pe,"uint8",Ee)],luminance:Te,colors:[Ht[0],Ht[1],Ht[2]]}},Q=c.useMemo(()=>$(O),[]),V=c.useMemo(()=>$(R),[]),I=!!y&&!!(w!=null&&w.enabled)&&!!g&&!!e&&((((ee=y.boxes)==null?void 0:ee.length)??0)>0||(((ie=y.masks)==null?void 0:ie.length)??0)>0),{gammaFilterId:J,filterStr:X,gamma:_e,offset:ae}=Vr(l),ge=`translate(${u.x}px, ${u.y}px) scale(${a})`,z=d==="auto"?void 0:d,{containerProps:K,modifierActive:re}=Er({containerRef:m,zoom:a,pan:u,onViewportChange:i});return f.jsxs("div",{className:"relative flex flex-col h-full",children:[f.jsx($r,{id:J,gamma:_e,offset:ae}),f.jsxs("div",{ref:m,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...K.style},onPointerDown:K.onPointerDown,onPointerMove:K.onPointerMove,onPointerUp:K.onPointerUp,onPointerCancel:K.onPointerCancel,children:[f.jsxs("div",{className:"relative w-full h-full",children:[f.jsxs("div",{className:"relative w-full h-full",style:{transform:ge,transformOrigin:"0 0"},children:[f.jsx("img",{ref:A,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:X,imageRendering:z,...n==="blend"?{opacity:o}:{}},onLoad:Y=>{const oe=Y.currentTarget;p({w:oe.naturalWidth,h:oe.naturalHeight})}}),I&&f.jsx(Pn,{data:y,settings:w,naturalWidth:g.w,naturalHeight:g.h})]}),f.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:f.jsx("div",{className:"w-full h-full",style:{transform:ge,transformOrigin:"0 0"},children:f.jsx("img",{ref:P,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:X,imageRendering:z,...n==="blend"?{opacity:1-o}:{}},onLoad:Y=>{const oe=Y.currentTarget;_({w:oe.naturalWidth,h:oe.naturalHeight})}})})}),n==="split"&&f.jsx(jo,{splitPosition:r,onChange:s,onReset:()=>s==null?void 0:s(.5)})]}),n==="split"?f.jsxs(f.Fragment,{children:[t&&E&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:f.jsx(ht,{imageElRef:P,naturalWidth:E.w,naturalHeight:E.h,zoom:a,pan:u,sample:V,notation:v,version:B})}),e&&g&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:f.jsx(ht,{imageElRef:A,naturalWidth:g.w,naturalHeight:g.h,zoom:a,pan:u,sample:Q,notation:v,version:B,onActiveChange:M})})]}):e&&g&&f.jsx(ht,{imageElRef:A,naturalWidth:g.w,naturalHeight:g.h,zoom:a,pan:u,sample:Q,notation:v,version:B,onActiveChange:M}),T&&f.jsx(Ar,{notation:v,onChange:C})]}),n==="split"&&f.jsx(Zo,{}),f.jsx(Ln,{label:x,corner:"bottom-right",isDraggable:h&&!re,grip:!0,onDragStart:b})]})}function Bc(){return f.jsx(zr,{title:"GPU compare unavailable",body:"Float image sources need the GPU compare (WebGPU), which isn't available in this browser."})}function Nc({mode:e,kernel:t,kernelOptions:n,onSlide:r,onBlend:o,onKernel:s,onSide:a}){return{id:"compare-mode",title:"Compare / diff mode",menu:{options:[...a?[{id:"side",label:"Side"}]:[],{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...n],value:e==="side"?"side":e==="split"?"slide":e==="blend"?"blend":t,onSelect:l=>{l==="side"?a==null||a():l==="slide"?r():l==="blend"?o():s(l)}}}}function Ic(e){const t=pn(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function Fc(e){const{width:t,height:n,channels:r}=e,o=t*n;if(e.precision==="f16-bits"){const i=e.data,l=new Uint16Array(o*4);for(let d=0;d<o;d++){const x=d*r,h=d*4;if(r===1){const b=i[x];l[h]=b,l[h+1]=b,l[h+2]=b,l[h+3]=Vt}else l[h]=i[x],l[h+1]=i[x+1],l[h+2]=i[x+2],l[h+3]=r>=4?i[x+3]:Vt}return{data:l,format:"rgba16float"}}const s=e.data,a=new Float32Array(o*4),u=i=>Number.isFinite(i)?i:0;for(let i=0;i<o;i++){const l=i*r;let d,x,h,b=1;r===1?d=x=h=u(s[l]):r===3?(d=u(s[l]),x=u(s[l+1]),h=u(s[l+2])):(d=u(s[l]),x=u(s[l+1]),h=u(s[l+2]),b=u(s[l+3]));const y=i*4;a[y]=d,a[y+1]=x,a[y+2]=h,a[y+3]=b}return{data:a,format:"rgba32float"}}function Gc({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:s,blendAlpha:a,onSplitPositionChange:u,diffSubmode:i,colormap:l="none",align:d="top-left",fit:x="crop",diffKernel:h,onDiffKernelChange:b,onCompareModeChange:y,onRequestSide:w,zoom:S,pan:m,onViewportChange:g,interpolation:p="auto",label:E="",pixelValueNotation:_="decimal"}){var Mt;const v=c.useRef(null),C=c.useRef(null),T=c.useRef(null),M=c.useRef(null),A=c.useRef(null),[P,O]=c.useState(!1),[R,B]=c.useState(!1),[N,$]=c.useState(null),[Q,V]=c.useState(null),[I,J]=c.useState(0),[X,_e]=c.useState(0),[ae,ge]=c.useState(null),[z,K]=c.useState(null),[re,ee]=c.useState({x:0,y:0,w:1,h:1}),ie=h??i??"absolute",[Y,oe,xe]=Ne(ie);c.useEffect(()=>{oe(h??i??"absolute")},[h,i,oe]);const Ee=c.useCallback(L=>{oe(L),b==null||b(L)},[b,oe]);c.useEffect(()=>{const L=v.current;if(L)return L.__cairnDiffKernel={current:Y,set:Ee},()=>{L&&delete L.__cairnDiffKernel}},[Y,Ee]);const[q,Se,be]=Ne(o);c.useEffect(()=>{Se(o)},[o,Se]);const ve=c.useCallback(L=>{Se(L),y==null||y(L)},[y,Se]),[pe,Te,Pe]=Ne(l);c.useEffect(()=>{Te(l)},[l,Te]);const Ge=c.useCallback(()=>{ve(be.default),Te(Pe.default),Ee(xe.default)},[ve,Te,Ee,be.default,Pe.default,xe.default]),Re=be.isModified||Pe.isModified||xe.isModified,[We,gt]=c.useState(0),[Je,Ve]=c.useState(0),Ue=c.useMemo(()=>{const Z=[Nc({mode:q,kernel:Y,kernelOptions:Fo().map(j=>({id:j.id,label:j.label})),onSide:w,onSlide:()=>ve("split"),onBlend:()=>ve("blend"),onKernel:j=>{ve("diff"),Ee(j)}})];return q==="diff"&&Z.push(Dt(pe,j=>Te(j))),Z},[q,Y,pe,Ee,ve,w]),Et=c.useRef(null),Ze=c.useRef(null),et=c.useRef(null),tt=c.useRef(null),[xt,$e]=c.useState(0),Ie=c.useRef(null),nt=c.useRef(null),[Ot,bt]=c.useState(0),rt=An();c.useEffect(()=>{const L=T.current;if(!L)return;let Z=!1;return Nt().then(j=>{if(!Z)try{if(Nr())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const H=j.createSurface(L,{hdr:!1});M.current={device:j,surface:H,texA:null,texB:null},B(!0)}catch(H){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",H),O(!0)}}).catch(j=>{Z||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",j),O(!0))}),()=>{var H,de;Z=!0;const j=M.current;j&&((H=j.texA)==null||H.destroy(),(de=j.texB)==null||de.destroy(),M.current=null)}},[]),c.useEffect(()=>{const L=v.current;if(!L)return;const Z=new ResizeObserver(()=>_e(j=>j+1));return Z.observe(L),()=>Z.disconnect()},[]),c.useEffect(()=>{if(!R)return;let L=!1;if(!M.current)return;async function j(H,de){if(de){const Me=Fc(de);return{width:de.width,height:de.height,imageData:null,make:Ae=>{const me=Ae.createTexture(de.width,de.height,Me.format);return me.write(Me.data),me}}}if(!H)return null;const he=await st(H);return he?{width:he.width,height:he.height,imageData:he,make:Me=>{const Ae=Me.createTexture(he.width,he.height,"rgba8unorm");return Ae.write(he.data),Ae}}:null}return Promise.all([j(e,n),j(t,r)]).then(([H,de])=>{var Oe,Xe;if(L||!M.current)return;const he=M.current;Et.current=(H==null?void 0:H.imageData)??null,Ze.current=(de==null?void 0:de.imageData)??null,et.current=n??null,tt.current=r??null,(Oe=he.texA)==null||Oe.destroy(),(Xe=he.texB)==null||Xe.destroy(),he.texA=null,he.texB=null;const Me=H??de;if(!Me){$(null),V(null),$e(je=>je+1);return}const Ae=de??Me,me=H??Me;he.texA=Ae.make(he.device),he.texB=me.make(he.device),V({a:{w:Ae.width,h:Ae.height},b:{w:me.width,h:me.height}}),$({w:Me.width,h:Me.height}),$e(je=>je+1),J(je=>je+1)}),()=>{L=!0}},[R,e,t,n,r]);const F=n!=null||r!=null,te=c.useMemo(()=>nc(Y,F),[Y,F]),D=c.useMemo(()=>{if(!F)return null;const L=r??n;if(!L)return null;const Z=L.precision==="f16-bits"?mr(L.data):L.data;return Cc(Z,L.width,L.height,L.channels)},[F,r,n]),G=c.useMemo(()=>{var L;return ks(((L=ct(te))==null?void 0:L.displayRange)??"unit",pe==="none"?null:pe)},[te,pe]),U=c.useMemo(()=>pe!=="none"?Ic(pe):void 0,[pe]),k=c.useMemo(()=>Q?Ct(Q.a,Q.b,d,x,"b"):null,[Q,d,x]),ne=c.useMemo(()=>k?Dn(k):"none",[k]),W=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",ue=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",ce=c.useMemo(()=>N?q==="diff"&&k?k.result:N:null,[q,k,N]),we=c.useCallback(()=>{const L=M.current;if(!R||!L||!L.surface||!L.texA||!L.texB||!N)return;const Z=ce??N,j=v.current,H=j?j.getBoundingClientRect():{width:Z.w,height:Z.h},de=go({zoom:S,pan:m},H,Z.w,Z.h);ee(me=>me.x===de.x&&me.y===de.y&&me.w===de.w&&me.h===de.h?me:de);const he=T.current;if(H.width>0&&H.height>0&&he&&L.surface){const me=Math.max(1,Math.round(H.width*rt)),Oe=Math.max(1,Math.round(H.height*rt));(he.width!==me||he.height!==Oe)&&(he.width=me,he.height=Oe,L.surface.configure(me,Oe))}const Me=xo(de,H,Z.w,Z.h)>=Rn?"nearest":"linear",Ae=de;try{if(q==="diff"){const me=ct(te)?te:"absolute",Oe=me==="hdr-flip"&&D?{ppd:67,startExposure:D.startExposure,stopExposure:D.stopExposure,numExposures:D.numExposures}:void 0,Xe=Xo(L.device,L.texA,L.texB,me,Oe,W,ue,k??void 0);A.current=Xe,Ec(L.device,L.surface,Xe.texture,Xe.displayRange,{uv:Ae,cmapMode:G,colormap:U,filter:Me,exposureEV:We,offset:Je})}else{const me={exposureEV:We,offset:Je,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:Ae,filter:Me,mode:q,split:s,alpha:a};Sa(L.device,L.surface,L.texA,L.texB,me)}}catch(me){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",me),O(!0)}},[R,N,ce,k,S,m.x,m.y,q,s,a,We,Je,Y,te,D,G,U,e,t,n,r,W,ue,rt]);c.useEffect(()=>{we()},[we,I,X]);const le=t!=null||r!=null;c.useEffect(()=>{const L=M.current;if(!R||!L||!L.texA||!L.texB||!le){ge(null);return}let Z=!1;const j=L.texA,H=L.texB,de=A.current,he=q==="diff"?k??void 0:void 0;return(q==="diff"&&de?gc(L.device,de,j,H,he):Br(L.device,j,H,he)).then(Ae=>{Z||ge(Ae)}),()=>{Z=!0}},[R,I,le,q,Y,k]),c.useEffect(()=>{const L=M.current;if(!R||!L||!L.texA||!L.texB||!le){K(null);return}let Z=!1;K(null);const j=q==="diff"?k??void 0:void 0;return pc(L.device,L.texA,L.texB,W,ue,j).then(H=>{Z||K(H)}).catch(()=>{Z||K(null)}),()=>{Z=!0}},[R,I,le,q,ne,W,ue]),c.useEffect(()=>{if(q!=="diff"){Ie.current=null,nt.current=null;return}const L=M.current,Z=A.current;if(!R||!L||!Z)return;let j=!1;return Ie.current=null,nt.current=null,bt(H=>H+1),Wo(L.device,Z).then(H=>{j||(Ie.current=H,nt.current={w:Z.width,h:Z.height},bt(de=>de+1))}).catch(()=>{}),()=>{j=!0}},[R,q,te,I,k]);const ke=(L,Z)=>(j,H,de)=>{const he=Z.current;if(he){const{data:Qo,width:Jo,height:Vc,channels:es}=he;if(j<0||H<0||j>=Jo||H>=Vc)return null;const an=(H*Jo+j)*es,cn=he.precision==="f16-bits"?Zn=>$t(Qo[Zn]??0):Zn=>Qo[Zn]??0,$c=.5,Xc=es===1?[cn(an)]:[cn(an),cn(an+1),cn(an+2)];return pt(Xc,"unit",de,$c)}const Me=L.current;if(!Me||j<0||H<0||j>=Me.width||H>=Me.height)return null;const Ae=(H*Me.width+j)*4,me=Me.data[Ae],Oe=Me.data[Ae+1],Xe=Me.data[Ae+2],je=At(me,Oe,Xe);return pt(me===Oe&&Oe===Xe?[me]:[me,Oe,Xe],"uint8",de,je)},Ce=c.useMemo(()=>ke(Et,et),[]),Fe=c.useMemo(()=>ke(Ze,tt),[]),ut=c.useMemo(()=>(L,Z,j)=>{var je;const H=Ie.current,de=nt.current;if(!H||!de)return null;const{w:he,h:Me}=de;if(L<0||Z<0||L>=he||Z>=Me)return null;const Ae=(Z*he+L)*4,me=((je=ct(te))==null?void 0:je.output)??"per-channel",Oe=.5,Xe=me==="scalar"?[H[Ae]??0]:[H[Ae]??0,H[Ae+1]??0,H[Ae+2]??0];return pt(Xe,"unit",j,Oe)},[te]);c.useEffect(()=>{const L=v.current;if(L)return L.__cairnCompareProbe={sampleDiff:(Z,j,H="decimal")=>ut(Z,j,H),sampleFg:(Z,j,H="decimal")=>Ce(Z,j,H),sampleRef:(Z,j,H="decimal")=>Fe(Z,j,H),get diffSamples(){return Ie.current},get dims(){return ce},get primaryDims(){return N},get diffResultDims(){return nt.current},get align(){return d},get fit(){return x},get resolvedKernelId(){return te},get compareMode(){return q},get ssimScalar(){return z},get ssimText(){return Go(z)}},()=>{L&&delete L.__cairnCompareProbe}},[ut,Ce,Fe,N,ce,d,x,te,q,z]);const on=p==="auto"?void 0:p;if(P)return n!=null||r!=null?f.jsx(Bc,{}):q==="diff"?f.jsx(Gn,{imageUrl:e,baselineUrl:t,diffMode:((Mt=ct(te))==null?void 0:Mt.kind)==="pointwise"?te:"absolute",interpolation:p,colormap:pe,showAxes:!1,zoom:S,pan:m,onViewportChange:g,label:E,pixelValueNotation:_}):f.jsx(Oc,{imageUrl:e,baselineUrl:t,mode:q,splitPosition:s,blendAlpha:a,onSplitPositionChange:u,zoom:S,pan:m,onViewportChange:g,interpolation:p,label:E,pixelValueNotation:_});const _t=f.jsxs(f.Fragment,{children:[f.jsx("canvas",{ref:T,className:"w-full h-full block",style:{imageRendering:on},"data-gpu-compare-canvas":!0}),q==="split"&&f.jsx(jo,{splitPosition:s,onChange:u,onReset:()=>u==null?void 0:u(.5)})]}),sn=!!E,qn=sn?"bottom-7":"bottom-1";return f.jsx(Zt,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":R},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:v,wrapperRef:C,zoom:S,pan:m,onViewportChange:g,naturalDims:ce,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:_t,showAxes:!1,notationSeed:_,onReset:Ge,extraModified:Re,exportCanvasRef:T,requestRender:we,leadingMenus:Ue,displayAdjust:{exposureEV:We,offset:Je,onExposureChange:gt,onOffsetChange:Ve},label:"",showLabelChip:!1,overlay:{render:({notation:L,setOverlayActive:Z})=>q==="split"?f.jsxs(f.Fragment,{children:[le&&ce&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-s)*100}% 0 0)`},children:f.jsx(ht,{imageElRef:T,naturalWidth:ce.w,naturalHeight:ce.h,zoom:S,pan:m,sourceWindow:re,sample:Fe,notation:L,version:xt})}),le&&ce&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${s*100}%)`},children:f.jsx(ht,{imageElRef:T,naturalWidth:ce.w,naturalHeight:ce.h,zoom:S,pan:m,sourceWindow:re,sample:Ce,notation:L,version:xt,onActiveChange:Z})})]}):ce&&f.jsx(ht,{imageElRef:T,naturalWidth:ce.w,naturalHeight:ce.h,zoom:S,pan:m,sourceWindow:re,sample:q==="diff"?ut:Ce,notation:L,version:q==="diff"?Ot:xt,onActiveChange:Z})},extraChips:f.jsxs(f.Fragment,{children:[q==="split"&&f.jsx(Zo,{}),sn?f.jsx(Ln,{label:E,corner:"bottom-right"}):null,ae&&f.jsxs("span",{className:`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${qn}`,"data-gpu-compare-metrics":!0,children:["MSE ",ae.mse.toExponential(2)," · PSNR ",Number.isFinite(ae.psnr)?ae.psnr.toFixed(1):"∞"," dB · MAE"," ",ae.mae.toExponential(2)," · SSIM ",Go(z)]})]})})}const Uc="cairn-plot:gpu-image-ready";async function zc(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await Nt(),window.__cairnPlotGpuImagePane=Ri,window.__cairnPlotGpuComparePane=Gc,window.__cairnPlotDiffMenuModes=Fo(),window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(Uc))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e),mo("no-webgpu")}}}zc()})(__cairnPlotJsxRuntime,__cairnPlotReact);
