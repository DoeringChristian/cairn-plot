var $c=Object.defineProperty;var Vc=(f,c,et)=>c in f?$c(f,c,{enumerable:!0,configurable:!0,writable:!0,value:et}):f[c]=et;var ae=(f,c,et)=>Vc(f,typeof c!="symbol"?c+"":c,et);(function(f,c){"use strict";const et=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function qn(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:et}),{hdr:!1,format:n}}function jo(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:et}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:et}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return qn(e,t)}}}const Jo=`
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
`,es=`
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
`;class ts extends Error{constructor(n){super(n);ae(this,"deviceLost",!0);this.name="DeviceLostError"}}async function Zn(e,t){try{await e.mapAsync(GPUMapMode.READ)}catch(n){if((n instanceof Error?n.name:"")==="AbortError"){const o=t.info;throw new ts("webgpu readback: buffer map aborted — device lost or destroyed mid-readback"+(o?` (reason=${String(o.reason)}${o.message?`: ${o.message}`:""})`:"")+`: ${n instanceof Error?n.message:String(n)}`)}throw n instanceof Error?n:new Error(String(n))}}function ln(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Qn(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function ns(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const rs={texture:0,sampler:1,uniform:2};function un(e,t){return e*3+rs[t]}const os={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function ss(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),a=r[2]!==void 0,s=r[3].trim();if(a){const u=os[s];if(u===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${s}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:u})}else s==="sampler"||s==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class jn{constructor(t,n,r,o){ae(this,"width");ae(this,"height");ae(this,"format");ae(this,"gpuTexture");ae(this,"device");ae(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:ln(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*Qn(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class Jn{constructor(t){ae(this,"_s");ae(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class as{constructor(t,n,r,o,a){ae(this,"_p");ae(this,"gpuPipeline");ae(this,"bindings");ae(this,"bindGroupLayout");ae(this,"variants");ae(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=a,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function is(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class cs{constructor(t){ae(this,"_c");ae(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class ls{constructor(t,n,r,o,a){ae(this,"width");ae(this,"height");ae(this,"paramsBuffer");ae(this,"bindGroup");ae(this,"buffers");ae(this,"destroyed",!1);this.width=t,this.height=n,this.buffers=r,this.paramsBuffer=o,this.bindGroup=a}destroy(){if(!this.destroyed){for(const t of this.buffers)t.destroy();this.paramsBuffer.destroy(),this.destroyed=!0}}}class us{constructor(t,n){ae(this,"_b");ae(this,"gpuBindGroup");ae(this,"ownedBuffers");ae(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class fs{constructor(t,n,r,o){ae(this,"canvas");ae(this,"hdr");ae(this,"format");ae(this,"context");ae(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function Ot(e){return"canvas"in e}async function ds(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function a(p){return Ot(p)?p.getCurrentTextureView():p.gpuTexture.createView()}function s(p){if(Ot(p))return{width:p.canvas.width,height:p.canvas.height};const E=p;return{width:E.width,height:E.height}}let u=!1;const i={};t.lost.then(p=>{i.info=p},()=>{});let l=null;function d(){var E,_;if(l!==null)return l;let p=!1;try{if(typeof document<"u"){const w=document.createElement("canvas");w.width=1,w.height=1;const C=w.getContext("webgpu");if(C)try{C.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:GPUTextureUsage.RENDER_ATTACHMENT});const A=(E=C.getConfiguration)==null?void 0:E.call(C);p=((_=A==null?void 0:A.toneMapping)==null?void 0:_.mode)==="extended"}catch{p=!1}finally{try{C.unconfigure()}catch{}}}}catch{p=!1}return l=p,p}const x=256;let h=null,b=null;function y(){if(!h||!b){const p=t.createShaderModule({code:Jo});b=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const E=t.createPipelineLayout({bindGroupLayouts:[b]});h=t.createComputePipeline({layout:E,compute:{module:p,entryPoint:"cs_main"}})}return{pipeline:h,layout:b}}let v=null,S=null;function m(){if(!v||!S){const p=t.createShaderModule({code:es});S=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});const E=t.createPipelineLayout({bindGroupLayouts:[S]});v=t.createRenderPipeline({layout:E,vertex:{module:p,entryPoint:"vs_main"},fragment:{module:p,entryPoint:"fs_main",targets:[{format:"rgba16float"}]},primitive:{topology:"triangle-list"}})}return{pipeline:v,layout:S}}return{backend:"webgpu",capabilities:n,probeExtendedToneMapping:d,createTexture(p,E,_){return new jn(t,p,E,_)},createSampler(p){const E=(p==null?void 0:p.filter)==="linear"?"linear":"nearest",_=t.createSampler({magFilter:E,minFilter:E,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new Jn(_)},createRenderPipeline(p){const E=t.createShaderModule({code:p.shaderWGSL}),_=ss(p.shaderWGSL),w=ln(p.targetFormat),C=is(t,_),A=t.createPipelineLayout({bindGroupLayouts:[C]}),M=P=>t.createRenderPipeline({layout:A,vertex:{module:E,entryPoint:"vs_main"},fragment:{module:E,entryPoint:"fs_main",targets:[{format:P}]},primitive:{topology:"triangle-list"}}),T=M(w);return new as(T,_,C,w,M)},createComputePipeline(p){const E=t.createShaderModule({code:p.shaderWGSL}),_=t.createComputePipeline({layout:"auto",compute:{module:E,entryPoint:"cs_main"}});return new cs(_)},createBindGroup(p,E){const _=p,w=new Map,C=[];for(const[M,T]of _.bindings)if(T.kind==="uniform"){const P=t.createBuffer({size:T.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});C.push(P),w.set(M,{binding:M,resource:{buffer:P}})}else T.kind==="sampler"&&w.set(M,{binding:M,resource:o()});for(const M of E){const T=M.resource;if(T instanceof jn){const P=un(M.binding,"texture");_.bindings.has(P)&&w.set(P,{binding:P,resource:T.gpuTexture.createView()})}else if(T instanceof Jn){const P=un(M.binding,"sampler");_.bindings.has(P)&&w.set(P,{binding:P,resource:T.gpuSampler})}else{const P=un(M.binding,"uniform"),L=_.bindings.get(P);if(L&&L.kind==="uniform"){const R=T.uniform,B=t.createBuffer({size:Math.max(L.sizeBytes,R.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(B,0,R.buffer,R.byteOffset,R.byteLength),C.push(B),w.set(P,{binding:P,resource:{buffer:B}})}}}const A=t.createBindGroup({layout:_.bindGroupLayout,entries:Array.from(w.values())});return new us(A,C)},createSurface(p,E){const _=p.getContext("webgpu");if(!_)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const w=E.hdr&&n.hdr,C=()=>w?jo(_,t):qn(_,t),A=C();return new fs(p,_,A,C)},renderFullscreen(p,E,_){const w=E,C=_,A=a(p),{width:M,height:T}=s(p),P=Ot(p)?p.format:ln(p.format),L=w.pipelineFor(P),R=t.createCommandEncoder(),B=R.beginRenderPass({colorAttachments:[{view:A,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});B.setPipeline(L),B.setBindGroup(0,C.gpuBindGroup),B.setViewport(0,0,M,T,0,1),B.draw(3),B.end(),t.queue.submit([R.finish()])},createDeepSampleBuffers(p){const{layout:E}=m(),_=P=>{const L=t.createBuffer({size:P.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});return t.queue.writeBuffer(L,0,P.buffer,P.byteOffset,P.byteLength),L},w=_(p.offsets),C=_(p.colors),A=_(p.zs),M=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),T=t.createBindGroup({layout:E,entries:[{binding:0,resource:{buffer:w}},{binding:1,resource:{buffer:C}},{binding:2,resource:{buffer:A}},{binding:3,resource:{buffer:M}}]});return new ls(p.width,p.height,[w,C,A],M,T)},compositeDeep(p,E,_,w){const C=p,A=E,{pipeline:M}=m();t.queue.writeBuffer(C.paramsBuffer,0,new Float32Array([C.width,C.height,w,_]));const T=t.createCommandEncoder(),P=T.beginRenderPass({colorAttachments:[{view:A.gpuTexture.createView(),loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});P.setPipeline(M),P.setBindGroup(0,C.bindGroup),P.setViewport(0,0,A.width,A.height,0,1),P.draw(3),P.end(),t.queue.submit([T.finish()])},async readback(p){const E=Ot(p),{width:_,height:w}=s(p),C=E?p.hdr?"rgba16float":"rgba8unorm":p.format,A=E&&p.format==="bgra8unorm",M=E?p.getCurrentGPUTexture():p.gpuTexture,T=Qn(C),P=_*T,L=256,R=Math.ceil(P/L)*L,B=R*w,O=t.createBuffer({size:B,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),X=t.createCommandEncoder();X.copyTextureToBuffer({texture:M},{buffer:O,bytesPerRow:R,rowsPerImage:w},{width:_,height:w,depthOrArrayLayers:1}),t.queue.submit([X.finish()]);try{await Zn(O,i)}catch(U){try{O.destroy()}catch{}throw U}const G=new Uint8Array(O.getMappedRange()),F=new Uint8Array(P*w);for(let U=0;U<w;U++){const $=U*R,oe=U*P;F.set(G.subarray($,$+P),oe)}if(O.unmap(),O.destroy(),C==="rgba8unorm"){if(A)for(let U=0;U<F.length;U+=4){const $=F[U],oe=F[U+2];F[U]=oe,F[U+2]=$}return F}if(C==="rgba16float"){const U=new Uint16Array(F.buffer,F.byteOffset,F.byteLength/2),$=new Float32Array(U.length);for(let oe=0;oe<U.length;oe++)$[oe]=ns(U[oe]);return $}return new Float32Array(F.buffer,F.byteOffset,F.byteLength/4)},async reduceDiffSumSquaredAbs(p,E,_,w){const C=p,A=E,M=Math.max(0,_*w),T=Math.max(1,Math.ceil(M/x)),{pipeline:P,layout:L}=y(),R=T*2*4,B=t.createBuffer({size:R,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),O=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(O,0,new Uint32Array([Math.max(1,_),Math.max(1,w),M,0]));const X=t.createBindGroup({layout:L,entries:[{binding:0,resource:C.gpuTexture.createView()},{binding:1,resource:A.gpuTexture.createView()},{binding:2,resource:{buffer:B}},{binding:3,resource:{buffer:O}}]}),G=t.createBuffer({size:R,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),F=t.createCommandEncoder(),U=F.beginComputePass();U.setPipeline(P),U.setBindGroup(0,X),U.dispatchWorkgroups(T),U.end(),F.copyBufferToBuffer(B,0,G,0,R),t.queue.submit([F.finish()]);try{await Zn(G,i)}catch(me){for(const W of[G,B,O])try{W.destroy()}catch{}throw me}const oe=new Float32Array(G.getMappedRange()).slice();G.unmap(),G.destroy(),B.destroy(),O.destroy();let ye=0,ie=0;for(let me=0;me<T;me++)ye+=oe[me*2],ie+=oe[me*2+1];return{sumSq:ye,sumAbs:ie}},destroy(){u||(t.destroy(),u=!0)},isContextLost(){return!1}}}let fn=null;async function ps(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return ds()}function Bt(){return fn||(fn=ps()),fn}function hs(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function ms(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),a=Math.floor(o),s=Math.min(a+1,e.length-1),u=o-a,[i,l,d]=hs(e[a],e[s],u);t[n*3]=Math.round(i),t[n*3+1]=Math.round(l),t[n*3+2]=Math.round(d)}return t}const dn={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},gs=Object.keys(dn),xs={viridis:"Viridis",plasma:"Plasma",magma:"Magma","red-green":"Red–Green","red-blue":"Red–Blue"},bs=gs.map(e=>({id:e,label:xs[e]})),vs=new Set(["red-green","red-blue"]),er=new Map;function pn(e){let t=er.get(e);if(!t){const n=dn[e]??dn.viridis;t=ms(n),er.set(e,t)}return t}function ft(e,t,n){return e<t?t:e>n?n:e}function Oe(e){return e<0?0:e>1?1:e}function Nt(e,t,n){return ft(Math.floor(e),t,n)}const hn=e=>{const t=e<0?0:e;return t/(1+t)},mn=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return Oe(n/r)},tr=4,ws=1,It=16,ys=.5,nr={linear:([e,t,n])=>[Oe(e),Oe(t),Oe(n)],srgb:([e,t,n])=>[Oe(e),Oe(t),Oe(n)],gamma:([e,t,n])=>[Oe(e),Oe(t),Oe(n)],reinhard:([e,t,n])=>[hn(e),hn(t),hn(n)],aces:([e,t,n])=>[mn(e),mn(t),mn(n)],extended:([e,t,n])=>[e,t,n]},rr="srgb",or=["linear","srgb","gamma","reinhard","aces"],Es=["srgb","gamma","linear"],sr={extended:"linear","extended-clamp":"linear","extended-reinhard":"reinhard","extended-aces":"aces","extended-gamma":"gamma"};function _s(e){return e&&nr[e]||nr[rr]}function _t(e){return e&&sr[e]?sr[e]:e&&or.includes(e)?e:rr}const ar=_t;function Ms(e){return e==="extended"?Ts:void 0}function Ss(e,t){return e==null?"srgb":ar(e)}function Ft(e,t,n){return e*2**t+n}function As(e){const t=Oe(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function gn(e){const t=Oe(e);return t<=.04045?t/12.92:Math.pow((t+.055)/1.055,2.4)}function bt(e,t){return typeof t=="number"&&t>0?Oe(Math.pow(Oe(e),1/t)):As(e)}const Mt=2.2,xn=.5,bn=4,vn=.1;function Gt(e){return e==="gamma"}function Ut(e,t){if(e==="gamma")return t>0?t:Mt;if(e==="linear")return 1}const Ts=1/0;function Ps(e,t,n,r){const o=ar(e),a=Ut(o,r);if(!n||Number.isFinite(t)&&t<=1)return{operator:o,hdrOut:!1,peak:1,gamma:a};const s=!Number.isFinite(t);switch(o){case"reinhard":return s?{operator:"extended",hdrOut:!0,peak:It,gamma:void 0}:{operator:"extended-reinhard",hdrOut:!0,peak:t,gamma:void 0};case"aces":return{operator:"extended-aces",hdrOut:!0,peak:s?It:t,gamma:void 0};default:return s?{operator:"extended",hdrOut:!0,peak:It,gamma:a}:{operator:"extended-clamp",hdrOut:!0,peak:t,gamma:a}}}function wn(e,t,n="linear",r=0,o=0){const a=pn(t),s=new ImageData(e.width,e.height),u=e.data,i=s.data,l=r!==0||o!==0;for(let d=0;d<u.length;d+=4){let x=(u[d]+u[d+1]+u[d+2])/3;l&&(x=Math.max(0,Math.min(255,Ft(x/255,r,o)*255)));let h;n==="positive"?h=Math.round(128+x/255*127):h=Math.round(x),h=Math.max(0,Math.min(255,h)),i[d]=a[h*3],i[d+1]=a[h*3+1],i[d+2]=a[h*3+2],i[d+3]=u[d+3]}return s}function Rs(e,t){return e==="signed"||e==="relative"?"signed":yn(t)}function yn(e){return vs.has(e??"")?"positive":"linear"}function ir(e,t){const n=new Map;return{get(r){const o=n.get(r);if(o!==void 0)return n.delete(r),n.set(r,o),o},set(r,o){for(n.get(r)!==void 0&&n.delete(r),n.set(r,o);n.size>e;){const s=n.keys().next().value;if(s===void 0)break;n.get(s),n.delete(s)}},has(r){return n.has(r)},get size(){return n.size}}}const cr=ir(50);function En(e){return cr.get(e)}function _n(e,t){cr.set(e,t)}const lr=ir(100);function Cs(e){return lr.get(e)}function Ds(e,t){lr.set(e,t)}function ks(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),a=new ImageData(r,o);for(let s=0;s<o;s++)for(let u=0;u<r;u++){const i=(s*e.width+u)*4,l=(s*t.width+u)*4,d=(s*r+u)*4;for(let x=0;x<3;x++){const h=e.data[i+x],b=t.data[l+x],y=h-b,v=Math.abs(y),S=Math.max(h,1);let m;switch(n){case"signed":m=(y+255)/2;break;case"absolute":m=v;break;case"squared":m=y*y/255;break;case"relative_signed":m=(y/S+1)*127.5;break;case"relative_absolute":m=v/S*255;break;case"relative_squared":m=y*y/(S*S)*255;break}a.data[d+x]=Math.min(255,Math.max(0,Math.round(m)))}a.data[d+3]=255}return a}async function tt(e){const t=Cs(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const a=o.getContext("2d");if(!a){n(null);return}a.drawImage(r,0,0);const s=a.getImageData(0,0,o.width,o.height);Ds(e,s),n(s)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const Ls={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},Os={linear:0,signed:1,positive:2},Bs=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,Ns=`#version 300 es
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
}`;let dt=null,re=null,ke=null,zt=null;function Is(){if(re)return re;try{if(typeof OffscreenCanvas<"u"?dt=new OffscreenCanvas(1,1):dt=document.createElement("canvas"),re=dt.getContext("webgl2",{preserveDrawingBuffer:!0}),!re)return console.warn("[cairn] WebGL 2 not available"),null;const e=re.createShader(re.VERTEX_SHADER);if(re.shaderSource(e,Bs),re.compileShader(e),!re.getShaderParameter(e,re.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",re.getShaderInfoLog(e)),null;const t=re.createShader(re.FRAGMENT_SHADER);if(re.shaderSource(t,Ns),re.compileShader(t),!re.getShaderParameter(t,re.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",re.getShaderInfoLog(t)),null;if(ke=re.createProgram(),re.attachShader(ke,e),re.attachShader(ke,t),re.linkProgram(ke),!re.getProgramParameter(ke,re.LINK_STATUS))return console.error("[cairn] WebGL program link:",re.getProgramInfoLog(ke)),null;zt=re.createVertexArray(),re.bindVertexArray(zt);const n=re.createBuffer();re.bindBuffer(re.ARRAY_BUFFER,n),re.bufferData(re.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),re.STATIC_DRAW);const r=re.getAttribLocation(ke,"a_pos");return re.enableVertexAttribArray(r),re.vertexAttribPointer(r,2,re.FLOAT,!1,0,0),re.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),re}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function ur(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function Fs(e,t,n){const r=new Uint8Array(1024);for(let a=0;a<256;a++)r[a*4]=t[a*3],r[a*4+1]=t[a*3+1],r[a*4+2]=t[a*3+2],r[a*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function Gs(e,t,n,r){const o=Is();if(!o||!ke||!zt||!dt)return null;const a=Math.min(e.width,t.width),s=Math.min(e.height,t.height);dt.width=a,dt.height=s,o.viewport(0,0,a,s);const u=ur(o,e,0),i=ur(o,t,1);let l=null;n.colormap?l=Fs(o,n.colormap,2):(l=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,l),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(ke),o.uniform1i(o.getUniformLocation(ke,"u_baseline"),0),o.uniform1i(o.getUniformLocation(ke,"u_other"),1),o.uniform1i(o.getUniformLocation(ke,"u_lut"),2),o.uniform1i(o.getUniformLocation(ke,"u_diff_mode"),Ls[n.diffMode]),o.uniform1i(o.getUniformLocation(ke,"u_cmap_mode"),Os[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(ke,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(zt),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=a,r.height=s;const d=r.getContext("2d");return d&&(d.save(),d.scale(1,-1),d.drawImage(dt,0,0,a,s,0,-s,a,s),d.restore()),o.deleteTexture(u),o.deleteTexture(i),o.deleteTexture(l),{width:a,height:s}}const Us="cairn:render-mode";function zs(){try{const e=localStorage.getItem(Us);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const $t=15360;function Vt(e){const t=e&32768?-1:1,n=e>>10&31,r=e&1023;return n===0?r===0?t*0:t*r*2**-24:n===31?r===0?t*(1/0):NaN:t*2**(n-15)*(1+r/1024)}const fr=globalThis.Float16Array;function dr(e,t=e.length){if(fr){const r=new fr(e.buffer,e.byteOffset,t);return Float32Array.from(r)}const n=new Float32Array(t);for(let r=0;r<t;r++)n[r]=Vt(e[r]);return n}const Ye=new Uint32Array(512),Ke=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(Ye[e]=0,Ye[e|256]=32768,Ke[e]=24,Ke[e|256]=24):t<-14?(Ye[e]=1024>>-t-14,Ye[e|256]=1024>>-t-14|32768,Ke[e]=-t-1,Ke[e|256]=-t-1):t<=15?(Ye[e]=t+15<<10,Ye[e|256]=t+15<<10|32768,Ke[e]=13,Ke[e|256]=13):t<128?(Ye[e]=31744,Ye[e|256]=64512,Ke[e]=24,Ke[e|256]=24):(Ye[e]=31744,Ye[e|256]=64512,Ke[e]=13,Ke[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var St=Uint8Array,pr=Uint16Array,$s=Int32Array,Vs=new St([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),Xs=new St([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),hr=function(e,t){for(var n=new pr(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new $s(n[30]),r=1;r<30;++r)for(var a=n[r];a<n[r+1];++a)o[a]=a-n[r]<<5|r;return{b:n,r:o}},mr=hr(Vs,2),Ws=mr.b,Hs=mr.r;Ws[28]=258,Hs[258]=28,hr(Xs,0);for(var Ys=new pr(32768),_e=0;_e<32768;++_e){var nt=(_e&43690)>>1|(_e&21845)<<1;nt=(nt&52428)>>2|(nt&13107)<<2,nt=(nt&61680)>>4|(nt&3855)<<4,Ys[_e]=((nt&65280)>>8|(nt&255)<<8)>>1}for(var Xt=new St(288),_e=0;_e<144;++_e)Xt[_e]=8;for(var _e=144;_e<256;++_e)Xt[_e]=9;for(var _e=256;_e<280;++_e)Xt[_e]=7;for(var _e=280;_e<288;++_e)Xt[_e]=8;for(var Ks=new St(32),_e=0;_e<32;++_e)Ks[_e]=5;var qs=new St(0),Zs=typeof TextDecoder<"u"&&new TextDecoder,Qs=0;try{Zs.decode(qs,{stream:!0}),Qs=1}catch{}const gr=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function Mn(e){const t=gr.length;return gr[(e%t+t)%t]}function js(e){const n=c.useRef(null),[r,o]=c.useState({w:0,h:0}),a=c.useRef(null),s=c.useRef(null),u=c.useRef(null),i=c.useCallback((l,d)=>{o(x=>x.w===l&&x.h===d?x:{w:l,h:d})},[]);return c.useLayoutEffect(()=>{const l=n.current;if(!l||l===u.current)return;const d=l.getBoundingClientRect();(d.width>0||d.height>0)&&(u.current=l,i(d.width,d.height))}),c.useEffect(()=>{var x;const l=n.current;if(l===s.current||((x=a.current)==null||x.disconnect(),a.current=null,s.current=l,!l))return;const d=new ResizeObserver(h=>{for(const b of h)i(b.contentRect.width,b.contentRect.height)});a.current=d,d.observe(l)}),c.useEffect(()=>()=>{var l;return(l=a.current)==null?void 0:l.disconnect()},[]),{ref:n,size:r}}function Js(){const[e,t]=c.useState(!1);return c.useEffect(()=>{const n=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!0)},r=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const ea=.001;function ta(e,t=ea){return Math.exp(-e*t)}function xr(e,t){return Math.hypot(e.x-t.x,e.y-t.y)}function br(e,t){return{x:(e.x+t.x)/2,y:(e.y+t.y)/2}}function na(e,t,n,r,o,a,s){const u=t>0&&r>0?r/t:1,i=Math.max(a,Math.min(s,e.zoom*u)),l=(n.x-e.pan.x)/e.zoom,d=(n.y-e.pan.y)/e.zoom;return{zoom:i,pan:{x:o.x-l*i,y:o.y-d*i}}}const ra=.25,Sn=64;function An(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return Sn;const o=Math.min(n/e,r/t);return o<=0?Sn:Math.max(Math.max(n,r)/o,8)}function vr(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:a=ra,maxZoom:s=Sn,naturalWidth:u,naturalHeight:i}=e,l=Js(),d=c.useRef(l);d.current=l;const x=c.useRef({zoom:n,pan:r});x.current={zoom:n,pan:r};const h=c.useRef(o);h.current=o,c.useEffect(()=>{const A=t.current;if(!A||!o)return;const M=T=>{var $;if(!T.ctrlKey&&!d.current)return;T.preventDefault(),T.stopPropagation();const P=ta(T.deltaY),L=x.current,R=A.getBoundingClientRect(),B=u&&i?An(u,i,R.width,R.height):s,O=Math.max(a,Math.min(B,L.zoom*P));if(L.zoom===O)return;const X=T.clientX-R.left,G=T.clientY-R.top,F=X-(X-L.pan.x)/L.zoom*O,U=G-(G-L.pan.y)/L.zoom*O;($=h.current)==null||$.call(h,{zoom:O,pan:{x:F,y:U}})};return A.addEventListener("wheel",M,{passive:!1}),()=>A.removeEventListener("wheel",M)},[t,!!o,a,s,u,i]);const b=c.useRef(new Map),y=c.useRef(null),v=c.useRef(null),S=c.useCallback((A,M,T)=>{const P=A.getBoundingClientRect();return{x:M-P.left,y:T-P.top}},[]),m=c.useCallback(A=>{if(!u||!i)return s;const M=A.getBoundingClientRect();return An(u,i,M.width,M.height)},[u,i,s]),g=c.useCallback((A,M)=>{const T=b.current,P=T.get(A),L=T.get(M);!P||!L||(y.current=null,v.current={idA:A,idB:M,startDist:xr(P,L),startMid:br(P,L),startZoom:x.current.zoom,startPan:{...x.current.pan}})},[]),p=c.useCallback(A=>{const M=b.current.get(A);M&&(y.current={pointerId:A,startX:M.x,startY:M.y,panX:x.current.pan.x,panY:x.current.pan.y})},[]),E=c.useCallback(A=>{if(!h.current)return;const M=A.pointerType==="touch";if(!M&&!d.current)return;const T=A.currentTarget;if(T.setPointerCapture(A.pointerId),b.current.set(A.pointerId,S(T,A.clientX,A.clientY)),M&&b.current.size>=2){const P=[...b.current.keys()];g(P[P.length-2],P[P.length-1]);return}p(A.pointerId)},[S,g,p]),_=c.useCallback(A=>{var R,B;const M=A.currentTarget,T=b.current.get(A.pointerId);if(T){const O=S(M,A.clientX,A.clientY);T.x=O.x,T.y=O.y}const P=v.current;if(P){const O=b.current.get(P.idA),X=b.current.get(P.idB);if(!O||!X)return;const G=na({zoom:P.startZoom,pan:P.startPan},P.startDist,P.startMid,xr(O,X),br(O,X),a,m(M));(R=h.current)==null||R.call(h,G);return}const L=y.current;!L||L.pointerId!==A.pointerId||!T||(B=h.current)==null||B.call(h,{zoom:x.current.zoom,pan:{x:L.panX+(T.x-L.startX),y:L.panY+(T.y-L.startY)}})},[S,a,m]),w=c.useCallback(A=>{var T;try{A.currentTarget.releasePointerCapture(A.pointerId)}catch{}b.current.delete(A.pointerId);const M=v.current;if(M&&(A.pointerId===M.idA||A.pointerId===M.idB)){v.current=null;const P=[...b.current.keys()];P.length===1&&p(P[0]);return}((T=y.current)==null?void 0:T.pointerId)===A.pointerId&&(y.current=null)},[p]);return{containerProps:{onPointerDown:E,onPointerMove:_,onPointerUp:w,onPointerCancel:w,style:{cursor:l&&!!o?"move":void 0,touchAction:o?"none":void 0}},modifierActive:l}}function Tn(){const[e,t]=c.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return c.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),a())};function a(){if(n)return;const s=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${s}dppx)`),r.addEventListener("change",o,{once:!0})}return a(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function Be(e){const t=c.useRef(e),[n,r]=c.useState(e),o=c.useCallback(()=>r(t.current),[]);return[n,r,{reset:o,isModified:!Object.is(n,t.current),default:t.current}]}function oa(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function wr(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function Pn({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:a}=js(),s=c.useRef(null),u=c.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),i=c.useMemo(()=>{const v=a.w,S=a.h;if(v<=0||S<=0||n<=0||r<=0)return null;const m=Math.min(v/n,S/r),g=n*m,p=r*m;return{left:(v-g)/2,top:(S-p)/2,width:g,height:p}},[a.w,a.h,n,r]),l=e.masks,d=t.showMasks&&!!l&&l.length>0,x=c.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(c.useEffect(()=>{if(!d||!l)return;const v=s.current;if(!v)return;(v.width!==n||v.height!==r)&&(v.width=n,v.height=r);const S=v.getContext("2d");if(!S)return;S.clearRect(0,0,v.width,v.height);let m=!1;const g=S.createImageData(n,r),p=g.data;let E=l.length,_=!1;const w=()=>{m||_&&S.putImageData(g,0,0)},C=document.createElement("canvas");C.width=n,C.height=r;const A=C.getContext("2d",{willReadFrequently:!0});for(const M of l){const T=new Image;T.onload=()=>{if(!m){if(A){A.clearRect(0,0,n,r),A.drawImage(T,0,0,n,r);const P=A.getImageData(0,0,n,r).data;for(let L=0;L<n*r;L++){const R=P[L*4];if(R===0||u.has(R))continue;const[B,O,X]=oa(Mn(R));p[L*4]=B,p[L*4+1]=O,p[L*4+2]=X,p[L*4+3]=255,_=!0}}E-=1,E===0&&w()}},T.onerror=()=>{E-=1,E===0&&w()},T.src=`data:image/png;base64,${M.png_b64}`}return()=>{m=!0}},[d,l,n,r,x]),!i)return f.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const h=e.boxes??[],b=t.showBoxes&&h.length>0,y=e.class_labels??{};return f.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[d&&f.jsx("canvas",{ref:s,className:"absolute",style:{left:i.left,top:i.top,width:i.width,height:i.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),b&&f.jsx("svg",{className:"absolute",style:{left:i.left,top:i.top,width:i.width,height:i.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:h.map((v,S)=>{if(!wr(v,t,u))return null;const m=v.domain==="pixel"?1:n,g=v.domain==="pixel"?1:r,p=v.position.minX*m,E=v.position.minY*g,_=(v.position.maxX-v.position.minX)*m,w=(v.position.maxY-v.position.minY)*g;return f.jsx("rect",{x:p,y:E,width:_,height:w,fill:"none",stroke:Mn(v.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},S)})}),b&&f.jsx("div",{className:"absolute",style:{left:i.left,top:i.top,width:i.width,height:i.height},children:h.map((v,S)=>{if(!wr(v,t,u))return null;const m=v.domain==="pixel"?1/n:1,g=v.domain==="pixel"?1/r:1,p=v.position.minX*m*100,E=v.position.minY*g*100,_=v.label??y[String(v.class_id)]??`#${v.class_id}`,w=v.score!=null?` ${(v.score*100).toFixed(0)}%`:"";return!_&&!w?null:f.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${p}%`,top:`${E}%`,transform:"translateY(-100%)",backgroundColor:Mn(v.class_id)},children:f.jsxs("span",{className:"mono",children:[_,w]})},S)})})]})}function sa(e,t){const n=t==null?void 0:t.precision,r=aa(e,n);return t!=null&&t.minus?r.replace("-","−"):r}function aa(e,t){if(!Number.isFinite(e))return String(e);if(e===0)return"0";const n=Math.abs(e);return n>=1e3||n<.001?e.toExponential(Math.max(0,t-2)):Number(e.toPrecision(t)).toString()}const ia={x:0,y:0,w:1,h:1};function Wt(e){const t=e.sourceWindow??ia,n=t.x*e.naturalWidth,r=t.y*e.naturalHeight,o=t.w*e.naturalWidth,a=t.h*e.naturalHeight,s=Math.min(e.box.width/o,e.box.height/a),u=o*s,i=a*s;return{scale:s,imgLeft:e.box.left+(e.box.width-u)/2,imgTop:e.box.top+(e.box.height-i)/2,srcOriginX:n,srcOriginY:r,visibleW:o,visibleH:a}}function ca(e){return Wt(e).scale}function yr(e,t,n){const r=Wt(n);return{x:r.srcOriginX+(e-r.imgLeft)/r.scale,y:r.srcOriginY+(t-r.imgTop)/r.scale}}function Er(e,t,n){const r=Wt(n);return{x:r.imgLeft+(e-r.srcOriginX)*r.scale,y:r.imgTop+(t-r.srcOriginY)*r.scale}}function la(e,t){const n=Er(e.x0,e.y0,t),r=Er(e.x1+1,e.y1+1,t);return{left:n.x,top:n.y,width:r.x-n.x,height:r.y-n.y}}function _r(e,t,n,r,o){const a=yr(e,t,o),s=yr(n,r,o),u=o.naturalWidth-1,i=o.naturalHeight-1,l=Math.min(a.x,s.x),d=Math.max(a.x,s.x),x=Math.min(a.y,s.y),h=Math.max(a.y,s.y);return d<0||l>u||h<0||x>i?null:{x0:Nt(l,0,u),y0:Nt(x,0,i),x1:Nt(d,0,u),y1:Nt(h,0,i)}}const Rn=30,Ht=["#ff5a5a","#39d353","#5b9bff"],ua="#ffffff",fa="rgba(0,0,0,0.9)",da=.15,pa=.06;function Cn(e){return sa(e,{precision:3})}function vt(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):Cn(e/255):Cn(n==="int"?e*255:e)}function pt(e,t,n){return e.length===1?{lines:[vt(e[0],t,n)]}:{lines:e.map(r=>vt(r,t,n)),colors:e.map((r,o)=>Ht[o]??null)}}const ha={x:0,y:0,w:1,h:1};function ht({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:a,notation:s="decimal",version:u=0,onActiveChange:i,sourceWindow:l=ha}){const d=c.useRef(null),x=c.useRef(!1),h=Tn(),b=c.useRef(i);b.current=i;const y=c.useCallback(S=>{var m;S!==x.current&&(x.current=S,(m=b.current)==null||m.call(b,S))},[]),v=c.useCallback(()=>{var ee;const S=d.current,m=e.current;if(!S)return;const g=window.devicePixelRatio||1,p=S.clientWidth,E=S.clientHeight;if(p===0||E===0)return;S.width!==Math.round(p*g)&&(S.width=Math.round(p*g)),S.height!==Math.round(E*g)&&(S.height=Math.round(E*g));const _=S.getContext("2d");if(!_)return;if(_.setTransform(g,0,0,g,0,0),_.clearRect(0,0,p,E),!m||t<=0||n<=0){y(!1);return}const w=m.getBoundingClientRect(),C=S.getBoundingClientRect();if(w.width===0||w.height===0){y(!1);return}const M=Wt({box:w,naturalWidth:t,naturalHeight:n,sourceWindow:l}),{srcOriginX:T,srcOriginY:P,visibleW:L,visibleH:R,scale:B}=M;if(L<=0||R<=0){y(!1);return}if(B<Rn){y(!1);return}const O=M.imgLeft-C.left,X=M.imgTop-C.top,G=Math.max(Math.floor(T),Math.floor(T+(0-O)/B)),F=Math.min(Math.ceil(T+L),Math.ceil(T+(p-O)/B)),U=Math.max(Math.floor(P),Math.floor(P+(0-X)/B)),$=Math.min(Math.ceil(P+R),Math.ceil(P+(E-X)/B));if(F<=G||$<=U){y(!1);return}y(!0);const oe=O+(0-T)*B,ye=X+(0-P)*B,ie=O+(t-T)*B,me=X+(n-P)*B;_.save(),_.beginPath(),_.rect(oe,ye,ie-oe,me-ye),_.clip(),_.textAlign="center",_.textBaseline="middle";const W=B*.14,J=B-W*2;for(let se=U;se<$;se++)for(let pe=G;pe<F;pe++){if(pe<0||se<0||pe>=t||se>=n)continue;const K=a(pe,se,s);if(!K||K.lines.length===0)continue;const le=K.lines.length;let ge=1;for(const Re of K.lines)Re.length>ge&&(ge=Re.length);const ve=J/(le*1.15),Y=J/(ge*.62)||ve,Te=Math.min(ve,Y,24);if(Te<6)continue;const we=O+(pe-T+.5)*B,Se=X+(se-P+.5)*B,ce=Te*1.15;_.font=`${Te}px ui-monospace, SFMono-Regular, Menlo, monospace`,_.shadowColor=fa,_.shadowBlur=Math.max(2,Te*da),_.shadowOffsetX=0,_.shadowOffsetY=Math.max(1,Te*pa);let Pe=Se-le*ce/2+ce/2;for(let Re=0;Re<K.lines.length;Re++){const Fe=K.lines[Re];_.fillStyle=((ee=K.colors)==null?void 0:ee[Re])??ua,_.fillText(Fe,we,Pe),Pe+=ce}}_.restore()},[e,t,n,a,s,y,l]);return c.useEffect(()=>{v()},[v,r,o.x,o.y,u,s,l,h]),c.useEffect(()=>{const S=d.current;if(!S)return;const m=new ResizeObserver(()=>v());return m.observe(S),()=>m.disconnect()},[v]),f.jsx("canvas",{ref:d,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function Mr({notation:e,onChange:t,className:n=""}){return f.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const ma=`
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
`,ga=`
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
`;function Sr(e){return`
${Ge}
${mt}
${ga}

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
`}const xa=Sr("select(colorB, colorA, uv.x < split)"),ba=Sr("mix(colorA, colorB, alpha)");function va(e){switch(e){case"center":return{v:"center",h:"center"};case"top-right":return{v:"top",h:"right"};case"bottom-left":return{v:"bottom",h:"left"};case"bottom-right":return{v:"bottom",h:"right"};case"top-left":default:return{v:"top",h:"left"}}}function Ar(e,t,n){const{v:r,h:o}=va(n),a=e.w-t.w,s=e.h-t.h,u=o==="left"?0:o==="right"?a:Math.floor(a/2),i=r==="top"?0:r==="bottom"?s:Math.floor(s/2);return{x:u,y:i}}function Tt(e,t,n,r,o="b"){if(r==="fill"){const s=o==="a"?{w:e.w,h:e.h}:{w:t.w,h:t.h};return{fit:r,result:s,offsetA:{x:0,y:0},offsetB:{x:0,y:0}}}const a={w:Math.min(e.w,t.w),h:Math.min(e.h,t.h)};return{fit:r,result:a,offsetA:Ar(e,a,n),offsetB:Ar(t,a,n)}}function Dn(e){return`${e.fit}:${e.result.w}x${e.result.h}:${e.offsetA.x},${e.offsetA.y}:${e.offsetB.x},${e.offsetB.y}`}const kn={linear:0,srgb:1,reinhard:2,aces:3,extended:4,"extended-reinhard":5,"extended-aces":6,"extended-clamp":7,gamma:8},Tr=new WeakMap;function wa(e,t){let n=Tr.get(e);n||(n=new Map,Tr.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:ma,targetFormat:t}),n.set(t,r)),r}function Pr(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function Rr(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function ya(e,t,n,r){var g;const o=Pr(t),a=wa(e,o),s=Rr(e,r.isScalar?r.colormap:void 0),u=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,i=kn[r.operator]??kn.srgb,l=new Float32Array([r.exposureEV,i,u,r.isScalar?1:0]),d=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),x=new Float32Array([r.hdrOut?1:0]),h=new Float32Array([r.filter==="nearest"?0:1]),b=new Float32Array([r.offset??0]),y=new Float32Array([r.peak??tr]),v=new Float32Array([r.srgbDecode?1:0]),S=new Float32Array([r.hdrEncodeLegacy?1:0]);let m;try{m=e.createBindGroup(a,[{binding:0,resource:n},{binding:1,resource:s},{binding:2,resource:{uniform:l}},{binding:3,resource:{uniform:d}},{binding:4,resource:{uniform:x}},{binding:5,resource:{uniform:h}},{binding:6,resource:{uniform:b}},{binding:7,resource:{uniform:y}},{binding:8,resource:{uniform:v}},{binding:9,resource:{uniform:S}}]),e.renderFullscreen(t,a,m)}finally{(g=m==null?void 0:m.destroy)==null||g.call(m),s.destroy()}}const Cr=new WeakMap;function Ea(e,t,n){let r=Cr.get(e);r||(r=new Map,Cr.set(e,r));const o=`${t}:${n}`;let a=r.get(o);return a||(a=e.createRenderPipeline({shaderWGSL:t==="split"?xa:ba,targetFormat:n}),r.set(o,a)),a}function _a(e,t,n,r,o){var v;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const a=Pr(t),s=Ea(e,o.mode,a),u=Rr(e,void 0),i=o.gamma,l=kn[o.operator],d=new Float32Array([o.exposureEV,l,i,0]),x=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),h=new Float32Array([o.split,o.alpha,0,o.filter==="nearest"?0:1]),b=new Float32Array([o.offset??0,0,0,0]);let y;try{y=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:u},{binding:3,resource:{uniform:d}},{binding:4,resource:{uniform:x}},{binding:5,resource:{uniform:h}},{binding:6,resource:{uniform:b}}]),e.renderFullscreen(t,s,y)}finally{(v=y==null?void 0:y.destroy)==null||v.call(y),u.destroy()}}function Dr(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,a=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:a,mae:o}}async function kr(e,t,n,r){const o=r??Tt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),a=o.result.w,s=o.result.h,u=a*s*3;if(u<=0)return{mse:0,psnr:1/0,mae:0};if(o.fit==="crop"&&o.offsetA.x===0&&o.offsetA.y===0&&o.offsetB.x===0&&o.offsetB.y===0&&e.reduceDiffSumSquaredAbs){const{sumSq:p,sumAbs:E}=await e.reduceDiffSumSquaredAbs(t,n,a,s);return Dr(p,E,u)}const l=await e.readback(t),d=await e.readback(n),x=l instanceof Uint8Array?255:1,h=d instanceof Uint8Array?255:1,b=Kt(l,t.width,t.height,x,o.offsetA,o.fit==="fill",a,s),y=Kt(d,n.width,n.height,h,o.offsetB,o.fit==="fill",a,s);let v=0,S=0;const m=[0,0,0],g=[0,0,0];for(let p=0;p<s;p++)for(let E=0;E<a;E++){b(E,p,m),y(E,p,g);for(let _=0;_<3;_++){const w=m[_]-g[_];v+=w*w,S+=Math.abs(w)}}return Dr(v,S,u)}function Kt(e,t,n,r,o,a,s,u){const i=(x,h,b)=>e[(h*t+x)*4+b]??0;if(!a)return(x,h,b)=>{const y=Math.min(Math.max(x+o.x,0),t-1),v=Math.min(Math.max(h+o.y,0),n-1);b[0]=i(y,v,0)/r,b[1]=i(y,v,1)/r,b[2]=i(y,v,2)/r};const l=t-1,d=n-1;return(x,h,b)=>{const y=(x+.5)/s,v=(h+.5)/u,S=y*t-.5,m=v*n-.5,g=Math.floor(S),p=Math.floor(m),E=S-g,_=m-p,w=Math.min(Math.max(g,0),l),C=Math.min(Math.max(g+1,0),l),A=Math.min(Math.max(p,0),d),M=Math.min(Math.max(p+1,0),d);for(let T=0;T<3;T++){const P=i(w,A,T),L=i(C,A,T),R=i(w,M,T),B=i(C,M,T),O=P+(L-P)*E,X=R+(B-R)*E;b[T]=(O+(X-O)*_)/r}}}function Lr(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const Ma=12,rt=[];function Or(e){const t=rt.indexOf(e);t!==-1&&rt.splice(t,1),rt.push(e)}function Sa(e){const t=rt.indexOf(e);t!==-1&&rt.splice(t,1)}function qt(e){e.parked||(Sa(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),e.surface=null,e.parked=!0)}function Br(e){for(;rt.length>Ma;){const t=rt.find(n=>n!==e&&!n.visible)??rt.find(n=>n!==e);if(!t)break;qt(t)}}function Nr(e){var o,a,s,u;if(e.disposed)return;if(Lr())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){Or(e),Br(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||((a=e.deep)==null?void 0:a.width)||1,r=e.backingHeight||((s=e.source)==null?void 0:s.height)||((u=e.deep)==null?void 0:u.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.deep){const i=t.createTexture(e.deep.width,e.deep.height,"rgba16float");e.srcTexture=i,e.deepBuffers=t.createDeepSampleBuffers(e.deep),t.compositeDeep(e.deepBuffers,i,e.deepZNear,e.deepZFar)}else if(e.source){const i=t.createTexture(e.source.width,e.source.height,e.source.format);i.write(e.source.data),e.srcTexture=i}e.parked=!1,Or(e),Br(e)}function Aa(e,t){if(e.disposed||!e.source&&!e.deep)return!0;try{return Nr(e),!e.surface||!e.srcTexture?!1:(ya(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,qt(e),!1}}function Ta(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,e.deep=null,e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},setDeepSource(t,n,r){if(!e.disposed&&(e.deep=t,e.deepZNear=n,e.deepZFar=r,e.source=null,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy(),e.deepBuffers&&e.deepBuffers.destroy();const o=e.device.createTexture(t.width,t.height,"rgba16float");e.srcTexture=o,e.deepBuffers=e.device.createDeepSampleBuffers(t),e.device.compositeDeep(e.deepBuffers,o,n,r)}},setDeepWindow(t,n){e.disposed||(e.deepZNear=t,e.deepZFar=n,!e.parked&&e.deepBuffers&&e.srcTexture&&e.device.compositeDeep(e.deepBuffers,e.srcTexture,t,n))},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return Aa(e,t)},park(){e.disposed||qt(e)},restore(){e.disposed||!e.source&&!e.deep||Nr(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(qt(e),e.source=null,e.deep=null,e.disposed=!0)}}}async function Pa(e,t){const n=await Bt(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,deep:null,deepZNear:-1/0,deepZFar:1/0,deepBuffers:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return Ta(r)}function Ir(e){e.dispose()}function Fr({title:e,body:t,className:n}){return f.jsx("div",{className:n??"relative h-full w-full",children:f.jsxs("div",{className:"flex h-full w-full flex-col items-center justify-center gap-1 rounded bg-bg-hover p-4 text-center",children:[f.jsx("div",{className:"text-sm font-semibold text-fg",children:e}),f.jsx("div",{className:"text-xs text-fg-muted",children:t})]})})}function Ra(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:a}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...a?["invert(1)"]:[]].join(" ")}function Gr(e){const n=`cairn-gamma-${c.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:a,exposure:s,offset:u,flipSign:i}=e,l=c.useMemo(()=>Ra(e,n),[n,r,o,s,i]);return{gammaFilterId:n,filterStr:l,gamma:a,offset:u}}function Ur({id:e,gamma:t,offset:n}){return f.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:f.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:f.jsxs("feComponentTransfer",{children:[f.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),f.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),f.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}const Ca=["nw","n","ne","e","se","s","sw","w"];function Da(e,t,n,r,o,a=1){const s=o.w-1,u=o.h-1,i=Math.round(n),l=Math.round(r);if(t==="move"){const g=e.x1-e.x0,p=e.y1-e.y0,E=ft(e.x0+i,0,s-g),_=ft(e.y0+l,0,u-p);return{x0:E,y0:_,x1:E+g,y1:_+p}}let{x0:d,y0:x,x1:h,y1:b}=e;const y=t==="nw"||t==="w"||t==="sw",v=t==="ne"||t==="e"||t==="se",S=t==="nw"||t==="n"||t==="ne",m=t==="sw"||t==="s"||t==="se";return y&&(d=ft(d+i,0,h-(a-1))),v&&(h=ft(h+i,d+(a-1),s)),S&&(x=ft(x+l,0,b-(a-1))),m&&(b=ft(b+l,x+(a-1),u)),{x0:d,y0:x,x1:h,y1:b}}function zr(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function ka({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=zr(e),a=zr(t),s=[];for(let g=0;g<=e;g+=o)s.push(g);const u=[];for(let g=0;g<=t;g+=a)u.push(g);const i=1/n,l=8*i,d=-12*i,x=-2*i,h=r==null?void 0:r.current;let b=0,y=0,v=0,S=0;if(h){const g=h.clientWidth,p=h.clientHeight,E=g/e,_=p/t,w=Math.min(E,_);v=e*w,S=t*w,b=(g-v)/2,y=(p-S)/2}const m=h&&v>0;return f.jsxs(f.Fragment,{children:[f.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:m?y:0,transform:`translateY(${d}px)`,fontSize:l},children:s.map(g=>f.jsx("span",{className:"mono",style:{position:"absolute",left:m?b+g/e*v:`${g/e*100}%`,transform:"translateX(-50%)"},children:g},g))}),f.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:m?b:0,transform:`translateX(${x}px)`,fontSize:l},children:u.map(g=>f.jsx("span",{className:"mono",style:{position:"absolute",top:m?y+g/t*S:`${g/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*i}px`},children:g},g))})]})}function Ln({label:e,corner:t="bottom-left",isDraggable:n=!1,grip:r=n,onDragStart:o}){const a=t==="bottom-right"?"bottom-1 right-1":"bottom-1 left-1";return f.jsxs("span",{className:`absolute ${a} z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${n?" cairn-drag-grip":""}`,draggable:n,onDragStart:o,style:{cursor:n?"grab":void 0},children:[r&&f.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const La=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function $r(e,t){const n=getComputedStyle(e),r=La.map(i=>`${i}:${n.getPropertyValue(i)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const a=e.children,s=t.children,u=Math.min(a.length,s.length);for(let i=0;i<u;i++)$r(a[i],s[i])}function On(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function Bn(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function Nn(e,t,n,r,o){const a=document.createElement("canvas");a.width=Math.max(1,Math.round(e*n)),a.height=Math.max(1,Math.round(t*n));const s=a.getContext("2d");if(!s)throw new Error("plot-to-png: 2D canvas context unavailable");return s.scale(n,n),r&&(s.fillStyle=r,s.fillRect(0,0,e,t)),o(s),await new Promise((u,i)=>a.toBlob(l=>l?u(l):i(new Error("plot-to-png: toBlob returned null")),"image/png"))}function Oa(e,t,n){const r=e.cloneNode(!0);$r(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),a="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((s,u)=>{const i=new Image;i.onload=()=>s(i),i.onerror=()=>u(new Error("plot-to-png: SVG rasterization failed")),i.src=a})}async function Vr(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,a=(t==null?void 0:t.background)??On(e);return Nn(r,o,Bn(t),a,s=>s.drawImage(e,0,0,r,o))}async function Ba(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,a=(t==null?void 0:t.background)??On(e);try{return await Nn(r,o,Bn(t),a,s=>s.drawImage(e,0,0,r,o))}catch(s){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${s instanceof Error?s.message:String(s)})`)}}function Na(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const a=o.getBoundingClientRect(),s=a.width*a.height;s>r&&(r=s,n=o)}return n}async function Ia(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),a=o.width||300,s=o.height||150,u=(t==null?void 0:t.background)??On(e);if(n){const l=n.getBoundingClientRect(),d=await Oa(n,l.width||a,l.height||s);return Nn(a,s,Bn(t),u,x=>{for(const h of r){const b=h.getBoundingClientRect();x.drawImage(h,b.left-o.left,b.top-o.top,b.width,b.height)}x.drawImage(d,l.left-o.left,l.top-o.top,l.width,l.height)})}if(r.length)return Vr(r[0],t);const i=Na(e);if(i)return Ba(i,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function Fa(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const Ga=8;function Ua(e,t,n,r=Ga){return!(t>0)||!(e>0)?n:e<t+r}function Xr(e,t){return Math.max(0,e.findIndex(n=>n.id===t))}function za(e){const t=e.trim();if(t==="")return null;const n=t.replace(/−/g,"-").replace(",","."),r=/^([+-]?)(inf(?:inity)?|∞)$/i.exec(n);if(r)return r[1]==="-"?-1/0:1/0;const o=Number(n);return Number.isNaN(o)?null:o}function $a(e,t){const n=za(e);return n===null?t:n}function Va(e){return String(e)}const Xa={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},Wa={boxZoom:f.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:f.jsxs(f.Fragment,{children:[f.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),f.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),f.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),f.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 2v20M2 12h20"}),f.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),f.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),f.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:f.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:f.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),f.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:f.jsx("path",{d:"M6 9l6 6 6-6"}),ellipsis:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"5",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),f.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),f.jsx("circle",{cx:"19",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"})]}),sun:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"12",cy:"12",r:"4"}),f.jsx("path",{d:"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"})]}),plusminus:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M4 7h6M7 4v6"}),f.jsx("path",{d:"M14 17h6"}),f.jsx("path",{d:"M6 20l12-16"})]}),layers:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 3l9 5-9 5-9-5 9-5z"}),f.jsx("path",{d:"M3 13l9 5 9-5"})]})};function je({name:e}){return f.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:Wa[e]??null})}function Wr({icon:e,label:t,title:n,active:r,disabled:o,onClick:a}){return f.jsx("button",{type:"button",disabled:o,onClick:s=>{s.stopPropagation(),!o&&a()},onPointerDown:s=>s.stopPropagation(),onDoubleClick:s=>s.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?f.jsx("span",{"aria-hidden":"true",children:t}):f.jsx(je,{name:e??""})})}function Hr(){return f.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function Yr(e,t,n){const r=c.useRef(n);r.current=n,c.useEffect(()=>{if(!e)return;const o=s=>{t.current&&!t.current.contains(s.target)&&r.current()},a=s=>{s.key==="Escape"&&(s.stopPropagation(),r.current())};return document.addEventListener("pointerdown",o,!0),document.addEventListener("keydown",a,!0),()=>{document.removeEventListener("pointerdown",o,!0),document.removeEventListener("keydown",a,!0)}},[e,t])}function Ha({icon:e,title:t,menu:n}){var S;const{options:r,value:o,onSelect:a}=n,[s,u]=c.useState(!1),[i,l]=c.useState(0),d=c.useRef(null),x=Xr(r,o),h=e?void 0:((S=r[x])==null?void 0:S.label)??"",b=c.useCallback(()=>{u(m=>{const g=!m;return g&&l(x),g})},[x]),y=c.useCallback(m=>{a(m),u(!1)},[a]);Yr(s,d,()=>u(!1));const v=m=>{if(!s){(m.key==="ArrowDown"||m.key==="Enter"||m.key===" ")&&(m.preventDefault(),l(x),u(!0));return}if(m.key==="ArrowDown")m.preventDefault(),l(g=>(g+1)%r.length);else if(m.key==="ArrowUp")m.preventDefault(),l(g=>(g-1+r.length)%r.length);else if(m.key==="Enter"||m.key===" "){m.preventDefault();const g=r[i];g&&y(g.id)}};return f.jsxs("div",{ref:d,className:"relative inline-flex",onPointerDown:m=>m.stopPropagation(),children:[f.jsxs("button",{type:"button",onClick:m=>{m.stopPropagation(),b()},onDoubleClick:m=>m.stopPropagation(),onKeyDown:v,"aria-haspopup":"listbox","aria-expanded":s,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",h?"px-1.5 text-[10px] font-mono":"px-1 text-xs",s?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[h?f.jsx("span",{"aria-hidden":"true",children:h}):f.jsx(je,{name:e??""}),f.jsx(je,{name:"caret"})]}),s&&f.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((m,g)=>{const p=m.id===o,E=g===i;return f.jsx("li",{role:"option","aria-selected":p,children:f.jsx("button",{type:"button",onClick:_=>{_.stopPropagation(),y(m.id)},onPointerEnter:()=>l(g),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",E?"bg-bg-hover":"",p?"text-accent font-medium":"text-fg"].join(" "),children:m.label})},m.id)})})]})}const Ya=e=>e.format?e.format(e.value):String(e.value);function Kr({spec:e}){const[t,n]=c.useState(!1),[r,o]=c.useState(""),a=c.useRef(null),s=c.useCallback(()=>{o(Va(e.value)),n(!0)},[e.value]);c.useEffect(()=>{t&&a.current&&(a.current.focus(),a.current.select())},[t]);const u=c.useCallback(()=>{n(l=>(l&&e.onChange($a(r,e.value)),!1))},[r,e]),i=c.useCallback(()=>n(!1),[]);return f.jsxs("label",{className:"inline-flex items-center gap-1 text-fg-muted",title:e.title,onPointerDown:l=>l.stopPropagation(),onDoubleClick:l=>{l.stopPropagation(),t||s()},children:[e.icon?f.jsx("span",{"aria-hidden":"true",className:"inline-flex",children:f.jsx(je,{name:e.icon})}):f.jsx("span",{"aria-hidden":"true",className:"text-[9px] font-mono",children:e.label}),t?f.jsx("input",{ref:a,type:"text",inputMode:"decimal","aria-label":`${e.title} (numeric entry)`,value:r,onChange:l=>o(l.target.value),onPointerDown:l=>l.stopPropagation(),onDoubleClick:l=>l.stopPropagation(),onKeyDown:l=>{l.stopPropagation(),l.key==="Enter"?(l.preventDefault(),u()):l.key==="Escape"&&(l.preventDefault(),i())},onBlur:u,className:"cairn-plot-toolbar-slider-entry h-3.5 w-[6.5rem] rounded border border-border bg-bg px-1 text-[9px] font-mono tabular-nums text-fg outline-none focus:border-accent"}):f.jsxs(f.Fragment,{children:[f.jsx("input",{type:"range","aria-label":e.title,min:e.min,max:e.max,step:e.step,value:e.value,onChange:l=>e.onChange(Number(l.target.value)),onPointerDown:l=>l.stopPropagation(),className:"cairn-plot-toolbar-slider h-1 w-16 cursor-pointer accent-accent"}),f.jsx("span",{"aria-hidden":"true",className:"w-8 text-right text-[9px] font-mono tabular-nums",children:Ya(e)})]})]})}function Ka({icon:e,title:t,menu:n,onClose:r}){var x;const{options:o,value:a,onSelect:s}=n,[u,i]=c.useState(!1),l=Xr(o,a),d=((x=o[l])==null?void 0:x.label)??"";return f.jsxs("div",{children:[f.jsxs("button",{type:"button","aria-haspopup":"menu","aria-expanded":u,"aria-label":t,onClick:h=>{h.stopPropagation(),i(b=>!b)},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",u?"text-accent":"text-fg hover:bg-bg-hover"].join(" "),children:[e?f.jsx(je,{name:e}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{className:"flex-1",children:t}),f.jsx("span",{className:"font-mono text-[10px] text-fg-muted",children:d}),f.jsx("span",{className:u?"rotate-180 transition-transform":"transition-transform",children:f.jsx(je,{name:"caret"})})]}),u&&o.map(h=>{const b=h.id===a;return f.jsxs("button",{type:"button",role:"menuitemradio","aria-checked":b,"data-menu-option":"",onClick:y=>{y.stopPropagation(),s(h.id),r()},className:["flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-[11px]",b?"text-accent font-medium bg-bg-hover/40":"text-fg hover:bg-bg-hover"].join(" "),children:[f.jsx("span",{"aria-hidden":"true",className:"w-3 text-center text-accent",children:b?"✓":""}),f.jsx("span",{children:h.label})]},h.id)})]})}function qa({actions:e,leading:t,sliders:n}){const[r,o]=c.useState(!1),a=c.useRef(null);return Yr(r,a,()=>o(!1)),f.jsxs("div",{ref:a,className:"relative inline-flex",onPointerDown:s=>s.stopPropagation(),children:[f.jsx("button",{type:"button",onClick:s=>{s.stopPropagation(),o(u=>!u)},onDoubleClick:s=>s.stopPropagation(),"aria-haspopup":"menu","aria-expanded":r,"aria-label":"More controls",title:"More controls",className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded text-xs",r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:f.jsx(je,{name:"ellipsis"})}),r&&f.jsxs("div",{role:"menu",className:["absolute right-0 top-full z-40 mt-1 min-w-[10rem] max-h-80 overflow-auto","rounded border border-border bg-bg-elevated py-1 shadow-md"].join(" "),children:[t.map(s=>s.menu?f.jsx(Ka,{icon:s.icon,title:s.title,menu:s.menu,onClose:()=>o(!1)},s.id):f.jsxs("button",{type:"button",disabled:s.disabled,onClick:u=>{var i;u.stopPropagation(),!s.disabled&&((i=s.onClick)==null||i.call(s),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?f.jsx(je,{name:s.icon}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{children:s.label??s.title})]},s.id)),t.length>0&&e.length>0&&f.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),e.map(s=>f.jsxs("button",{type:"button",role:"menuitem",disabled:s.disabled,onClick:u=>{u.stopPropagation(),!s.disabled&&(s.onClick(),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?f.jsx(je,{name:s.icon}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{children:s.title})]},s.id)),n.length>0&&(e.length>0||t.length>0)&&f.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),n.map(s=>f.jsx("div",{className:"px-2 py-1",children:f.jsx(Kr,{spec:s})},s.id))]})]})}function Za({controller:e,config:t}){var P,L;const n=c.useRef(null),[r,o]=c.useState(!1),a=c.useRef(r);a.current=r;const s=c.useRef(0),u=`${((P=t==null?void 0:t.leadingButtons)==null?void 0:P.length)??0}:${((L=t==null?void 0:t.sliders)==null?void 0:L.length)??0}:${(t==null?void 0:t.visibility)??"hover"}`;if(c.useEffect(()=>{const R=n.current,B=R==null?void 0:R.parentElement;if(!B)return;const O=()=>{const U=B.clientWidth;if(!a.current&&n.current){const $=n.current.scrollWidth;$>0&&(s.current=$)}o(Ua(U,s.current,a.current))};let X=0;const G=()=>{X||(X=requestAnimationFrame(()=>{X=0,O()}))},F=new ResizeObserver(G);return F.observe(B),O(),()=>{F.disconnect(),X&&cancelAnimationFrame(X)}},[u]),(t==null?void 0:t.enabled)===!1)return null;const i=e.capabilities,l=t==null?void 0:t.buttons,d=(R,B)=>B&&(l==null?void 0:l[R])!==!1,x=R=>()=>e.setDragMode(R),h=()=>{e.toPNG({filename:"plot"}).then(R=>Fa(R,"plot.png")).catch(()=>{})},b=[];d("zoom",i.zoom)&&b.push({id:"zoom",icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:x("zoom")}),d("pan",i.pan)&&b.push({id:"pan",icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:x("pan")}),d("select",i.select)&&b.push({id:"select",icon:"select",title:"Box select",active:e.dragMode==="select",onClick:x("select")}),d("lasso",i.lasso)&&b.push({id:"lasso",icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:x("lasso")});const y=[];d("zoomIn",i.zoom)&&y.push({id:"zoomIn",icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),d("zoomOut",i.zoom)&&y.push({id:"zoomOut",icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()});const v=[];d("autoscale",i.autoscale)&&v.push({id:"autoscale",icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),d("reset",i.reset)&&v.push({id:"reset",icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()});const S=[];d("screenshot",i.screenshot)&&S.push({id:"screenshot",icon:"camera",title:"Download plot as PNG",onClick:h});const m=[b,y,v,S].filter(R=>R.length>0),g=m.flat(),p=(t==null?void 0:t.leadingButtons)??[],E=(t==null?void 0:t.sliders)??[];if(!p.length&&g.length===0&&E.length===0)return null;const _=(t==null?void 0:t.position)??"top-right",w=(t==null?void 0:t.visibility)==="always",C=_==="top-right"||_==="bottom-right",M=["cairn-plot-toolbar z-30 rounded border border-border bg-bg-elevated/90 shadow-sm backdrop-blur-sm transition-opacity",w?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),T={position:"absolute",pointerEvents:"auto",...Xa[_]};return r?f.jsx("div",{ref:n,style:T,className:`${M} inline-flex px-0.5 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:f.jsx(qa,{actions:g,leading:p,sliders:E})}):f.jsxs("div",{ref:n,style:T,className:`${M} flex flex-col gap-0.5 px-1 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:[f.jsxs("div",{className:`flex items-center gap-0.5 ${C?"justify-end":"justify-start"}`,children:[p.length>0&&f.jsxs(f.Fragment,{children:[p.map(R=>R.menu?f.jsx(Ha,{icon:R.icon,title:R.title,menu:R.menu},R.id):f.jsx(Wr,{icon:R.icon,label:R.label,title:R.title,active:R.active,disabled:R.disabled,onClick:R.onClick??(()=>{})},R.id)),m.length>0&&f.jsx(Hr,{})]}),m.map((R,B)=>f.jsxs("span",{className:"inline-flex items-center gap-0.5",children:[B>0&&f.jsx(Hr,{}),R.map(O=>f.jsx(Wr,{icon:O.icon,title:O.title,active:O.active,disabled:O.disabled,onClick:O.onClick},O.id))]},R[0].id))]}),E.length>0&&f.jsx("div",{className:`flex items-center gap-2 ${C?"justify-end":"justify-start"}`,children:E.map(R=>f.jsx(Kr,{spec:R},R.id))})]})}const Qa={zoom:1,pan:{x:0,y:0}},qr=1.3,ja=.25,Ja=64,ei={buttons:{zoom:!1}};function ti(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const ni=[{id:"none",label:"None"},...bs];function Pt(e,t){return{id:"colormap",title:"Colormap",menu:{options:ni,value:e,onSelect:t}}}const Zr={linear:"Linear",srgb:"sRGB",gamma:"Gamma",reinhard:"Reinhard",aces:"ACES",extended:"Extended · Linear","extended-clamp":"Extended · Linear (managed)","extended-reinhard":"Extended · Reinhard","extended-aces":"Extended · ACES"},ri=or.map(e=>({id:e,label:Zr[e]}));function Qr(e,t){return{id:"tonemap",title:"Tone-mapping operator",menu:{options:ri,value:e,onSelect:t}}}const oi=Es.map(e=>({id:e,label:Zr[e]}));function jr(e,t){return{id:"tonemap",title:"Display transfer (sRGB · Gamma · Linear)",menu:{options:oi,value:e,onSelect:t}}}function si({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:a,naturalHeight:s,minZoom:u=ja,maxZoom:i=Ja,requestRender:l,onReset:d,extraModified:x=!1}){const h=c.useCallback(w=>{var X;if(!o)return;const C=(X=e.current)==null?void 0:X.getBoundingClientRect(),A=(C==null?void 0:C.width)??0,M=(C==null?void 0:C.height)??0,T=a&&s&&A>0&&M>0?An(a,s,A,M):i,P=Math.max(u,Math.min(T,n*w));if(P===n)return;const L=A/2,R=M/2,B=L-(L-r.x)/n*P,O=R-(R-r.y)/n*P;o({zoom:P,pan:{x:B,y:O}})},[o,e,a,s,i,u,n,r.x,r.y]),b=c.useCallback(()=>h(qr),[h]),y=c.useCallback(()=>h(1/qr),[h]),v=c.useCallback(()=>{o==null||o(Qa),d==null||d()},[o,d]),S=c.useCallback(w=>{const C={scale:w==null?void 0:w.scale,filename:w==null?void 0:w.filename};l==null||l();const A=t==null?void 0:t.current;if(A)return Vr(A,C);const M=e.current;return M?Ia(M,C):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,l]),m=c.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),g=n!==1||r.x!==0||r.y!==0||x,p=c.useCallback(w=>{},[]),E=c.useCallback(w=>{},[]),_=c.useCallback(()=>{},[]);return c.useMemo(()=>({capabilities:m,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:g,setDragMode:p,setHoverMode:E,toggleSpikelines:_,zoomIn:b,zoomOut:y,autoscale:v,reset:v,toPNG:S}),[m,g,p,E,_,b,y,v,S])}const ai={zoom:1,pan:{x:0,y:0}};function Zt({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:a,pan:s,onViewportChange:u,naturalDims:i,checkerboard:l,wrapperClassName:d,wrapperStyle:x,viewportPadding:h,header:b,surface:y,showAxes:v,overlayNode:S,overlay:m,notationSeed:g,exportCanvasRef:p,requestRender:E,leadingMenus:_,displayAdjust:w,depthSliders:C,extraSliders:A,regionSelect:M,onReset:T,extraModified:P,label:L,showLabelChip:R,isDraggable:B=!1,onDragStart:O,extraChips:X}){const[G,F]=c.useState(g),[U,$]=c.useState(!1),[oe,ye]=c.useState(!1),ie="render"in m?null:m,me=!!M&&!!ie,{containerProps:W}=vr({containerRef:r,zoom:a,pan:s,onViewportChange:u,naturalWidth:i==null?void 0:i.w,naturalHeight:i==null?void 0:i.h}),J=c.useCallback(()=>{w==null||w.onExposureChange(0),w==null||w.onOffsetChange(0),T==null||T()},[w,T]),ee=c.useCallback(()=>{u==null||u(ai),J()},[u,J]),se=si({rootRef:r,canvasRef:p,zoom:a,pan:s,onViewportChange:u,naturalWidth:i==null?void 0:i.w,naturalHeight:i==null?void 0:i.h,requestRender:E,onReset:J,extraModified:((w==null?void 0:w.exposureEV)??0)!==0||((w==null?void 0:w.offset)??0)!==0||!!P}),pe=c.useMemo(()=>{const we=[];if(C&&we.push(...C),!w)return A&&we.push(...A),we.length?we:void 0;const Se=(ce,Pe)=>`${ce>=0?"+":"−"}${Math.abs(ce).toFixed(Pe)}`;return we.push({id:"exposure",icon:"sun",label:"EV",title:"Exposure (EV stops) — color × 2^EV. Double-click to type a value (may exceed the slider range).",min:-8,max:8,step:.1,value:w.exposureEV,onChange:w.onExposureChange,format:ce=>Se(ce,1)},{id:"offset",icon:"plusminus",label:"OFF",title:"Offset — added after exposure (before tonemap). Double-click to type a value (may exceed the slider range).",min:-1,max:1,step:.01,value:w.offset,onChange:w.onOffsetChange,format:ce=>Se(ce,2)}),A&&we.push(...A),we},[w,C,A]),K=c.useMemo(()=>me?{id:"region-depth",icon:"select",title:"Select depth from region — drag a rectangle to set the Z window to the samples it covers (Esc to cancel)",active:oe,onClick:()=>ye(we=>!we)}:null,[me,oe]),le=c.useMemo(()=>({...ei,leadingButtons:[..._??[],...K?[K]:[],...U?[ti(G,F)]:[]],sliders:pe}),[U,G,_,K,pe]),ge=" cairn-checkerboard",ve="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(l==="pane"?ge:""),Y=d+(l==="wrapper"?ge:""),Te="render"in m?m.render({notation:G,setOverlayActive:$}):m.hasSource&&i?f.jsx(ht,{imageElRef:m.displayElRef,naturalWidth:i.w,naturalHeight:i.h,zoom:a,pan:s,sourceWindow:m.sourceWindow,sample:m.sample,notation:G,version:m.version,onActiveChange:$}):null;return f.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[b,n&&f.jsx(Za,{controller:se,config:le}),f.jsxs("div",{ref:r,className:ve,style:{padding:h,...W.style},onPointerDown:W.onPointerDown,onPointerMove:W.onPointerMove,onPointerUp:W.onPointerUp,onPointerCancel:W.onPointerCancel,onDoubleClick:ee,...t,children:[f.jsxs("div",{ref:o,className:Y,style:x,children:[y,v&&i&&f.jsx(ka,{naturalWidth:i.w,naturalHeight:i.h,zoom:a,containerRef:o}),S]}),Te,!n&&U&&f.jsx(Mr,{notation:G,onChange:F}),oe&&M&&ie&&i&&f.jsx(ii,{imageElRef:ie.displayElRef,naturalDims:i,sourceWindow:ie.sourceWindow,onQueryLive:M.queryLive,onSelect:(we,Se,ce,Pe)=>{ye(!1),M.commit(we,Se,ce,Pe)},onExit:()=>ye(!1)}),!oe&&(M==null?void 0:M.rect)&&ie&&i&&f.jsx(li,{rect:M.rect,imageElRef:ie.displayElRef,naturalDims:i,sourceWindow:ie.sourceWindow,zoom:a,pan:s,onQueryLive:M.queryLive,onCommit:M.commit,onRemove:M.remove})]}),R&&f.jsx(Ln,{label:L,isDraggable:B,onDragStart:O}),X]})}function ii({imageElRef:e,naturalDims:t,sourceWindow:n,onQueryLive:r,onSelect:o,onExit:a}){var S;const s=c.useRef(null),u=c.useRef(null),[i,l]=c.useState(null),d=c.useCallback((m,g,p,E)=>{const _=e.current;return _?_r(m,g,p,E,{box:_.getBoundingClientRect(),naturalWidth:t.w,naturalHeight:t.h,sourceWindow:n}):null},[e,t,n]);c.useEffect(()=>{const m=g=>{g.key==="Escape"&&a()};return window.addEventListener("keydown",m),()=>window.removeEventListener("keydown",m)},[a]);const x=c.useCallback(m=>{var g,p;(p=(g=m.target).setPointerCapture)==null||p.call(g,m.pointerId),u.current={x:m.clientX,y:m.clientY},l({x0:m.clientX,y0:m.clientY,x1:m.clientX,y1:m.clientY})},[]),h=c.useCallback(m=>{const g=u.current;if(!g)return;l({x0:g.x,y0:g.y,x1:m.clientX,y1:m.clientY});const p=d(g.x,g.y,m.clientX,m.clientY);p&&r(p.x0,p.y0,p.x1,p.y1)},[d,r]),b=c.useCallback(m=>{const g=u.current;u.current=null,l(null);const p=e.current;if(!g||!p){a();return}if(Math.abs(m.clientX-g.x)<3&&Math.abs(m.clientY-g.y)<3){a();return}const E=p.getBoundingClientRect(),_=_r(g.x,g.y,m.clientX,m.clientY,{box:E,naturalWidth:t.w,naturalHeight:t.h,sourceWindow:n});if(!_){a();return}o(_.x0,_.y0,_.x1,_.y1)},[e,t,n,o,a]),y=(S=s.current)==null?void 0:S.getBoundingClientRect(),v=i&&y?{left:Math.min(i.x0,i.x1)-y.left,top:Math.min(i.y0,i.y1)-y.top,width:Math.abs(i.x1-i.x0),height:Math.abs(i.y1-i.y0)}:null;return f.jsx("div",{ref:s,className:"absolute inset-0 z-20",style:{cursor:"crosshair",touchAction:"none"},onPointerDown:x,onPointerMove:h,onPointerUp:b,children:v&&f.jsx("div",{className:"absolute border-2 border-dashed border-sky-400 bg-sky-400/15 pointer-events-none",style:v})})}const ci={nw:{cursor:"nwse-resize",fx:0,fy:0},n:{cursor:"ns-resize",fx:.5,fy:0},ne:{cursor:"nesw-resize",fx:1,fy:0},e:{cursor:"ew-resize",fx:1,fy:.5},se:{cursor:"nwse-resize",fx:1,fy:1},s:{cursor:"ns-resize",fx:.5,fy:1},sw:{cursor:"nesw-resize",fx:0,fy:1},w:{cursor:"ew-resize",fx:0,fy:.5}};function li({rect:e,imageElRef:t,naturalDims:n,sourceWindow:r,zoom:o,pan:a,onQueryLive:s,onCommit:u,onRemove:i}){const l=c.useRef(null),[d,x]=c.useState(null),h=c.useRef(null),[b,y]=c.useState(null),v=d??e;c.useLayoutEffect(()=>{const p=()=>{const w=t.current,C=l.current;if(!w||!C)return;const A=w.getBoundingClientRect(),M=C.getBoundingClientRect(),T=la(v,{box:A,naturalWidth:n.w,naturalHeight:n.h,sourceWindow:r});y({left:T.left-M.left,top:T.top-M.top,width:T.width,height:T.height})};p();const E=t.current;if(!E||typeof ResizeObserver>"u")return;const _=new ResizeObserver(p);return _.observe(E),()=>_.disconnect()},[v,n.w,n.h,r,o,a.x,a.y]);const S=c.useCallback(p=>E=>{var _,w;E.stopPropagation(),(w=(_=E.target).setPointerCapture)==null||w.call(_,E.pointerId),h.current={handle:p,sx:E.clientX,sy:E.clientY,start:v},x(v)},[v]),m=c.useCallback(p=>{const E=h.current,_=t.current;if(!E||!_)return;const w=ca({box:_.getBoundingClientRect(),naturalWidth:n.w,naturalHeight:n.h,sourceWindow:r}),C=(p.clientX-E.sx)/(w||1),A=(p.clientY-E.sy)/(w||1),M=Da(E.start,E.handle,C,A,{w:n.w,h:n.h},1);x(M),s(M.x0,M.y0,M.x1,M.y1)},[t,n.w,n.h,r,s]),g=c.useCallback(()=>{const p=h.current;h.current=null;const E=d;x(null),p&&E&&u(E.x0,E.y0,E.x1,E.y1)},[d,u]);return b?f.jsxs("div",{ref:l,className:"absolute inset-0 z-20 pointer-events-none",style:{touchAction:"none"},children:[f.jsx("div",{className:"absolute border-2 border-sky-400 bg-sky-400/10 pointer-events-auto",style:{...b,cursor:"move",touchAction:"none"},onPointerDown:S("move"),onPointerMove:m,onPointerUp:g}),Ca.map(p=>{const E=ci[p];return f.jsx("div",{className:"absolute pointer-events-auto flex items-center justify-center",style:{left:b.left+E.fx*b.width-12,top:b.top+E.fy*b.height-12,width:24,height:24,cursor:E.cursor,touchAction:"none"},onPointerDown:S(p),onPointerMove:m,onPointerUp:g,children:f.jsx("div",{className:"w-2.5 h-2.5 rounded-sm bg-sky-400 border border-white/80"})},p)}),f.jsx("button",{type:"button","aria-label":"Remove depth region",title:"Remove region (reset the depth window)",className:"absolute pointer-events-auto flex items-center justify-center rounded-full text-white",style:{left:b.left+b.width-8,top:b.top-32,width:40,height:40},onPointerDown:p=>p.stopPropagation(),onClick:i,children:f.jsx("span",{className:"flex items-center justify-center w-5 h-5 rounded-full bg-slate-800/90 border border-white/70 text-[11px] leading-none",children:"×"})})]}):f.jsx("div",{ref:l,className:"absolute inset-0 z-20 pointer-events-none"})}const In={inFlight:!1,pending:null};function Jr(e,t){return e.inFlight?{state:{inFlight:!0,pending:t},launch:null}:{state:{inFlight:!0,pending:null},launch:t}}function eo(e){return e.pending!=null?{state:{inFlight:!0,pending:null},launch:e.pending}:{state:In,launch:null}}const ui=1e3,fi=typeof requestAnimationFrame=="function"?e=>requestAnimationFrame(()=>e()):e=>setTimeout(e,0),to=typeof cancelAnimationFrame=="function"?cancelAnimationFrame:e=>clearTimeout(e);function no(e,t){const n=e.deep,r=(n==null?void 0:n.zMin)??0,o=(n==null?void 0:n.zMax)??0,a=t!=null,[s,u,i]=Be(r),[l,d,x]=Be(o),[h,b]=c.useState(null),[y,v]=c.useState(null),S=c.useRef(n);S.current=n;const m=c.useRef(r);m.current=r;const g=c.useRef(o);g.current=o;const p=c.useRef(s);p.current=s;const E=c.useRef(l);E.current=l;const _=c.useRef({near:s,far:l,ver:0}),w=c.useRef(0),C=c.useRef(!0),A=c.useRef(In),M=c.useRef(null),T=u,P=d,L=c.useCallback(()=>{const W=S.current;if(!W)return;const{near:J,far:ee,ver:se}=_.current,pe=()=>{const K=eo(A.current);A.current=K.state,K.launch!=null&&L()};W.flatten(J,ee).then(K=>{_.current.ver===se&&!C.current&&(M.current!=null&&to(M.current),M.current=fi(()=>{M.current=null,b(K)})),pe()}).catch(pe)},[]),R=c.useCallback(()=>{const W=Jr(A.current,1);A.current=W.state,W.launch!=null&&L()},[L]);c.useEffect(()=>()=>{M.current!=null&&to(M.current),n==null||n.dispose()},[n]),c.useEffect(()=>{if(!n)return;const W=s<=r&&l>=o;if(C.current=W,w.current+=1,_.current={near:s,far:l,ver:w.current},a){t(s,l);return}if(W){b(null);return}R()},[n,s,l,r,o,R,a,t]);const B=c.useMemo(()=>n&&!a&&h!=null?{...e,data:h}:e,[e,n,a,h]),O=n!=null&&r>0&&o/r>ui,X=c.useMemo(()=>{if(!n||!(o>r))return;const W=ee=>Math.abs(ee)>=1e3||Math.abs(ee)<.01&&ee!==0?ee.toExponential(2):ee.toFixed(3),J=(ee,se,pe,K,le)=>{if(O){const ge=Math.log10(r),ve=Math.log10(o);return{id:ee,icon:"layers",label:se,title:`${pe} (log scale). Double-click to type a Z.`,min:ge,max:ve,step:(ve-ge)/200,value:Math.log10(Math.max(r,Math.min(K,o))),onChange:Y=>le(10**Y),format:Y=>W(10**Y)}}return{id:ee,icon:"layers",label:se,title:`${pe}. Double-click to type a Z.`,min:r,max:o,step:(o-r)/200,value:K,onChange:le,format:W}};return[J("depth-near","ZN","Depth window NEAR — composite only samples with Z ≥ this",s,T),J("depth-far","ZF","Depth window FAR — composite only samples with Z ≤ this",l,P)]},[n,r,o,s,l,O,T,P]),G=c.useCallback(W=>{if(W.count===0){const se=m.current,pe=g.current,K=pe>se?0:1;u(pe+K),d(se-K);return}const J=g.current-m.current,ee=Math.max(Math.abs(J)*1e-4,1e-4);u(W.zMin-ee),d(W.zMax+ee)},[u,d]),F=c.useRef(null),U=c.useRef(In),$=c.useCallback(()=>{const W=S.current,J=F.current,ee=()=>{const se=eo(U.current);U.current=se.state,se.launch!=null&&$()};if(!W||!J){ee();return}W.zRangeInRect(J.x0,J.y0,J.x1,J.y1).then(se=>{G(se),ee()}).catch(ee)},[G]),oe=c.useCallback((W,J,ee,se)=>{F.current={x0:W,y0:J,x1:ee,y1:se};const pe=Jr(U.current,1);U.current=pe.state,pe.launch!=null&&$()},[$]),ye=c.useCallback((W,J,ee,se)=>{v({x0:W,y0:J,x1:ee,y1:se}),oe(W,J,ee,se)},[oe]),ie=c.useCallback(()=>{v(null),i.reset(),x.reset(),b(null)},[i,x]),me=c.useCallback(()=>{i.reset(),x.reset(),v(null),b(null)},[i,x]);return{hdr:B,sliders:X,hasDeep:n!=null,region:y,queryRegionWindow:oe,commitRegion:ye,removeRegion:ie,reset:me,isModified:i.isModified||x.isModified}}function ro(e){return"hdr"in e&&e.hdr!=null}function oo(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function Ce(e){return Number.isFinite(e)?e:0}const di={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function pi(e,t,n,r,o=0){const{h:a,w:s,c:u}=oo(e.shape),i=e.precision==="f16-bits"?dr(e.data):e.data,l=_s(t),d=new Uint8ClampedArray(s*a*4);for(let x=0;x<s*a;x++){const h=x*u;let b,y,v,S=1;u===1?b=y=v=Ce(i[h]):u===3?(b=Ce(i[h]),y=Ce(i[h+1]),v=Ce(i[h+2])):(b=Ce(i[h]),y=Ce(i[h+1]),v=Ce(i[h+2]),S=Ce(i[h+3]));const m=[Ft(b,n,o),Ft(y,n,o),Ft(v,n,o)],[g,p,E]=l(m),_=x*4;d[_]=255*bt(g,r),d[_+1]=255*bt(p,r),d[_+2]=255*bt(E,r),d[_+3]=255*(S<0?0:S>1?1:S)}return new ImageData(d,s,a)}function hi(e,t,n){const r=Ut(t,n??Mt),o=new Uint8ClampedArray(e.data.length),a=e.data;for(let s=0;s<a.length;s+=4)o[s]=255*bt(gn(a[s]/255),r),o[s+1]=255*bt(gn(a[s+1]/255),r),o[s+2]=255*bt(gn(a[s+2]/255),r),o[s+3]=a[s+3];return new ImageData(o,e.width,e.height)}function mi(e){var yt,xt;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:a="auto",colormap:s="none",tonemap:u,gamma:i,showAxes:l=!1,processing:d=di,zoom:x=1,pan:h={x:0,y:0},onViewportChange:b,onNaturalSize:y,label:v,isDraggable:S=!1,onDragStart:m,overlay:g,overlaySettings:p,pixelValueNotation:E="decimal",toolbar:_=!0}=e,[w,C,A]=Be(s);c.useEffect(()=>{C(s)},[s,C]);const M=(()=>{const N=_t(u);return N==="gamma"||N==="linear"?N:"srgb"})(),[T,P,L]=Be(M);c.useEffect(()=>{P(M)},[u]);const[R,B,O]=Be(i&&i>0?i:Mt);c.useEffect(()=>{i&&i>0&&B(i)},[i,B]);const X=c.useRef(null),G=c.useRef(null),F=c.useRef(null),[U,$]=c.useState(!1),oe=c.useRef(null),ye=c.useRef(null),ie=c.useRef(null),me=c.useRef(null),[W,J]=c.useState(0),ee=c.useCallback(()=>J(N=>N+1),[]),se=c.useMemo(()=>({get current(){const N=ie.current;return N instanceof HTMLCanvasElement?N:null}}),[]),pe=c.useCallback(N=>{X.current=N,N&&(ie.current=N)},[]),K=c.useCallback(N=>{G.current=N,N&&(ie.current=N)},[]),le=c.useCallback(N=>{F.current=N,N&&(ie.current=N)},[]),ge=c.useCallback(N=>{N&&(ie.current=N)},[]),[ve,Y]=c.useState(!1),[Te,we]=c.useState(!1),[Se,ce]=c.useState(!1),[Pe,Re]=c.useState(null),{flipSign:Fe}=d,{gammaFilterId:Dt,filterStr:Ne,gamma:kt,offset:Qe}=Gr(d),We=!r&&o!=="none"&&n!=null&&t!=null,Ue=o!=="none"&&n!=null,ze=w!=="none"&&!We&&!(r&&Ue)&&t!=null;c.useEffect(()=>{if(!ze||!t){ce(!1);return}let N=!1;ce(!1);const de=`${t}::${w}`,te=En(de);if(te){const D=G.current;if(D){D.width=te.width,D.height=te.height;const I=D.getContext("2d");I&&I.putImageData(te,0,0),ee(),Re({w:te.width,h:te.height}),y==null||y(te.width,te.height),ce(!0)}return}const xe=new Image;return xe.onload=()=>{if(N)return;const D=document.createElement("canvas");D.width=xe.naturalWidth,D.height=xe.naturalHeight;const I=D.getContext("2d");if(!I)return;I.drawImage(xe,0,0);const V=I.getImageData(0,0,D.width,D.height),z=yn(w),Z=wn(V,w,z);_n(de,Z);const q=G.current;if(!q||N)return;q.width=Z.width,q.height=Z.height;const ne=q.getContext("2d");ne&&ne.putImageData(Z,0,0),ee(),Re({w:Z.width,h:Z.height}),y==null||y(Z.width,Z.height),ce(!0)},xe.src=t,()=>{N=!0}},[ze,t,w]);const at=t!=null&&!We&&!ze&&T!=="srgb";c.useEffect(()=>{if(!at||!t){$(!1);return}let N=!1;return $(!1),tt(t).then(de=>{if(N||!de)return;const te=hi(de,T,R),xe=F.current;if(!xe)return;xe.width=te.width,xe.height=te.height;const D=xe.getContext("2d");D&&D.putImageData(te,0,0),ee(),Re({w:te.width,h:te.height}),y==null||y(te.width,te.height),$(!0)}),()=>{N=!0}},[at,t,T,R]);const Je=c.useCallback((N,de)=>{Re(te=>te&&te.w===N&&te.h===de?te:{w:N,h:de}),y==null||y(N,de)},[]);c.useEffect(()=>{if(!t){me.current=null,ee();return}let N=!1;return tt(t).then(de=>{N||(me.current=de,ee())}),()=>{N=!0}},[t,ee]);const gt=c.useCallback((N,de,te)=>{const xe=me.current;if(!xe||N<0||de<0||N>=xe.width||de>=xe.height)return null;const D=(de*xe.width+N)*4,I=xe.data[D],V=xe.data[D+1],z=xe.data[D+2];return pt(w!=="none"||I===V&&V===z?[I]:[I,V,z],"uint8",te)},[w]);c.useEffect(()=>{if(we(!1),!We){Y(!1);return}let N=!1;const de=zs(),te=de==="gpu"||de==="auto",xe=`${n}::${t}::${o}::${w}`;if(de!=="gpu"){const D=En(xe);if(D){const I=X.current;if(I){(I.width!==D.width||I.height!==D.height)&&(I.width=D.width,I.height=D.height);const V=I.getContext("2d");V&&V.putImageData(D,0,0),Je(D.width,D.height),Y(!0)}return}}return(async()=>{const[D,I]=await Promise.all([tt(n),tt(t)]);if(N||!D||!I)return;const z=o.includes("signed")?"signed":"positive",Z=w!=="none"?pn(w):null,q={diffMode:o,colormap:Z,cmapMode:z};if(te)try{const ue=X.current;if(ue){const De=Gs(D,I,q,ue);if(De){if(N)return;Je(De.width,De.height),Y(!0);return}}}catch(ue){console.warn("[cairn] WebGL 2 diff error:",ue)}if(de==="gpu"){N||we(!0);return}let ne=ks(D,I,o);w!=="none"&&(ne=wn(ne,w,z)),_n(xe,ne);const Ee=X.current;if(!Ee||N)return;(Ee.width!==ne.width||Ee.height!==ne.height)&&(Ee.width=ne.width,Ee.height=ne.height);const Le=Ee.getContext("2d");Le&&Le.putImageData(ne,0,0),Je(ne.width,ne.height),Y(!0)})(),()=>{N=!0}},[n,t,o,We,w,y]);const He=a==="auto"?void 0:a,it=Fe?{filter:"invert(1)"}:{},$e=g&&(p!=null&&p.enabled)&&Pe&&t&&((((yt=g.boxes)==null?void 0:yt.length)??0)>0||(((xt=g.masks)==null?void 0:xt.length)??0)>0)?f.jsx(Pn,{data:g,settings:p,naturalWidth:Pe.w,naturalHeight:Pe.h}):void 0,Ve=t?We&&Te?f.jsx(Fr,{title:"WebGL 2 unavailable",body:"GPU render mode needs WebGL 2 here — switch render mode to Auto or CPU."}):We?f.jsxs(f.Fragment,{children:[!ve&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),f.jsx("canvas",{ref:pe,className:"w-full h-full object-contain block",style:{display:ve?"block":"none",imageRendering:He,...it}})]}):ze?f.jsxs(f.Fragment,{children:[!Se&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),f.jsx("canvas",{ref:K,className:"w-full h-full object-contain block",style:{display:Se?"block":"none",imageRendering:He,...it}})]}):at?f.jsxs(f.Fragment,{children:[!U&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying transfer..."}),f.jsx("canvas",{ref:le,className:"w-full h-full object-contain block",style:{display:U?"block":"none",imageRendering:He,...it}})]}):f.jsx("img",{ref:ge,src:t,alt:v,className:"w-full h-full object-contain block",draggable:!1,style:{filter:Ne,imageRendering:He},onLoad:N=>{const de=N.currentTarget;Re({w:de.naturalWidth,h:de.naturalHeight}),y==null||y(de.naturalWidth,de.naturalHeight)}}):f.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return f.jsx(Zt,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:_,paneRef:oe,wrapperRef:ye,zoom:x,pan:h,onViewportChange:b,naturalDims:Pe,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${h.x}px, ${h.y}px) scale(${x})`,transformOrigin:"0 0"},viewportPadding:l&&Pe?"16px 4px 4px 28px":"4px",header:f.jsx(Ur,{id:Dt,gamma:kt,offset:Qe}),surface:Ve,showAxes:l,overlayNode:$e,overlay:{displayElRef:ie,sample:gt,version:W,hasSource:!!t},notationSeed:E,exportCanvasRef:se,leadingMenus:w==="none"?[Pt(w,N=>C(N)),jr(T,N=>P(N))]:[Pt(w,N=>C(N))],extraSliders:w==="none"&&Gt(T)?[{id:"gamma",label:"γ",title:"Display gamma γ for the Gamma transfer — display = clamp(value)^(1/γ), tev-style. Default 2.2 (close to sRGB, not identical). Double-click to type a value.",min:xn,max:bn,step:vn,value:R,onChange:B,format:N=>N.toFixed(1)}]:void 0,onReset:()=>{A.reset(),L.reset(),O.reset()},extraModified:A.isModified||L.isModified||O.isModified,label:v,showLabelChip:!!v,isDraggable:S,onDragStart:m})}function gi(e){const{tonemap:t="srgb",exposure:n=0,gamma:r,showAxes:o=!1,label:a="",interpolation:s="auto",zoom:u=1,pan:i={x:0,y:0},onViewportChange:l,pixelValueNotation:d="decimal",toolbar:x=!0}=e,h=no(e.hdr),b=h.hdr,[y,v,S]=Be(_t(t));c.useEffect(()=>{v(_t(t))},[t,v]);const[m,g,p]=Be(r&&r>0?r:Mt);c.useEffect(()=>{r&&r>0&&g(r)},[r,g]);const E=c.useRef(null),_=c.useRef(null),w=c.useRef(null),[C,A]=c.useState(null),[M,T]=c.useState(0),[P,L]=c.useState(0),[R,B]=c.useState(0);c.useEffect(()=>{const G=E.current;if(!G)return;let F;try{F=pi(b,y,n+P,Ut(y,m),R)}catch($){console.error("[cairn] HDR tone-map error:",$);return}(G.width!==F.width||G.height!==F.height)&&(G.width=F.width,G.height=F.height);const U=G.getContext("2d");U&&(U.putImageData(F,0,0),T($=>$+1),A($=>$&&$.w===F.width&&$.h===F.height?$:{w:F.width,h:F.height}))},[b,y,n,m,P,R]);const O=c.useCallback((G,F,U)=>{const $=C;if(!$||G<0||F<0||G>=$.w||F>=$.h)return null;const oe=b.shape.length===2?1:b.shape[2]??1,ye=(F*$.w+G)*oe,ie=b.data,me=b.precision==="f16-bits"?J=>Vt(ie[J]??0):J=>ie[J]??0,W=oe===1?[me(ye)]:[me(ye),me(ye+1),me(ye+2)];return pt(W,"unit",U)},[b,C]),X=s==="auto"?void 0:s;return f.jsx(Zt,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:x,paneRef:_,wrapperRef:w,zoom:u,pan:i,onViewportChange:l,naturalDims:C,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${i.x}px, ${i.y}px) scale(${u})`,transformOrigin:"0 0"},viewportPadding:o&&C?"16px 4px 4px 28px":"4px",surface:f.jsx("canvas",{ref:E,className:"w-full h-full object-contain block",style:{imageRendering:X}}),showAxes:o,overlay:{displayElRef:E,sample:O,version:M,hasSource:!0},notationSeed:d,exportCanvasRef:E,leadingMenus:[Qr(y,G=>v(G))],displayAdjust:{exposureEV:P,offset:R,onExposureChange:L,onOffsetChange:B},extraSliders:Gt(y)?[{id:"gamma",label:"γ",title:"Display gamma γ for the Gamma transfer — display = clamp(value)^(1/γ), tev-style. Default 2.2 (close to sRGB, not identical). Double-click to type a value.",min:xn,max:bn,step:vn,value:m,onChange:g,format:G=>G.toFixed(1)}]:void 0,depthSliders:h.sliders,regionSelect:h.hasDeep?{rect:h.region,queryLive:h.queryRegionWindow,commit:h.commitRegion,remove:h.removeRegion}:void 0,onReset:()=>{h.reset(),S.reset(),p.reset()},extraModified:h.isModified||S.isModified||p.isModified,label:a,showLabelChip:!!a})}function Fn(e){return ro(e)?f.jsx(gi,{...e}):f.jsx(mi,{...e})}const so={"no-webgpu":0,"no-hdr-browser":1,"no-hdr-display":2},xi="https://github.com/doeringchristian/cairn-plot/blob/main/docs/browser-support.md";function bi(e,t=!1){const n=e||"";return t?"brave":/firefox/i.test(n)?"firefox":/safari/i.test(n)&&!/chrome|chromium|crios|android/i.test(n)?"safari":/linux/i.test(n)&&/chrome|chromium/i.test(n)?"chromium-linux":"chromium"}function vi(e){const t=e||"";return/mac os x|macintosh/i.test(t)?"macos":/windows/i.test(t)?"windows":"other"}function wi(e,t){if(e==="no-hdr-display")switch(vi(t.userAgent)){case"macos":return"macOS: EDR engages automatically on HDR-capable displays — confirm your display supports HDR.";case"windows":return"Windows: turn on Settings → System → Display → Use HDR.";default:return"Enable HDR in your display and OS settings."}const n=bi(t.userAgent,t.isBrave);if(e==="no-hdr-browser")switch(n){case"firefox":return"Firefox has no extended-tone-mapping canvas path at all — true HDR output is impossible until Firefox implements it (fundamental browser limitation).";case"safari":return"Safari's WebGPU HDR canvas tone-mapping is still maturing — update to the latest Safari 26+.";default:return"Chrome/Edge 129+ is required for HDR canvas output (toneMapping: extended) — update your browser."}switch(n){case"firefox":return"Firefox: about:config → dom.webgpu.enabled (HDR output is not available in Firefox at all — browser limitation).";case"safari":return"Safari: Develop → Feature Flags → WebGPU (Safari 26+ has it by default).";case"brave":return"Brave: check Shields fingerprint blocking + brave://flags.";case"chromium-linux":return"Chromium on Linux: enable chrome://flags/#enable-unsafe-webgpu.";case"chromium":default:return"Chrome/Edge: enable chrome://flags/#enable-unsafe-webgpu and hardware acceleration."}}function yi(e){switch(e){case"no-webgpu":return"GPU renderer unavailable → CPU fallback active; FLIP kernels + HDR compare disabled.";case"no-hdr-browser":return"True HDR output is unsupported by this browser — a fundamental browser limitation, not a cairn-plot bug → HDR images tone-mapped to SDR.";case"no-hdr-display":return"Your display/OS is not in HDR mode → HDR images tone-mapped to SDR."}}function ao(e,t){return`cairn-plot:capnotice:${e}:${t}`}const io=new Set;function co(e){try{if(window.localStorage.getItem(e)==="1")return!0}catch{}try{if(window.sessionStorage.getItem(e)==="1")return!0}catch{}return io.has(e)}function Ei(e){try{window.localStorage.setItem(e,"1");return}catch{}try{window.sessionStorage.setItem(e,"1");return}catch{}io.add(e)}const lo=new Set;let Qt=null,wt=null;function uo(){wt&&wt.parentNode&&wt.parentNode.removeChild(wt),wt=null,Qt=null}function _i(e){const t=ao(e,window.location.pathname),n=wi(e,{userAgent:navigator.userAgent,isBrave:!!navigator.brave}),r=document.createElement("div");r.setAttribute("role","status"),r.setAttribute("data-cairn-plot-capnotice",e),Object.assign(r.style,{position:"fixed",bottom:"12px",right:"12px",zIndex:"2147483000",maxWidth:"340px",boxSizing:"border-box",padding:"10px 30px 10px 12px",borderRadius:"6px",border:"1px solid var(--color-border, #d0d7de)",background:"rgb(var(--color-bg-elevated-rgb, 246 248 250) / 0.9)",color:"var(--color-fg-muted, #656d76)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",boxShadow:"0 4px 12px rgba(0, 0, 0, 0.18)",font:"12px/1.4 system-ui, sans-serif"});const o=document.createElement("div");o.textContent=yi(e),Object.assign(o.style,{fontWeight:"600",color:"var(--color-fg, #1f2328)",marginBottom:"4px"});const a=document.createElement("div");a.textContent=n,a.style.marginBottom="4px";const s=document.createElement("a");s.href=xi,s.target="_blank",s.rel="noopener noreferrer",s.textContent="Learn more",Object.assign(s.style,{color:"var(--color-accent, #0969da)",textDecoration:"none"});const u=document.createElement("button");u.type="button",u.textContent="×",u.setAttribute("aria-label","Dismiss browser capability notice"),u.title="Dismiss",Object.assign(u.style,{position:"absolute",top:"4px",right:"6px",padding:"0 4px",border:"0",background:"transparent",color:"var(--color-fg-subtle, #8b949e)",cursor:"pointer",fontSize:"16px",lineHeight:"1"}),u.addEventListener("click",()=>{Ei(t),uo()}),r.appendChild(o),r.appendChild(a),r.appendChild(s),r.appendChild(u),document.body.appendChild(r),wt=r,Qt=e}function fo(e){if(typeof document>"u"||typeof window>"u"||lo.has(e))return;lo.add(e);const t=ao(e,window.location.pathname);if(co(t))return;const n=()=>{if(!co(t)){if(Qt!==null)if(so[e]<so[Qt])uo();else return;_i(e)}};document.body?n():window.addEventListener("DOMContentLoaded",n,{once:!0})}const Mi={data:new Float32Array(0),shape:[0,0],dtype:"<f4"};function Si(e){const{h:t,w:n,c:r}=oo(e.shape);if(e.precision==="f16-bits"){const s=e.data,u=new Uint16Array(n*t*4);for(let i=0;i<n*t;i++){const l=i*r,d=i*4;if(r===1){const x=s[l];u[d]=x,u[d+1]=x,u[d+2]=x,u[d+3]=$t}else u[d]=s[l],u[d+1]=s[l+1],u[d+2]=s[l+2],u[d+3]=r>=4?s[l+3]:$t}return{data:u,width:n,height:t,format:"rgba16float"}}const o=e.data,a=new Float32Array(n*t*4);for(let s=0;s<n*t;s++){const u=s*r;let i,l,d,x=1;r===1?i=l=d=Ce(o[u]):r===3?(i=Ce(o[u]),l=Ce(o[u+1]),d=Ce(o[u+2])):(i=Ce(o[u]),l=Ce(o[u+1]),d=Ce(o[u+2]),x=Ce(o[u+3]));const h=s*4;a[h]=i,a[h+1]=l,a[h+2]=d,a[h+3]=x}return{data:a,width:n,height:t,format:"rgba32float"}}function po(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),a=n*o,s=r*o,u=(t.width-a)/2,i=(t.height-s)/2,l=Math.max(e.zoom,1e-6),d=t.width/(l*a),x=t.height/(l*s),h=-u/a-e.pan.x/(l*a),b=-i/s-e.pan.y/(l*s);return{x:h,y:b,w:d,h:x}}function ho(e,t,n,r){const o=e.w*n,a=e.h*r;return o<=0||a<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/a)}const Ai=(()=>{try{return new URLSearchParams(window.location.search).get("hdrEncode")==="legacy"}catch{return!1}})();function Ti(e){var de,te,xe;const t=ro(e),n=c.useRef(null),r=c.useRef(null),o=c.useRef(null),a=c.useRef(null),s=c.useRef(null),u=t&&!!((de=e.hdr)!=null&&de.deep),i=c.useCallback((D,I)=>{var V,z;(V=a.current)==null||V.setDeepWindow(D,I),(z=s.current)==null||z.call(s)},[]),l=no(t?e.hdr:Mi,u?i:void 0),d=c.useRef(!1),[x,h]=c.useState(!1),[b,y]=c.useState(!1),[v,S]=c.useState(!1),[m,g]=c.useState(null),[p,E]=c.useState(0),[_,w]=c.useState(0),[C,A]=c.useState({x:0,y:0,w:1,h:1}),M=c.useRef(null),T=c.useRef(null),[P,L]=c.useState(0),R=e.zoom??1,B=e.pan??{x:0,y:0},O=e.onViewportChange,X=t?"none":e.colormap??"none",[G,F,U]=Be(X);c.useEffect(()=>{F(X)},[X,F]);const $=t?"none":G,oe=t?e.tonemap:void 0,[ye,ie]=c.useState(null);c.useEffect(()=>{ie(null)},[oe]);const me=Ss(oe),W=ye??me,J=ye!==null&&ye!==me,ee=c.useCallback(()=>ie(null),[]),se=t?e.peak:void 0,[pe,K,le]=Be(se!=null&&se>0?se:Ms(oe)??tr),ge=e.gamma,[ve,Y,Te]=Be(ge&&ge>0?ge:Mt);c.useEffect(()=>{ge&&ge>0&&Y(ge)},[ge,Y]);const we=t?void 0:e.tonemap,Se=(()=>{const D=_t(we);return D==="gamma"||D==="linear"?D:"srgb"})(),[ce,Pe,Re]=Be(Se);c.useEffect(()=>{Pe(Se)},[we]);const[Fe,Dt]=c.useState(0),[Ne,kt]=c.useState(0),Qe=Tn();c.useEffect(()=>{const D=n.current;if(!D)return;let I=!1;return Bt().then(V=>{var ne;if(I)return;const z=((ne=V.probeExtendedToneMapping)==null?void 0:ne.call(V))??!1,Z=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,q=z&&Z&&t;d.current=q,h(q),t&&!q&&fo(z?"no-hdr-display":"no-hdr-browser"),Pa(D,{hdr:q}).then(Ee=>{if(I){Ir(Ee);return}a.current=Ee,S(!0)}).catch(Ee=>{I||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",Ee),y(!0))})}).catch(V=>{I||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",V),y(!0))}),()=>{I=!0,a.current&&(Ir(a.current),a.current=null)}},[]),c.useEffect(()=>{const D=r.current;if(!D)return;const I=new ResizeObserver(()=>w(V=>V+1));return I.observe(D),()=>I.disconnect()},[]),c.useEffect(()=>{const D=r.current;if(!D)return;const I=new IntersectionObserver(V=>{const z=V[0];if(!z)return;const Z=a.current;Z&&(Z.setVisible(z.isIntersecting),z.isIntersecting?Z.isParked&&(Z.restore(),w(q=>q+1)):Z.park())},{threshold:0});return I.observe(D),()=>I.disconnect()},[]),c.useEffect(()=>{var V;if(!t||!v||u)return;const D=l.hdr;M.current=D;const I=Si(D);(V=a.current)==null||V.setSource(I),g(z=>z&&z.w===I.width&&z.h===I.height?z:{w:I.width,h:I.height}),L(z=>z+1),E(z=>z+1)},[t,v,u,t?l.hdr:null]),c.useEffect(()=>{if(!t||!v||!u)return;const D=e.hdr,I=D.deep;M.current=D;let V=!1;return I.getGpuCsr().then(z=>{var Z;V||((Z=a.current)==null||Z.setDeepSource(z,I.zMin,I.zMax),g(q=>q&&q.w===z.width&&q.h===z.height?q:{w:z.width,h:z.height}),L(q=>q+1),E(q=>q+1))}).catch(z=>{V||console.warn("[cairn] deep GPU CSR upload failed:",z)}),()=>{V=!0}},[t,v,u,t?e.hdr.deep:null]),c.useEffect(()=>{if(t||!v)return;const D=e,I=D.imageUrl,V=G;if(!I){T.current=null,g(null),L(Z=>Z+1);return}let z=!1;return tt(I).then(Z=>{var Ee,Le;if(z||!Z)return;let q=Z;if(V!=="none"){const ue=`gpu::${I}::${V}::ev${Fe}::off${Ne}`,De=En(ue);if(De)q=De;else{const ct=yn(V);q=wn(Z,V,ct,Fe,Ne),_n(ue,q)}}T.current=Z;const ne={data:q.data,width:q.width,height:q.height,format:"rgba8unorm"};(Ee=a.current)==null||Ee.setSource(ne),g(ue=>ue&&ue.w===q.width&&ue.h===q.height?ue:{w:q.width,h:q.height}),(Le=D.onNaturalSize)==null||Le.call(D,q.width,q.height),L(ue=>ue+1),E(ue=>ue+1)}),()=>{z=!0}},[t,v,t?null:e.imageUrl,t?null:G,t?0:Fe,t?0:Ne]);const We=t?e.exposure??0:0,Ue=!t&&$==="none",ze=c.useCallback(()=>{const D=a.current;if(!D||!v||!m)return;const I=r.current,V=o.current,z=V?V.getBoundingClientRect():I?I.getBoundingClientRect():{width:m.w,height:m.h},Z=po({zoom:R,pan:B},z,m.w,m.h);A(ue=>ue.x===Z.x&&ue.y===Z.y&&ue.w===Z.w&&ue.h===Z.h?ue:Z),z.width>0&&z.height>0&&D.resize(Math.round(z.width*Qe),Math.round(z.height*Qe));const q=ho(Z,z,m.w,m.h)>=Rn?"nearest":"linear",ne=Z,Ee=Ps(W,d.current?pe:1,d.current,ve),Le=t?{exposureEV:We+Fe,offset:Ne,operator:Ee.operator,gamma:Ee.gamma,isScalar:!1,hdrOut:Ee.hdrOut,hdrEncodeLegacy:Ai,peak:Ee.peak,uv:ne,filter:q}:{exposureEV:Ue?Fe:0,offset:Ue?Ne:0,operator:Ue?ce:"linear",gamma:Ue?Ut(ce,ve):1,isScalar:!1,hdrOut:!1,srgbDecode:Ue,uv:ne,filter:q};try{D.render(Le)||y(!0)}catch(ue){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",ue),y(!0)}},[v,m,R,B.x,B.y,We,Fe,Ne,W,pe,ve,ce,Ue,t,$,Qe]);s.current=ze,c.useEffect(()=>{ze()},[ze,p,_]);const at=c.useCallback((D,I,V)=>{if(t){const ue=M.current,De=m;if(!ue||!De||D<0||I<0||D>=De.w||I>=De.h)return null;const ct=ue.shape.length===2?1:ue.shape[2]??1,lt=(I*De.w+D)*ct,on=ue.data,Et=ue.precision==="f16-bits"?Lt=>Vt(on[Lt]??0):Lt=>on[Lt]??0,sn=ct===1?[Et(lt)]:[Et(lt),Et(lt+1),Et(lt+2)];return pt(sn,"unit",V)}const z=T.current;if(!z||D<0||I<0||D>=z.width||I>=z.height)return null;const Z=(I*z.width+D)*4,q=z.data[Z],ne=z.data[Z+1],Ee=z.data[Z+2];return pt($!=="none"||q===ne&&ne===Ee?[q]:[q,ne,Ee],"uint8",V)},[t,m,$]),Je=e.showAxes??!1,gt=t?e.label??"":e.label,He=e.interpolation??"auto",it=He==="auto"?void 0:He,$e=t?void 0:e.overlay,Ve=t?void 0:e.overlaySettings,yt=t?!1:e.isDraggable??!1,xt=t?void 0:e.onDragStart;if(b)return t?f.jsx(Fn,{...e}):f.jsx(Fn,{...e});const N=$e&&(Ve!=null&&Ve.enabled)&&m&&((((te=$e.boxes)==null?void 0:te.length)??0)>0||(((xe=$e.masks)==null?void 0:xe.length)??0)>0)?f.jsx(Pn,{data:$e,settings:Ve,naturalWidth:m.w,naturalHeight:m.h}):void 0;return f.jsx(Zt,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":v},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:r,wrapperRef:o,zoom:R,pan:B,onViewportChange:O,naturalDims:m,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:Je&&m?"16px 4px 4px 28px":0,surface:f.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:it},"data-gpu-image-canvas":!0}),showAxes:Je,overlayNode:N,overlay:{displayElRef:n,sample:at,version:P,hasSource:!0,sourceWindow:C},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:ze,leadingMenus:t?[Qr(W,D=>ie(D))]:Ue?[Pt($,D=>F(D)),jr(ce,D=>Pe(D))]:[Pt($,D=>F(D))],displayAdjust:{exposureEV:Fe,offset:Ne,onExposureChange:Dt,onOffsetChange:kt},extraSliders:[...t&&x?[{id:"peak",label:"PK",title:"Peak white (×SDR white) — the HDR ceiling P every operator clips at (Linear/sRGB/Gamma hard-clip at P; Reinhard/ACES roll off toward P). P=1 reproduces the SDR rendition exactly; double-click to type a value, including 'inf' for the raw browser-clipped extended look.",min:ws,max:It,step:ys,value:pe,onChange:K,format:D=>Number.isFinite(D)?`${D.toFixed(1)}×`:"∞"}]:[],...(t?Gt(W):Ue&&Gt(ce))?[{id:"gamma",label:"γ",title:"Display gamma γ for the Gamma transfer — display = clamp(value)^(1/γ), tev-style. Default 2.2 (close to sRGB, not identical). Double-click to type a value.",min:xn,max:bn,step:vn,value:ve,onChange:Y,format:D=>D.toFixed(1)}]:[]],depthSliders:l.sliders,regionSelect:u?{rect:l.region,queryLive:l.queryRegionWindow,commit:l.commitRegion,remove:l.removeRegion}:void 0,onReset:()=>{U.reset(),ee(),le.reset(),Te.reset(),Re.reset(),l.reset()},extraModified:U.isModified||J||le.isModified||Te.isModified||Re.isModified||l.isModified,label:gt,showLabelChip:!!gt,isDraggable:yt,onDragStart:xt})}const jt=new Map;function qe(e){if(jt.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);jt.set(e.id,e)}function ot(e){return jt.get(e)}function Pi(){return Array.from(jt.values())}function mo(e,t){return{...e.params??{},...t??{}}}const Ri={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},Ci={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},Di={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},ki={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},Li={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},Oi={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},go=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];Ni(go);const Gn=[1.052156925,1,.91835767],Bi=.7;function Ni(e){const[t,n,r]=e[0],[o,a,s]=e[1],[u,i,l]=e[2],d=a*l-s*i,x=-(o*l-s*u),h=o*i-a*u,y=1/(t*d+n*x+r*h);return[[d*y,-(n*l-r*i)*y,(n*s-r*a)*y],[x*y,(t*l-r*u)*y,-(t*s-r*o)*y],[h*y,-(t*i-n*u)*y,(t*a-n*o)*y]]}function Ii(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const Un=6/29;function zn(e){return e>Un**3?Math.cbrt(e):e/(3*Un*Un)+4/29}function xo(e,t,n){const[r,o,a]=Ii(go,e,t,n),s=zn(r*Gn[0]),u=zn(o*Gn[1]),i=zn(a*Gn[2]),l=116*u-16,d=500*(s-u),x=200*(u-i);return[l,.01*l*d,.01*l*x]}function Fi(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function Gi(){const e=xo(0,1,0),t=xo(0,0,1);return Math.pow(Fi(e,t),Bi)}const bo=Gi(),Ui=.082;function vo(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],a=Math.max(...n,...o),s=Math.ceil(3*Math.sqrt(a/(2*Math.PI**2))*e),u=1/e,i=Math.PI**2,l=[0,0,0];for(let d=-s;d<=s;d++)for(let x=-s;x<=s;x++){const h=(x*u)**2+(d*u)**2;for(let b=0;b<3;b++)l[b]+=t[b]*Math.sqrt(Math.PI/n[b])*Math.exp(-i*h/n[b])+r[b]*Math.sqrt(Math.PI/o[b])*Math.exp(-i*h/o[b])}return{r:s,deltaX:u,sums:l}}function wo(e){const t=.5*Ui*e,n=Math.ceil(3*t);let r=0,o=0,a=0;for(let s=-n;s<=n;s++)for(let u=-n;u<=n;u++){const i=Math.exp(-(u*u+s*s)/(2*t*t)),l=-u*i,d=(u*u/(t*t)-1)*i;l>0&&(r+=l),d>0?o+=d:a-=d}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:a}}const zi=`
${Ge}
${Yt}
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
`,$i=`
${Ge}
${Yt}
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
`,Jt=`
${Ge}
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
`,yo=`
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
`;function Ze(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function en(e,t,n){const r=n.sourceMap,o=r?t==="a"?r.offsetA:r.offsetB:{x:0,y:0},a=r!=null&&r.fill?1:0;return[Ze(e,[o.x,o.y,a,0]),Ze(e+1,[n.width,n.height,0,0])]}function tn(e){return[Ze(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),Ze(2,[e.sums[2],0,0,0])]}function Eo(e){return[Ze(4,[bo,e.sd,e.r,e.edgeNorm]),Ze(5,[e.pointPos,e.pointNeg,0,0])]}function _o(e,t,n,r,o,a=""){const s=vo(e),u=wo(e),i=`ycxczA${a}`,l=`ycxczB${a}`,d=`labA${a}`,x=`labB${a}`,h=`flip${a}`;return{passes:[{name:i,shader:t,inputs:[n],output:i,uniforms:()=>en(1,"a",o)},{name:l,shader:t,inputs:[r],output:l,uniforms:()=>en(1,"b",o)},{name:d,shader:Jt,inputs:[i],output:d,uniforms:()=>tn(s)},{name:x,shader:Jt,inputs:[l],output:x,uniforms:()=>tn(s)},{name:h,shader:yo,inputs:[d,x,i,l],output:h,uniforms:()=>Eo(u)}],flipRef:h}}const Vi={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=_o(t,zi,"srcA","srcB",e);return{passes:n,final:r}}},Xi={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=_o(t,$i,"srcA","srcB",e);return{passes:n,final:r}}},Mo=`
${Ge}
${Yt}
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
`,Wi=`
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
`,Hi={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",output:"scalar",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),a=(r-n)/Math.max(o-1,1),s=vo(t),u=wo(t),i=[];let l=null;for(let d=0;d<o;d++){const x=n+d*a,h=`_e${d}`,b=`ycxczA${h}`,y=`ycxczB${h}`,v=`labA${h}`,S=`labB${h}`,m=`acc${h}`;i.push({name:b,shader:Mo,inputs:["srcA"],output:b,uniforms:()=>[Ze(1,[x,0,0,0]),...en(2,"a",e)]},{name:y,shader:Mo,inputs:["srcB"],output:y,uniforms:()=>[Ze(1,[x,0,0,0]),...en(2,"b",e)]},{name:v,shader:Jt,inputs:[b],output:v,uniforms:()=>tn(s)},{name:S,shader:Jt,inputs:[y],output:S,uniforms:()=>tn(s)}),l===null?i.push({name:m,shader:yo,inputs:[v,S,b,y],output:m,uniforms:()=>Eo(u)}):i.push({name:m,shader:Wi,inputs:[v,S,b,y,l],output:m,uniforms:()=>[Ze(5,[bo,u.sd,u.r,u.edgeNorm]),Ze(6,[u.pointPos,u.pointNeg,0,0])]}),l=m}return{passes:i,final:l}}},So=.01,Ao=.03,nn=1,$n=1.5,st=5,Vn=[.2126,.7152,.0722];function Xn(e){return e<=.04045?e/12.92:Math.pow((e+.055)/1.055,2.4)}function To(e,t,n){const r=Vn[0]*Xn(e)+Vn[1]*Xn(t)+Vn[2]*Xn(n);return Math.min(1,Math.max(0,r))}function Yi(e,t){const n=2*t+1,r=new Float64Array(n);let o=0;for(let a=-t,s=0;a<=t;a++,s++){const u=Math.exp(-.5*a*a/(e*e));r[s]=u,o+=u}for(let a=0;a<n;a++)r[a]=r[a]/o;return r}function Po(e,t){if(t===1)return 0;const n=2*t;let r=(e%n+n)%n;return r>=t&&(r=n-1-r),r}const Ro=()=>new Promise(e=>{typeof setTimeout=="function"?setTimeout(e,0):Promise.resolve().then(e)}),Wn=64;async function Rt(e,t,n,r,o,a){const s=new Float64Array(t*n);for(let i=0;i<n;i++){for(let l=0;l<t;l++){let d=0;for(let x=-o,h=0;x<=o;x++,h++)d+=r[h]*e[i*t+Po(l+x,t)];s[i*t+l]=d}(i+1)%Wn===0&&await a()}const u=new Float64Array(t*n);for(let i=0;i<n;i++){for(let l=0;l<t;l++){let d=0;for(let x=-o,h=0;x<=o;x++,h++)d+=r[h]*s[Po(i+x,n)*t+l];u[i*t+l]=d}(i+1)%Wn===0&&await a()}return u}async function Ki(e,t,n,r,o=Ro){const a=n*r;if(a<=0)return NaN;const s=Yi($n,st),u=new Float64Array(a),i=new Float64Array(a),l=new Float64Array(a);for(let g=0;g<a;g++)u[g]=e[g]*e[g],i[g]=t[g]*t[g],l[g]=e[g]*t[g];const d=await Rt(e,n,r,s,st,o),x=await Rt(t,n,r,s,st,o),h=await Rt(u,n,r,s,st,o),b=await Rt(i,n,r,s,st,o),y=await Rt(l,n,r,s,st,o),v=(So*nn)**2,S=(Ao*nn)**2;let m=0;for(let g=0;g<a;g++){const p=h[g]-d[g]*d[g],E=b[g]-x[g]*x[g],_=y[g]-d[g]*x[g],w=2*d[g]*x[g]+v,C=2*_+S,A=d[g]*d[g]+x[g]*x[g]+v,M=p+E+S;m+=w*C/(A*M)}return m/a}const Co=`
${Ge}

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
`,qi=`
${Co}
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let y = ssim_moment_luma(in);
  return vec4<f32>(y.x, y.y, y.x * y.x, y.y * y.y);
}
`,Zi=`
${Co}
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let y = ssim_moment_luma(in);
  return vec4<f32>(y.x * y.y, 0.0, 0.0, 0.0);
}
`,Do=`
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
`,Qi=`
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
`;function Ct(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function ko(e){const t=e.sourceMap,n=t?t.offsetA:{x:0,y:0},r=t?t.offsetB:{x:0,y:0},o=t!=null&&t.fill?1:0;return[Ct(2,[n.x,n.y,r.x,r.y]),Ct(3,[e.width,e.height,o,0])]}function Lo(e,t){const n=`${t}H`,r=`${t}V`;return{passes:[{name:n,shader:Do,inputs:[e],output:n,uniforms:()=>[Ct(1,[1,0,st,$n])]},{name:r,shader:Do,inputs:[n],output:r,uniforms:()=>[Ct(1,[0,1,st,$n])]}],out:r}}const ji={kind:"multipass",id:"ssim",label:"SSIM (1−SSIM)",publicName:"ssim",displayRange:"unit",output:"scalar",buildPasses(e){const t=(So*nn)**2,n=(Ao*nn)**2,r=Lo("momA","statsA"),o=Lo("momB","statsB");return{passes:[{name:"momA",shader:qi,inputs:["srcA","srcB"],output:"momA",uniforms:ko},{name:"momB",shader:Zi,inputs:["srcA","srcB"],output:"momB",uniforms:ko},...r.passes,...o.passes,{name:"ssim",shader:Qi,inputs:[r.out,o.out],output:"ssim",uniforms:()=>[Ct(2,[t,n,0,0])]}],final:"ssim"}}};let Oo=!1;function Ji(){Oo||(Oo=!0,qe(Ci),qe(Ri),qe(Di),qe(Li),qe(ki),qe(Oi),qe(Vi),qe(Hi),qe(Xi),qe(ji))}Ji();function Bo(){const e=[];for(const n of Pi())n.kind==="pointwise"&&e.push({id:n.id,label:n.label});e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"});const t=ot("ssim");return t&&e.push({id:t.id,label:t.label}),e}function ec(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}function tc(e,t,n){const r=t*n;if(r<=0)return NaN;let o=0;for(let a=0;a<r;a++)o+=e[a*4]??0;return 1-o/r}function No(e){return e==null||Number.isNaN(e)?"—":e.toFixed(4)}const Io=new WeakMap;function nc(e,t,n){let r=Io.get(e);r||(r=new Map,Io.set(e,r));const o=r.get(t);if(o)return o;const a=n().catch(s=>{throw r.get(t)===a&&r.delete(t),s});return r.set(t,a),a}const Fo=new WeakMap;function Hn(e,t,n,r){let o=Fo.get(e);o||(o=new Map,Fo.set(e,o));const a=`${t}::${r}`;let s=o.get(a);return s||(s=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(a,s)),s}function rc(e){return`
${Ge}
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
`}const rn="rgba16float";function oc(e,t,n,r,o,a){var S,m;const s=ot(r);if(!s)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const u=a??Tt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),i=u.result.w,l=u.result.h,d=u.fit==="fill"?1:0,x=mo(s,o);if(s.kind==="pointwise"){const g=e.createTexture(i,l,rn),p=Hn(e,`pw:${s.id}`,rc(s.source),rn),E=new Float32Array([u.offsetA.x,u.offsetA.y,u.offsetB.x,u.offsetB.y]),_=new Float32Array([i,l,d,0]);let w;try{w=e.createBindGroup(p,[{binding:0,resource:t},{binding:1,resource:n},{binding:2,resource:{uniform:E}},{binding:3,resource:{uniform:_}}]),e.renderFullscreen(g,p,w)}finally{(S=w==null?void 0:w.destroy)==null||S.call(w)}return g}const h={width:i,height:l,params:x,sourceMap:{fill:u.fit==="fill",offsetA:u.offsetA,offsetB:u.offsetB}},b=s.buildPasses(h),y=new Map([["srcA",t],["srcB",n]]),v=[];try{for(const p of b.passes){const E=e.createTexture(i,l,rn);v.push(E),y.set(p.output,E);const _=Hn(e,`mp:${s.id}:${p.name}`,p.shader,rn),w=p.inputs.map((A,M)=>{const T=y.get(A);if(!T)throw new Error(`computeDiff: pass "${p.name}" input "${A}" not produced yet`);return{binding:M,resource:T}});p.uniforms&&w.push(...p.uniforms(h));let C;try{C=e.createBindGroup(_,w),e.renderFullscreen(E,_,C)}finally{(m=C==null?void 0:C.destroy)==null||m.call(C)}}const g=y.get(b.final);if(!g)throw new Error(`computeDiff: final ref "${b.final}" not produced`);for(const p of v)p!==g&&p.destroy();return g}catch(g){for(const p of v)p.destroy();throw g}}const sc=8,ac=256*1024*1024;class ic{constructor(t=sc,n=ac){ae(this,"map",new Map);ae(this,"totalBytes",0);ae(this,"maxEntries");ae(this,"maxBytes");this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}accountReadbackBytes(t,n){let r=!1;for(const o of this.map.values())if(o===t){r=!0;break}r&&(t.bytes+=n,this.totalBytes+=n,this.evict())}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const Go=new WeakMap;function Uo(e){let t=Go.get(e);return t||(t=new ic,Go.set(e,t)),t}function cc(e,t){const n=mo(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function lc(e,t,n,r,o){const a=ot(n),s=a?cc(a,r):"",u=o?Dn(o):"";return`${e}|${t}|${n}|${s}|${u}`}function zo(e,t,n,r,o,a,s,u){const i=ot(r);if(!i)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const l=Uo(e),d=u??Tt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),x=lc(a,s,r,o,d),h=l.get(x);if(h)return h;const b=oc(e,t,n,r,o,d),y=d.result.w,v=d.result.h,S={texture:b,width:y,height:v,displayRange:i.displayRange,bytes:y*v*8};return l.set(x,S),S}function uc(e,t,n){return`${e}|${t}|${n?Dn(n):""}`}function fc(e,t,n,r,o,a){return nc(e,uc(r,o,a),()=>dc(e,t,n,r,o,a))}async function dc(e,t,n,r,o,a){try{const s=zo(e,t,n,"ssim",void 0,r,o,a);return s.ssimMean!==void 0?s.ssimMean:(s.ssimMeanPending||(s.ssimMeanPending=$o(e,s).then(u=>{const i=tc(u,s.width,s.height);return s.ssimMean=i,i})),await s.ssimMeanPending)}catch{return pc(e,t,n,a)}}async function pc(e,t,n,r){const o=r??Tt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),a=o.result.w,s=o.result.h,u=a*s;if(u<=0)return NaN;const i=await e.readback(t),l=await e.readback(n),d=i instanceof Uint8Array?255:1,x=l instanceof Uint8Array?255:1,h=o.fit==="fill",b=Kt(i,t.width,t.height,d,o.offsetA,h,a,s),y=Kt(l,n.width,n.height,x,o.offsetB,h,a,s),v=new Float64Array(u),S=new Float64Array(u),m=[0,0,0],g=[0,0,0];for(let p=0;p<s;p++){for(let E=0;E<a;E++){b(E,p,m),y(E,p,g);const _=p*a+E;v[_]=To(m[0],m[1],m[2]),S[_]=To(g[0],g[1],g[2])}(p+1)%Wn===0&&await Ro()}return Ki(v,S,a,s)}async function hc(e,t,n,r,o){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=kr(e,n,r,o).then(a=>(t.scalars=a,a))),t.scalarsPending)}async function $o(e,t){return t.resultSamples?t.resultSamples:(t.resultSamplesPending||(t.resultSamplesPending=e.readback(t.texture).then(n=>{const r=n instanceof Float32Array?n:Float32Array.from(n);return t.resultSamples=r,Uo(e).accountReadbackBytes(t,r.byteLength),r})),t.resultSamplesPending)}const mc=`
${Ge}
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
`,gc={unit:0,signed:1,relative:2},xc={linear:0,signed:1,positive:2};function bc(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function vc(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function wc(e,t,n,r,o){var b,y,v;const a=vc(t),s=Hn(e,"diff-display",mc,a),u=bc(e,o.colormap),i=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),l=new Float32Array([gc[r],xc[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]),d=new Float32Array([o.exposureEV??0,o.offset??0,0,0]),x=new Float32Array([((b=o.sourceDims)==null?void 0:b.w)??0,((y=o.sourceDims)==null?void 0:y.h)??0,0,0]);let h;try{h=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:u},{binding:2,resource:{uniform:i}},{binding:3,resource:{uniform:l}},{binding:4,resource:{uniform:d}},{binding:5,resource:{uniform:x}}]),e.renderFullscreen(t,s,h)}finally{(v=h==null?void 0:h.destroy)==null||v.call(h),u.destroy()}}const Vo=.6*.6*2.51,yc=.6*.03,Ec=0,Xo=.6*.6*2.43,_c=.6*.59,Mc=.14;function Wo(e){const t=(yc-_c*e)/(Vo-Xo*e),n=(Ec-Mc*e)/(Vo-Xo*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const Sc=.85,Ac=.85,Ho=11920928955078125e-23,Yn=[.2126,.7152,.0722];function Tc(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function Pc(e,t,n,r=3,o={}){const a=t*n,s=Wo(Sc),u=Wo(Ac),i=new Float64Array(a);let l=0;for(let g=0;g<a;g++){const[p,E,_]=Tc(e,g,r),w=p*Yn[0]+E*Yn[1]+_*Yn[2];i[g]=w,w>l&&(l=w)}const d=Float64Array.from(i).sort(),x=a>>1,h=a%2===1?d[x]:d[x-1],b=Math.max(h,Ho),y=Math.max(l,Ho),v=o.startExposure??Math.log2(s/y),S=o.stopExposure??Math.log2(u/b),m=Math.max(2,Math.ceil(S-v));return{startExposure:v,stopExposure:S,numExposures:m}}const Rc="absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm pointer-events-none select-none",Cc="REF";function Yo(){return f.jsx("span",{className:Rc,children:Cc})}function Ko({splitPosition:e,onChange:t,onReset:n}){return f.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${e*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:r=>{r.stopPropagation(),n==null||n()},onPointerDown:r=>{r.stopPropagation(),r.preventDefault();const o=r.currentTarget;try{o.setPointerCapture(r.pointerId)}catch{}const s=o.parentElement.getBoundingClientRect(),u=l=>{t==null||t(Math.max(0,Math.min(1,(l.clientX-s.left)/s.width)))},i=()=>{window.removeEventListener("pointermove",u),window.removeEventListener("pointerup",i)};window.addEventListener("pointermove",u),window.addEventListener("pointerup",i)},children:f.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})}const Dc={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function kc({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:a,zoom:s,pan:u,onViewportChange:i,processing:l=Dc,interpolation:d="auto",label:x="",isDraggable:h=!1,onDragStart:b,overlay:y,overlaySettings:v,pixelValueNotation:S="decimal"}){var se,pe;const m=c.useRef(null),[g,p]=c.useState(null),[E,_]=c.useState(null),[w,C]=c.useState(S),[A,M]=c.useState(!1),T=c.useRef(null),P=c.useRef(null),L=c.useRef(null),R=c.useRef(null),[B,O]=c.useState(0);c.useEffect(()=>{if(!e){L.current=null,O(le=>le+1);return}let K=!1;return tt(e).then(le=>{K||(L.current=le,O(ge=>ge+1))}),()=>{K=!0}},[e]),c.useEffect(()=>{if(!t){R.current=null,O(le=>le+1);return}let K=!1;return tt(t).then(le=>{K||(R.current=le,O(ge=>ge+1))}),()=>{K=!0}},[t]);const X=K=>(le,ge,ve)=>{const Y=K.current;if(!Y||le<0||ge<0||le>=Y.width||ge>=Y.height)return null;const Te=(ge*Y.width+le)*4,we=Y.data[Te],Se=Y.data[Te+1],ce=Y.data[Te+2];return we===Se&&Se===ce?{lines:[vt(we,"uint8",ve)]}:{lines:[vt(we,"uint8",ve),vt(Se,"uint8",ve),vt(ce,"uint8",ve)],colors:[Ht[0],Ht[1],Ht[2]]}},G=c.useMemo(()=>X(L),[]),F=c.useMemo(()=>X(R),[]),U=!!y&&!!(v!=null&&v.enabled)&&!!g&&!!e&&((((se=y.boxes)==null?void 0:se.length)??0)>0||(((pe=y.masks)==null?void 0:pe.length)??0)>0),{gammaFilterId:$,filterStr:oe,gamma:ye,offset:ie}=Gr(l),me=`translate(${u.x}px, ${u.y}px) scale(${s})`,W=d==="auto"?void 0:d,{containerProps:J,modifierActive:ee}=vr({containerRef:m,zoom:s,pan:u,onViewportChange:i});return f.jsxs("div",{className:"relative flex flex-col h-full",children:[f.jsx(Ur,{id:$,gamma:ye,offset:ie}),f.jsxs("div",{ref:m,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...J.style},onPointerDown:J.onPointerDown,onPointerMove:J.onPointerMove,onPointerUp:J.onPointerUp,onPointerCancel:J.onPointerCancel,children:[f.jsxs("div",{className:"relative w-full h-full",children:[f.jsxs("div",{className:"relative w-full h-full",style:{transform:me,transformOrigin:"0 0"},children:[f.jsx("img",{ref:T,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:oe,imageRendering:W,...n==="blend"?{opacity:o}:{}},onLoad:K=>{const le=K.currentTarget;p({w:le.naturalWidth,h:le.naturalHeight})}}),U&&f.jsx(Pn,{data:y,settings:v,naturalWidth:g.w,naturalHeight:g.h})]}),f.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:f.jsx("div",{className:"w-full h-full",style:{transform:me,transformOrigin:"0 0"},children:f.jsx("img",{ref:P,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:oe,imageRendering:W,...n==="blend"?{opacity:1-o}:{}},onLoad:K=>{const le=K.currentTarget;_({w:le.naturalWidth,h:le.naturalHeight})}})})}),n==="split"&&f.jsx(Ko,{splitPosition:r,onChange:a,onReset:()=>a==null?void 0:a(.5)})]}),n==="split"?f.jsxs(f.Fragment,{children:[t&&E&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:f.jsx(ht,{imageElRef:P,naturalWidth:E.w,naturalHeight:E.h,zoom:s,pan:u,sample:F,notation:w,version:B})}),e&&g&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:f.jsx(ht,{imageElRef:T,naturalWidth:g.w,naturalHeight:g.h,zoom:s,pan:u,sample:G,notation:w,version:B,onActiveChange:M})})]}):e&&g&&f.jsx(ht,{imageElRef:T,naturalWidth:g.w,naturalHeight:g.h,zoom:s,pan:u,sample:G,notation:w,version:B,onActiveChange:M}),A&&f.jsx(Mr,{notation:w,onChange:C})]}),n==="split"&&f.jsx(Yo,{}),f.jsx(Ln,{label:x,corner:"bottom-right",isDraggable:h&&!ee,grip:!0,onDragStart:b})]})}function Lc(){return f.jsx(Fr,{title:"GPU compare unavailable",body:"Float image sources need the GPU compare (WebGPU), which isn't available in this browser."})}function Oc({mode:e,kernel:t,kernelOptions:n,onSlide:r,onBlend:o,onKernel:a,onSide:s}){return{id:"compare-mode",title:"Compare / diff mode",menu:{options:[...s?[{id:"side",label:"Side"}]:[],{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...n],value:e==="side"?"side":e==="split"?"slide":e==="blend"?"blend":t,onSelect:l=>{l==="side"?s==null||s():l==="slide"?r():l==="blend"?o():a(l)}}}}function Bc(e){const t=pn(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function Nc(e){const{width:t,height:n,channels:r}=e,o=t*n;if(e.precision==="f16-bits"){const i=e.data,l=new Uint16Array(o*4);for(let d=0;d<o;d++){const x=d*r,h=d*4;if(r===1){const b=i[x];l[h]=b,l[h+1]=b,l[h+2]=b,l[h+3]=$t}else l[h]=i[x],l[h+1]=i[x+1],l[h+2]=i[x+2],l[h+3]=r>=4?i[x+3]:$t}return{data:l,format:"rgba16float"}}const a=e.data,s=new Float32Array(o*4),u=i=>Number.isFinite(i)?i:0;for(let i=0;i<o;i++){const l=i*r;let d,x,h,b=1;r===1?d=x=h=u(a[l]):r===3?(d=u(a[l]),x=u(a[l+1]),h=u(a[l+2])):(d=u(a[l]),x=u(a[l+1]),h=u(a[l+2]),b=u(a[l+3]));const y=i*4;s[y]=d,s[y+1]=x,s[y+2]=h,s[y+3]=b}return{data:s,format:"rgba32float"}}function Ic({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:a,blendAlpha:s,onSplitPositionChange:u,diffSubmode:i,colormap:l="none",align:d="top-left",fit:x="crop",diffKernel:h,onDiffKernelChange:b,onCompareModeChange:y,onRequestSide:v,zoom:S,pan:m,onViewportChange:g,interpolation:p="auto",label:E="",pixelValueNotation:_="decimal"}){var qo;const w=c.useRef(null),C=c.useRef(null),A=c.useRef(null),M=c.useRef(null),T=c.useRef(null),[P,L]=c.useState(!1),[R,B]=c.useState(!1),[O,X]=c.useState(null),[G,F]=c.useState(null),[U,$]=c.useState(0),[oe,ye]=c.useState(0),[ie,me]=c.useState(null),[W,J]=c.useState(null),[ee,se]=c.useState({x:0,y:0,w:1,h:1}),pe=h??i??"absolute",[K,le,ge]=Be(pe);c.useEffect(()=>{le(h??i??"absolute")},[h,i,le]);const ve=c.useCallback(k=>{le(k),b==null||b(k)},[b,le]);c.useEffect(()=>{const k=w.current;if(k)return k.__cairnDiffKernel={current:K,set:ve},()=>{k&&delete k.__cairnDiffKernel}},[K,ve]);const[Y,Te,we]=Be(o);c.useEffect(()=>{Te(o)},[o,Te]);const Se=c.useCallback(k=>{Te(k),y==null||y(k)},[y,Te]),[ce,Pe,Re]=Be(l);c.useEffect(()=>{Pe(l)},[l,Pe]);const Fe=c.useCallback(()=>{Se(we.default),Pe(Re.default),ve(ge.default)},[Se,Pe,ve,we.default,Re.default,ge.default]),Dt=we.isModified||Re.isModified||ge.isModified,[Ne,kt]=c.useState(0),[Qe,We]=c.useState(0),Ue=c.useMemo(()=>{const Q=[Oc({mode:Y,kernel:K,kernelOptions:Bo().map(j=>({id:j.id,label:j.label})),onSide:v,onSlide:()=>Se("split"),onBlend:()=>Se("blend"),onKernel:j=>{Se("diff"),ve(j)}})];return Y==="diff"&&Q.push(Pt(ce,j=>Pe(j))),Q},[Y,K,ce,ve,Se,v]),ze=c.useRef(null),at=c.useRef(null),Je=c.useRef(null),gt=c.useRef(null),[He,it]=c.useState(0),$e=c.useRef(null),Ve=c.useRef(null),[yt,xt]=c.useState(0),N=Tn();c.useEffect(()=>{const k=A.current;if(!k)return;let Q=!1;return Bt().then(j=>{if(!Q)try{if(Lr())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const H=j.createSurface(k,{hdr:!1});M.current={device:j,surface:H,texA:null,texB:null},B(!0)}catch(H){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",H),L(!0)}}).catch(j=>{Q||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",j),L(!0))}),()=>{var H,fe;Q=!0;const j=M.current;j&&((H=j.texA)==null||H.destroy(),(fe=j.texB)==null||fe.destroy(),M.current=null)}},[]),c.useEffect(()=>{const k=w.current;if(!k)return;const Q=new ResizeObserver(()=>ye(j=>j+1));return Q.observe(k),()=>Q.disconnect()},[]),c.useEffect(()=>{if(!R)return;let k=!1;if(!M.current)return;async function j(H,fe){if(fe){const Me=Nc(fe);return{width:fe.width,height:fe.height,imageData:null,make:Ae=>{const be=Ae.createTexture(fe.width,fe.height,Me.format);return be.write(Me.data),be}}}if(!H)return null;const he=await tt(H);return he?{width:he.width,height:he.height,imageData:he,make:Me=>{const Ae=Me.createTexture(he.width,he.height,"rgba8unorm");return Ae.write(he.data),Ae}}:null}return Promise.all([j(e,n),j(t,r)]).then(([H,fe])=>{var Ie,Xe;if(k||!M.current)return;const he=M.current;ze.current=(H==null?void 0:H.imageData)??null,at.current=(fe==null?void 0:fe.imageData)??null,Je.current=n??null,gt.current=r??null,(Ie=he.texA)==null||Ie.destroy(),(Xe=he.texB)==null||Xe.destroy(),he.texA=null,he.texB=null;const Me=H??fe;if(!Me){X(null),F(null),it(ut=>ut+1);return}const Ae=fe??Me,be=H??Me;he.texA=Ae.make(he.device),he.texB=be.make(he.device),F({a:{w:Ae.width,h:Ae.height},b:{w:be.width,h:be.height}}),X({w:Me.width,h:Me.height}),it(ut=>ut+1),$(ut=>ut+1)}),()=>{k=!0}},[R,e,t,n,r]);const de=n!=null||r!=null,te=c.useMemo(()=>ec(K,de),[K,de]),xe=c.useMemo(()=>{if(!de)return null;const k=r??n;if(!k)return null;const Q=k.precision==="f16-bits"?dr(k.data):k.data;return Pc(Q,k.width,k.height,k.channels)},[de,r,n]),D=c.useMemo(()=>{var k;return Rs(((k=ot(te))==null?void 0:k.displayRange)??"unit",ce==="none"?null:ce)},[te,ce]),I=c.useMemo(()=>ce!=="none"?Bc(ce):void 0,[ce]),V=c.useMemo(()=>G?Tt(G.a,G.b,d,x,"b"):null,[G,d,x]),z=c.useMemo(()=>V?Dn(V):"none",[V]),Z=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",q=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",ne=c.useMemo(()=>O?Y==="diff"&&V?V.result:O:null,[Y,V,O]),Ee=c.useCallback(()=>{const k=M.current;if(!R||!k||!k.surface||!k.texA||!k.texB||!O)return;const Q=ne??O,j=w.current,H=j?j.getBoundingClientRect():{width:Q.w,height:Q.h},fe=po({zoom:S,pan:m},H,Q.w,Q.h);se(be=>be.x===fe.x&&be.y===fe.y&&be.w===fe.w&&be.h===fe.h?be:fe);const he=A.current;if(H.width>0&&H.height>0&&he&&k.surface){const be=Math.max(1,Math.round(H.width*N)),Ie=Math.max(1,Math.round(H.height*N));(he.width!==be||he.height!==Ie)&&(he.width=be,he.height=Ie,k.surface.configure(be,Ie))}const Me=ho(fe,H,Q.w,Q.h)>=Rn?"nearest":"linear",Ae=fe;try{if(Y==="diff"){const be=ot(te)?te:"absolute",Ie=be==="hdr-flip"&&xe?{ppd:67,startExposure:xe.startExposure,stopExposure:xe.stopExposure,numExposures:xe.numExposures}:void 0,Xe=zo(k.device,k.texA,k.texB,be,Ie,Z,q,V??void 0);T.current=Xe,wc(k.device,k.surface,Xe.texture,Xe.displayRange,{uv:Ae,cmapMode:D,colormap:I,filter:Me,exposureEV:Ne,offset:Qe})}else{const be={exposureEV:Ne,offset:Qe,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:Ae,filter:Me,mode:Y,split:a,alpha:s};_a(k.device,k.surface,k.texA,k.texB,be)}}catch(be){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",be),L(!0)}},[R,O,ne,V,S,m.x,m.y,Y,a,s,Ne,Qe,K,te,xe,D,I,e,t,n,r,Z,q,N]);c.useEffect(()=>{Ee()},[Ee,U,oe]);const Le=t!=null||r!=null;c.useEffect(()=>{const k=M.current;if(!R||!k||!k.texA||!k.texB||!Le){me(null);return}let Q=!1;const j=k.texA,H=k.texB,fe=T.current,he=Y==="diff"?V??void 0:void 0;return(Y==="diff"&&fe?hc(k.device,fe,j,H,he):kr(k.device,j,H,he)).then(Ae=>{Q||me(Ae)}),()=>{Q=!0}},[R,U,Le,Y,K,V]),c.useEffect(()=>{const k=M.current;if(!R||!k||!k.texA||!k.texB||!Le){J(null);return}let Q=!1;J(null);const j=Y==="diff"?V??void 0:void 0;return fc(k.device,k.texA,k.texB,Z,q,j).then(H=>{Q||J(H)}).catch(()=>{Q||J(null)}),()=>{Q=!0}},[R,U,Le,Y,z,Z,q]),c.useEffect(()=>{if(Y!=="diff"){$e.current=null,Ve.current=null;return}const k=M.current,Q=T.current;if(!R||!k||!Q)return;let j=!1;return $e.current=null,Ve.current=null,xt(H=>H+1),$o(k.device,Q).then(H=>{j||($e.current=H,Ve.current={w:Q.width,h:Q.height},xt(fe=>fe+1))}).catch(()=>{}),()=>{j=!0}},[R,Y,te,U,V]);const ue=(k,Q)=>(j,H,fe)=>{const he=Q.current;if(he){const{data:ut,width:Zo,height:Uc,channels:Qo}=he;if(j<0||H<0||j>=Zo||H>=Uc)return null;const an=(H*Zo+j)*Qo,cn=he.precision==="f16-bits"?Kn=>Vt(ut[Kn]??0):Kn=>ut[Kn]??0,zc=Qo===1?[cn(an)]:[cn(an),cn(an+1),cn(an+2)];return pt(zc,"unit",fe)}const Me=k.current;if(!Me||j<0||H<0||j>=Me.width||H>=Me.height)return null;const Ae=(H*Me.width+j)*4,be=Me.data[Ae],Ie=Me.data[Ae+1],Xe=Me.data[Ae+2];return pt(be===Ie&&Ie===Xe?[be]:[be,Ie,Xe],"uint8",fe)},De=c.useMemo(()=>ue(ze,Je),[]),ct=c.useMemo(()=>ue(at,gt),[]),lt=c.useMemo(()=>(k,Q,j)=>{var Xe;const H=$e.current,fe=Ve.current;if(!H||!fe)return null;const{w:he,h:Me}=fe;if(k<0||Q<0||k>=he||Q>=Me)return null;const Ae=(Q*he+k)*4,Ie=(((Xe=ot(te))==null?void 0:Xe.output)??"per-channel")==="scalar"?[H[Ae]??0]:[H[Ae]??0,H[Ae+1]??0,H[Ae+2]??0];return pt(Ie,"unit",j)},[te]);c.useEffect(()=>{const k=w.current;if(k)return k.__cairnCompareProbe={sampleDiff:(Q,j,H="decimal")=>lt(Q,j,H),sampleFg:(Q,j,H="decimal")=>De(Q,j,H),sampleRef:(Q,j,H="decimal")=>ct(Q,j,H),get diffSamples(){return $e.current},get dims(){return ne},get primaryDims(){return O},get diffResultDims(){return Ve.current},get align(){return d},get fit(){return x},get resolvedKernelId(){return te},get compareMode(){return Y},get ssimScalar(){return W},get ssimText(){return No(W)}},()=>{k&&delete k.__cairnCompareProbe}},[lt,De,ct,O,ne,d,x,te,Y,W]);const on=p==="auto"?void 0:p;if(P)return n!=null||r!=null?f.jsx(Lc,{}):Y==="diff"?f.jsx(Fn,{imageUrl:e,baselineUrl:t,diffMode:((qo=ot(te))==null?void 0:qo.kind)==="pointwise"?te:"absolute",interpolation:p,colormap:ce,showAxes:!1,zoom:S,pan:m,onViewportChange:g,label:E,pixelValueNotation:_}):f.jsx(kc,{imageUrl:e,baselineUrl:t,mode:Y,splitPosition:a,blendAlpha:s,onSplitPositionChange:u,zoom:S,pan:m,onViewportChange:g,interpolation:p,label:E,pixelValueNotation:_});const Et=f.jsxs(f.Fragment,{children:[f.jsx("canvas",{ref:A,className:"w-full h-full block",style:{imageRendering:on},"data-gpu-compare-canvas":!0}),Y==="split"&&f.jsx(Ko,{splitPosition:a,onChange:u,onReset:()=>u==null?void 0:u(.5)})]}),sn=!!E,Lt=sn?"bottom-7":"bottom-1";return f.jsx(Zt,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":R},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:w,wrapperRef:C,zoom:S,pan:m,onViewportChange:g,naturalDims:ne,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:Et,showAxes:!1,notationSeed:_,onReset:Fe,extraModified:Dt,exportCanvasRef:A,requestRender:Ee,leadingMenus:Ue,displayAdjust:{exposureEV:Ne,offset:Qe,onExposureChange:kt,onOffsetChange:We},label:"",showLabelChip:!1,overlay:{render:({notation:k,setOverlayActive:Q})=>Y==="split"?f.jsxs(f.Fragment,{children:[Le&&ne&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-a)*100}% 0 0)`},children:f.jsx(ht,{imageElRef:A,naturalWidth:ne.w,naturalHeight:ne.h,zoom:S,pan:m,sourceWindow:ee,sample:ct,notation:k,version:He})}),Le&&ne&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${a*100}%)`},children:f.jsx(ht,{imageElRef:A,naturalWidth:ne.w,naturalHeight:ne.h,zoom:S,pan:m,sourceWindow:ee,sample:De,notation:k,version:He,onActiveChange:Q})})]}):ne&&f.jsx(ht,{imageElRef:A,naturalWidth:ne.w,naturalHeight:ne.h,zoom:S,pan:m,sourceWindow:ee,sample:Y==="diff"?lt:De,notation:k,version:Y==="diff"?yt:He,onActiveChange:Q})},extraChips:f.jsxs(f.Fragment,{children:[Y==="split"&&f.jsx(Yo,{}),sn?f.jsx(Ln,{label:E,corner:"bottom-right"}):null,ie&&f.jsxs("span",{className:`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${Lt}`,"data-gpu-compare-metrics":!0,children:["MSE ",ie.mse.toExponential(2)," · PSNR ",Number.isFinite(ie.psnr)?ie.psnr.toFixed(1):"∞"," dB · MAE"," ",ie.mae.toExponential(2)," · SSIM ",No(W)]})]})})}const Fc="cairn-plot:gpu-image-ready";async function Gc(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await Bt(),window.__cairnPlotGpuImagePane=Ti,window.__cairnPlotGpuComparePane=Ic,window.__cairnPlotDiffMenuModes=Bo(),window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(Fc))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e),fo("no-webgpu")}}}Gc()})(__cairnPlotJsxRuntime,__cairnPlotReact);
