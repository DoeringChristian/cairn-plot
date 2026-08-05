var Xc=Object.defineProperty;var Wc=(f,c,rt)=>c in f?Xc(f,c,{enumerable:!0,configurable:!0,writable:!0,value:rt}):f[c]=rt;var le=(f,c,rt)=>Wc(f,typeof c!="symbol"?c+"":c,rt);(function(f,c){"use strict";const rt=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function jn(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:rt}),{hdr:!1,format:n}}function es(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:rt}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:rt}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return jn(e,t)}}}const ts=`
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
`,ns=`
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
`;class rs extends Error{constructor(n){super(n);le(this,"deviceLost",!0);this.name="DeviceLostError"}}async function Qn(e,t){try{await e.mapAsync(GPUMapMode.READ)}catch(n){if((n instanceof Error?n.name:"")==="AbortError"){const o=t.info;throw new rs("webgpu readback: buffer map aborted — device lost or destroyed mid-readback"+(o?` (reason=${String(o.reason)}${o.message?`: ${o.message}`:""})`:"")+`: ${n instanceof Error?n.message:String(n)}`)}throw n instanceof Error?n:new Error(String(n))}}function un(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Jn(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function os(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const ss={texture:0,sampler:1,uniform:2};function fn(e,t){return e*3+ss[t]}const as={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function is(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),s=r[2]!==void 0,a=r[3].trim();if(s){const u=as[a];if(u===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${a}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:u})}else a==="sampler"||a==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class er{constructor(t,n,r,o){le(this,"width");le(this,"height");le(this,"format");le(this,"gpuTexture");le(this,"device");le(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:un(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*Jn(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class tr{constructor(t){le(this,"_s");le(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class cs{constructor(t,n,r,o,s){le(this,"_p");le(this,"gpuPipeline");le(this,"bindings");le(this,"bindGroupLayout");le(this,"variants");le(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=s,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function ls(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class us{constructor(t){le(this,"_c");le(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class fs{constructor(t,n,r,o,s){le(this,"width");le(this,"height");le(this,"paramsBuffer");le(this,"bindGroup");le(this,"buffers");le(this,"destroyed",!1);this.width=t,this.height=n,this.buffers=r,this.paramsBuffer=o,this.bindGroup=s}destroy(){if(!this.destroyed){for(const t of this.buffers)t.destroy();this.paramsBuffer.destroy(),this.destroyed=!0}}}class ds{constructor(t,n){le(this,"_b");le(this,"gpuBindGroup");le(this,"ownedBuffers");le(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class ps{constructor(t,n,r,o){le(this,"canvas");le(this,"hdr");le(this,"format");le(this,"context");le(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function Bt(e){return"canvas"in e}async function hs(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function s(p){return Bt(p)?p.getCurrentTextureView():p.gpuTexture.createView()}function a(p){if(Bt(p))return{width:p.canvas.width,height:p.canvas.height};const E=p;return{width:E.width,height:E.height}}let u=!1;const i={};t.lost.then(p=>{i.info=p},()=>{});let l=null;function d(){var E,_;if(l!==null)return l;let p=!1;try{if(typeof document<"u"){const v=document.createElement("canvas");v.width=1,v.height=1;const C=v.getContext("webgpu");if(C)try{C.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:GPUTextureUsage.RENDER_ATTACHMENT});const T=(E=C.getConfiguration)==null?void 0:E.call(C);p=((_=T==null?void 0:T.toneMapping)==null?void 0:_.mode)==="extended"}catch{p=!1}finally{try{C.unconfigure()}catch{}}}}catch{p=!1}return l=p,p}const x=256;let h=null,b=null;function y(){if(!h||!b){const p=t.createShaderModule({code:ts});b=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const E=t.createPipelineLayout({bindGroupLayouts:[b]});h=t.createComputePipeline({layout:E,compute:{module:p,entryPoint:"cs_main"}})}return{pipeline:h,layout:b}}let w=null,S=null;function m(){if(!w||!S){const p=t.createShaderModule({code:ns});S=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});const E=t.createPipelineLayout({bindGroupLayouts:[S]});w=t.createRenderPipeline({layout:E,vertex:{module:p,entryPoint:"vs_main"},fragment:{module:p,entryPoint:"fs_main",targets:[{format:"rgba16float"}]},primitive:{topology:"triangle-list"}})}return{pipeline:w,layout:S}}return{backend:"webgpu",capabilities:n,probeExtendedToneMapping:d,createTexture(p,E,_){return new er(t,p,E,_)},createSampler(p){const E=(p==null?void 0:p.filter)==="linear"?"linear":"nearest",_=t.createSampler({magFilter:E,minFilter:E,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new tr(_)},createRenderPipeline(p){const E=t.createShaderModule({code:p.shaderWGSL}),_=is(p.shaderWGSL),v=un(p.targetFormat),C=ls(t,_),T=t.createPipelineLayout({bindGroupLayouts:[C]}),M=A=>t.createRenderPipeline({layout:T,vertex:{module:E,entryPoint:"vs_main"},fragment:{module:E,entryPoint:"fs_main",targets:[{format:A}]},primitive:{topology:"triangle-list"}}),P=M(v);return new cs(P,_,C,v,M)},createComputePipeline(p){const E=t.createShaderModule({code:p.shaderWGSL}),_=t.createComputePipeline({layout:"auto",compute:{module:E,entryPoint:"cs_main"}});return new us(_)},createBindGroup(p,E){const _=p,v=new Map,C=[];for(const[M,P]of _.bindings)if(P.kind==="uniform"){const A=t.createBuffer({size:P.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});C.push(A),v.set(M,{binding:M,resource:{buffer:A}})}else P.kind==="sampler"&&v.set(M,{binding:M,resource:o()});for(const M of E){const P=M.resource;if(P instanceof er){const A=fn(M.binding,"texture");_.bindings.has(A)&&v.set(A,{binding:A,resource:P.gpuTexture.createView()})}else if(P instanceof tr){const A=fn(M.binding,"sampler");_.bindings.has(A)&&v.set(A,{binding:A,resource:P.gpuSampler})}else{const A=fn(M.binding,"uniform"),k=_.bindings.get(A);if(k&&k.kind==="uniform"){const R=P.uniform,O=t.createBuffer({size:Math.max(k.sizeBytes,R.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(O,0,R.buffer,R.byteOffset,R.byteLength),C.push(O),v.set(A,{binding:A,resource:{buffer:O}})}}}const T=t.createBindGroup({layout:_.bindGroupLayout,entries:Array.from(v.values())});return new ds(T,C)},createSurface(p,E){const _=p.getContext("webgpu");if(!_)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const v=E.hdr&&n.hdr,C=()=>v?es(_,t):jn(_,t),T=C();return new ps(p,_,T,C)},renderFullscreen(p,E,_){const v=E,C=_,T=s(p),{width:M,height:P}=a(p),A=Bt(p)?p.format:un(p.format),k=v.pipelineFor(A),R=t.createCommandEncoder(),O=R.beginRenderPass({colorAttachments:[{view:T,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});O.setPipeline(k),O.setBindGroup(0,C.gpuBindGroup),O.setViewport(0,0,M,P,0,1),O.draw(3),O.end(),t.queue.submit([R.finish()])},createDeepSampleBuffers(p){const{layout:E}=m(),_=A=>{const k=t.createBuffer({size:A.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});return t.queue.writeBuffer(k,0,A.buffer,A.byteOffset,A.byteLength),k},v=_(p.offsets),C=_(p.colors),T=_(p.zs),M=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),P=t.createBindGroup({layout:E,entries:[{binding:0,resource:{buffer:v}},{binding:1,resource:{buffer:C}},{binding:2,resource:{buffer:T}},{binding:3,resource:{buffer:M}}]});return new fs(p.width,p.height,[v,C,T],M,P)},compositeDeep(p,E,_,v){const C=p,T=E,{pipeline:M}=m();t.queue.writeBuffer(C.paramsBuffer,0,new Float32Array([C.width,C.height,v,_]));const P=t.createCommandEncoder(),A=P.beginRenderPass({colorAttachments:[{view:T.gpuTexture.createView(),loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});A.setPipeline(M),A.setBindGroup(0,C.bindGroup),A.setViewport(0,0,T.width,T.height,0,1),A.draw(3),A.end(),t.queue.submit([P.finish()])},async readback(p){const E=Bt(p),{width:_,height:v}=a(p),C=E?p.hdr?"rgba16float":"rgba8unorm":p.format,T=E&&p.format==="bgra8unorm",M=E?p.getCurrentGPUTexture():p.gpuTexture,P=Jn(C),A=_*P,k=256,R=Math.ceil(A/k)*k,O=R*v,B=t.createBuffer({size:O,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),X=t.createCommandEncoder();X.copyTextureToBuffer({texture:M},{buffer:B,bytesPerRow:R,rowsPerImage:v},{width:_,height:v,depthOrArrayLayers:1}),t.queue.submit([X.finish()]);try{await Qn(B,i)}catch(I){try{B.destroy()}catch{}throw I}const Q=new Uint8Array(B.getMappedRange()),z=new Uint8Array(A*v);for(let I=0;I<v;I++){const J=I*R,W=I*A;z.set(Q.subarray(J,J+A),W)}if(B.unmap(),B.destroy(),C==="rgba8unorm"){if(T)for(let I=0;I<z.length;I+=4){const J=z[I],W=z[I+2];z[I]=W,z[I+2]=J}return z}if(C==="rgba16float"){const I=new Uint16Array(z.buffer,z.byteOffset,z.byteLength/2),J=new Float32Array(I.length);for(let W=0;W<I.length;W++)J[W]=os(I[W]);return J}return new Float32Array(z.buffer,z.byteOffset,z.byteLength/4)},async reduceDiffSumSquaredAbs(p,E,_,v){const C=p,T=E,M=Math.max(0,_*v),P=Math.max(1,Math.ceil(M/x)),{pipeline:A,layout:k}=y(),R=P*2*4,O=t.createBuffer({size:R,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),B=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(B,0,new Uint32Array([Math.max(1,_),Math.max(1,v),M,0]));const X=t.createBindGroup({layout:k,entries:[{binding:0,resource:C.gpuTexture.createView()},{binding:1,resource:T.gpuTexture.createView()},{binding:2,resource:{buffer:O}},{binding:3,resource:{buffer:B}}]}),Q=t.createBuffer({size:R,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),z=t.createCommandEncoder(),I=z.beginComputePass();I.setPipeline(A),I.setBindGroup(0,X),I.dispatchWorkgroups(P),I.end(),z.copyBufferToBuffer(O,0,Q,0,R),t.queue.submit([z.finish()]);try{await Qn(Q,i)}catch(xe){for(const $ of[Q,O,B])try{$.destroy()}catch{}throw xe}const W=new Float32Array(Q.getMappedRange()).slice();Q.unmap(),Q.destroy(),O.destroy(),B.destroy();let Ee=0,ae=0;for(let xe=0;xe<P;xe++)Ee+=W[xe*2],ae+=W[xe*2+1];return{sumSq:Ee,sumAbs:ae}},destroy(){u||(t.destroy(),u=!0)},isContextLost(){return!1}}}let dn=null;async function ms(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return hs()}function Nt(){return dn||(dn=ms()),dn}function gs(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function xs(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),s=Math.floor(o),a=Math.min(s+1,e.length-1),u=o-s,[i,l,d]=gs(e[s],e[a],u);t[n*3]=Math.round(i),t[n*3+1]=Math.round(l),t[n*3+2]=Math.round(d)}return t}const pn={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},bs=Object.keys(pn),vs={viridis:"Viridis",plasma:"Plasma",magma:"Magma","red-green":"Red–Green","red-blue":"Red–Blue"},ws=bs.map(e=>({id:e,label:vs[e]})),ys=new Set(["red-green","red-blue"]),nr=new Map;function hn(e){let t=nr.get(e);if(!t){const n=pn[e]??pn.viridis;t=xs(n),nr.set(e,t)}return t}function ft(e,t,n){return e<t?t:e>n?n:e}function Ie(e){return e<0?0:e>1?1:e}function It(e,t,n){return ft(Math.floor(e),t,n)}const mn=e=>{const t=e<0?0:e;return t/(1+t)},gn=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return Ie(n/r)},rr=4,Es=1,Ft=16,_s=.5,or={linear:([e,t,n])=>[Ie(e),Ie(t),Ie(n)],srgb:([e,t,n])=>[Ie(e),Ie(t),Ie(n)],gamma:([e,t,n])=>[Ie(e),Ie(t),Ie(n)],reinhard:([e,t,n])=>[mn(e),mn(t),mn(n)],aces:([e,t,n])=>[gn(e),gn(t),gn(n)],extended:([e,t,n])=>[e,t,n]},sr="srgb",ar=["linear","srgb","gamma","reinhard","aces"],Ms=["srgb","gamma","linear"],ir={extended:"linear","extended-clamp":"linear","extended-reinhard":"reinhard","extended-aces":"aces","extended-gamma":"gamma"};function Ss(e){return e&&or[e]||or[sr]}function Mt(e){return e&&ir[e]?ir[e]:e&&ar.includes(e)?e:sr}const cr=Mt;function Ts(e){return e==="extended"?Rs:void 0}function Ps(e,t){return e==null?"srgb":cr(e)}function Gt(e,t,n){return e*2**t+n}function As(e){const t=Ie(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function xn(e){const t=Ie(e);return t<=.04045?t/12.92:Math.pow((t+.055)/1.055,2.4)}function bt(e,t){return typeof t=="number"&&t>0?Ie(Math.pow(Ie(e),1/t)):As(e)}const St=2.2,bn=.5,vn=4,wn=.1;function Ut(e){return e==="gamma"}function zt(e,t){if(e==="gamma")return t>0?t:St;if(e==="linear")return 1}const Rs=1/0;function Cs(e,t,n,r){const o=cr(e),s=zt(o,r);if(!n||Number.isFinite(t)&&t<=1)return{operator:o,hdrOut:!1,peak:1,gamma:s};const a=!Number.isFinite(t);switch(o){case"reinhard":return a?{operator:"extended",hdrOut:!0,peak:Ft,gamma:void 0}:{operator:"extended-reinhard",hdrOut:!0,peak:t,gamma:void 0};case"aces":return{operator:"extended-aces",hdrOut:!0,peak:a?Ft:t,gamma:void 0};default:return a?{operator:"extended",hdrOut:!0,peak:Ft,gamma:s}:{operator:"extended-clamp",hdrOut:!0,peak:t,gamma:s}}}function yn(e,t,n="linear",r=0,o=0){const s=hn(t),a=new ImageData(e.width,e.height),u=e.data,i=a.data,l=r!==0||o!==0;for(let d=0;d<u.length;d+=4){let x=(u[d]+u[d+1]+u[d+2])/3;l&&(x=Math.max(0,Math.min(255,Gt(x/255,r,o)*255)));let h;n==="positive"?h=Math.round(128+x/255*127):h=Math.round(x),h=Math.max(0,Math.min(255,h)),i[d]=s[h*3],i[d+1]=s[h*3+1],i[d+2]=s[h*3+2],i[d+3]=u[d+3]}return a}function Ds(e,t){return e==="signed"||e==="relative"?"signed":En(t)}function En(e){return ys.has(e??"")?"positive":"linear"}function lr(e,t){const n=new Map;return{get(r){const o=n.get(r);if(o!==void 0)return n.delete(r),n.set(r,o),o},set(r,o){for(n.get(r)!==void 0&&n.delete(r),n.set(r,o);n.size>e;){const a=n.keys().next().value;if(a===void 0)break;n.get(a),n.delete(a)}},has(r){return n.has(r)},get size(){return n.size}}}const ur=lr(50);function _n(e){return ur.get(e)}function Mn(e,t){ur.set(e,t)}const fr=lr(100);function ks(e){return fr.get(e)}function Ls(e,t){fr.set(e,t)}function Os(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),s=new ImageData(r,o);for(let a=0;a<o;a++)for(let u=0;u<r;u++){const i=(a*e.width+u)*4,l=(a*t.width+u)*4,d=(a*r+u)*4;for(let x=0;x<3;x++){const h=e.data[i+x],b=t.data[l+x],y=h-b,w=Math.abs(y),S=Math.max(h,1);let m;switch(n){case"signed":m=(y+255)/2;break;case"absolute":m=w;break;case"squared":m=y*y/255;break;case"relative_signed":m=(y/S+1)*127.5;break;case"relative_absolute":m=w/S*255;break;case"relative_squared":m=y*y/(S*S)*255;break}s.data[d+x]=Math.min(255,Math.max(0,Math.round(m)))}s.data[d+3]=255}return s}async function ot(e){const t=ks(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const s=o.getContext("2d");if(!s){n(null);return}s.drawImage(r,0,0);const a=s.getImageData(0,0,o.width,o.height);Ls(e,a),n(a)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const Bs={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},Ns={linear:0,signed:1,positive:2},Is=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,Fs=`#version 300 es
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
}`;let dt=null,se=null,Be=null,$t=null;function Gs(){if(se)return se;try{if(typeof OffscreenCanvas<"u"?dt=new OffscreenCanvas(1,1):dt=document.createElement("canvas"),se=dt.getContext("webgl2",{preserveDrawingBuffer:!0}),!se)return console.warn("[cairn] WebGL 2 not available"),null;const e=se.createShader(se.VERTEX_SHADER);if(se.shaderSource(e,Is),se.compileShader(e),!se.getShaderParameter(e,se.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",se.getShaderInfoLog(e)),null;const t=se.createShader(se.FRAGMENT_SHADER);if(se.shaderSource(t,Fs),se.compileShader(t),!se.getShaderParameter(t,se.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",se.getShaderInfoLog(t)),null;if(Be=se.createProgram(),se.attachShader(Be,e),se.attachShader(Be,t),se.linkProgram(Be),!se.getProgramParameter(Be,se.LINK_STATUS))return console.error("[cairn] WebGL program link:",se.getProgramInfoLog(Be)),null;$t=se.createVertexArray(),se.bindVertexArray($t);const n=se.createBuffer();se.bindBuffer(se.ARRAY_BUFFER,n),se.bufferData(se.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),se.STATIC_DRAW);const r=se.getAttribLocation(Be,"a_pos");return se.enableVertexAttribArray(r),se.vertexAttribPointer(r,2,se.FLOAT,!1,0,0),se.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),se}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function dr(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function Us(e,t,n){const r=new Uint8Array(1024);for(let s=0;s<256;s++)r[s*4]=t[s*3],r[s*4+1]=t[s*3+1],r[s*4+2]=t[s*3+2],r[s*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function zs(e,t,n,r){const o=Gs();if(!o||!Be||!$t||!dt)return null;const s=Math.min(e.width,t.width),a=Math.min(e.height,t.height);dt.width=s,dt.height=a,o.viewport(0,0,s,a);const u=dr(o,e,0),i=dr(o,t,1);let l=null;n.colormap?l=Us(o,n.colormap,2):(l=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,l),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(Be),o.uniform1i(o.getUniformLocation(Be,"u_baseline"),0),o.uniform1i(o.getUniformLocation(Be,"u_other"),1),o.uniform1i(o.getUniformLocation(Be,"u_lut"),2),o.uniform1i(o.getUniformLocation(Be,"u_diff_mode"),Bs[n.diffMode]),o.uniform1i(o.getUniformLocation(Be,"u_cmap_mode"),Ns[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(Be,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray($t),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=s,r.height=a;const d=r.getContext("2d");return d&&(d.save(),d.scale(1,-1),d.drawImage(dt,0,0,s,a,0,-a,s,a),d.restore()),o.deleteTexture(u),o.deleteTexture(i),o.deleteTexture(l),{width:s,height:a}}const $s="cairn:render-mode";function Vs(){try{const e=localStorage.getItem($s);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const Xs=.299,Ws=.587,Hs=.114;function Tt(e,t,n){return(Xs*e+Ws*t+Hs*n)/255}const Vt=15360;function Xt(e){const t=e&32768?-1:1,n=e>>10&31,r=e&1023;return n===0?r===0?t*0:t*r*2**-24:n===31?r===0?t*(1/0):NaN:t*2**(n-15)*(1+r/1024)}const pr=globalThis.Float16Array;function hr(e,t=e.length){if(pr){const r=new pr(e.buffer,e.byteOffset,t);return Float32Array.from(r)}const n=new Float32Array(t);for(let r=0;r<t;r++)n[r]=Xt(e[r]);return n}const We=new Uint32Array(512),He=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(We[e]=0,We[e|256]=32768,He[e]=24,He[e|256]=24):t<-14?(We[e]=1024>>-t-14,We[e|256]=1024>>-t-14|32768,He[e]=-t-1,He[e|256]=-t-1):t<=15?(We[e]=t+15<<10,We[e|256]=t+15<<10|32768,He[e]=13,He[e|256]=13):t<128?(We[e]=31744,We[e|256]=64512,He[e]=24,He[e|256]=24):(We[e]=31744,We[e|256]=64512,He[e]=13,He[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var Pt=Uint8Array,mr=Uint16Array,Ys=Int32Array,Ks=new Pt([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),qs=new Pt([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),gr=function(e,t){for(var n=new mr(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new Ys(n[30]),r=1;r<30;++r)for(var s=n[r];s<n[r+1];++s)o[s]=s-n[r]<<5|r;return{b:n,r:o}},xr=gr(Ks,2),Zs=xr.b,js=xr.r;Zs[28]=258,js[258]=28,gr(qs,0);for(var Qs=new mr(32768),ye=0;ye<32768;++ye){var st=(ye&43690)>>1|(ye&21845)<<1;st=(st&52428)>>2|(st&13107)<<2,st=(st&61680)>>4|(st&3855)<<4,Qs[ye]=((st&65280)>>8|(st&255)<<8)>>1}for(var Wt=new Pt(288),ye=0;ye<144;++ye)Wt[ye]=8;for(var ye=144;ye<256;++ye)Wt[ye]=9;for(var ye=256;ye<280;++ye)Wt[ye]=7;for(var ye=280;ye<288;++ye)Wt[ye]=8;for(var Js=new Pt(32),ye=0;ye<32;++ye)Js[ye]=5;var ea=new Pt(0),ta=typeof TextDecoder<"u"&&new TextDecoder,na=0;try{ta.decode(ea,{stream:!0}),na=1}catch{}const br=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function Sn(e){const t=br.length;return br[(e%t+t)%t]}function ra(e){const n=c.useRef(null),[r,o]=c.useState({w:0,h:0}),s=c.useRef(null),a=c.useRef(null),u=c.useRef(null),i=c.useCallback((l,d)=>{o(x=>x.w===l&&x.h===d?x:{w:l,h:d})},[]);return c.useLayoutEffect(()=>{const l=n.current;if(!l||l===u.current)return;const d=l.getBoundingClientRect();(d.width>0||d.height>0)&&(u.current=l,i(d.width,d.height))}),c.useEffect(()=>{var x;const l=n.current;if(l===a.current||((x=s.current)==null||x.disconnect(),s.current=null,a.current=l,!l))return;const d=new ResizeObserver(h=>{for(const b of h)i(b.contentRect.width,b.contentRect.height)});s.current=d,d.observe(l)}),c.useEffect(()=>()=>{var l;return(l=s.current)==null?void 0:l.disconnect()},[]),{ref:n,size:r}}function oa(){const[e,t]=c.useState(!1);return c.useEffect(()=>{const n=s=>{(s.key==="Alt"||s.key==="Control"||s.key==="Meta")&&t(!0)},r=s=>{(s.key==="Alt"||s.key==="Control"||s.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const sa=.001;function aa(e,t=sa){return Math.exp(-e*t)}function vr(e,t){return Math.hypot(e.x-t.x,e.y-t.y)}function wr(e,t){return{x:(e.x+t.x)/2,y:(e.y+t.y)/2}}function ia(e,t,n,r,o,s,a){const u=t>0&&r>0?r/t:1,i=Math.max(s,Math.min(a,e.zoom*u)),l=(n.x-e.pan.x)/e.zoom,d=(n.y-e.pan.y)/e.zoom;return{zoom:i,pan:{x:o.x-l*i,y:o.y-d*i}}}const ca=.25,Tn=64;function Pn(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return Tn;const o=Math.min(n/e,r/t);return o<=0?Tn:Math.max(Math.max(n,r)/o,8)}function yr(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:s=ca,maxZoom:a=Tn,naturalWidth:u,naturalHeight:i}=e,l=oa(),d=c.useRef(l);d.current=l;const x=c.useRef({zoom:n,pan:r});x.current={zoom:n,pan:r};const h=c.useRef(o);h.current=o,c.useEffect(()=>{const T=t.current;if(!T||!o)return;const M=P=>{var J;if(!P.ctrlKey&&!d.current)return;P.preventDefault(),P.stopPropagation();const A=aa(P.deltaY),k=x.current,R=T.getBoundingClientRect(),O=u&&i?Pn(u,i,R.width,R.height):a,B=Math.max(s,Math.min(O,k.zoom*A));if(k.zoom===B)return;const X=P.clientX-R.left,Q=P.clientY-R.top,z=X-(X-k.pan.x)/k.zoom*B,I=Q-(Q-k.pan.y)/k.zoom*B;(J=h.current)==null||J.call(h,{zoom:B,pan:{x:z,y:I}})};return T.addEventListener("wheel",M,{passive:!1}),()=>T.removeEventListener("wheel",M)},[t,!!o,s,a,u,i]);const b=c.useRef(new Map),y=c.useRef(null),w=c.useRef(null),S=c.useCallback((T,M,P)=>{const A=T.getBoundingClientRect();return{x:M-A.left,y:P-A.top}},[]),m=c.useCallback(T=>{if(!u||!i)return a;const M=T.getBoundingClientRect();return Pn(u,i,M.width,M.height)},[u,i,a]),g=c.useCallback((T,M)=>{const P=b.current,A=P.get(T),k=P.get(M);!A||!k||(y.current=null,w.current={idA:T,idB:M,startDist:vr(A,k),startMid:wr(A,k),startZoom:x.current.zoom,startPan:{...x.current.pan}})},[]),p=c.useCallback(T=>{const M=b.current.get(T);M&&(y.current={pointerId:T,startX:M.x,startY:M.y,panX:x.current.pan.x,panY:x.current.pan.y})},[]),E=c.useCallback(T=>{if(!h.current)return;const M=T.pointerType==="touch";if(!M&&!d.current)return;const P=T.currentTarget;if(P.setPointerCapture(T.pointerId),b.current.set(T.pointerId,S(P,T.clientX,T.clientY)),M&&b.current.size>=2){const A=[...b.current.keys()];g(A[A.length-2],A[A.length-1]);return}p(T.pointerId)},[S,g,p]),_=c.useCallback(T=>{var R,O;const M=T.currentTarget,P=b.current.get(T.pointerId);if(P){const B=S(M,T.clientX,T.clientY);P.x=B.x,P.y=B.y}const A=w.current;if(A){const B=b.current.get(A.idA),X=b.current.get(A.idB);if(!B||!X)return;const Q=ia({zoom:A.startZoom,pan:A.startPan},A.startDist,A.startMid,vr(B,X),wr(B,X),s,m(M));(R=h.current)==null||R.call(h,Q);return}const k=y.current;!k||k.pointerId!==T.pointerId||!P||(O=h.current)==null||O.call(h,{zoom:x.current.zoom,pan:{x:k.panX+(P.x-k.startX),y:k.panY+(P.y-k.startY)}})},[S,s,m]),v=c.useCallback(T=>{var P;try{T.currentTarget.releasePointerCapture(T.pointerId)}catch{}b.current.delete(T.pointerId);const M=w.current;if(M&&(T.pointerId===M.idA||T.pointerId===M.idB)){w.current=null;const A=[...b.current.keys()];A.length===1&&p(A[0]);return}((P=y.current)==null?void 0:P.pointerId)===T.pointerId&&(y.current=null)},[p]);return{containerProps:{onPointerDown:E,onPointerMove:_,onPointerUp:v,onPointerCancel:v,style:{cursor:l&&!!o?"move":void 0,touchAction:o?"none":void 0}},modifierActive:l}}function An(){const[e,t]=c.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return c.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),s())};function s(){if(n)return;const a=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${a}dppx)`),r.addEventListener("change",o,{once:!0})}return s(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function Fe(e){const t=c.useRef(e),[n,r]=c.useState(e),o=c.useCallback(()=>r(t.current),[]);return[n,r,{reset:o,isModified:!Object.is(n,t.current),default:t.current}]}function la(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function Er(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function Rn({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:s}=ra(),a=c.useRef(null),u=c.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),i=c.useMemo(()=>{const w=s.w,S=s.h;if(w<=0||S<=0||n<=0||r<=0)return null;const m=Math.min(w/n,S/r),g=n*m,p=r*m;return{left:(w-g)/2,top:(S-p)/2,width:g,height:p}},[s.w,s.h,n,r]),l=e.masks,d=t.showMasks&&!!l&&l.length>0,x=c.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(c.useEffect(()=>{if(!d||!l)return;const w=a.current;if(!w)return;(w.width!==n||w.height!==r)&&(w.width=n,w.height=r);const S=w.getContext("2d");if(!S)return;S.clearRect(0,0,w.width,w.height);let m=!1;const g=S.createImageData(n,r),p=g.data;let E=l.length,_=!1;const v=()=>{m||_&&S.putImageData(g,0,0)},C=document.createElement("canvas");C.width=n,C.height=r;const T=C.getContext("2d",{willReadFrequently:!0});for(const M of l){const P=new Image;P.onload=()=>{if(!m){if(T){T.clearRect(0,0,n,r),T.drawImage(P,0,0,n,r);const A=T.getImageData(0,0,n,r).data;for(let k=0;k<n*r;k++){const R=A[k*4];if(R===0||u.has(R))continue;const[O,B,X]=la(Sn(R));p[k*4]=O,p[k*4+1]=B,p[k*4+2]=X,p[k*4+3]=255,_=!0}}E-=1,E===0&&v()}},P.onerror=()=>{E-=1,E===0&&v()},P.src=`data:image/png;base64,${M.png_b64}`}return()=>{m=!0}},[d,l,n,r,x]),!i)return f.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const h=e.boxes??[],b=t.showBoxes&&h.length>0,y=e.class_labels??{};return f.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[d&&f.jsx("canvas",{ref:a,className:"absolute",style:{left:i.left,top:i.top,width:i.width,height:i.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),b&&f.jsx("svg",{className:"absolute",style:{left:i.left,top:i.top,width:i.width,height:i.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:h.map((w,S)=>{if(!Er(w,t,u))return null;const m=w.domain==="pixel"?1:n,g=w.domain==="pixel"?1:r,p=w.position.minX*m,E=w.position.minY*g,_=(w.position.maxX-w.position.minX)*m,v=(w.position.maxY-w.position.minY)*g;return f.jsx("rect",{x:p,y:E,width:_,height:v,fill:"none",stroke:Sn(w.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},S)})}),b&&f.jsx("div",{className:"absolute",style:{left:i.left,top:i.top,width:i.width,height:i.height},children:h.map((w,S)=>{if(!Er(w,t,u))return null;const m=w.domain==="pixel"?1/n:1,g=w.domain==="pixel"?1/r:1,p=w.position.minX*m*100,E=w.position.minY*g*100,_=w.label??y[String(w.class_id)]??`#${w.class_id}`,v=w.score!=null?` ${(w.score*100).toFixed(0)}%`:"";return!_&&!v?null:f.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${p}%`,top:`${E}%`,transform:"translateY(-100%)",backgroundColor:Sn(w.class_id)},children:f.jsxs("span",{className:"mono",children:[_,v]})},S)})})]})}function ua(e,t){const n=t==null?void 0:t.precision,r=fa(e,n);return t!=null&&t.minus?r.replace("-","−"):r}function fa(e,t){if(!Number.isFinite(e))return String(e);if(e===0)return"0";const n=Math.abs(e);return n>=1e3||n<.001?e.toExponential(Math.max(0,t-2)):Number(e.toPrecision(t)).toString()}const da={x:0,y:0,w:1,h:1};function Ht(e){const t=e.sourceWindow??da,n=t.x*e.naturalWidth,r=t.y*e.naturalHeight,o=t.w*e.naturalWidth,s=t.h*e.naturalHeight,a=Math.min(e.box.width/o,e.box.height/s),u=o*a,i=s*a;return{scale:a,imgLeft:e.box.left+(e.box.width-u)/2,imgTop:e.box.top+(e.box.height-i)/2,srcOriginX:n,srcOriginY:r,visibleW:o,visibleH:s}}function pa(e){return Ht(e).scale}function _r(e,t,n){const r=Ht(n);return{x:r.srcOriginX+(e-r.imgLeft)/r.scale,y:r.srcOriginY+(t-r.imgTop)/r.scale}}function Mr(e,t,n){const r=Ht(n);return{x:r.imgLeft+(e-r.srcOriginX)*r.scale,y:r.imgTop+(t-r.srcOriginY)*r.scale}}function ha(e,t){const n=Mr(e.x0,e.y0,t),r=Mr(e.x1+1,e.y1+1,t);return{left:n.x,top:n.y,width:r.x-n.x,height:r.y-n.y}}function Sr(e,t,n,r,o){const s=_r(e,t,o),a=_r(n,r,o),u=o.naturalWidth-1,i=o.naturalHeight-1,l=Math.min(s.x,a.x),d=Math.max(s.x,a.x),x=Math.min(s.y,a.y),h=Math.max(s.y,a.y);return d<0||l>u||h<0||x>i?null:{x0:It(l,0,u),y0:It(x,0,i),x1:It(d,0,u),y1:It(h,0,i)}}const Cn=30,Yt=["#ff5a5a","#39d353","#5b9bff"];function Dn(e){return ua(e,{precision:3})}function vt(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):Dn(e/255):Dn(n==="int"?e*255:e)}function pt(e,t,n,r){return e.length===1?{lines:[vt(e[0],t,n)],luminance:r}:{lines:e.map(o=>vt(o,t,n)),luminance:r,colors:e.map((o,s)=>Yt[s]??null)}}const ma={x:0,y:0,w:1,h:1};function ht({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:s,notation:a="decimal",version:u=0,onActiveChange:i,sourceWindow:l=ma}){const d=c.useRef(null),x=c.useRef(!1),h=An(),b=c.useRef(i);b.current=i;const y=c.useCallback(S=>{var m;S!==x.current&&(x.current=S,(m=b.current)==null||m.call(b,S))},[]),w=c.useCallback(()=>{var re;const S=d.current,m=e.current;if(!S)return;const g=window.devicePixelRatio||1,p=S.clientWidth,E=S.clientHeight;if(p===0||E===0)return;S.width!==Math.round(p*g)&&(S.width=Math.round(p*g)),S.height!==Math.round(E*g)&&(S.height=Math.round(E*g));const _=S.getContext("2d");if(!_)return;if(_.setTransform(g,0,0,g,0,0),_.clearRect(0,0,p,E),!m||t<=0||n<=0){y(!1);return}const v=m.getBoundingClientRect(),C=S.getBoundingClientRect();if(v.width===0||v.height===0){y(!1);return}const M=Ht({box:v,naturalWidth:t,naturalHeight:n,sourceWindow:l}),{srcOriginX:P,srcOriginY:A,visibleW:k,visibleH:R,scale:O}=M;if(k<=0||R<=0){y(!1);return}if(O<Cn){y(!1);return}const B=M.imgLeft-C.left,X=M.imgTop-C.top,Q=Math.max(Math.floor(P),Math.floor(P+(0-B)/O)),z=Math.min(Math.ceil(P+k),Math.ceil(P+(p-B)/O)),I=Math.max(Math.floor(A),Math.floor(A+(0-X)/O)),J=Math.min(Math.ceil(A+R),Math.ceil(A+(E-X)/O));if(z<=Q||J<=I){y(!1);return}y(!0);const W=B+(0-P)*O,Ee=X+(0-A)*O,ae=B+(t-P)*O,xe=X+(n-A)*O;_.save(),_.beginPath(),_.rect(W,Ee,ae-W,xe-Ee),_.clip(),_.textAlign="center",_.textBaseline="middle",_.lineJoin="round";const $=O*.14,q=O-$*2;for(let ee=I;ee<J;ee++)for(let oe=Q;oe<z;oe++){if(oe<0||ee<0||oe>=t||ee>=n)continue;const Y=s(oe,ee,a);if(!Y||Y.lines.length===0)continue;const fe=Y.lines.length;let me=1;for(const ze of Y.lines)ze.length>me&&(me=ze.length);const we=q/(fe*1.15),K=q/(me*.62)||we,Se=Math.min(we,K,24);if(Se<6)continue;const ve=B+(oe-P+.5)*O,_e=X+(ee-A+.5)*O,de=Se*1.15,Te=Y.luminance<=.55,Ge=Te?"#ffffff":"#000000";_.font=`${Se}px ui-monospace, SFMono-Regular, Menlo, monospace`,_.lineWidth=Math.max(1.4,Se*.16),_.strokeStyle=Te?"rgba(0,0,0,0.85)":"rgba(255,255,255,0.9)";let Re=_e-fe*de/2+de/2;for(let ze=0;ze<Y.lines.length;ze++){const ke=Y.lines[ze];_.strokeText(ke,ve,Re),_.fillStyle=((re=Y.colors)==null?void 0:re[ze])??Ge,_.fillText(ke,ve,Re),Re+=de}}_.restore()},[e,t,n,s,a,y,l]);return c.useEffect(()=>{w()},[w,r,o.x,o.y,u,a,l,h]),c.useEffect(()=>{const S=d.current;if(!S)return;const m=new ResizeObserver(()=>w());return m.observe(S),()=>m.disconnect()},[w]),f.jsx("canvas",{ref:d,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function Tr({notation:e,onChange:t,className:n=""}){return f.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const ga=`
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
`,$e=`
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
`,At=`
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
`,xa=`
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
`,Kt=`
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
${$e}
${mt}
${xa}

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
`}const ba=Pr("select(colorB, colorA, uv.x < split)"),va=Pr("mix(colorA, colorB, alpha)");function wa(e){switch(e){case"center":return{v:"center",h:"center"};case"top-right":return{v:"top",h:"right"};case"bottom-left":return{v:"bottom",h:"left"};case"bottom-right":return{v:"bottom",h:"right"};case"top-left":default:return{v:"top",h:"left"}}}function Ar(e,t,n){const{v:r,h:o}=wa(n),s=e.w-t.w,a=e.h-t.h,u=o==="left"?0:o==="right"?s:Math.floor(s/2),i=r==="top"?0:r==="bottom"?a:Math.floor(a/2);return{x:u,y:i}}function Rt(e,t,n,r,o="b"){if(r==="fill"){const a=o==="a"?{w:e.w,h:e.h}:{w:t.w,h:t.h};return{fit:r,result:a,offsetA:{x:0,y:0},offsetB:{x:0,y:0}}}const s={w:Math.min(e.w,t.w),h:Math.min(e.h,t.h)};return{fit:r,result:s,offsetA:Ar(e,s,n),offsetB:Ar(t,s,n)}}function kn(e){return`${e.fit}:${e.result.w}x${e.result.h}:${e.offsetA.x},${e.offsetA.y}:${e.offsetB.x},${e.offsetB.y}`}const Ln={linear:0,srgb:1,reinhard:2,aces:3,extended:4,"extended-reinhard":5,"extended-aces":6,"extended-clamp":7,gamma:8},Rr=new WeakMap;function ya(e,t){let n=Rr.get(e);n||(n=new Map,Rr.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:ga,targetFormat:t}),n.set(t,r)),r}function Cr(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function Dr(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function Ea(e,t,n,r){var g;const o=Cr(t),s=ya(e,o),a=Dr(e,r.isScalar?r.colormap:void 0),u=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,i=Ln[r.operator]??Ln.srgb,l=new Float32Array([r.exposureEV,i,u,r.isScalar?1:0]),d=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),x=new Float32Array([r.hdrOut?1:0]),h=new Float32Array([r.filter==="nearest"?0:1]),b=new Float32Array([r.offset??0]),y=new Float32Array([r.peak??rr]),w=new Float32Array([r.srgbDecode?1:0]),S=new Float32Array([r.hdrEncodeLegacy?1:0]);let m;try{m=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:a},{binding:2,resource:{uniform:l}},{binding:3,resource:{uniform:d}},{binding:4,resource:{uniform:x}},{binding:5,resource:{uniform:h}},{binding:6,resource:{uniform:b}},{binding:7,resource:{uniform:y}},{binding:8,resource:{uniform:w}},{binding:9,resource:{uniform:S}}]),e.renderFullscreen(t,s,m)}finally{(g=m==null?void 0:m.destroy)==null||g.call(m),a.destroy()}}const kr=new WeakMap;function _a(e,t,n){let r=kr.get(e);r||(r=new Map,kr.set(e,r));const o=`${t}:${n}`;let s=r.get(o);return s||(s=e.createRenderPipeline({shaderWGSL:t==="split"?ba:va,targetFormat:n}),r.set(o,s)),s}function Ma(e,t,n,r,o){var w;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const s=Cr(t),a=_a(e,o.mode,s),u=Dr(e,void 0),i=o.gamma,l=Ln[o.operator],d=new Float32Array([o.exposureEV,l,i,0]),x=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),h=new Float32Array([o.split,o.alpha,0,o.filter==="nearest"?0:1]),b=new Float32Array([o.offset??0,0,0,0]);let y;try{y=e.createBindGroup(a,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:u},{binding:3,resource:{uniform:d}},{binding:4,resource:{uniform:x}},{binding:5,resource:{uniform:h}},{binding:6,resource:{uniform:b}}]),e.renderFullscreen(t,a,y)}finally{(w=y==null?void 0:y.destroy)==null||w.call(y),u.destroy()}}function Lr(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,s=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:s,mae:o}}async function Or(e,t,n,r){const o=r??Rt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),s=o.result.w,a=o.result.h,u=s*a*3;if(u<=0)return{mse:0,psnr:1/0,mae:0};if(o.fit==="crop"&&o.offsetA.x===0&&o.offsetA.y===0&&o.offsetB.x===0&&o.offsetB.y===0&&e.reduceDiffSumSquaredAbs){const{sumSq:p,sumAbs:E}=await e.reduceDiffSumSquaredAbs(t,n,s,a);return Lr(p,E,u)}const l=await e.readback(t),d=await e.readback(n),x=l instanceof Uint8Array?255:1,h=d instanceof Uint8Array?255:1,b=qt(l,t.width,t.height,x,o.offsetA,o.fit==="fill",s,a),y=qt(d,n.width,n.height,h,o.offsetB,o.fit==="fill",s,a);let w=0,S=0;const m=[0,0,0],g=[0,0,0];for(let p=0;p<a;p++)for(let E=0;E<s;E++){b(E,p,m),y(E,p,g);for(let _=0;_<3;_++){const v=m[_]-g[_];w+=v*v,S+=Math.abs(v)}}return Lr(w,S,u)}function qt(e,t,n,r,o,s,a,u){const i=(x,h,b)=>e[(h*t+x)*4+b]??0;if(!s)return(x,h,b)=>{const y=Math.min(Math.max(x+o.x,0),t-1),w=Math.min(Math.max(h+o.y,0),n-1);b[0]=i(y,w,0)/r,b[1]=i(y,w,1)/r,b[2]=i(y,w,2)/r};const l=t-1,d=n-1;return(x,h,b)=>{const y=(x+.5)/a,w=(h+.5)/u,S=y*t-.5,m=w*n-.5,g=Math.floor(S),p=Math.floor(m),E=S-g,_=m-p,v=Math.min(Math.max(g,0),l),C=Math.min(Math.max(g+1,0),l),T=Math.min(Math.max(p,0),d),M=Math.min(Math.max(p+1,0),d);for(let P=0;P<3;P++){const A=i(v,T,P),k=i(C,T,P),R=i(v,M,P),O=i(C,M,P),B=A+(k-A)*E,X=R+(O-R)*E;b[P]=(B+(X-B)*_)/r}}}function Br(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const Sa=12,at=[];function Nr(e){const t=at.indexOf(e);t!==-1&&at.splice(t,1),at.push(e)}function Ta(e){const t=at.indexOf(e);t!==-1&&at.splice(t,1)}function Zt(e){e.parked||(Ta(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),e.surface=null,e.parked=!0)}function Ir(e){for(;at.length>Sa;){const t=at.find(n=>n!==e&&!n.visible)??at.find(n=>n!==e);if(!t)break;Zt(t)}}function Fr(e){var o,s,a,u;if(e.disposed)return;if(Br())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){Nr(e),Ir(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||((s=e.deep)==null?void 0:s.width)||1,r=e.backingHeight||((a=e.source)==null?void 0:a.height)||((u=e.deep)==null?void 0:u.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.deep){const i=t.createTexture(e.deep.width,e.deep.height,"rgba16float");e.srcTexture=i,e.deepBuffers=t.createDeepSampleBuffers(e.deep),t.compositeDeep(e.deepBuffers,i,e.deepZNear,e.deepZFar)}else if(e.source){const i=t.createTexture(e.source.width,e.source.height,e.source.format);i.write(e.source.data),e.srcTexture=i}e.parked=!1,Nr(e),Ir(e)}function Pa(e,t){if(e.disposed||!e.source&&!e.deep)return!0;try{return Fr(e),!e.surface||!e.srcTexture?!1:(Ea(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,Zt(e),!1}}function Aa(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,e.deep=null,e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},setDeepSource(t,n,r){if(!e.disposed&&(e.deep=t,e.deepZNear=n,e.deepZFar=r,e.source=null,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy(),e.deepBuffers&&e.deepBuffers.destroy();const o=e.device.createTexture(t.width,t.height,"rgba16float");e.srcTexture=o,e.deepBuffers=e.device.createDeepSampleBuffers(t),e.device.compositeDeep(e.deepBuffers,o,n,r)}},setDeepWindow(t,n){e.disposed||(e.deepZNear=t,e.deepZFar=n,!e.parked&&e.deepBuffers&&e.srcTexture&&e.device.compositeDeep(e.deepBuffers,e.srcTexture,t,n))},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return Pa(e,t)},park(){e.disposed||Zt(e)},restore(){e.disposed||!e.source&&!e.deep||Fr(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(Zt(e),e.source=null,e.deep=null,e.disposed=!0)}}}async function Ra(e,t){const n=await Nt(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,deep:null,deepZNear:-1/0,deepZFar:1/0,deepBuffers:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return Aa(r)}function Gr(e){e.dispose()}function Ur({title:e,body:t,className:n}){return f.jsx("div",{className:n??"relative h-full w-full",children:f.jsxs("div",{className:"flex h-full w-full flex-col items-center justify-center gap-1 rounded bg-bg-hover p-4 text-center",children:[f.jsx("div",{className:"text-sm font-semibold text-fg",children:e}),f.jsx("div",{className:"text-xs text-fg-muted",children:t})]})})}function Ca(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:s}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...s?["invert(1)"]:[]].join(" ")}function zr(e){const n=`cairn-gamma-${c.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:s,exposure:a,offset:u,flipSign:i}=e,l=c.useMemo(()=>Ca(e,n),[n,r,o,a,i]);return{gammaFilterId:n,filterStr:l,gamma:s,offset:u}}function $r({id:e,gamma:t,offset:n}){return f.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:f.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:f.jsxs("feComponentTransfer",{children:[f.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),f.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),f.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}const Da=["nw","n","ne","e","se","s","sw","w"];function ka(e,t,n,r,o,s=1){const a=o.w-1,u=o.h-1,i=Math.round(n),l=Math.round(r);if(t==="move"){const g=e.x1-e.x0,p=e.y1-e.y0,E=ft(e.x0+i,0,a-g),_=ft(e.y0+l,0,u-p);return{x0:E,y0:_,x1:E+g,y1:_+p}}let{x0:d,y0:x,x1:h,y1:b}=e;const y=t==="nw"||t==="w"||t==="sw",w=t==="ne"||t==="e"||t==="se",S=t==="nw"||t==="n"||t==="ne",m=t==="sw"||t==="s"||t==="se";return y&&(d=ft(d+i,0,h-(s-1))),w&&(h=ft(h+i,d+(s-1),a)),S&&(x=ft(x+l,0,b-(s-1))),m&&(b=ft(b+l,x+(s-1),u)),{x0:d,y0:x,x1:h,y1:b}}function Vr(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function La({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=Vr(e),s=Vr(t),a=[];for(let g=0;g<=e;g+=o)a.push(g);const u=[];for(let g=0;g<=t;g+=s)u.push(g);const i=1/n,l=8*i,d=-12*i,x=-2*i,h=r==null?void 0:r.current;let b=0,y=0,w=0,S=0;if(h){const g=h.clientWidth,p=h.clientHeight,E=g/e,_=p/t,v=Math.min(E,_);w=e*v,S=t*v,b=(g-w)/2,y=(p-S)/2}const m=h&&w>0;return f.jsxs(f.Fragment,{children:[f.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:m?y:0,transform:`translateY(${d}px)`,fontSize:l},children:a.map(g=>f.jsx("span",{className:"mono",style:{position:"absolute",left:m?b+g/e*w:`${g/e*100}%`,transform:"translateX(-50%)"},children:g},g))}),f.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:m?b:0,transform:`translateX(${x}px)`,fontSize:l},children:u.map(g=>f.jsx("span",{className:"mono",style:{position:"absolute",top:m?y+g/t*S:`${g/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*i}px`},children:g},g))})]})}function On({label:e,corner:t="bottom-left",isDraggable:n=!1,grip:r=n,onDragStart:o}){const s=t==="bottom-right"?"bottom-1 right-1":"bottom-1 left-1";return f.jsxs("span",{className:`absolute ${s} z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${n?" cairn-drag-grip":""}`,draggable:n,onDragStart:o,style:{cursor:n?"grab":void 0},children:[r&&f.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const Oa=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function Xr(e,t){const n=getComputedStyle(e),r=Oa.map(i=>`${i}:${n.getPropertyValue(i)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const s=e.children,a=t.children,u=Math.min(s.length,a.length);for(let i=0;i<u;i++)Xr(s[i],a[i])}function Bn(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function Nn(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function In(e,t,n,r,o){const s=document.createElement("canvas");s.width=Math.max(1,Math.round(e*n)),s.height=Math.max(1,Math.round(t*n));const a=s.getContext("2d");if(!a)throw new Error("plot-to-png: 2D canvas context unavailable");return a.scale(n,n),r&&(a.fillStyle=r,a.fillRect(0,0,e,t)),o(a),await new Promise((u,i)=>s.toBlob(l=>l?u(l):i(new Error("plot-to-png: toBlob returned null")),"image/png"))}function Ba(e,t,n){const r=e.cloneNode(!0);Xr(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),s="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((a,u)=>{const i=new Image;i.onload=()=>a(i),i.onerror=()=>u(new Error("plot-to-png: SVG rasterization failed")),i.src=s})}async function Wr(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,s=(t==null?void 0:t.background)??Bn(e);return In(r,o,Nn(t),s,a=>a.drawImage(e,0,0,r,o))}async function Na(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,s=(t==null?void 0:t.background)??Bn(e);try{return await In(r,o,Nn(t),s,a=>a.drawImage(e,0,0,r,o))}catch(a){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${a instanceof Error?a.message:String(a)})`)}}function Ia(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const s=o.getBoundingClientRect(),a=s.width*s.height;a>r&&(r=a,n=o)}return n}async function Fa(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),s=o.width||300,a=o.height||150,u=(t==null?void 0:t.background)??Bn(e);if(n){const l=n.getBoundingClientRect(),d=await Ba(n,l.width||s,l.height||a);return In(s,a,Nn(t),u,x=>{for(const h of r){const b=h.getBoundingClientRect();x.drawImage(h,b.left-o.left,b.top-o.top,b.width,b.height)}x.drawImage(d,l.left-o.left,l.top-o.top,l.width,l.height)})}if(r.length)return Wr(r[0],t);const i=Ia(e);if(i)return Na(i,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function Ga(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const Ua=8;function za(e,t,n,r=Ua){return!(t>0)||!(e>0)?n:e<t+r}function Hr(e,t){return Math.max(0,e.findIndex(n=>n.id===t))}function $a(e){const t=e.trim();if(t==="")return null;const n=t.replace(/−/g,"-").replace(",","."),r=/^([+-]?)(inf(?:inity)?|∞)$/i.exec(n);if(r)return r[1]==="-"?-1/0:1/0;const o=Number(n);return Number.isNaN(o)?null:o}function Va(e,t){const n=$a(e);return n===null?t:n}function Xa(e){return String(e)}const Wa={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},Ha={boxZoom:f.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:f.jsxs(f.Fragment,{children:[f.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),f.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),f.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),f.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 2v20M2 12h20"}),f.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),f.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),f.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:f.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:f.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),f.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:f.jsx("path",{d:"M6 9l6 6 6-6"}),ellipsis:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"5",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),f.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),f.jsx("circle",{cx:"19",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"})]}),sun:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"12",cy:"12",r:"4"}),f.jsx("path",{d:"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"})]}),plusminus:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M4 7h6M7 4v6"}),f.jsx("path",{d:"M14 17h6"}),f.jsx("path",{d:"M6 20l12-16"})]}),layers:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 3l9 5-9 5-9-5 9-5z"}),f.jsx("path",{d:"M3 13l9 5 9-5"})]})};function je({name:e}){return f.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:Ha[e]??null})}function Yr({icon:e,label:t,title:n,active:r,disabled:o,onClick:s}){return f.jsx("button",{type:"button",disabled:o,onClick:a=>{a.stopPropagation(),!o&&s()},onPointerDown:a=>a.stopPropagation(),onDoubleClick:a=>a.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?f.jsx("span",{"aria-hidden":"true",children:t}):f.jsx(je,{name:e??""})})}function Kr(){return f.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function qr(e,t,n){const r=c.useRef(n);r.current=n,c.useEffect(()=>{if(!e)return;const o=a=>{t.current&&!t.current.contains(a.target)&&r.current()},s=a=>{a.key==="Escape"&&(a.stopPropagation(),r.current())};return document.addEventListener("pointerdown",o,!0),document.addEventListener("keydown",s,!0),()=>{document.removeEventListener("pointerdown",o,!0),document.removeEventListener("keydown",s,!0)}},[e,t])}function Ya({icon:e,title:t,menu:n}){var S;const{options:r,value:o,onSelect:s}=n,[a,u]=c.useState(!1),[i,l]=c.useState(0),d=c.useRef(null),x=Hr(r,o),h=e?void 0:((S=r[x])==null?void 0:S.label)??"",b=c.useCallback(()=>{u(m=>{const g=!m;return g&&l(x),g})},[x]),y=c.useCallback(m=>{s(m),u(!1)},[s]);qr(a,d,()=>u(!1));const w=m=>{if(!a){(m.key==="ArrowDown"||m.key==="Enter"||m.key===" ")&&(m.preventDefault(),l(x),u(!0));return}if(m.key==="ArrowDown")m.preventDefault(),l(g=>(g+1)%r.length);else if(m.key==="ArrowUp")m.preventDefault(),l(g=>(g-1+r.length)%r.length);else if(m.key==="Enter"||m.key===" "){m.preventDefault();const g=r[i];g&&y(g.id)}};return f.jsxs("div",{ref:d,className:"relative inline-flex",onPointerDown:m=>m.stopPropagation(),children:[f.jsxs("button",{type:"button",onClick:m=>{m.stopPropagation(),b()},onDoubleClick:m=>m.stopPropagation(),onKeyDown:w,"aria-haspopup":"listbox","aria-expanded":a,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",h?"px-1.5 text-[10px] font-mono":"px-1 text-xs",a?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[h?f.jsx("span",{"aria-hidden":"true",children:h}):f.jsx(je,{name:e??""}),f.jsx(je,{name:"caret"})]}),a&&f.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((m,g)=>{const p=m.id===o,E=g===i;return f.jsx("li",{role:"option","aria-selected":p,children:f.jsx("button",{type:"button",onClick:_=>{_.stopPropagation(),y(m.id)},onPointerEnter:()=>l(g),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",E?"bg-bg-hover":"",p?"text-accent font-medium":"text-fg"].join(" "),children:m.label})},m.id)})})]})}const Ka=e=>e.format?e.format(e.value):String(e.value);function Zr({spec:e}){const[t,n]=c.useState(!1),[r,o]=c.useState(""),s=c.useRef(null),a=c.useCallback(()=>{o(Xa(e.value)),n(!0)},[e.value]);c.useEffect(()=>{t&&s.current&&(s.current.focus(),s.current.select())},[t]);const u=c.useCallback(()=>{n(l=>(l&&e.onChange(Va(r,e.value)),!1))},[r,e]),i=c.useCallback(()=>n(!1),[]);return f.jsxs("label",{className:"inline-flex items-center gap-1 text-fg-muted",title:e.title,onPointerDown:l=>l.stopPropagation(),onDoubleClick:l=>{l.stopPropagation(),t||a()},children:[e.icon?f.jsx("span",{"aria-hidden":"true",className:"inline-flex",children:f.jsx(je,{name:e.icon})}):f.jsx("span",{"aria-hidden":"true",className:"text-[9px] font-mono",children:e.label}),t?f.jsx("input",{ref:s,type:"text",inputMode:"decimal","aria-label":`${e.title} (numeric entry)`,value:r,onChange:l=>o(l.target.value),onPointerDown:l=>l.stopPropagation(),onDoubleClick:l=>l.stopPropagation(),onKeyDown:l=>{l.stopPropagation(),l.key==="Enter"?(l.preventDefault(),u()):l.key==="Escape"&&(l.preventDefault(),i())},onBlur:u,className:"cairn-plot-toolbar-slider-entry h-3.5 w-[6.5rem] rounded border border-border bg-bg px-1 text-[9px] font-mono tabular-nums text-fg outline-none focus:border-accent"}):f.jsxs(f.Fragment,{children:[f.jsx("input",{type:"range","aria-label":e.title,min:e.min,max:e.max,step:e.step,value:e.value,onChange:l=>e.onChange(Number(l.target.value)),onPointerDown:l=>l.stopPropagation(),className:"cairn-plot-toolbar-slider h-1 w-16 cursor-pointer accent-accent"}),f.jsx("span",{"aria-hidden":"true",className:"w-8 text-right text-[9px] font-mono tabular-nums",children:Ka(e)})]})]})}function qa({icon:e,title:t,menu:n,onClose:r}){var x;const{options:o,value:s,onSelect:a}=n,[u,i]=c.useState(!1),l=Hr(o,s),d=((x=o[l])==null?void 0:x.label)??"";return f.jsxs("div",{children:[f.jsxs("button",{type:"button","aria-haspopup":"menu","aria-expanded":u,"aria-label":t,onClick:h=>{h.stopPropagation(),i(b=>!b)},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",u?"text-accent":"text-fg hover:bg-bg-hover"].join(" "),children:[e?f.jsx(je,{name:e}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{className:"flex-1",children:t}),f.jsx("span",{className:"font-mono text-[10px] text-fg-muted",children:d}),f.jsx("span",{className:u?"rotate-180 transition-transform":"transition-transform",children:f.jsx(je,{name:"caret"})})]}),u&&o.map(h=>{const b=h.id===s;return f.jsxs("button",{type:"button",role:"menuitemradio","aria-checked":b,"data-menu-option":"",onClick:y=>{y.stopPropagation(),a(h.id),r()},className:["flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-[11px]",b?"text-accent font-medium bg-bg-hover/40":"text-fg hover:bg-bg-hover"].join(" "),children:[f.jsx("span",{"aria-hidden":"true",className:"w-3 text-center text-accent",children:b?"✓":""}),f.jsx("span",{children:h.label})]},h.id)})]})}function Za({actions:e,leading:t,sliders:n}){const[r,o]=c.useState(!1),s=c.useRef(null);return qr(r,s,()=>o(!1)),f.jsxs("div",{ref:s,className:"relative inline-flex",onPointerDown:a=>a.stopPropagation(),children:[f.jsx("button",{type:"button",onClick:a=>{a.stopPropagation(),o(u=>!u)},onDoubleClick:a=>a.stopPropagation(),"aria-haspopup":"menu","aria-expanded":r,"aria-label":"More controls",title:"More controls",className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded text-xs",r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:f.jsx(je,{name:"ellipsis"})}),r&&f.jsxs("div",{role:"menu",className:["absolute right-0 top-full z-40 mt-1 min-w-[10rem] max-h-80 overflow-auto","rounded border border-border bg-bg-elevated py-1 shadow-md"].join(" "),children:[t.map(a=>a.menu?f.jsx(qa,{icon:a.icon,title:a.title,menu:a.menu,onClose:()=>o(!1)},a.id):f.jsxs("button",{type:"button",disabled:a.disabled,onClick:u=>{var i;u.stopPropagation(),!a.disabled&&((i=a.onClick)==null||i.call(a),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",a.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",a.active?"text-accent":""].join(" "),children:[a.icon?f.jsx(je,{name:a.icon}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{children:a.label??a.title})]},a.id)),t.length>0&&e.length>0&&f.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),e.map(a=>f.jsxs("button",{type:"button",role:"menuitem",disabled:a.disabled,onClick:u=>{u.stopPropagation(),!a.disabled&&(a.onClick(),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",a.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",a.active?"text-accent":""].join(" "),children:[a.icon?f.jsx(je,{name:a.icon}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{children:a.title})]},a.id)),n.length>0&&(e.length>0||t.length>0)&&f.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),n.map(a=>f.jsx("div",{className:"px-2 py-1",children:f.jsx(Zr,{spec:a})},a.id))]})]})}function ja({controller:e,config:t}){var A,k;const n=c.useRef(null),[r,o]=c.useState(!1),s=c.useRef(r);s.current=r;const a=c.useRef(0),u=`${((A=t==null?void 0:t.leadingButtons)==null?void 0:A.length)??0}:${((k=t==null?void 0:t.sliders)==null?void 0:k.length)??0}:${(t==null?void 0:t.visibility)??"hover"}`;if(c.useEffect(()=>{const R=n.current,O=R==null?void 0:R.parentElement;if(!O)return;const B=()=>{const I=O.clientWidth;if(!s.current&&n.current){const J=n.current.scrollWidth;J>0&&(a.current=J)}o(za(I,a.current,s.current))};let X=0;const Q=()=>{X||(X=requestAnimationFrame(()=>{X=0,B()}))},z=new ResizeObserver(Q);return z.observe(O),B(),()=>{z.disconnect(),X&&cancelAnimationFrame(X)}},[u]),(t==null?void 0:t.enabled)===!1)return null;const i=e.capabilities,l=t==null?void 0:t.buttons,d=(R,O)=>O&&(l==null?void 0:l[R])!==!1,x=R=>()=>e.setDragMode(R),h=()=>{e.toPNG({filename:"plot"}).then(R=>Ga(R,"plot.png")).catch(()=>{})},b=[];d("zoom",i.zoom)&&b.push({id:"zoom",icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:x("zoom")}),d("pan",i.pan)&&b.push({id:"pan",icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:x("pan")}),d("select",i.select)&&b.push({id:"select",icon:"select",title:"Box select",active:e.dragMode==="select",onClick:x("select")}),d("lasso",i.lasso)&&b.push({id:"lasso",icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:x("lasso")});const y=[];d("zoomIn",i.zoom)&&y.push({id:"zoomIn",icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),d("zoomOut",i.zoom)&&y.push({id:"zoomOut",icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()});const w=[];d("autoscale",i.autoscale)&&w.push({id:"autoscale",icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),d("reset",i.reset)&&w.push({id:"reset",icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()});const S=[];d("screenshot",i.screenshot)&&S.push({id:"screenshot",icon:"camera",title:"Download plot as PNG",onClick:h});const m=[b,y,w,S].filter(R=>R.length>0),g=m.flat(),p=(t==null?void 0:t.leadingButtons)??[],E=(t==null?void 0:t.sliders)??[];if(!p.length&&g.length===0&&E.length===0)return null;const _=(t==null?void 0:t.position)??"top-right",v=(t==null?void 0:t.visibility)==="always",C=_==="top-right"||_==="bottom-right",M=["cairn-plot-toolbar z-30 rounded border border-border bg-bg-elevated/90 shadow-sm backdrop-blur-sm transition-opacity",v?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),P={position:"absolute",pointerEvents:"auto",...Wa[_]};return r?f.jsx("div",{ref:n,style:P,className:`${M} inline-flex px-0.5 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:f.jsx(Za,{actions:g,leading:p,sliders:E})}):f.jsxs("div",{ref:n,style:P,className:`${M} flex flex-col gap-0.5 px-1 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:[f.jsxs("div",{className:`flex items-center gap-0.5 ${C?"justify-end":"justify-start"}`,children:[p.length>0&&f.jsxs(f.Fragment,{children:[p.map(R=>R.menu?f.jsx(Ya,{icon:R.icon,title:R.title,menu:R.menu},R.id):f.jsx(Yr,{icon:R.icon,label:R.label,title:R.title,active:R.active,disabled:R.disabled,onClick:R.onClick??(()=>{})},R.id)),m.length>0&&f.jsx(Kr,{})]}),m.map((R,O)=>f.jsxs("span",{className:"inline-flex items-center gap-0.5",children:[O>0&&f.jsx(Kr,{}),R.map(B=>f.jsx(Yr,{icon:B.icon,title:B.title,active:B.active,disabled:B.disabled,onClick:B.onClick},B.id))]},R[0].id))]}),E.length>0&&f.jsx("div",{className:`flex items-center gap-2 ${C?"justify-end":"justify-start"}`,children:E.map(R=>f.jsx(Zr,{spec:R},R.id))})]})}const Qa={zoom:1,pan:{x:0,y:0}},jr=1.3,Ja=.25,ei=64,ti={buttons:{zoom:!1}};function ni(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const ri=[{id:"none",label:"None"},...ws];function Ct(e,t){return{id:"colormap",title:"Colormap",menu:{options:ri,value:e,onSelect:t}}}const Qr={linear:"Linear",srgb:"sRGB",gamma:"Gamma",reinhard:"Reinhard",aces:"ACES",extended:"Extended · Linear","extended-clamp":"Extended · Linear (managed)","extended-reinhard":"Extended · Reinhard","extended-aces":"Extended · ACES"},oi=ar.map(e=>({id:e,label:Qr[e]}));function Jr(e,t){return{id:"tonemap",title:"Tone-mapping operator",menu:{options:oi,value:e,onSelect:t}}}const si=Ms.map(e=>({id:e,label:Qr[e]}));function eo(e,t){return{id:"tonemap",title:"Display transfer (sRGB · Gamma · Linear)",menu:{options:si,value:e,onSelect:t}}}function ai({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:s,naturalHeight:a,minZoom:u=Ja,maxZoom:i=ei,requestRender:l,onReset:d,extraModified:x=!1}){const h=c.useCallback(v=>{var X;if(!o)return;const C=(X=e.current)==null?void 0:X.getBoundingClientRect(),T=(C==null?void 0:C.width)??0,M=(C==null?void 0:C.height)??0,P=s&&a&&T>0&&M>0?Pn(s,a,T,M):i,A=Math.max(u,Math.min(P,n*v));if(A===n)return;const k=T/2,R=M/2,O=k-(k-r.x)/n*A,B=R-(R-r.y)/n*A;o({zoom:A,pan:{x:O,y:B}})},[o,e,s,a,i,u,n,r.x,r.y]),b=c.useCallback(()=>h(jr),[h]),y=c.useCallback(()=>h(1/jr),[h]),w=c.useCallback(()=>{o==null||o(Qa),d==null||d()},[o,d]),S=c.useCallback(v=>{const C={scale:v==null?void 0:v.scale,filename:v==null?void 0:v.filename};l==null||l();const T=t==null?void 0:t.current;if(T)return Wr(T,C);const M=e.current;return M?Fa(M,C):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,l]),m=c.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),g=n!==1||r.x!==0||r.y!==0||x,p=c.useCallback(v=>{},[]),E=c.useCallback(v=>{},[]),_=c.useCallback(()=>{},[]);return c.useMemo(()=>({capabilities:m,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:g,setDragMode:p,setHoverMode:E,toggleSpikelines:_,zoomIn:b,zoomOut:y,autoscale:w,reset:w,toPNG:S}),[m,g,p,E,_,b,y,w,S])}const ii={zoom:1,pan:{x:0,y:0}};function jt({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:s,pan:a,onViewportChange:u,naturalDims:i,checkerboard:l,wrapperClassName:d,wrapperStyle:x,viewportPadding:h,header:b,surface:y,showAxes:w,overlayNode:S,overlay:m,notationSeed:g,exportCanvasRef:p,requestRender:E,leadingMenus:_,displayAdjust:v,depthSliders:C,extraSliders:T,regionSelect:M,onReset:P,extraModified:A,label:k,showLabelChip:R,isDraggable:O=!1,onDragStart:B,extraChips:X}){const[Q,z]=c.useState(g),[I,J]=c.useState(!1),[W,Ee]=c.useState(!1),ae="render"in m?null:m,xe=!!M&&!!ae,{containerProps:$}=yr({containerRef:r,zoom:s,pan:a,onViewportChange:u,naturalWidth:i==null?void 0:i.w,naturalHeight:i==null?void 0:i.h}),q=c.useCallback(()=>{v==null||v.onExposureChange(0),v==null||v.onOffsetChange(0),P==null||P()},[v,P]),re=c.useCallback(()=>{u==null||u(ii),q()},[u,q]),ee=ai({rootRef:r,canvasRef:p,zoom:s,pan:a,onViewportChange:u,naturalWidth:i==null?void 0:i.w,naturalHeight:i==null?void 0:i.h,requestRender:E,onReset:q,extraModified:((v==null?void 0:v.exposureEV)??0)!==0||((v==null?void 0:v.offset)??0)!==0||!!A}),oe=c.useMemo(()=>{const ve=[];if(C&&ve.push(...C),!v)return T&&ve.push(...T),ve.length?ve:void 0;const _e=(de,Te)=>`${de>=0?"+":"−"}${Math.abs(de).toFixed(Te)}`;return ve.push({id:"exposure",icon:"sun",label:"EV",title:"Exposure (EV stops) — color × 2^EV. Double-click to type a value (may exceed the slider range).",min:-8,max:8,step:.1,value:v.exposureEV,onChange:v.onExposureChange,format:de=>_e(de,1)},{id:"offset",icon:"plusminus",label:"OFF",title:"Offset — added after exposure (before tonemap). Double-click to type a value (may exceed the slider range).",min:-1,max:1,step:.01,value:v.offset,onChange:v.onOffsetChange,format:de=>_e(de,2)}),T&&ve.push(...T),ve},[v,C,T]),Y=c.useMemo(()=>xe?{id:"region-depth",icon:"select",title:"Select depth from region — drag a rectangle to set the Z window to the samples it covers (Esc to cancel)",active:W,onClick:()=>Ee(ve=>!ve)}:null,[xe,W]),fe=c.useMemo(()=>({...ti,leadingButtons:[..._??[],...Y?[Y]:[],...I?[ni(Q,z)]:[]],sliders:oe}),[I,Q,_,Y,oe]),me=" cairn-checkerboard",we="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(l==="pane"?me:""),K=d+(l==="wrapper"?me:""),Se="render"in m?m.render({notation:Q,setOverlayActive:J}):m.hasSource&&i?f.jsx(ht,{imageElRef:m.displayElRef,naturalWidth:i.w,naturalHeight:i.h,zoom:s,pan:a,sourceWindow:m.sourceWindow,sample:m.sample,notation:Q,version:m.version,onActiveChange:J}):null;return f.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[b,n&&f.jsx(ja,{controller:ee,config:fe}),f.jsxs("div",{ref:r,className:we,style:{padding:h,...$.style},onPointerDown:$.onPointerDown,onPointerMove:$.onPointerMove,onPointerUp:$.onPointerUp,onPointerCancel:$.onPointerCancel,onDoubleClick:re,...t,children:[f.jsxs("div",{ref:o,className:K,style:x,children:[y,w&&i&&f.jsx(La,{naturalWidth:i.w,naturalHeight:i.h,zoom:s,containerRef:o}),S]}),Se,!n&&I&&f.jsx(Tr,{notation:Q,onChange:z}),W&&M&&ae&&i&&f.jsx(ci,{imageElRef:ae.displayElRef,naturalDims:i,sourceWindow:ae.sourceWindow,onQueryLive:M.queryLive,onSelect:(ve,_e,de,Te)=>{Ee(!1),M.commit(ve,_e,de,Te)},onExit:()=>Ee(!1)}),!W&&(M==null?void 0:M.rect)&&ae&&i&&f.jsx(ui,{rect:M.rect,imageElRef:ae.displayElRef,naturalDims:i,sourceWindow:ae.sourceWindow,zoom:s,pan:a,onQueryLive:M.queryLive,onCommit:M.commit,onRemove:M.remove})]}),R&&f.jsx(On,{label:k,isDraggable:O,onDragStart:B}),X]})}function ci({imageElRef:e,naturalDims:t,sourceWindow:n,onQueryLive:r,onSelect:o,onExit:s}){var S;const a=c.useRef(null),u=c.useRef(null),[i,l]=c.useState(null),d=c.useCallback((m,g,p,E)=>{const _=e.current;return _?Sr(m,g,p,E,{box:_.getBoundingClientRect(),naturalWidth:t.w,naturalHeight:t.h,sourceWindow:n}):null},[e,t,n]);c.useEffect(()=>{const m=g=>{g.key==="Escape"&&s()};return window.addEventListener("keydown",m),()=>window.removeEventListener("keydown",m)},[s]);const x=c.useCallback(m=>{var g,p;(p=(g=m.target).setPointerCapture)==null||p.call(g,m.pointerId),u.current={x:m.clientX,y:m.clientY},l({x0:m.clientX,y0:m.clientY,x1:m.clientX,y1:m.clientY})},[]),h=c.useCallback(m=>{const g=u.current;if(!g)return;l({x0:g.x,y0:g.y,x1:m.clientX,y1:m.clientY});const p=d(g.x,g.y,m.clientX,m.clientY);p&&r(p.x0,p.y0,p.x1,p.y1)},[d,r]),b=c.useCallback(m=>{const g=u.current;u.current=null,l(null);const p=e.current;if(!g||!p){s();return}if(Math.abs(m.clientX-g.x)<3&&Math.abs(m.clientY-g.y)<3){s();return}const E=p.getBoundingClientRect(),_=Sr(g.x,g.y,m.clientX,m.clientY,{box:E,naturalWidth:t.w,naturalHeight:t.h,sourceWindow:n});if(!_){s();return}o(_.x0,_.y0,_.x1,_.y1)},[e,t,n,o,s]),y=(S=a.current)==null?void 0:S.getBoundingClientRect(),w=i&&y?{left:Math.min(i.x0,i.x1)-y.left,top:Math.min(i.y0,i.y1)-y.top,width:Math.abs(i.x1-i.x0),height:Math.abs(i.y1-i.y0)}:null;return f.jsx("div",{ref:a,className:"absolute inset-0 z-20",style:{cursor:"crosshair",touchAction:"none"},onPointerDown:x,onPointerMove:h,onPointerUp:b,children:w&&f.jsx("div",{className:"absolute border-2 border-dashed border-sky-400 bg-sky-400/15 pointer-events-none",style:w})})}const li={nw:{cursor:"nwse-resize",fx:0,fy:0},n:{cursor:"ns-resize",fx:.5,fy:0},ne:{cursor:"nesw-resize",fx:1,fy:0},e:{cursor:"ew-resize",fx:1,fy:.5},se:{cursor:"nwse-resize",fx:1,fy:1},s:{cursor:"ns-resize",fx:.5,fy:1},sw:{cursor:"nesw-resize",fx:0,fy:1},w:{cursor:"ew-resize",fx:0,fy:.5}};function ui({rect:e,imageElRef:t,naturalDims:n,sourceWindow:r,zoom:o,pan:s,onQueryLive:a,onCommit:u,onRemove:i}){const l=c.useRef(null),[d,x]=c.useState(null),h=c.useRef(null),[b,y]=c.useState(null),w=d??e;c.useLayoutEffect(()=>{const p=()=>{const v=t.current,C=l.current;if(!v||!C)return;const T=v.getBoundingClientRect(),M=C.getBoundingClientRect(),P=ha(w,{box:T,naturalWidth:n.w,naturalHeight:n.h,sourceWindow:r});y({left:P.left-M.left,top:P.top-M.top,width:P.width,height:P.height})};p();const E=t.current;if(!E||typeof ResizeObserver>"u")return;const _=new ResizeObserver(p);return _.observe(E),()=>_.disconnect()},[w,n.w,n.h,r,o,s.x,s.y]);const S=c.useCallback(p=>E=>{var _,v;E.stopPropagation(),(v=(_=E.target).setPointerCapture)==null||v.call(_,E.pointerId),h.current={handle:p,sx:E.clientX,sy:E.clientY,start:w},x(w)},[w]),m=c.useCallback(p=>{const E=h.current,_=t.current;if(!E||!_)return;const v=pa({box:_.getBoundingClientRect(),naturalWidth:n.w,naturalHeight:n.h,sourceWindow:r}),C=(p.clientX-E.sx)/(v||1),T=(p.clientY-E.sy)/(v||1),M=ka(E.start,E.handle,C,T,{w:n.w,h:n.h},1);x(M),a(M.x0,M.y0,M.x1,M.y1)},[t,n.w,n.h,r,a]),g=c.useCallback(()=>{const p=h.current;h.current=null;const E=d;x(null),p&&E&&u(E.x0,E.y0,E.x1,E.y1)},[d,u]);return b?f.jsxs("div",{ref:l,className:"absolute inset-0 z-20 pointer-events-none",style:{touchAction:"none"},children:[f.jsx("div",{className:"absolute border-2 border-sky-400 bg-sky-400/10 pointer-events-auto",style:{...b,cursor:"move",touchAction:"none"},onPointerDown:S("move"),onPointerMove:m,onPointerUp:g}),Da.map(p=>{const E=li[p];return f.jsx("div",{className:"absolute pointer-events-auto flex items-center justify-center",style:{left:b.left+E.fx*b.width-12,top:b.top+E.fy*b.height-12,width:24,height:24,cursor:E.cursor,touchAction:"none"},onPointerDown:S(p),onPointerMove:m,onPointerUp:g,children:f.jsx("div",{className:"w-2.5 h-2.5 rounded-sm bg-sky-400 border border-white/80"})},p)}),f.jsx("button",{type:"button","aria-label":"Remove depth region",title:"Remove region (reset the depth window)",className:"absolute pointer-events-auto flex items-center justify-center rounded-full text-white",style:{left:b.left+b.width-8,top:b.top-32,width:40,height:40},onPointerDown:p=>p.stopPropagation(),onClick:i,children:f.jsx("span",{className:"flex items-center justify-center w-5 h-5 rounded-full bg-slate-800/90 border border-white/70 text-[11px] leading-none",children:"×"})})]}):f.jsx("div",{ref:l,className:"absolute inset-0 z-20 pointer-events-none"})}const Fn={inFlight:!1,pending:null};function to(e,t){return e.inFlight?{state:{inFlight:!0,pending:t},launch:null}:{state:{inFlight:!0,pending:null},launch:t}}function no(e){return e.pending!=null?{state:{inFlight:!0,pending:null},launch:e.pending}:{state:Fn,launch:null}}const fi=1e3,di=typeof requestAnimationFrame=="function"?e=>requestAnimationFrame(()=>e()):e=>setTimeout(e,0),ro=typeof cancelAnimationFrame=="function"?cancelAnimationFrame:e=>clearTimeout(e);function oo(e,t){const n=e.deep,r=(n==null?void 0:n.zMin)??0,o=(n==null?void 0:n.zMax)??0,s=t!=null,[a,u,i]=Fe(r),[l,d,x]=Fe(o),[h,b]=c.useState(null),[y,w]=c.useState(null),S=c.useRef(n);S.current=n;const m=c.useRef(r);m.current=r;const g=c.useRef(o);g.current=o;const p=c.useRef(a);p.current=a;const E=c.useRef(l);E.current=l;const _=c.useRef({near:a,far:l,ver:0}),v=c.useRef(0),C=c.useRef(!0),T=c.useRef(Fn),M=c.useRef(null),P=u,A=d,k=c.useCallback(()=>{const $=S.current;if(!$)return;const{near:q,far:re,ver:ee}=_.current,oe=()=>{const Y=no(T.current);T.current=Y.state,Y.launch!=null&&k()};$.flatten(q,re).then(Y=>{_.current.ver===ee&&!C.current&&(M.current!=null&&ro(M.current),M.current=di(()=>{M.current=null,b(Y)})),oe()}).catch(oe)},[]),R=c.useCallback(()=>{const $=to(T.current,1);T.current=$.state,$.launch!=null&&k()},[k]);c.useEffect(()=>()=>{M.current!=null&&ro(M.current),n==null||n.dispose()},[n]),c.useEffect(()=>{if(!n)return;const $=a<=r&&l>=o;if(C.current=$,v.current+=1,_.current={near:a,far:l,ver:v.current},s){t(a,l);return}if($){b(null);return}R()},[n,a,l,r,o,R,s,t]);const O=c.useMemo(()=>n&&!s&&h!=null?{...e,data:h}:e,[e,n,s,h]),B=n!=null&&r>0&&o/r>fi,X=c.useMemo(()=>{if(!n||!(o>r))return;const $=re=>Math.abs(re)>=1e3||Math.abs(re)<.01&&re!==0?re.toExponential(2):re.toFixed(3),q=(re,ee,oe,Y,fe)=>{if(B){const me=Math.log10(r),we=Math.log10(o);return{id:re,icon:"layers",label:ee,title:`${oe} (log scale). Double-click to type a Z.`,min:me,max:we,step:(we-me)/200,value:Math.log10(Math.max(r,Math.min(Y,o))),onChange:K=>fe(10**K),format:K=>$(10**K)}}return{id:re,icon:"layers",label:ee,title:`${oe}. Double-click to type a Z.`,min:r,max:o,step:(o-r)/200,value:Y,onChange:fe,format:$}};return[q("depth-near","ZN","Depth window NEAR — composite only samples with Z ≥ this",a,P),q("depth-far","ZF","Depth window FAR — composite only samples with Z ≤ this",l,A)]},[n,r,o,a,l,B,P,A]),Q=c.useCallback($=>{if($.count===0){const ee=m.current,oe=g.current,Y=oe>ee?0:1;u(oe+Y),d(ee-Y);return}const q=g.current-m.current,re=Math.max(Math.abs(q)*1e-4,1e-4);u($.zMin-re),d($.zMax+re)},[u,d]),z=c.useRef(null),I=c.useRef(Fn),J=c.useCallback(()=>{const $=S.current,q=z.current,re=()=>{const ee=no(I.current);I.current=ee.state,ee.launch!=null&&J()};if(!$||!q){re();return}$.zRangeInRect(q.x0,q.y0,q.x1,q.y1).then(ee=>{Q(ee),re()}).catch(re)},[Q]),W=c.useCallback(($,q,re,ee)=>{z.current={x0:$,y0:q,x1:re,y1:ee};const oe=to(I.current,1);I.current=oe.state,oe.launch!=null&&J()},[J]),Ee=c.useCallback(($,q,re,ee)=>{w({x0:$,y0:q,x1:re,y1:ee}),W($,q,re,ee)},[W]),ae=c.useCallback(()=>{w(null),i.reset(),x.reset(),b(null)},[i,x]),xe=c.useCallback(()=>{i.reset(),x.reset(),w(null),b(null)},[i,x]);return{hdr:O,sliders:X,hasDeep:n!=null,region:y,queryRegionWindow:W,commitRegion:Ee,removeRegion:ae,reset:xe,isModified:i.isModified||x.isModified}}function so(e){return"hdr"in e&&e.hdr!=null}function ao(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function Oe(e){return Number.isFinite(e)?e:0}const pi={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function hi(e,t,n,r,o=0){const{h:s,w:a,c:u}=ao(e.shape),i=e.precision==="f16-bits"?hr(e.data):e.data,l=Ss(t),d=new Uint8ClampedArray(a*s*4);for(let x=0;x<a*s;x++){const h=x*u;let b,y,w,S=1;u===1?b=y=w=Oe(i[h]):u===3?(b=Oe(i[h]),y=Oe(i[h+1]),w=Oe(i[h+2])):(b=Oe(i[h]),y=Oe(i[h+1]),w=Oe(i[h+2]),S=Oe(i[h+3]));const m=[Gt(b,n,o),Gt(y,n,o),Gt(w,n,o)],[g,p,E]=l(m),_=x*4;d[_]=255*bt(g,r),d[_+1]=255*bt(p,r),d[_+2]=255*bt(E,r),d[_+3]=255*(S<0?0:S>1?1:S)}return new ImageData(d,a,s)}function mi(e,t,n){const r=zt(t,n??St),o=new Uint8ClampedArray(e.data.length),s=e.data;for(let a=0;a<s.length;a+=4)o[a]=255*bt(xn(s[a]/255),r),o[a+1]=255*bt(xn(s[a+1]/255),r),o[a+2]=255*bt(xn(s[a+2]/255),r),o[a+3]=s[a+3];return new ImageData(o,e.width,e.height)}function gi(e){var gt,ut;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:s="auto",colormap:a="none",tonemap:u,gamma:i,showAxes:l=!1,processing:d=pi,zoom:x=1,pan:h={x:0,y:0},onViewportChange:b,onNaturalSize:y,label:w,isDraggable:S=!1,onDragStart:m,overlay:g,overlaySettings:p,pixelValueNotation:E="decimal",toolbar:_=!0}=e,[v,C,T]=Fe(a);c.useEffect(()=>{C(a)},[a,C]);const M=(()=>{const F=Mt(u);return F==="gamma"||F==="linear"?F:"srgb"})(),[P,A,k]=Fe(M);c.useEffect(()=>{A(M)},[u]);const[R,O,B]=Fe(i&&i>0?i:St);c.useEffect(()=>{i&&i>0&&O(i)},[i,O]);const X=c.useRef(null),Q=c.useRef(null),z=c.useRef(null),[I,J]=c.useState(!1),W=c.useRef(null),Ee=c.useRef(null),ae=c.useRef(null),xe=c.useRef(null),$=c.useRef(null),[q,re]=c.useState(0),ee=c.useCallback(()=>re(F=>F+1),[]),oe=c.useMemo(()=>({get current(){const F=ae.current;return F instanceof HTMLCanvasElement?F:null}}),[]),Y=c.useCallback(F=>{X.current=F,F&&(ae.current=F)},[]),fe=c.useCallback(F=>{Q.current=F,F&&(ae.current=F)},[]),me=c.useCallback(F=>{z.current=F,F&&(ae.current=F)},[]),we=c.useCallback(F=>{F&&(ae.current=F)},[]),[K,Se]=c.useState(!1),[ve,_e]=c.useState(!1),[de,Te]=c.useState(!1),[Ge,Re]=c.useState(null),{flipSign:ze}=d,{gammaFilterId:ke,filterStr:Lt,gamma:qe,offset:yt}=zr(d),Le=!r&&o!=="none"&&n!=null&&t!=null,Qe=o!=="none"&&n!=null,Je=v!=="none"&&!Le&&!(r&&Qe)&&t!=null;c.useEffect(()=>{if(!Je||!t){Te(!1);return}let F=!1;Te(!1);const te=`${t}::${v}`,ue=_n(te);if(ue){const N=Q.current;if(N){N.width=ue.width,N.height=ue.height;const G=N.getContext("2d");G&&G.putImageData(ue,0,0),$.current=ue,ee(),Re({w:ue.width,h:ue.height}),y==null||y(ue.width,ue.height),Te(!0)}return}const L=new Image;return L.onload=()=>{if(F)return;const N=document.createElement("canvas");N.width=L.naturalWidth,N.height=L.naturalHeight;const G=N.getContext("2d");if(!G)return;G.drawImage(L,0,0);const V=G.getImageData(0,0,N.width,N.height),ne=En(v),U=yn(V,v,ne);Mn(te,U);const ie=Q.current;if(!ie||F)return;ie.width=U.width,ie.height=U.height;const ce=ie.getContext("2d");ce&&ce.putImageData(U,0,0),$.current=U,ee(),Re({w:U.width,h:U.height}),y==null||y(U.width,U.height),Te(!0)},L.src=t,()=>{F=!0}},[Je,t,v]);const et=t!=null&&!Le&&!Je&&P!=="srgb";c.useEffect(()=>{if(!et||!t){J(!1);return}let F=!1;return J(!1),ot(t).then(te=>{if(F||!te)return;const ue=mi(te,P,R),L=z.current;if(!L)return;L.width=ue.width,L.height=ue.height;const N=L.getContext("2d");N&&N.putImageData(ue,0,0),$.current=ue,ee(),Re({w:ue.width,h:ue.height}),y==null||y(ue.width,ue.height),J(!0)}),()=>{F=!0}},[et,t,P,R]);const tt=c.useCallback((F,te)=>{Re(ue=>ue&&ue.w===F&&ue.h===te?ue:{w:F,h:te}),y==null||y(F,te)},[]);c.useEffect(()=>{if(!t){xe.current=null,$.current=null,ee();return}let F=!1;return ot(t).then(te=>{F||(xe.current=te,v==="none"&&($.current=te),ee())}),()=>{F=!0}},[t,v,ee]);const lt=c.useCallback((F,te,ue)=>{const L=xe.current;if(!L||F<0||te<0||F>=L.width||te>=L.height)return null;const N=(te*L.width+F)*4,G=L.data[N],V=L.data[N+1],ne=L.data[N+2],U=$.current;let ie=G,ce=V,Pe=ne;if(U&&U.width===L.width&&U.height===L.height){const De=(te*U.width+F)*4;ie=U.data[De],ce=U.data[De+1],Pe=U.data[De+2]}const be=Tt(ie,ce,Pe);return pt(v!=="none"||G===V&&V===ne?[G]:[G,V,ne],"uint8",ue,be)},[v]);c.useEffect(()=>{if(_e(!1),!Le){Se(!1);return}let F=!1;const te=Vs(),ue=te==="gpu"||te==="auto",L=`${n}::${t}::${o}::${v}`;if(te!=="gpu"){const N=_n(L);if(N){const G=X.current;if(G){(G.width!==N.width||G.height!==N.height)&&(G.width=N.width,G.height=N.height);const V=G.getContext("2d");V&&V.putImageData(N,0,0),tt(N.width,N.height),Se(!0)}return}}return(async()=>{const[N,G]=await Promise.all([ot(n),ot(t)]);if(F||!N||!G)return;const ne=o.includes("signed")?"signed":"positive",U=v!=="none"?hn(v):null,ie={diffMode:o,colormap:U,cmapMode:ne};if(ue)try{const Ce=X.current;if(Ce){const De=zs(N,G,ie,Ce);if(De){if(F)return;tt(De.width,De.height),Se(!0);return}}}catch(Ce){console.warn("[cairn] WebGL 2 diff error:",Ce)}if(te==="gpu"){F||_e(!0);return}let ce=Os(N,G,o);v!=="none"&&(ce=yn(ce,v,ne)),Mn(L,ce);const Pe=X.current;if(!Pe||F)return;(Pe.width!==ce.width||Pe.height!==ce.height)&&(Pe.width=ce.width,Pe.height=ce.height);const be=Pe.getContext("2d");be&&be.putImageData(ce,0,0),tt(ce.width,ce.height),Se(!0)})(),()=>{F=!0}},[n,t,o,Le,v,y]);const nt=s==="auto"?void 0:s,Ue=ze?{filter:"invert(1)"}:{},Ve=g&&(p!=null&&p.enabled)&&Ge&&t&&((((gt=g.boxes)==null?void 0:gt.length)??0)>0||(((ut=g.masks)==null?void 0:ut.length)??0)>0)?f.jsx(Rn,{data:g,settings:p,naturalWidth:Ge.w,naturalHeight:Ge.h}):void 0,Ot=t?Le&&ve?f.jsx(Ur,{title:"WebGL 2 unavailable",body:"GPU render mode needs WebGL 2 here — switch render mode to Auto or CPU."}):Le?f.jsxs(f.Fragment,{children:[!K&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),f.jsx("canvas",{ref:Y,className:"w-full h-full object-contain block",style:{display:K?"block":"none",imageRendering:nt,...Ue}})]}):Je?f.jsxs(f.Fragment,{children:[!de&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),f.jsx("canvas",{ref:fe,className:"w-full h-full object-contain block",style:{display:de?"block":"none",imageRendering:nt,...Ue}})]}):et?f.jsxs(f.Fragment,{children:[!I&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying transfer..."}),f.jsx("canvas",{ref:me,className:"w-full h-full object-contain block",style:{display:I?"block":"none",imageRendering:nt,...Ue}})]}):f.jsx("img",{ref:we,src:t,alt:w,className:"w-full h-full object-contain block",draggable:!1,style:{filter:Lt,imageRendering:nt},onLoad:F=>{const te=F.currentTarget;Re({w:te.naturalWidth,h:te.naturalHeight}),y==null||y(te.naturalWidth,te.naturalHeight)}}):f.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return f.jsx(jt,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:_,paneRef:W,wrapperRef:Ee,zoom:x,pan:h,onViewportChange:b,naturalDims:Ge,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${h.x}px, ${h.y}px) scale(${x})`,transformOrigin:"0 0"},viewportPadding:l&&Ge?"16px 4px 4px 28px":"4px",header:f.jsx($r,{id:ke,gamma:qe,offset:yt}),surface:Ot,showAxes:l,overlayNode:Ve,overlay:{displayElRef:ae,sample:lt,version:q,hasSource:!!t},notationSeed:E,exportCanvasRef:oe,leadingMenus:v==="none"?[Ct(v,F=>C(F)),eo(P,F=>A(F))]:[Ct(v,F=>C(F))],extraSliders:v==="none"&&Ut(P)?[{id:"gamma",label:"γ",title:"Display gamma γ for the Gamma transfer — display = clamp(value)^(1/γ), tev-style. Default 2.2 (close to sRGB, not identical). Double-click to type a value.",min:bn,max:vn,step:wn,value:R,onChange:O,format:F=>F.toFixed(1)}]:void 0,onReset:()=>{T.reset(),k.reset(),B.reset()},extraModified:T.isModified||k.isModified||B.isModified,label:w,showLabelChip:!!w,isDraggable:S,onDragStart:m})}function xi(e){const{tonemap:t="srgb",exposure:n=0,gamma:r,showAxes:o=!1,label:s="",interpolation:a="auto",zoom:u=1,pan:i={x:0,y:0},onViewportChange:l,pixelValueNotation:d="decimal",toolbar:x=!0}=e,h=oo(e.hdr),b=h.hdr,[y,w,S]=Fe(Mt(t));c.useEffect(()=>{w(Mt(t))},[t,w]);const[m,g,p]=Fe(r&&r>0?r:St);c.useEffect(()=>{r&&r>0&&g(r)},[r,g]);const E=c.useRef(null),_=c.useRef(null),v=c.useRef(null),[C,T]=c.useState(null),M=c.useRef(null),[P,A]=c.useState(0),[k,R]=c.useState(0),[O,B]=c.useState(0);c.useEffect(()=>{const z=E.current;if(!z)return;let I;try{I=hi(b,y,n+k,zt(y,m),O)}catch(W){console.error("[cairn] HDR tone-map error:",W);return}(z.width!==I.width||z.height!==I.height)&&(z.width=I.width,z.height=I.height);const J=z.getContext("2d");J&&(J.putImageData(I,0,0),M.current=I,A(W=>W+1),T(W=>W&&W.w===I.width&&W.h===I.height?W:{w:I.width,h:I.height}))},[b,y,n,m,k,O]);const X=c.useCallback((z,I,J)=>{const W=C;if(!W||z<0||I<0||z>=W.w||I>=W.h)return null;const Ee=b.shape.length===2?1:b.shape[2]??1,ae=(I*W.w+z)*Ee,xe=b.data,$=b.precision==="f16-bits"?oe=>Xt(xe[oe]??0):oe=>xe[oe]??0,q=M.current;let re=.5;if(q&&q.width===W.w&&q.height===W.h){const oe=(I*W.w+z)*4;re=Tt(q.data[oe],q.data[oe+1],q.data[oe+2])}const ee=Ee===1?[$(ae)]:[$(ae),$(ae+1),$(ae+2)];return pt(ee,"unit",J,re)},[b,C]),Q=a==="auto"?void 0:a;return f.jsx(jt,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:x,paneRef:_,wrapperRef:v,zoom:u,pan:i,onViewportChange:l,naturalDims:C,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${i.x}px, ${i.y}px) scale(${u})`,transformOrigin:"0 0"},viewportPadding:o&&C?"16px 4px 4px 28px":"4px",surface:f.jsx("canvas",{ref:E,className:"w-full h-full object-contain block",style:{imageRendering:Q}}),showAxes:o,overlay:{displayElRef:E,sample:X,version:P,hasSource:!0},notationSeed:d,exportCanvasRef:E,leadingMenus:[Jr(y,z=>w(z))],displayAdjust:{exposureEV:k,offset:O,onExposureChange:R,onOffsetChange:B},extraSliders:Ut(y)?[{id:"gamma",label:"γ",title:"Display gamma γ for the Gamma transfer — display = clamp(value)^(1/γ), tev-style. Default 2.2 (close to sRGB, not identical). Double-click to type a value.",min:bn,max:vn,step:wn,value:m,onChange:g,format:z=>z.toFixed(1)}]:void 0,depthSliders:h.sliders,regionSelect:h.hasDeep?{rect:h.region,queryLive:h.queryRegionWindow,commit:h.commitRegion,remove:h.removeRegion}:void 0,onReset:()=>{h.reset(),S.reset(),p.reset()},extraModified:h.isModified||S.isModified||p.isModified,label:s,showLabelChip:!!s})}function Gn(e){return so(e)?f.jsx(xi,{...e}):f.jsx(gi,{...e})}const io={"no-webgpu":0,"no-hdr-browser":1,"no-hdr-display":2},bi="https://github.com/doeringchristian/cairn-plot/blob/main/docs/browser-support.md";function vi(e,t=!1){const n=e||"";return t?"brave":/firefox/i.test(n)?"firefox":/safari/i.test(n)&&!/chrome|chromium|crios|android/i.test(n)?"safari":/linux/i.test(n)&&/chrome|chromium/i.test(n)?"chromium-linux":"chromium"}function wi(e){const t=e||"";return/mac os x|macintosh/i.test(t)?"macos":/windows/i.test(t)?"windows":"other"}function yi(e,t){if(e==="no-hdr-display")switch(wi(t.userAgent)){case"macos":return"macOS: EDR engages automatically on HDR-capable displays — confirm your display supports HDR.";case"windows":return"Windows: turn on Settings → System → Display → Use HDR.";default:return"Enable HDR in your display and OS settings."}const n=vi(t.userAgent,t.isBrave);if(e==="no-hdr-browser")switch(n){case"firefox":return"Firefox has no extended-tone-mapping canvas path at all — true HDR output is impossible until Firefox implements it (fundamental browser limitation).";case"safari":return"Safari's WebGPU HDR canvas tone-mapping is still maturing — update to the latest Safari 26+.";default:return"Chrome/Edge 129+ is required for HDR canvas output (toneMapping: extended) — update your browser."}switch(n){case"firefox":return"Firefox: about:config → dom.webgpu.enabled (HDR output is not available in Firefox at all — browser limitation).";case"safari":return"Safari: Develop → Feature Flags → WebGPU (Safari 26+ has it by default).";case"brave":return"Brave: check Shields fingerprint blocking + brave://flags.";case"chromium-linux":return"Chromium on Linux: enable chrome://flags/#enable-unsafe-webgpu.";case"chromium":default:return"Chrome/Edge: enable chrome://flags/#enable-unsafe-webgpu and hardware acceleration."}}function Ei(e){switch(e){case"no-webgpu":return"GPU renderer unavailable → CPU fallback active; FLIP kernels + HDR compare disabled.";case"no-hdr-browser":return"True HDR output is unsupported by this browser — a fundamental browser limitation, not a cairn-plot bug → HDR images tone-mapped to SDR.";case"no-hdr-display":return"Your display/OS is not in HDR mode → HDR images tone-mapped to SDR."}}function co(e,t){return`cairn-plot:capnotice:${e}:${t}`}const lo=new Set;function uo(e){try{if(window.localStorage.getItem(e)==="1")return!0}catch{}try{if(window.sessionStorage.getItem(e)==="1")return!0}catch{}return lo.has(e)}function _i(e){try{window.localStorage.setItem(e,"1");return}catch{}try{window.sessionStorage.setItem(e,"1");return}catch{}lo.add(e)}const fo=new Set;let Qt=null,wt=null;function po(){wt&&wt.parentNode&&wt.parentNode.removeChild(wt),wt=null,Qt=null}function Mi(e){const t=co(e,window.location.pathname),n=yi(e,{userAgent:navigator.userAgent,isBrave:!!navigator.brave}),r=document.createElement("div");r.setAttribute("role","status"),r.setAttribute("data-cairn-plot-capnotice",e),Object.assign(r.style,{position:"fixed",bottom:"12px",right:"12px",zIndex:"2147483000",maxWidth:"340px",boxSizing:"border-box",padding:"10px 30px 10px 12px",borderRadius:"6px",border:"1px solid var(--color-border, #d0d7de)",background:"rgb(var(--color-bg-elevated-rgb, 246 248 250) / 0.9)",color:"var(--color-fg-muted, #656d76)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",boxShadow:"0 4px 12px rgba(0, 0, 0, 0.18)",font:"12px/1.4 system-ui, sans-serif"});const o=document.createElement("div");o.textContent=Ei(e),Object.assign(o.style,{fontWeight:"600",color:"var(--color-fg, #1f2328)",marginBottom:"4px"});const s=document.createElement("div");s.textContent=n,s.style.marginBottom="4px";const a=document.createElement("a");a.href=bi,a.target="_blank",a.rel="noopener noreferrer",a.textContent="Learn more",Object.assign(a.style,{color:"var(--color-accent, #0969da)",textDecoration:"none"});const u=document.createElement("button");u.type="button",u.textContent="×",u.setAttribute("aria-label","Dismiss browser capability notice"),u.title="Dismiss",Object.assign(u.style,{position:"absolute",top:"4px",right:"6px",padding:"0 4px",border:"0",background:"transparent",color:"var(--color-fg-subtle, #8b949e)",cursor:"pointer",fontSize:"16px",lineHeight:"1"}),u.addEventListener("click",()=>{_i(t),po()}),r.appendChild(o),r.appendChild(s),r.appendChild(a),r.appendChild(u),document.body.appendChild(r),wt=r,Qt=e}function ho(e){if(typeof document>"u"||typeof window>"u"||fo.has(e))return;fo.add(e);const t=co(e,window.location.pathname);if(uo(t))return;const n=()=>{if(!uo(t)){if(Qt!==null)if(io[e]<io[Qt])po();else return;Mi(e)}};document.body?n():window.addEventListener("DOMContentLoaded",n,{once:!0})}const Si={data:new Float32Array(0),shape:[0,0],dtype:"<f4"};function Ti(e){const{h:t,w:n,c:r}=ao(e.shape);if(e.precision==="f16-bits"){const a=e.data,u=new Uint16Array(n*t*4);for(let i=0;i<n*t;i++){const l=i*r,d=i*4;if(r===1){const x=a[l];u[d]=x,u[d+1]=x,u[d+2]=x,u[d+3]=Vt}else u[d]=a[l],u[d+1]=a[l+1],u[d+2]=a[l+2],u[d+3]=r>=4?a[l+3]:Vt}return{data:u,width:n,height:t,format:"rgba16float"}}const o=e.data,s=new Float32Array(n*t*4);for(let a=0;a<n*t;a++){const u=a*r;let i,l,d,x=1;r===1?i=l=d=Oe(o[u]):r===3?(i=Oe(o[u]),l=Oe(o[u+1]),d=Oe(o[u+2])):(i=Oe(o[u]),l=Oe(o[u+1]),d=Oe(o[u+2]),x=Oe(o[u+3]));const h=a*4;s[h]=i,s[h+1]=l,s[h+2]=d,s[h+3]=x}return{data:s,width:n,height:t,format:"rgba32float"}}function mo(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),s=n*o,a=r*o,u=(t.width-s)/2,i=(t.height-a)/2,l=Math.max(e.zoom,1e-6),d=t.width/(l*s),x=t.height/(l*a),h=-u/s-e.pan.x/(l*s),b=-i/a-e.pan.y/(l*a);return{x:h,y:b,w:d,h:x}}function go(e,t,n,r){const o=e.w*n,s=e.h*r;return o<=0||s<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/s)}const Pi=(()=>{try{return new URLSearchParams(window.location.search).get("hdrEncode")==="legacy"}catch{return!1}})();function Ai(e){var F,te,ue;const t=so(e),n=c.useRef(null),r=c.useRef(null),o=c.useRef(null),s=c.useRef(null),a=c.useRef(null),u=t&&!!((F=e.hdr)!=null&&F.deep),i=c.useCallback((L,N)=>{var G,V;(G=s.current)==null||G.setDeepWindow(L,N),(V=a.current)==null||V.call(a)},[]),l=oo(t?e.hdr:Si,u?i:void 0),d=c.useRef(!1),[x,h]=c.useState(!1),[b,y]=c.useState(!1),[w,S]=c.useState(!1),[m,g]=c.useState(null),[p,E]=c.useState(0),[_,v]=c.useState(0),[C,T]=c.useState({x:0,y:0,w:1,h:1}),M=c.useRef(null),P=c.useRef(null),[A,k]=c.useState(0),R=e.zoom??1,O=e.pan??{x:0,y:0},B=e.onViewportChange,X=t?"none":e.colormap??"none",[Q,z,I]=Fe(X);c.useEffect(()=>{z(X)},[X,z]);const J=t?"none":Q,W=t?e.tonemap:void 0,[Ee,ae]=c.useState(null);c.useEffect(()=>{ae(null)},[W]);const xe=Ps(W),$=Ee??xe,q=Ee!==null&&Ee!==xe,re=c.useCallback(()=>ae(null),[]),ee=t?e.peak:void 0,[oe,Y,fe]=Fe(ee!=null&&ee>0?ee:Ts(W)??rr),me=e.gamma,[we,K,Se]=Fe(me&&me>0?me:St);c.useEffect(()=>{me&&me>0&&K(me)},[me,K]);const ve=t?void 0:e.tonemap,_e=(()=>{const L=Mt(ve);return L==="gamma"||L==="linear"?L:"srgb"})(),[de,Te,Ge]=Fe(_e);c.useEffect(()=>{Te(_e)},[ve]);const[Re,ze]=c.useState(0),[ke,Lt]=c.useState(0),qe=An();c.useEffect(()=>{const L=n.current;if(!L)return;let N=!1;return Nt().then(G=>{var ie;if(N)return;const V=((ie=G.probeExtendedToneMapping)==null?void 0:ie.call(G))??!1,ne=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,U=V&&ne&&t;d.current=U,h(U),t&&!U&&ho(V?"no-hdr-display":"no-hdr-browser"),Ra(L,{hdr:U}).then(ce=>{if(N){Gr(ce);return}s.current=ce,S(!0)}).catch(ce=>{N||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",ce),y(!0))})}).catch(G=>{N||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",G),y(!0))}),()=>{N=!0,s.current&&(Gr(s.current),s.current=null)}},[]),c.useEffect(()=>{const L=r.current;if(!L)return;const N=new ResizeObserver(()=>v(G=>G+1));return N.observe(L),()=>N.disconnect()},[]),c.useEffect(()=>{const L=r.current;if(!L)return;const N=new IntersectionObserver(G=>{const V=G[0];if(!V)return;const ne=s.current;ne&&(ne.setVisible(V.isIntersecting),V.isIntersecting?ne.isParked&&(ne.restore(),v(U=>U+1)):ne.park())},{threshold:0});return N.observe(L),()=>N.disconnect()},[]),c.useEffect(()=>{var G;if(!t||!w||u)return;const L=l.hdr;M.current=L;const N=Ti(L);(G=s.current)==null||G.setSource(N),g(V=>V&&V.w===N.width&&V.h===N.height?V:{w:N.width,h:N.height}),k(V=>V+1),E(V=>V+1)},[t,w,u,t?l.hdr:null]),c.useEffect(()=>{if(!t||!w||!u)return;const L=e.hdr,N=L.deep;M.current=L;let G=!1;return N.getGpuCsr().then(V=>{var ne;G||((ne=s.current)==null||ne.setDeepSource(V,N.zMin,N.zMax),g(U=>U&&U.w===V.width&&U.h===V.height?U:{w:V.width,h:V.height}),k(U=>U+1),E(U=>U+1))}).catch(V=>{G||console.warn("[cairn] deep GPU CSR upload failed:",V)}),()=>{G=!0}},[t,w,u,t?e.hdr.deep:null]),c.useEffect(()=>{if(t||!w)return;const L=e,N=L.imageUrl,G=Q;if(!N){P.current=null,g(null),k(ne=>ne+1);return}let V=!1;return ot(N).then(ne=>{var ce,Pe;if(V||!ne)return;let U=ne;if(G!=="none"){const be=`gpu::${N}::${G}::ev${Re}::off${ke}`,Ce=_n(be);if(Ce)U=Ce;else{const De=En(G);U=yn(ne,G,De,Re,ke),Mn(be,U)}}P.current=ne;const ie={data:U.data,width:U.width,height:U.height,format:"rgba8unorm"};(ce=s.current)==null||ce.setSource(ie),g(be=>be&&be.w===U.width&&be.h===U.height?be:{w:U.width,h:U.height}),(Pe=L.onNaturalSize)==null||Pe.call(L,U.width,U.height),k(be=>be+1),E(be=>be+1)}),()=>{V=!0}},[t,w,t?null:e.imageUrl,t?null:Q,t?0:Re,t?0:ke]);const yt=t?e.exposure??0:0,Le=!t&&J==="none",Qe=c.useCallback(()=>{const L=s.current;if(!L||!w||!m)return;const N=r.current,G=o.current,V=G?G.getBoundingClientRect():N?N.getBoundingClientRect():{width:m.w,height:m.h},ne=mo({zoom:R,pan:O},V,m.w,m.h);T(be=>be.x===ne.x&&be.y===ne.y&&be.w===ne.w&&be.h===ne.h?be:ne),V.width>0&&V.height>0&&L.resize(Math.round(V.width*qe),Math.round(V.height*qe));const U=go(ne,V,m.w,m.h)>=Cn?"nearest":"linear",ie=ne,ce=Cs($,d.current?oe:1,d.current,we),Pe=t?{exposureEV:yt+Re,offset:ke,operator:ce.operator,gamma:ce.gamma,isScalar:!1,hdrOut:ce.hdrOut,hdrEncodeLegacy:Pi,peak:ce.peak,uv:ie,filter:U}:{exposureEV:Le?Re:0,offset:Le?ke:0,operator:Le?de:"linear",gamma:Le?zt(de,we):1,isScalar:!1,hdrOut:!1,srgbDecode:Le,uv:ie,filter:U};try{L.render(Pe)||y(!0)}catch(be){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",be),y(!0)}},[w,m,R,O.x,O.y,yt,Re,ke,$,oe,we,de,Le,t,J,qe]);a.current=Qe,c.useEffect(()=>{Qe()},[Qe,p,_]);const Je=c.useCallback((L,N,G)=>{if(t){const Ce=M.current,De=m;if(!Ce||!De||L<0||N<0||L>=De.w||N>=De.h)return null;const Et=Ce.shape.length===2?1:Ce.shape[2]??1,_t=(N*De.w+L)*Et,sn=Ce.data,xt=Ce.precision==="f16-bits"?D=>Xt(sn[D]??0):D=>sn[D]??0,qn=.5,an=Et===1?[xt(_t)]:[xt(_t),xt(_t+1),xt(_t+2)];return pt(an,"unit",G,qn)}const V=P.current;if(!V||L<0||N<0||L>=V.width||N>=V.height)return null;const ne=(N*V.width+L)*4,U=V.data[ne],ie=V.data[ne+1],ce=V.data[ne+2],Pe=Tt(U,ie,ce);return pt(J!=="none"||U===ie&&ie===ce?[U]:[U,ie,ce],"uint8",G,Pe)},[t,m,J]),et=e.showAxes??!1,tt=t?e.label??"":e.label,lt=e.interpolation??"auto",nt=lt==="auto"?void 0:lt,Ue=t?void 0:e.overlay,Ve=t?void 0:e.overlaySettings,Ot=t?!1:e.isDraggable??!1,gt=t?void 0:e.onDragStart;if(b)return t?f.jsx(Gn,{...e}):f.jsx(Gn,{...e});const ut=Ue&&(Ve!=null&&Ve.enabled)&&m&&((((te=Ue.boxes)==null?void 0:te.length)??0)>0||(((ue=Ue.masks)==null?void 0:ue.length)??0)>0)?f.jsx(Rn,{data:Ue,settings:Ve,naturalWidth:m.w,naturalHeight:m.h}):void 0;return f.jsx(jt,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":w},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:r,wrapperRef:o,zoom:R,pan:O,onViewportChange:B,naturalDims:m,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:et&&m?"16px 4px 4px 28px":0,surface:f.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:nt},"data-gpu-image-canvas":!0}),showAxes:et,overlayNode:ut,overlay:{displayElRef:n,sample:Je,version:A,hasSource:!0,sourceWindow:C},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:Qe,leadingMenus:t?[Jr($,L=>ae(L))]:Le?[Ct(J,L=>z(L)),eo(de,L=>Te(L))]:[Ct(J,L=>z(L))],displayAdjust:{exposureEV:Re,offset:ke,onExposureChange:ze,onOffsetChange:Lt},extraSliders:[...t&&x?[{id:"peak",label:"PK",title:"Peak white (×SDR white) — the HDR ceiling P every operator clips at (Linear/sRGB/Gamma hard-clip at P; Reinhard/ACES roll off toward P). P=1 reproduces the SDR rendition exactly; double-click to type a value, including 'inf' for the raw browser-clipped extended look.",min:Es,max:Ft,step:_s,value:oe,onChange:Y,format:L=>Number.isFinite(L)?`${L.toFixed(1)}×`:"∞"}]:[],...(t?Ut($):Le&&Ut(de))?[{id:"gamma",label:"γ",title:"Display gamma γ for the Gamma transfer — display = clamp(value)^(1/γ), tev-style. Default 2.2 (close to sRGB, not identical). Double-click to type a value.",min:bn,max:vn,step:wn,value:we,onChange:K,format:L=>L.toFixed(1)}]:[]],depthSliders:l.sliders,regionSelect:u?{rect:l.region,queryLive:l.queryRegionWindow,commit:l.commitRegion,remove:l.removeRegion}:void 0,onReset:()=>{I.reset(),re(),fe.reset(),Se.reset(),Ge.reset(),l.reset()},extraModified:I.isModified||q||fe.isModified||Se.isModified||Ge.isModified||l.isModified,label:tt,showLabelChip:!!tt,isDraggable:Ot,onDragStart:gt})}const Jt=new Map;function Ye(e){if(Jt.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);Jt.set(e.id,e)}function it(e){return Jt.get(e)}function Ri(){return Array.from(Jt.values())}function xo(e,t){return{...e.params??{},...t??{}}}const Ci={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},Di={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},ki={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},Li={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},Oi={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},Bi={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},bo=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];Ii(bo);const Un=[1.052156925,1,.91835767],Ni=.7;function Ii(e){const[t,n,r]=e[0],[o,s,a]=e[1],[u,i,l]=e[2],d=s*l-a*i,x=-(o*l-a*u),h=o*i-s*u,y=1/(t*d+n*x+r*h);return[[d*y,-(n*l-r*i)*y,(n*a-r*s)*y],[x*y,(t*l-r*u)*y,-(t*a-r*o)*y],[h*y,-(t*i-n*u)*y,(t*s-n*o)*y]]}function Fi(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const zn=6/29;function $n(e){return e>zn**3?Math.cbrt(e):e/(3*zn*zn)+4/29}function vo(e,t,n){const[r,o,s]=Fi(bo,e,t,n),a=$n(r*Un[0]),u=$n(o*Un[1]),i=$n(s*Un[2]),l=116*u-16,d=500*(a-u),x=200*(u-i);return[l,.01*l*d,.01*l*x]}function Gi(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function Ui(){const e=vo(0,1,0),t=vo(0,0,1);return Math.pow(Gi(e,t),Ni)}const wo=Ui(),zi=.082;function yo(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],s=Math.max(...n,...o),a=Math.ceil(3*Math.sqrt(s/(2*Math.PI**2))*e),u=1/e,i=Math.PI**2,l=[0,0,0];for(let d=-a;d<=a;d++)for(let x=-a;x<=a;x++){const h=(x*u)**2+(d*u)**2;for(let b=0;b<3;b++)l[b]+=t[b]*Math.sqrt(Math.PI/n[b])*Math.exp(-i*h/n[b])+r[b]*Math.sqrt(Math.PI/o[b])*Math.exp(-i*h/o[b])}return{r:a,deltaX:u,sums:l}}function Eo(e){const t=.5*zi*e,n=Math.ceil(3*t);let r=0,o=0,s=0;for(let a=-n;a<=n;a++)for(let u=-n;u<=n;u++){const i=Math.exp(-(u*u+a*a)/(2*t*t)),l=-u*i,d=(u*u/(t*t)-1)*i;l>0&&(r+=l),d>0?o+=d:s-=d}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:s}}const $i=`
${$e}
${Kt}
${mt}
${At}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_map0: vec4<f32>; // offX, offY, fitFill, 0
@group(0) @binding(8) var<uniform> u_map1: vec4<f32>; // resultW, resultH, 0, 0
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = mapSample(src, px, u_map0.x, u_map0.y, u_map1.x, u_map1.y, u_map0.z);
  return vec4<f32>(flip_rgb2ycxcz(s.rgb), 1.0);
}
`,Vi=`
${$e}
${Kt}
${mt}
${At}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_map0: vec4<f32>; // offX, offY, fitFill, 0
@group(0) @binding(8) var<uniform> u_map1: vec4<f32>; // resultW, resultH, 0, 0
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = mapSample(src, px, u_map0.x, u_map0.y, u_map1.x, u_map1.y, u_map0.z);
  return vec4<f32>(flip_linrgb2ycxcz(clamp(s.rgb, vec3<f32>(0.0), vec3<f32>(1.0))), 1.0);
}
`,en=`
${$e}
${Kt}
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
`,_o=`
${$e}
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
`;function Ke(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function tn(e,t,n){const r=n.sourceMap,o=r?t==="a"?r.offsetA:r.offsetB:{x:0,y:0},s=r!=null&&r.fill?1:0;return[Ke(e,[o.x,o.y,s,0]),Ke(e+1,[n.width,n.height,0,0])]}function nn(e){return[Ke(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),Ke(2,[e.sums[2],0,0,0])]}function Mo(e){return[Ke(4,[wo,e.sd,e.r,e.edgeNorm]),Ke(5,[e.pointPos,e.pointNeg,0,0])]}function So(e,t,n,r,o,s=""){const a=yo(e),u=Eo(e),i=`ycxczA${s}`,l=`ycxczB${s}`,d=`labA${s}`,x=`labB${s}`,h=`flip${s}`;return{passes:[{name:i,shader:t,inputs:[n],output:i,uniforms:()=>tn(1,"a",o)},{name:l,shader:t,inputs:[r],output:l,uniforms:()=>tn(1,"b",o)},{name:d,shader:en,inputs:[i],output:d,uniforms:()=>nn(a)},{name:x,shader:en,inputs:[l],output:x,uniforms:()=>nn(a)},{name:h,shader:_o,inputs:[d,x,i,l],output:h,uniforms:()=>Mo(u)}],flipRef:h}}const Xi={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=So(t,$i,"srcA","srcB",e);return{passes:n,final:r}}},Wi={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=So(t,Vi,"srcA","srcB",e);return{passes:n,final:r}}},To=`
${$e}
${Kt}
${mt}
${At}
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
`,Hi=`
${$e}
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
`,Yi={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",output:"scalar",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),s=(r-n)/Math.max(o-1,1),a=yo(t),u=Eo(t),i=[];let l=null;for(let d=0;d<o;d++){const x=n+d*s,h=`_e${d}`,b=`ycxczA${h}`,y=`ycxczB${h}`,w=`labA${h}`,S=`labB${h}`,m=`acc${h}`;i.push({name:b,shader:To,inputs:["srcA"],output:b,uniforms:()=>[Ke(1,[x,0,0,0]),...tn(2,"a",e)]},{name:y,shader:To,inputs:["srcB"],output:y,uniforms:()=>[Ke(1,[x,0,0,0]),...tn(2,"b",e)]},{name:w,shader:en,inputs:[b],output:w,uniforms:()=>nn(a)},{name:S,shader:en,inputs:[y],output:S,uniforms:()=>nn(a)}),l===null?i.push({name:m,shader:_o,inputs:[w,S,b,y],output:m,uniforms:()=>Mo(u)}):i.push({name:m,shader:Hi,inputs:[w,S,b,y,l],output:m,uniforms:()=>[Ke(5,[wo,u.sd,u.r,u.edgeNorm]),Ke(6,[u.pointPos,u.pointNeg,0,0])]}),l=m}return{passes:i,final:l}}},Po=.01,Ao=.03,rn=1,Vn=1.5,ct=5,Xn=[.2126,.7152,.0722];function Wn(e){return e<=.04045?e/12.92:Math.pow((e+.055)/1.055,2.4)}function Ro(e,t,n){const r=Xn[0]*Wn(e)+Xn[1]*Wn(t)+Xn[2]*Wn(n);return Math.min(1,Math.max(0,r))}function Ki(e,t){const n=2*t+1,r=new Float64Array(n);let o=0;for(let s=-t,a=0;s<=t;s++,a++){const u=Math.exp(-.5*s*s/(e*e));r[a]=u,o+=u}for(let s=0;s<n;s++)r[s]=r[s]/o;return r}function Co(e,t){if(t===1)return 0;const n=2*t;let r=(e%n+n)%n;return r>=t&&(r=n-1-r),r}const Do=()=>new Promise(e=>{typeof setTimeout=="function"?setTimeout(e,0):Promise.resolve().then(e)}),Hn=64;async function Dt(e,t,n,r,o,s){const a=new Float64Array(t*n);for(let i=0;i<n;i++){for(let l=0;l<t;l++){let d=0;for(let x=-o,h=0;x<=o;x++,h++)d+=r[h]*e[i*t+Co(l+x,t)];a[i*t+l]=d}(i+1)%Hn===0&&await s()}const u=new Float64Array(t*n);for(let i=0;i<n;i++){for(let l=0;l<t;l++){let d=0;for(let x=-o,h=0;x<=o;x++,h++)d+=r[h]*a[Co(i+x,n)*t+l];u[i*t+l]=d}(i+1)%Hn===0&&await s()}return u}async function qi(e,t,n,r,o=Do){const s=n*r;if(s<=0)return NaN;const a=Ki(Vn,ct),u=new Float64Array(s),i=new Float64Array(s),l=new Float64Array(s);for(let g=0;g<s;g++)u[g]=e[g]*e[g],i[g]=t[g]*t[g],l[g]=e[g]*t[g];const d=await Dt(e,n,r,a,ct,o),x=await Dt(t,n,r,a,ct,o),h=await Dt(u,n,r,a,ct,o),b=await Dt(i,n,r,a,ct,o),y=await Dt(l,n,r,a,ct,o),w=(Po*rn)**2,S=(Ao*rn)**2;let m=0;for(let g=0;g<s;g++){const p=h[g]-d[g]*d[g],E=b[g]-x[g]*x[g],_=y[g]-d[g]*x[g],v=2*d[g]*x[g]+w,C=2*_+S,T=d[g]*d[g]+x[g]*x[g]+w,M=p+E+S;m+=v*C/(T*M)}return m/s}const ko=`
${$e}

fn ssim_srgb2linear(c: f32) -> f32 {
  if (c <= 0.04045) { return c / 12.92; }
  return pow((c + 0.055) / 1.055, 2.4);
}
fn ssim_luma(srgb: vec3<f32>) -> f32 {
  let lin = vec3<f32>(ssim_srgb2linear(srgb.r), ssim_srgb2linear(srgb.g), ssim_srgb2linear(srgb.b));
  return clamp(dot(lin, vec3<f32>(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
}

${mt}
${At}
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
`,Zi=`
${ko}
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let y = ssim_moment_luma(in);
  return vec4<f32>(y.x, y.y, y.x * y.x, y.y * y.y);
}
`,ji=`
${ko}
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let y = ssim_moment_luma(in);
  return vec4<f32>(y.x * y.y, 0.0, 0.0, 0.0);
}
`,Lo=`
${$e}
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
`,Qi=`
${$e}
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
`;function kt(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function Oo(e){const t=e.sourceMap,n=t?t.offsetA:{x:0,y:0},r=t?t.offsetB:{x:0,y:0},o=t!=null&&t.fill?1:0;return[kt(2,[n.x,n.y,r.x,r.y]),kt(3,[e.width,e.height,o,0])]}function Bo(e,t){const n=`${t}H`,r=`${t}V`;return{passes:[{name:n,shader:Lo,inputs:[e],output:n,uniforms:()=>[kt(1,[1,0,ct,Vn])]},{name:r,shader:Lo,inputs:[n],output:r,uniforms:()=>[kt(1,[0,1,ct,Vn])]}],out:r}}const Ji={kind:"multipass",id:"ssim",label:"SSIM (1−SSIM)",publicName:"ssim",displayRange:"unit",output:"scalar",buildPasses(e){const t=(Po*rn)**2,n=(Ao*rn)**2,r=Bo("momA","statsA"),o=Bo("momB","statsB");return{passes:[{name:"momA",shader:Zi,inputs:["srcA","srcB"],output:"momA",uniforms:Oo},{name:"momB",shader:ji,inputs:["srcA","srcB"],output:"momB",uniforms:Oo},...r.passes,...o.passes,{name:"ssim",shader:Qi,inputs:[r.out,o.out],output:"ssim",uniforms:()=>[kt(2,[t,n,0,0])]}],final:"ssim"}}};let No=!1;function ec(){No||(No=!0,Ye(Di),Ye(Ci),Ye(ki),Ye(Oi),Ye(Li),Ye(Bi),Ye(Xi),Ye(Yi),Ye(Wi),Ye(Ji))}ec();function Io(){const e=[];for(const n of Ri())n.kind==="pointwise"&&e.push({id:n.id,label:n.label});e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"});const t=it("ssim");return t&&e.push({id:t.id,label:t.label}),e}function tc(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}function nc(e,t,n){const r=t*n;if(r<=0)return NaN;let o=0;for(let s=0;s<r;s++)o+=e[s*4]??0;return 1-o/r}function Fo(e){return e==null||Number.isNaN(e)?"—":e.toFixed(4)}const Go=new WeakMap;function rc(e,t,n){let r=Go.get(e);r||(r=new Map,Go.set(e,r));const o=r.get(t);if(o)return o;const s=n().catch(a=>{throw r.get(t)===s&&r.delete(t),a});return r.set(t,s),s}const Uo=new WeakMap;function Yn(e,t,n,r){let o=Uo.get(e);o||(o=new Map,Uo.set(e,o));const s=`${t}::${r}`;let a=o.get(s);return a||(a=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(s,a)),a}function oc(e){return`
${$e}
${mt}
${At}
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
`}const on="rgba16float";function sc(e,t,n,r,o,s){var S,m;const a=it(r);if(!a)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const u=s??Rt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),i=u.result.w,l=u.result.h,d=u.fit==="fill"?1:0,x=xo(a,o);if(a.kind==="pointwise"){const g=e.createTexture(i,l,on),p=Yn(e,`pw:${a.id}`,oc(a.source),on),E=new Float32Array([u.offsetA.x,u.offsetA.y,u.offsetB.x,u.offsetB.y]),_=new Float32Array([i,l,d,0]);let v;try{v=e.createBindGroup(p,[{binding:0,resource:t},{binding:1,resource:n},{binding:2,resource:{uniform:E}},{binding:3,resource:{uniform:_}}]),e.renderFullscreen(g,p,v)}finally{(S=v==null?void 0:v.destroy)==null||S.call(v)}return g}const h={width:i,height:l,params:x,sourceMap:{fill:u.fit==="fill",offsetA:u.offsetA,offsetB:u.offsetB}},b=a.buildPasses(h),y=new Map([["srcA",t],["srcB",n]]),w=[];try{for(const p of b.passes){const E=e.createTexture(i,l,on);w.push(E),y.set(p.output,E);const _=Yn(e,`mp:${a.id}:${p.name}`,p.shader,on),v=p.inputs.map((T,M)=>{const P=y.get(T);if(!P)throw new Error(`computeDiff: pass "${p.name}" input "${T}" not produced yet`);return{binding:M,resource:P}});p.uniforms&&v.push(...p.uniforms(h));let C;try{C=e.createBindGroup(_,v),e.renderFullscreen(E,_,C)}finally{(m=C==null?void 0:C.destroy)==null||m.call(C)}}const g=y.get(b.final);if(!g)throw new Error(`computeDiff: final ref "${b.final}" not produced`);for(const p of w)p!==g&&p.destroy();return g}catch(g){for(const p of w)p.destroy();throw g}}const ac=8,ic=256*1024*1024;class cc{constructor(t=ac,n=ic){le(this,"map",new Map);le(this,"totalBytes",0);le(this,"maxEntries");le(this,"maxBytes");this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}accountReadbackBytes(t,n){let r=!1;for(const o of this.map.values())if(o===t){r=!0;break}r&&(t.bytes+=n,this.totalBytes+=n,this.evict())}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const zo=new WeakMap;function $o(e){let t=zo.get(e);return t||(t=new cc,zo.set(e,t)),t}function lc(e,t){const n=xo(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function uc(e,t,n,r,o){const s=it(n),a=s?lc(s,r):"",u=o?kn(o):"";return`${e}|${t}|${n}|${a}|${u}`}function Vo(e,t,n,r,o,s,a,u){const i=it(r);if(!i)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const l=$o(e),d=u??Rt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),x=uc(s,a,r,o,d),h=l.get(x);if(h)return h;const b=sc(e,t,n,r,o,d),y=d.result.w,w=d.result.h,S={texture:b,width:y,height:w,displayRange:i.displayRange,bytes:y*w*8};return l.set(x,S),S}function fc(e,t,n){return`${e}|${t}|${n?kn(n):""}`}function dc(e,t,n,r,o,s){return rc(e,fc(r,o,s),()=>pc(e,t,n,r,o,s))}async function pc(e,t,n,r,o,s){try{const a=Vo(e,t,n,"ssim",void 0,r,o,s);return a.ssimMean!==void 0?a.ssimMean:(a.ssimMeanPending||(a.ssimMeanPending=Xo(e,a).then(u=>{const i=nc(u,a.width,a.height);return a.ssimMean=i,i})),await a.ssimMeanPending)}catch{return hc(e,t,n,s)}}async function hc(e,t,n,r){const o=r??Rt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),s=o.result.w,a=o.result.h,u=s*a;if(u<=0)return NaN;const i=await e.readback(t),l=await e.readback(n),d=i instanceof Uint8Array?255:1,x=l instanceof Uint8Array?255:1,h=o.fit==="fill",b=qt(i,t.width,t.height,d,o.offsetA,h,s,a),y=qt(l,n.width,n.height,x,o.offsetB,h,s,a),w=new Float64Array(u),S=new Float64Array(u),m=[0,0,0],g=[0,0,0];for(let p=0;p<a;p++){for(let E=0;E<s;E++){b(E,p,m),y(E,p,g);const _=p*s+E;w[_]=Ro(m[0],m[1],m[2]),S[_]=Ro(g[0],g[1],g[2])}(p+1)%Hn===0&&await Do()}return qi(w,S,s,a)}async function mc(e,t,n,r,o){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=Or(e,n,r,o).then(s=>(t.scalars=s,s))),t.scalarsPending)}async function Xo(e,t){return t.resultSamples?t.resultSamples:(t.resultSamplesPending||(t.resultSamplesPending=e.readback(t.texture).then(n=>{const r=n instanceof Float32Array?n:Float32Array.from(n);return t.resultSamples=r,$o(e).accountReadbackBytes(t,r.byteLength),r})),t.resultSamplesPending)}const gc=`
${$e}
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
`,xc={unit:0,signed:1,relative:2},bc={linear:0,signed:1,positive:2};function vc(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function wc(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function yc(e,t,n,r,o){var b,y,w;const s=wc(t),a=Yn(e,"diff-display",gc,s),u=vc(e,o.colormap),i=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),l=new Float32Array([xc[r],bc[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]),d=new Float32Array([o.exposureEV??0,o.offset??0,0,0]),x=new Float32Array([((b=o.sourceDims)==null?void 0:b.w)??0,((y=o.sourceDims)==null?void 0:y.h)??0,0,0]);let h;try{h=e.createBindGroup(a,[{binding:0,resource:n},{binding:1,resource:u},{binding:2,resource:{uniform:i}},{binding:3,resource:{uniform:l}},{binding:4,resource:{uniform:d}},{binding:5,resource:{uniform:x}}]),e.renderFullscreen(t,a,h)}finally{(w=h==null?void 0:h.destroy)==null||w.call(h),u.destroy()}}const Wo=.6*.6*2.51,Ec=.6*.03,_c=0,Ho=.6*.6*2.43,Mc=.6*.59,Sc=.14;function Yo(e){const t=(Ec-Mc*e)/(Wo-Ho*e),n=(_c-Sc*e)/(Wo-Ho*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const Tc=.85,Pc=.85,Ko=11920928955078125e-23,Kn=[.2126,.7152,.0722];function Ac(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function Rc(e,t,n,r=3,o={}){const s=t*n,a=Yo(Tc),u=Yo(Pc),i=new Float64Array(s);let l=0;for(let g=0;g<s;g++){const[p,E,_]=Ac(e,g,r),v=p*Kn[0]+E*Kn[1]+_*Kn[2];i[g]=v,v>l&&(l=v)}const d=Float64Array.from(i).sort(),x=s>>1,h=s%2===1?d[x]:d[x-1],b=Math.max(h,Ko),y=Math.max(l,Ko),w=o.startExposure??Math.log2(a/y),S=o.stopExposure??Math.log2(u/b),m=Math.max(2,Math.ceil(S-w));return{startExposure:w,stopExposure:S,numExposures:m}}const Cc="absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm pointer-events-none select-none",Dc="REF";function qo(){return f.jsx("span",{className:Cc,children:Dc})}function Zo({splitPosition:e,onChange:t,onReset:n}){return f.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${e*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:r=>{r.stopPropagation(),n==null||n()},onPointerDown:r=>{r.stopPropagation(),r.preventDefault();const o=r.currentTarget;try{o.setPointerCapture(r.pointerId)}catch{}const a=o.parentElement.getBoundingClientRect(),u=l=>{t==null||t(Math.max(0,Math.min(1,(l.clientX-a.left)/a.width)))},i=()=>{window.removeEventListener("pointermove",u),window.removeEventListener("pointerup",i)};window.addEventListener("pointermove",u),window.addEventListener("pointerup",i)},children:f.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})}const kc={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Lc({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:s,zoom:a,pan:u,onViewportChange:i,processing:l=kc,interpolation:d="auto",label:x="",isDraggable:h=!1,onDragStart:b,overlay:y,overlaySettings:w,pixelValueNotation:S="decimal"}){var ee,oe;const m=c.useRef(null),[g,p]=c.useState(null),[E,_]=c.useState(null),[v,C]=c.useState(S),[T,M]=c.useState(!1),P=c.useRef(null),A=c.useRef(null),k=c.useRef(null),R=c.useRef(null),[O,B]=c.useState(0);c.useEffect(()=>{if(!e){k.current=null,B(fe=>fe+1);return}let Y=!1;return ot(e).then(fe=>{Y||(k.current=fe,B(me=>me+1))}),()=>{Y=!0}},[e]),c.useEffect(()=>{if(!t){R.current=null,B(fe=>fe+1);return}let Y=!1;return ot(t).then(fe=>{Y||(R.current=fe,B(me=>me+1))}),()=>{Y=!0}},[t]);const X=Y=>(fe,me,we)=>{const K=Y.current;if(!K||fe<0||me<0||fe>=K.width||me>=K.height)return null;const Se=(me*K.width+fe)*4,ve=K.data[Se],_e=K.data[Se+1],de=K.data[Se+2],Te=Tt(ve,_e,de);return ve===_e&&_e===de?{lines:[vt(ve,"uint8",we)],luminance:Te}:{lines:[vt(ve,"uint8",we),vt(_e,"uint8",we),vt(de,"uint8",we)],luminance:Te,colors:[Yt[0],Yt[1],Yt[2]]}},Q=c.useMemo(()=>X(k),[]),z=c.useMemo(()=>X(R),[]),I=!!y&&!!(w!=null&&w.enabled)&&!!g&&!!e&&((((ee=y.boxes)==null?void 0:ee.length)??0)>0||(((oe=y.masks)==null?void 0:oe.length)??0)>0),{gammaFilterId:J,filterStr:W,gamma:Ee,offset:ae}=zr(l),xe=`translate(${u.x}px, ${u.y}px) scale(${a})`,$=d==="auto"?void 0:d,{containerProps:q,modifierActive:re}=yr({containerRef:m,zoom:a,pan:u,onViewportChange:i});return f.jsxs("div",{className:"relative flex flex-col h-full",children:[f.jsx($r,{id:J,gamma:Ee,offset:ae}),f.jsxs("div",{ref:m,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...q.style},onPointerDown:q.onPointerDown,onPointerMove:q.onPointerMove,onPointerUp:q.onPointerUp,onPointerCancel:q.onPointerCancel,children:[f.jsxs("div",{className:"relative w-full h-full",children:[f.jsxs("div",{className:"relative w-full h-full",style:{transform:xe,transformOrigin:"0 0"},children:[f.jsx("img",{ref:P,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:W,imageRendering:$,...n==="blend"?{opacity:o}:{}},onLoad:Y=>{const fe=Y.currentTarget;p({w:fe.naturalWidth,h:fe.naturalHeight})}}),I&&f.jsx(Rn,{data:y,settings:w,naturalWidth:g.w,naturalHeight:g.h})]}),f.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:f.jsx("div",{className:"w-full h-full",style:{transform:xe,transformOrigin:"0 0"},children:f.jsx("img",{ref:A,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:W,imageRendering:$,...n==="blend"?{opacity:1-o}:{}},onLoad:Y=>{const fe=Y.currentTarget;_({w:fe.naturalWidth,h:fe.naturalHeight})}})})}),n==="split"&&f.jsx(Zo,{splitPosition:r,onChange:s,onReset:()=>s==null?void 0:s(.5)})]}),n==="split"?f.jsxs(f.Fragment,{children:[t&&E&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:f.jsx(ht,{imageElRef:A,naturalWidth:E.w,naturalHeight:E.h,zoom:a,pan:u,sample:z,notation:v,version:O})}),e&&g&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:f.jsx(ht,{imageElRef:P,naturalWidth:g.w,naturalHeight:g.h,zoom:a,pan:u,sample:Q,notation:v,version:O,onActiveChange:M})})]}):e&&g&&f.jsx(ht,{imageElRef:P,naturalWidth:g.w,naturalHeight:g.h,zoom:a,pan:u,sample:Q,notation:v,version:O,onActiveChange:M}),T&&f.jsx(Tr,{notation:v,onChange:C})]}),n==="split"&&f.jsx(qo,{}),f.jsx(On,{label:x,corner:"bottom-right",isDraggable:h&&!re,grip:!0,onDragStart:b})]})}function Oc(){return f.jsx(Ur,{title:"GPU compare unavailable",body:"Float image sources need the GPU compare (WebGPU), which isn't available in this browser."})}function Bc({mode:e,kernel:t,kernelOptions:n,onSlide:r,onBlend:o,onKernel:s,onSide:a}){return{id:"compare-mode",title:"Compare / diff mode",menu:{options:[...a?[{id:"side",label:"Side"}]:[],{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...n],value:e==="side"?"side":e==="split"?"slide":e==="blend"?"blend":t,onSelect:l=>{l==="side"?a==null||a():l==="slide"?r():l==="blend"?o():s(l)}}}}function Nc(e){const t=hn(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function Ic(e){const{width:t,height:n,channels:r}=e,o=t*n;if(e.precision==="f16-bits"){const i=e.data,l=new Uint16Array(o*4);for(let d=0;d<o;d++){const x=d*r,h=d*4;if(r===1){const b=i[x];l[h]=b,l[h+1]=b,l[h+2]=b,l[h+3]=Vt}else l[h]=i[x],l[h+1]=i[x+1],l[h+2]=i[x+2],l[h+3]=r>=4?i[x+3]:Vt}return{data:l,format:"rgba16float"}}const s=e.data,a=new Float32Array(o*4),u=i=>Number.isFinite(i)?i:0;for(let i=0;i<o;i++){const l=i*r;let d,x,h,b=1;r===1?d=x=h=u(s[l]):r===3?(d=u(s[l]),x=u(s[l+1]),h=u(s[l+2])):(d=u(s[l]),x=u(s[l+1]),h=u(s[l+2]),b=u(s[l+3]));const y=i*4;a[y]=d,a[y+1]=x,a[y+2]=h,a[y+3]=b}return{data:a,format:"rgba32float"}}function Fc({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:s,blendAlpha:a,onSplitPositionChange:u,diffSubmode:i,colormap:l="none",align:d="top-left",fit:x="crop",diffKernel:h,onDiffKernelChange:b,onCompareModeChange:y,onRequestSide:w,zoom:S,pan:m,onViewportChange:g,interpolation:p="auto",label:E="",pixelValueNotation:_="decimal"}){var an;const v=c.useRef(null),C=c.useRef(null),T=c.useRef(null),M=c.useRef(null),P=c.useRef(null),[A,k]=c.useState(!1),[R,O]=c.useState(!1),[B,X]=c.useState(null),[Q,z]=c.useState(null),[I,J]=c.useState(0),[W,Ee]=c.useState(0),[ae,xe]=c.useState(null),[$,q]=c.useState(null),[re,ee]=c.useState({x:0,y:0,w:1,h:1}),oe=h??i??"absolute",[Y,fe,me]=Fe(oe);c.useEffect(()=>{fe(h??i??"absolute")},[h,i,fe]);const we=c.useCallback(D=>{fe(D),b==null||b(D)},[b,fe]);c.useEffect(()=>{const D=v.current;if(D)return D.__cairnDiffKernel={current:Y,set:we},()=>{D&&delete D.__cairnDiffKernel}},[Y,we]);const[K,Se,ve]=Fe(o);c.useEffect(()=>{Se(o)},[o,Se]);const _e=c.useCallback(D=>{Se(D),y==null||y(D)},[y,Se]),[de,Te,Ge]=Fe(l);c.useEffect(()=>{Te(l)},[l,Te]);const Re=c.useCallback(()=>{_e(ve.default),Te(Ge.default),we(me.default)},[_e,Te,we,ve.default,Ge.default,me.default]),ze=ve.isModified||Ge.isModified||me.isModified,[ke,Lt]=c.useState(0),[qe,yt]=c.useState(0),Le=c.useMemo(()=>{const Z=[Bc({mode:K,kernel:Y,kernelOptions:Io().map(j=>({id:j.id,label:j.label})),onSide:w,onSlide:()=>_e("split"),onBlend:()=>_e("blend"),onKernel:j=>{_e("diff"),we(j)}})];return K==="diff"&&Z.push(Ct(de,j=>Te(j))),Z},[K,Y,de,we,_e,w]),Qe=c.useRef(null),Je=c.useRef(null),et=c.useRef(null),tt=c.useRef(null),[lt,nt]=c.useState(0),Ue=c.useRef(null),Ve=c.useRef(null),[Ot,gt]=c.useState(0),ut=An();c.useEffect(()=>{const D=T.current;if(!D)return;let Z=!1;return Nt().then(j=>{if(!Z)try{if(Br())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const H=j.createSurface(D,{hdr:!1});M.current={device:j,surface:H,texA:null,texB:null},O(!0)}catch(H){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",H),k(!0)}}).catch(j=>{Z||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",j),k(!0))}),()=>{var H,pe;Z=!0;const j=M.current;j&&((H=j.texA)==null||H.destroy(),(pe=j.texB)==null||pe.destroy(),M.current=null)}},[]),c.useEffect(()=>{const D=v.current;if(!D)return;const Z=new ResizeObserver(()=>Ee(j=>j+1));return Z.observe(D),()=>Z.disconnect()},[]),c.useEffect(()=>{if(!R)return;let D=!1;if(!M.current)return;async function j(H,pe){if(pe){const Me=Ic(pe);return{width:pe.width,height:pe.height,imageData:null,make:Ae=>{const ge=Ae.createTexture(pe.width,pe.height,Me.format);return ge.write(Me.data),ge}}}if(!H)return null;const he=await ot(H);return he?{width:he.width,height:he.height,imageData:he,make:Me=>{const Ae=Me.createTexture(he.width,he.height,"rgba8unorm");return Ae.write(he.data),Ae}}:null}return Promise.all([j(e,n),j(t,r)]).then(([H,pe])=>{var Ne,Xe;if(D||!M.current)return;const he=M.current;Qe.current=(H==null?void 0:H.imageData)??null,Je.current=(pe==null?void 0:pe.imageData)??null,et.current=n??null,tt.current=r??null,(Ne=he.texA)==null||Ne.destroy(),(Xe=he.texB)==null||Xe.destroy(),he.texA=null,he.texB=null;const Me=H??pe;if(!Me){X(null),z(null),nt(Ze=>Ze+1);return}const Ae=pe??Me,ge=H??Me;he.texA=Ae.make(he.device),he.texB=ge.make(he.device),z({a:{w:Ae.width,h:Ae.height},b:{w:ge.width,h:ge.height}}),X({w:Me.width,h:Me.height}),nt(Ze=>Ze+1),J(Ze=>Ze+1)}),()=>{D=!0}},[R,e,t,n,r]);const F=n!=null||r!=null,te=c.useMemo(()=>tc(Y,F),[Y,F]),ue=c.useMemo(()=>{if(!F)return null;const D=r??n;if(!D)return null;const Z=D.precision==="f16-bits"?hr(D.data):D.data;return Rc(Z,D.width,D.height,D.channels)},[F,r,n]),L=c.useMemo(()=>{var D;return Ds(((D=it(te))==null?void 0:D.displayRange)??"unit",de==="none"?null:de)},[te,de]),N=c.useMemo(()=>de!=="none"?Nc(de):void 0,[de]),G=c.useMemo(()=>Q?Rt(Q.a,Q.b,d,x,"b"):null,[Q,d,x]),V=c.useMemo(()=>G?kn(G):"none",[G]),ne=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",U=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",ie=c.useMemo(()=>B?K==="diff"&&G?G.result:B:null,[K,G,B]),ce=c.useCallback(()=>{const D=M.current;if(!R||!D||!D.surface||!D.texA||!D.texB||!B)return;const Z=ie??B,j=v.current,H=j?j.getBoundingClientRect():{width:Z.w,height:Z.h},pe=mo({zoom:S,pan:m},H,Z.w,Z.h);ee(ge=>ge.x===pe.x&&ge.y===pe.y&&ge.w===pe.w&&ge.h===pe.h?ge:pe);const he=T.current;if(H.width>0&&H.height>0&&he&&D.surface){const ge=Math.max(1,Math.round(H.width*ut)),Ne=Math.max(1,Math.round(H.height*ut));(he.width!==ge||he.height!==Ne)&&(he.width=ge,he.height=Ne,D.surface.configure(ge,Ne))}const Me=go(pe,H,Z.w,Z.h)>=Cn?"nearest":"linear",Ae=pe;try{if(K==="diff"){const ge=it(te)?te:"absolute",Ne=ge==="hdr-flip"&&ue?{ppd:67,startExposure:ue.startExposure,stopExposure:ue.stopExposure,numExposures:ue.numExposures}:void 0,Xe=Vo(D.device,D.texA,D.texB,ge,Ne,ne,U,G??void 0);P.current=Xe,yc(D.device,D.surface,Xe.texture,Xe.displayRange,{uv:Ae,cmapMode:L,colormap:N,filter:Me,exposureEV:ke,offset:qe})}else{const ge={exposureEV:ke,offset:qe,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:Ae,filter:Me,mode:K,split:s,alpha:a};Ma(D.device,D.surface,D.texA,D.texB,ge)}}catch(ge){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",ge),k(!0)}},[R,B,ie,G,S,m.x,m.y,K,s,a,ke,qe,Y,te,ue,L,N,e,t,n,r,ne,U,ut]);c.useEffect(()=>{ce()},[ce,I,W]);const Pe=t!=null||r!=null;c.useEffect(()=>{const D=M.current;if(!R||!D||!D.texA||!D.texB||!Pe){xe(null);return}let Z=!1;const j=D.texA,H=D.texB,pe=P.current,he=K==="diff"?G??void 0:void 0;return(K==="diff"&&pe?mc(D.device,pe,j,H,he):Or(D.device,j,H,he)).then(Ae=>{Z||xe(Ae)}),()=>{Z=!0}},[R,I,Pe,K,Y,G]),c.useEffect(()=>{const D=M.current;if(!R||!D||!D.texA||!D.texB||!Pe){q(null);return}let Z=!1;q(null);const j=K==="diff"?G??void 0:void 0;return dc(D.device,D.texA,D.texB,ne,U,j).then(H=>{Z||q(H)}).catch(()=>{Z||q(null)}),()=>{Z=!0}},[R,I,Pe,K,V,ne,U]),c.useEffect(()=>{if(K!=="diff"){Ue.current=null,Ve.current=null;return}const D=M.current,Z=P.current;if(!R||!D||!Z)return;let j=!1;return Ue.current=null,Ve.current=null,gt(H=>H+1),Xo(D.device,Z).then(H=>{j||(Ue.current=H,Ve.current={w:Z.width,h:Z.height},gt(pe=>pe+1))}).catch(()=>{}),()=>{j=!0}},[R,K,te,I,G]);const be=(D,Z)=>(j,H,pe)=>{const he=Z.current;if(he){const{data:jo,width:Qo,height:zc,channels:Jo}=he;if(j<0||H<0||j>=Qo||H>=zc)return null;const cn=(H*Qo+j)*Jo,ln=he.precision==="f16-bits"?Zn=>Xt(jo[Zn]??0):Zn=>jo[Zn]??0,$c=.5,Vc=Jo===1?[ln(cn)]:[ln(cn),ln(cn+1),ln(cn+2)];return pt(Vc,"unit",pe,$c)}const Me=D.current;if(!Me||j<0||H<0||j>=Me.width||H>=Me.height)return null;const Ae=(H*Me.width+j)*4,ge=Me.data[Ae],Ne=Me.data[Ae+1],Xe=Me.data[Ae+2],Ze=Tt(ge,Ne,Xe);return pt(ge===Ne&&Ne===Xe?[ge]:[ge,Ne,Xe],"uint8",pe,Ze)},Ce=c.useMemo(()=>be(Qe,et),[]),De=c.useMemo(()=>be(Je,tt),[]),Et=c.useMemo(()=>(D,Z,j)=>{var Ze;const H=Ue.current,pe=Ve.current;if(!H||!pe)return null;const{w:he,h:Me}=pe;if(D<0||Z<0||D>=he||Z>=Me)return null;const Ae=(Z*he+D)*4,ge=((Ze=it(te))==null?void 0:Ze.output)??"per-channel",Ne=.5,Xe=ge==="scalar"?[H[Ae]??0]:[H[Ae]??0,H[Ae+1]??0,H[Ae+2]??0];return pt(Xe,"unit",j,Ne)},[te]);c.useEffect(()=>{const D=v.current;if(D)return D.__cairnCompareProbe={sampleDiff:(Z,j,H="decimal")=>Et(Z,j,H),sampleFg:(Z,j,H="decimal")=>Ce(Z,j,H),sampleRef:(Z,j,H="decimal")=>De(Z,j,H),get diffSamples(){return Ue.current},get dims(){return ie},get primaryDims(){return B},get diffResultDims(){return Ve.current},get align(){return d},get fit(){return x},get resolvedKernelId(){return te},get compareMode(){return K},get ssimScalar(){return $},get ssimText(){return Fo($)}},()=>{D&&delete D.__cairnCompareProbe}},[Et,Ce,De,B,ie,d,x,te,K,$]);const _t=p==="auto"?void 0:p;if(A)return n!=null||r!=null?f.jsx(Oc,{}):K==="diff"?f.jsx(Gn,{imageUrl:e,baselineUrl:t,diffMode:((an=it(te))==null?void 0:an.kind)==="pointwise"?te:"absolute",interpolation:p,colormap:de,showAxes:!1,zoom:S,pan:m,onViewportChange:g,label:E,pixelValueNotation:_}):f.jsx(Lc,{imageUrl:e,baselineUrl:t,mode:K,splitPosition:s,blendAlpha:a,onSplitPositionChange:u,zoom:S,pan:m,onViewportChange:g,interpolation:p,label:E,pixelValueNotation:_});const sn=f.jsxs(f.Fragment,{children:[f.jsx("canvas",{ref:T,className:"w-full h-full block",style:{imageRendering:_t},"data-gpu-compare-canvas":!0}),K==="split"&&f.jsx(Zo,{splitPosition:s,onChange:u,onReset:()=>u==null?void 0:u(.5)})]}),xt=!!E,qn=xt?"bottom-7":"bottom-1";return f.jsx(jt,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":R},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:v,wrapperRef:C,zoom:S,pan:m,onViewportChange:g,naturalDims:ie,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:sn,showAxes:!1,notationSeed:_,onReset:Re,extraModified:ze,exportCanvasRef:T,requestRender:ce,leadingMenus:Le,displayAdjust:{exposureEV:ke,offset:qe,onExposureChange:Lt,onOffsetChange:yt},label:"",showLabelChip:!1,overlay:{render:({notation:D,setOverlayActive:Z})=>K==="split"?f.jsxs(f.Fragment,{children:[Pe&&ie&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-s)*100}% 0 0)`},children:f.jsx(ht,{imageElRef:T,naturalWidth:ie.w,naturalHeight:ie.h,zoom:S,pan:m,sourceWindow:re,sample:De,notation:D,version:lt})}),Pe&&ie&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${s*100}%)`},children:f.jsx(ht,{imageElRef:T,naturalWidth:ie.w,naturalHeight:ie.h,zoom:S,pan:m,sourceWindow:re,sample:Ce,notation:D,version:lt,onActiveChange:Z})})]}):ie&&f.jsx(ht,{imageElRef:T,naturalWidth:ie.w,naturalHeight:ie.h,zoom:S,pan:m,sourceWindow:re,sample:K==="diff"?Et:Ce,notation:D,version:K==="diff"?Ot:lt,onActiveChange:Z})},extraChips:f.jsxs(f.Fragment,{children:[K==="split"&&f.jsx(qo,{}),xt?f.jsx(On,{label:E,corner:"bottom-right"}):null,ae&&f.jsxs("span",{className:`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${qn}`,"data-gpu-compare-metrics":!0,children:["MSE ",ae.mse.toExponential(2)," · PSNR ",Number.isFinite(ae.psnr)?ae.psnr.toFixed(1):"∞"," dB · MAE"," ",ae.mae.toExponential(2)," · SSIM ",Fo($)]})]})})}const Gc="cairn-plot:gpu-image-ready";async function Uc(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await Nt(),window.__cairnPlotGpuImagePane=Ai,window.__cairnPlotGpuComparePane=Fc,window.__cairnPlotDiffMenuModes=Io(),window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(Gc))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e),ho("no-webgpu")}}}Uc()})(__cairnPlotJsxRuntime,__cairnPlotReact);
