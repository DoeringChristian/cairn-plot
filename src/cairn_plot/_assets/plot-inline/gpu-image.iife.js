var Ll=Object.defineProperty;var Ol=(f,i,pt)=>i in f?Ll(f,i,{enumerable:!0,configurable:!0,writable:!0,value:pt}):f[i]=pt;var ie=(f,i,pt)=>Ol(f,typeof i!="symbol"?i+"":i,pt);(function(f,i){"use strict";const pt=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function gr(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:pt}),{hdr:!1,format:n}}function Ps(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:pt}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:pt}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return gr(e,t)}}}const Ds=`
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
`,ks=`
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
`;class Ls extends Error{constructor(n){super(n);ie(this,"deviceLost",!0);this.name="DeviceLostError"}}async function xr(e,t){try{await e.mapAsync(GPUMapMode.READ)}catch(n){if((n instanceof Error?n.name:"")==="AbortError"){const o=t.info;throw new Ls("webgpu readback: buffer map aborted — device lost or destroyed mid-readback"+(o?` (reason=${String(o.reason)}${o.message?`: ${o.message}`:""})`:"")+`: ${n instanceof Error?n.message:String(n)}`)}throw n instanceof Error?n:new Error(String(n))}}function Cn(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function br(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Os(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const Bs={texture:0,sampler:1,uniform:2};function Rn(e,t){return e*3+Bs[t]}const Ns={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function Is(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),a=r[2]!==void 0,s=r[3].trim();if(a){const l=Ns[s];if(l===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${s}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:l})}else s==="sampler"||s==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class vr{constructor(t,n,r,o){ie(this,"width");ie(this,"height");ie(this,"format");ie(this,"gpuTexture");ie(this,"device");ie(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:Cn(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*br(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class yr{constructor(t){ie(this,"_s");ie(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class Fs{constructor(t,n,r,o,a){ie(this,"_p");ie(this,"gpuPipeline");ie(this,"bindings");ie(this,"bindGroupLayout");ie(this,"variants");ie(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=a,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function Gs(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class Us{constructor(t){ie(this,"_c");ie(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class zs{constructor(t,n,r,o,a){ie(this,"width");ie(this,"height");ie(this,"paramsBuffer");ie(this,"bindGroup");ie(this,"buffers");ie(this,"destroyed",!1);this.width=t,this.height=n,this.buffers=r,this.paramsBuffer=o,this.bindGroup=a}destroy(){if(!this.destroyed){for(const t of this.buffers)t.destroy();this.paramsBuffer.destroy(),this.destroyed=!0}}}class Vs{constructor(t,n){ie(this,"_b");ie(this,"gpuBindGroup");ie(this,"ownedBuffers");ie(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class $s{constructor(t,n,r,o){ie(this,"canvas");ie(this,"hdr");ie(this,"format");ie(this,"context");ie(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function Ht(e){return"canvas"in e}async function Xs(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function a(p){return Ht(p)?p.getCurrentTextureView():p.gpuTexture.createView()}function s(p){if(Ht(p))return{width:p.canvas.width,height:p.canvas.height};const E=p;return{width:E.width,height:E.height}}let l=!1;const c={};t.lost.then(p=>{c.info=p},()=>{});let u=null;function d(){var E,_;if(u!==null)return u;let p=!1;try{if(typeof document<"u"){const w=document.createElement("canvas");w.width=1,w.height=1;const P=w.getContext("webgpu");if(P)try{P.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:GPUTextureUsage.RENDER_ATTACHMENT});const S=(E=P.getConfiguration)==null?void 0:E.call(P);p=((_=S==null?void 0:S.toneMapping)==null?void 0:_.mode)==="extended"}catch{p=!1}finally{try{P.unconfigure()}catch{}}}}catch{p=!1}return u=p,p}const g=256;let h=null,b=null;function v(){if(!h||!b){const p=t.createShaderModule({code:Ds});b=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const E=t.createPipelineLayout({bindGroupLayouts:[b]});h=t.createComputePipeline({layout:E,compute:{module:p,entryPoint:"cs_main"}})}return{pipeline:h,layout:b}}let y=null,M=null;function x(){if(!y||!M){const p=t.createShaderModule({code:ks});M=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});const E=t.createPipelineLayout({bindGroupLayouts:[M]});y=t.createRenderPipeline({layout:E,vertex:{module:p,entryPoint:"vs_main"},fragment:{module:p,entryPoint:"fs_main",targets:[{format:"rgba16float"}]},primitive:{topology:"triangle-list"}})}return{pipeline:y,layout:M}}return{backend:"webgpu",capabilities:n,probeExtendedToneMapping:d,createTexture(p,E,_){return new vr(t,p,E,_)},createSampler(p){const E=(p==null?void 0:p.filter)==="linear"?"linear":"nearest",_=t.createSampler({magFilter:E,minFilter:E,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new yr(_)},createRenderPipeline(p){const E=t.createShaderModule({code:p.shaderWGSL}),_=Is(p.shaderWGSL),w=Cn(p.targetFormat),P=Gs(t,_),S=t.createPipelineLayout({bindGroupLayouts:[P]}),T=C=>t.createRenderPipeline({layout:S,vertex:{module:E,entryPoint:"vs_main"},fragment:{module:E,entryPoint:"fs_main",targets:[{format:C}]},primitive:{topology:"triangle-list"}}),A=T(w);return new Fs(A,_,P,w,T)},createComputePipeline(p){const E=t.createShaderModule({code:p.shaderWGSL}),_=t.createComputePipeline({layout:"auto",compute:{module:E,entryPoint:"cs_main"}});return new Us(_)},createBindGroup(p,E){const _=p,w=new Map,P=[];for(const[T,A]of _.bindings)if(A.kind==="uniform"){const C=t.createBuffer({size:A.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});P.push(C),w.set(T,{binding:T,resource:{buffer:C}})}else A.kind==="sampler"&&w.set(T,{binding:T,resource:o()});for(const T of E){const A=T.resource;if(A instanceof vr){const C=Rn(T.binding,"texture");_.bindings.has(C)&&w.set(C,{binding:C,resource:A.gpuTexture.createView()})}else if(A instanceof yr){const C=Rn(T.binding,"sampler");_.bindings.has(C)&&w.set(C,{binding:C,resource:A.gpuSampler})}else{const C=Rn(T.binding,"uniform"),B=_.bindings.get(C);if(B&&B.kind==="uniform"){const R=A.uniform,N=t.createBuffer({size:Math.max(B.sizeBytes,R.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(N,0,R.buffer,R.byteOffset,R.byteLength),P.push(N),w.set(C,{binding:C,resource:{buffer:N}})}}}const S=t.createBindGroup({layout:_.bindGroupLayout,entries:Array.from(w.values())});return new Vs(S,P)},createSurface(p,E){const _=p.getContext("webgpu");if(!_)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const w=E.hdr&&n.hdr,P=()=>w?Ps(_,t):gr(_,t),S=P();return new $s(p,_,S,P)},renderFullscreen(p,E,_){const w=E,P=_,S=a(p),{width:T,height:A}=s(p),C=Ht(p)?p.format:Cn(p.format),B=w.pipelineFor(C),R=t.createCommandEncoder(),N=R.beginRenderPass({colorAttachments:[{view:S,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});N.setPipeline(B),N.setBindGroup(0,P.gpuBindGroup),N.setViewport(0,0,T,A,0,1),N.draw(3),N.end(),t.queue.submit([R.finish()])},createDeepSampleBuffers(p){const{layout:E}=x(),_=C=>{const B=t.createBuffer({size:C.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});return t.queue.writeBuffer(B,0,C.buffer,C.byteOffset,C.byteLength),B},w=_(p.offsets),P=_(p.colors),S=_(p.zs),T=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),A=t.createBindGroup({layout:E,entries:[{binding:0,resource:{buffer:w}},{binding:1,resource:{buffer:P}},{binding:2,resource:{buffer:S}},{binding:3,resource:{buffer:T}}]});return new zs(p.width,p.height,[w,P,S],T,A)},compositeDeep(p,E,_,w){const P=p,S=E,{pipeline:T}=x();t.queue.writeBuffer(P.paramsBuffer,0,new Float32Array([P.width,P.height,w,_]));const A=t.createCommandEncoder(),C=A.beginRenderPass({colorAttachments:[{view:S.gpuTexture.createView(),loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});C.setPipeline(T),C.setBindGroup(0,P.bindGroup),C.setViewport(0,0,S.width,S.height,0,1),C.draw(3),C.end(),t.queue.submit([A.finish()])},async readback(p){const E=Ht(p),{width:_,height:w}=s(p),P=E?p.hdr?"rgba16float":"rgba8unorm":p.format,S=E&&p.format==="bgra8unorm",T=E?p.getCurrentGPUTexture():p.gpuTexture,A=br(P),C=_*A,B=256,R=Math.ceil(C/B)*B,N=R*w,I=t.createBuffer({size:N,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),K=t.createCommandEncoder();K.copyTextureToBuffer({texture:T},{buffer:I,bytesPerRow:R,rowsPerImage:w},{width:_,height:w,depthOrArrayLayers:1}),t.queue.submit([K.finish()]);try{await xr(I,c)}catch(z){try{I.destroy()}catch{}throw z}const X=new Uint8Array(I.getMappedRange()),F=new Uint8Array(C*w);for(let z=0;z<w;z++){const ee=z*R,ce=z*C;F.set(X.subarray(ee,ee+C),ce)}if(I.unmap(),I.destroy(),P==="rgba8unorm"){if(S)for(let z=0;z<F.length;z+=4){const ee=F[z],ce=F[z+2];F[z]=ce,F[z+2]=ee}return F}if(P==="rgba16float"){const z=new Uint16Array(F.buffer,F.byteOffset,F.byteLength/2),ee=new Float32Array(z.length);for(let ce=0;ce<z.length;ce++)ee[ce]=Os(z[ce]);return ee}return new Float32Array(F.buffer,F.byteOffset,F.byteLength/4)},async reduceDiffSumSquaredAbs(p,E,_,w){const P=p,S=E,T=Math.max(0,_*w),A=Math.max(1,Math.ceil(T/g)),{pipeline:C,layout:B}=v(),R=A*2*4,N=t.createBuffer({size:R,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),I=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(I,0,new Uint32Array([Math.max(1,_),Math.max(1,w),T,0]));const K=t.createBindGroup({layout:B,entries:[{binding:0,resource:P.gpuTexture.createView()},{binding:1,resource:S.gpuTexture.createView()},{binding:2,resource:{buffer:N}},{binding:3,resource:{buffer:I}}]}),X=t.createBuffer({size:R,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),F=t.createCommandEncoder(),z=F.beginComputePass();z.setPipeline(C),z.setBindGroup(0,K),z.dispatchWorkgroups(A),z.end(),F.copyBufferToBuffer(N,0,X,0,R),t.queue.submit([F.finish()]);try{await xr(X,c)}catch(fe){for(const k of[X,N,I])try{k.destroy()}catch{}throw fe}const ce=new Float32Array(X.getMappedRange()).slice();X.unmap(),X.destroy(),N.destroy(),I.destroy();let ae=0,pe=0;for(let fe=0;fe<A;fe++)ae+=ce[fe*2],pe+=ce[fe*2+1];return{sumSq:ae,sumAbs:pe}},destroy(){l||(t.destroy(),l=!0)},isContextLost(){return!1}}}let Pn=null;async function Ws(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return Xs()}function Yt(){return Pn||(Pn=Ws()),Pn}function Hs(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function Ys(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),a=Math.floor(o),s=Math.min(a+1,e.length-1),l=o-a,[c,u,d]=Hs(e[a],e[s],l);t[n*3]=Math.round(c),t[n*3+1]=Math.round(u),t[n*3+2]=Math.round(d)}return t}const Dn={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},Ks=Object.keys(Dn),qs={viridis:"Viridis",plasma:"Plasma",magma:"Magma","red-green":"Red–Green","red-blue":"Red–Blue"},Zs=Ks.map(e=>({id:e,label:qs[e]})),js=new Set(["red-green","red-blue"]),wr=new Map;function kn(e){let t=wr.get(e);if(!t){const n=Dn[e]??Dn.viridis;t=Ys(n),wr.set(e,t)}return t}function wt(e,t,n){return e<t?t:e>n?n:e}function Ue(e){return e<0?0:e>1?1:e}function Kt(e,t,n){return wt(Math.floor(e),t,n)}const Ln=e=>{const t=e<0?0:e;return t/(1+t)},On=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return Ue(n/r)},qt=4,Er=1,It=16,_r=.5,Mr={linear:([e,t,n])=>[Ue(e),Ue(t),Ue(n)],srgb:([e,t,n])=>[Ue(e),Ue(t),Ue(n)],gamma:([e,t,n])=>[Ue(e),Ue(t),Ue(n)],reinhard:([e,t,n])=>[Ln(e),Ln(t),Ln(n)],aces:([e,t,n])=>[On(e),On(t),On(n)],extended:([e,t,n])=>[e,t,n]},Sr="srgb",Ar=["linear","srgb","gamma","reinhard","aces"],Qs=["srgb","gamma","linear"],Tr={extended:"linear","extended-clamp":"linear","extended-reinhard":"reinhard","extended-aces":"aces","extended-gamma":"gamma"};function Js(e){return e&&Mr[e]||Mr[Sr]}function Zt(e){return e&&Tr[e]?Tr[e]:e&&Ar.includes(e)?e:Sr}const Cr=Zt;function Rr(e){return e==="extended"?ta:void 0}function Pr(e,t){return e==null?"srgb":Cr(e)}function jt(e,t,n){return e*2**t+n}function ea(e){const t=Ue(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function Bn(e){const t=Ue(e);return t<=.04045?t/12.92:Math.pow((t+.055)/1.055,2.4)}function Dt(e,t){return typeof t=="number"&&t>0?Ue(Math.pow(Ue(e),1/t)):ea(e)}const kt=2.2,Qt=.5,Jt=4,en=.1;function tn(e){return e==="gamma"}function Nn(e,t){if(e==="gamma")return t>0?t:kt;if(e==="linear")return 1}const ta=1/0;function Dr(e,t,n,r){const o=Cr(e),a=Nn(o,r);if(!n||Number.isFinite(t)&&t<=1)return{operator:o,hdrOut:!1,peak:1,gamma:a};const s=!Number.isFinite(t);switch(o){case"reinhard":return s?{operator:"extended",hdrOut:!0,peak:It,gamma:void 0}:{operator:"extended-reinhard",hdrOut:!0,peak:t,gamma:void 0};case"aces":return{operator:"extended-aces",hdrOut:!0,peak:s?It:t,gamma:void 0};default:return s?{operator:"extended",hdrOut:!0,peak:It,gamma:a}:{operator:"extended-clamp",hdrOut:!0,peak:t,gamma:a}}}function In(e,t,n="linear",r=0,o=0){const a=kn(t),s=new ImageData(e.width,e.height),l=e.data,c=s.data,u=r!==0||o!==0;for(let d=0;d<l.length;d+=4){let g=(l[d]+l[d+1]+l[d+2])/3;u&&(g=Math.max(0,Math.min(255,jt(g/255,r,o)*255)));let h;n==="positive"?h=Math.round(128+g/255*127):h=Math.round(g),h=Math.max(0,Math.min(255,h)),c[d]=a[h*3],c[d+1]=a[h*3+1],c[d+2]=a[h*3+2],c[d+3]=l[d+3]}return s}function na(e,t){return e==="signed"||e==="relative"?"signed":Fn(t)}function Fn(e){return js.has(e??"")?"positive":"linear"}function kr(e,t){const n=new Map;return{get(r){const o=n.get(r);if(o!==void 0)return n.delete(r),n.set(r,o),o},set(r,o){for(n.get(r)!==void 0&&n.delete(r),n.set(r,o);n.size>e;){const s=n.keys().next().value;if(s===void 0)break;n.get(s),n.delete(s)}},has(r){return n.has(r)},get size(){return n.size}}}const Lr=kr(50);function Gn(e){return Lr.get(e)}function Un(e,t){Lr.set(e,t)}const Or=kr(100);function ra(e){return Or.get(e)}function oa(e,t){Or.set(e,t)}function sa(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),a=new ImageData(r,o);for(let s=0;s<o;s++)for(let l=0;l<r;l++){const c=(s*e.width+l)*4,u=(s*t.width+l)*4,d=(s*r+l)*4;for(let g=0;g<3;g++){const h=e.data[c+g],b=t.data[u+g],v=h-b,y=Math.abs(v),M=Math.max(h,1);let x;switch(n){case"signed":x=(v+255)/2;break;case"absolute":x=y;break;case"squared":x=v*v/255;break;case"relative_signed":x=(v/M+1)*127.5;break;case"relative_absolute":x=y/M*255;break;case"relative_squared":x=v*v/(M*M)*255;break}a.data[d+g]=Math.min(255,Math.max(0,Math.round(x)))}a.data[d+3]=255}return a}async function mt(e){const t=ra(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const a=o.getContext("2d");if(!a){n(null);return}a.drawImage(r,0,0);const s=a.getImageData(0,0,o.width,o.height);oa(e,s),n(s)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const aa={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},ia={linear:0,signed:1,positive:2},ca=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,la=`#version 300 es
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
}`;let Et=null,re=null,Ie=null,nn=null;function ua(){if(re)return re;try{if(typeof OffscreenCanvas<"u"?Et=new OffscreenCanvas(1,1):Et=document.createElement("canvas"),re=Et.getContext("webgl2",{preserveDrawingBuffer:!0}),!re)return console.warn("[cairn] WebGL 2 not available"),null;const e=re.createShader(re.VERTEX_SHADER);if(re.shaderSource(e,ca),re.compileShader(e),!re.getShaderParameter(e,re.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",re.getShaderInfoLog(e)),null;const t=re.createShader(re.FRAGMENT_SHADER);if(re.shaderSource(t,la),re.compileShader(t),!re.getShaderParameter(t,re.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",re.getShaderInfoLog(t)),null;if(Ie=re.createProgram(),re.attachShader(Ie,e),re.attachShader(Ie,t),re.linkProgram(Ie),!re.getProgramParameter(Ie,re.LINK_STATUS))return console.error("[cairn] WebGL program link:",re.getProgramInfoLog(Ie)),null;nn=re.createVertexArray(),re.bindVertexArray(nn);const n=re.createBuffer();re.bindBuffer(re.ARRAY_BUFFER,n),re.bufferData(re.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),re.STATIC_DRAW);const r=re.getAttribLocation(Ie,"a_pos");return re.enableVertexAttribArray(r),re.vertexAttribPointer(r,2,re.FLOAT,!1,0,0),re.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),re}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function Br(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function fa(e,t,n){const r=new Uint8Array(1024);for(let a=0;a<256;a++)r[a*4]=t[a*3],r[a*4+1]=t[a*3+1],r[a*4+2]=t[a*3+2],r[a*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function da(e,t,n,r){const o=ua();if(!o||!Ie||!nn||!Et)return null;const a=Math.min(e.width,t.width),s=Math.min(e.height,t.height);Et.width=a,Et.height=s,o.viewport(0,0,a,s);const l=Br(o,e,0),c=Br(o,t,1);let u=null;n.colormap?u=fa(o,n.colormap,2):(u=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,u),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(Ie),o.uniform1i(o.getUniformLocation(Ie,"u_baseline"),0),o.uniform1i(o.getUniformLocation(Ie,"u_other"),1),o.uniform1i(o.getUniformLocation(Ie,"u_lut"),2),o.uniform1i(o.getUniformLocation(Ie,"u_diff_mode"),aa[n.diffMode]),o.uniform1i(o.getUniformLocation(Ie,"u_cmap_mode"),ia[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(Ie,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(nn),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=a,r.height=s;const d=r.getContext("2d");return d&&(d.save(),d.scale(1,-1),d.drawImage(Et,0,0,a,s,0,-s,a,s),d.restore()),o.deleteTexture(l),o.deleteTexture(c),o.deleteTexture(u),{width:a,height:s}}const pa="cairn:render-mode";function ma(){try{const e=localStorage.getItem(pa);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const rn=15360;function on(e){const t=e&32768?-1:1,n=e>>10&31,r=e&1023;return n===0?r===0?t*0:t*r*2**-24:n===31?r===0?t*(1/0):NaN:t*2**(n-15)*(1+r/1024)}const Nr=globalThis.Float16Array;function Ir(e,t=e.length){if(Nr){const r=new Nr(e.buffer,e.byteOffset,t);return Float32Array.from(r)}const n=new Float32Array(t);for(let r=0;r<t;r++)n[r]=on(e[r]);return n}const nt=new Uint32Array(512),rt=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(nt[e]=0,nt[e|256]=32768,rt[e]=24,rt[e|256]=24):t<-14?(nt[e]=1024>>-t-14,nt[e|256]=1024>>-t-14|32768,rt[e]=-t-1,rt[e|256]=-t-1):t<=15?(nt[e]=t+15<<10,nt[e|256]=t+15<<10|32768,rt[e]=13,rt[e|256]=13):t<128?(nt[e]=31744,nt[e|256]=64512,rt[e]=24,rt[e|256]=24):(nt[e]=31744,nt[e|256]=64512,rt[e]=13,rt[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var Ft=Uint8Array,Fr=Uint16Array,ha=Int32Array,ga=new Ft([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),xa=new Ft([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),Gr=function(e,t){for(var n=new Fr(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new ha(n[30]),r=1;r<30;++r)for(var a=n[r];a<n[r+1];++a)o[a]=a-n[r]<<5|r;return{b:n,r:o}},Ur=Gr(ga,2),ba=Ur.b,va=Ur.r;ba[28]=258,va[258]=28,Gr(xa,0);for(var ya=new Fr(32768),Se=0;Se<32768;++Se){var ht=(Se&43690)>>1|(Se&21845)<<1;ht=(ht&52428)>>2|(ht&13107)<<2,ht=(ht&61680)>>4|(ht&3855)<<4,ya[Se]=((ht&65280)>>8|(ht&255)<<8)>>1}for(var sn=new Ft(288),Se=0;Se<144;++Se)sn[Se]=8;for(var Se=144;Se<256;++Se)sn[Se]=9;for(var Se=256;Se<280;++Se)sn[Se]=7;for(var Se=280;Se<288;++Se)sn[Se]=8;for(var wa=new Ft(32),Se=0;Se<32;++Se)wa[Se]=5;var Ea=new Ft(0),_a=typeof TextDecoder<"u"&&new TextDecoder,Ma=0;try{_a.decode(Ea,{stream:!0}),Ma=1}catch{}const zr=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function zn(e){const t=zr.length;return zr[(e%t+t)%t]}function Sa(e){const n=i.useRef(null),[r,o]=i.useState({w:0,h:0}),a=i.useRef(null),s=i.useRef(null),l=i.useRef(null),c=i.useCallback((u,d)=>{o(g=>g.w===u&&g.h===d?g:{w:u,h:d})},[]);return i.useLayoutEffect(()=>{const u=n.current;if(!u||u===l.current)return;const d=u.getBoundingClientRect();(d.width>0||d.height>0)&&(l.current=u,c(d.width,d.height))}),i.useEffect(()=>{var g;const u=n.current;if(u===s.current||((g=a.current)==null||g.disconnect(),a.current=null,s.current=u,!u))return;const d=new ResizeObserver(h=>{for(const b of h)c(b.contentRect.width,b.contentRect.height)});a.current=d,d.observe(u)}),i.useEffect(()=>()=>{var u;return(u=a.current)==null?void 0:u.disconnect()},[]),{ref:n,size:r}}function Aa(){const[e,t]=i.useState(!1);return i.useEffect(()=>{const n=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!0)},r=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const Ta=.001;function Ca(e,t=Ta){return Math.exp(-e*t)}function Vr(e,t){return Math.hypot(e.x-t.x,e.y-t.y)}function $r(e,t){return{x:(e.x+t.x)/2,y:(e.y+t.y)/2}}function Ra(e,t,n,r,o,a,s){const l=t>0&&r>0?r/t:1,c=Math.max(a,Math.min(s,e.zoom*l)),u=(n.x-e.pan.x)/e.zoom,d=(n.y-e.pan.y)/e.zoom;return{zoom:c,pan:{x:o.x-u*c,y:o.y-d*c}}}const Pa=.25,Vn=64;function $n(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return Vn;const o=Math.min(n/e,r/t);return o<=0?Vn:Math.max(Math.max(n,r)/o,8)}function Xr(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:a=Pa,maxZoom:s=Vn,naturalWidth:l,naturalHeight:c}=e,u=Aa(),d=i.useRef(u);d.current=u;const g=i.useRef({zoom:n,pan:r});g.current={zoom:n,pan:r};const h=i.useRef(o);h.current=o,i.useEffect(()=>{const S=t.current;if(!S||!o)return;const T=A=>{var ee;if(!A.ctrlKey&&!d.current)return;A.preventDefault(),A.stopPropagation();const C=Ca(A.deltaY),B=g.current,R=S.getBoundingClientRect(),N=l&&c?$n(l,c,R.width,R.height):s,I=Math.max(a,Math.min(N,B.zoom*C));if(B.zoom===I)return;const K=A.clientX-R.left,X=A.clientY-R.top,F=K-(K-B.pan.x)/B.zoom*I,z=X-(X-B.pan.y)/B.zoom*I;(ee=h.current)==null||ee.call(h,{zoom:I,pan:{x:F,y:z}})};return S.addEventListener("wheel",T,{passive:!1}),()=>S.removeEventListener("wheel",T)},[t,!!o,a,s,l,c]);const b=i.useRef(new Map),v=i.useRef(null),y=i.useRef(null),M=i.useCallback((S,T,A)=>{const C=S.getBoundingClientRect();return{x:T-C.left,y:A-C.top}},[]),x=i.useCallback(S=>{if(!l||!c)return s;const T=S.getBoundingClientRect();return $n(l,c,T.width,T.height)},[l,c,s]),m=i.useCallback((S,T)=>{const A=b.current,C=A.get(S),B=A.get(T);!C||!B||(v.current=null,y.current={idA:S,idB:T,startDist:Vr(C,B),startMid:$r(C,B),startZoom:g.current.zoom,startPan:{...g.current.pan}})},[]),p=i.useCallback(S=>{const T=b.current.get(S);T&&(v.current={pointerId:S,startX:T.x,startY:T.y,panX:g.current.pan.x,panY:g.current.pan.y})},[]),E=i.useCallback(S=>{if(!h.current)return;const T=S.pointerType==="touch";if(!T&&!d.current)return;const A=S.currentTarget;if(A.setPointerCapture(S.pointerId),b.current.set(S.pointerId,M(A,S.clientX,S.clientY)),T&&b.current.size>=2){const C=[...b.current.keys()];m(C[C.length-2],C[C.length-1]);return}p(S.pointerId)},[M,m,p]),_=i.useCallback(S=>{var R,N;const T=S.currentTarget,A=b.current.get(S.pointerId);if(A){const I=M(T,S.clientX,S.clientY);A.x=I.x,A.y=I.y}const C=y.current;if(C){const I=b.current.get(C.idA),K=b.current.get(C.idB);if(!I||!K)return;const X=Ra({zoom:C.startZoom,pan:C.startPan},C.startDist,C.startMid,Vr(I,K),$r(I,K),a,x(T));(R=h.current)==null||R.call(h,X);return}const B=v.current;!B||B.pointerId!==S.pointerId||!A||(N=h.current)==null||N.call(h,{zoom:g.current.zoom,pan:{x:B.panX+(A.x-B.startX),y:B.panY+(A.y-B.startY)}})},[M,a,x]),w=i.useCallback(S=>{var A;try{S.currentTarget.releasePointerCapture(S.pointerId)}catch{}b.current.delete(S.pointerId);const T=y.current;if(T&&(S.pointerId===T.idA||S.pointerId===T.idB)){y.current=null;const C=[...b.current.keys()];C.length===1&&p(C[0]);return}((A=v.current)==null?void 0:A.pointerId)===S.pointerId&&(v.current=null)},[p]);return{containerProps:{onPointerDown:E,onPointerMove:_,onPointerUp:w,onPointerCancel:w,style:{cursor:u&&!!o?"move":void 0,touchAction:o?"none":void 0}},modifierActive:u}}function Xn(){const[e,t]=i.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return i.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),a())};function a(){if(n)return;const s=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${s}dppx)`),r.addEventListener("change",o,{once:!0})}return a(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function Fe(e){const t=i.useRef(e),[n,r]=i.useState(e),o=i.useCallback(()=>r(t.current),[]);return[n,r,{reset:o,isModified:!Object.is(n,t.current),default:t.current}]}function Da(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function Wr(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function Wn({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:a}=Sa(),s=i.useRef(null),l=i.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),c=i.useMemo(()=>{const y=a.w,M=a.h;if(y<=0||M<=0||n<=0||r<=0)return null;const x=Math.min(y/n,M/r),m=n*x,p=r*x;return{left:(y-m)/2,top:(M-p)/2,width:m,height:p}},[a.w,a.h,n,r]),u=e.masks,d=t.showMasks&&!!u&&u.length>0,g=i.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(i.useEffect(()=>{if(!d||!u)return;const y=s.current;if(!y)return;(y.width!==n||y.height!==r)&&(y.width=n,y.height=r);const M=y.getContext("2d");if(!M)return;M.clearRect(0,0,y.width,y.height);let x=!1;const m=M.createImageData(n,r),p=m.data;let E=u.length,_=!1;const w=()=>{x||_&&M.putImageData(m,0,0)},P=document.createElement("canvas");P.width=n,P.height=r;const S=P.getContext("2d",{willReadFrequently:!0});for(const T of u){const A=new Image;A.onload=()=>{if(!x){if(S){S.clearRect(0,0,n,r),S.drawImage(A,0,0,n,r);const C=S.getImageData(0,0,n,r).data;for(let B=0;B<n*r;B++){const R=C[B*4];if(R===0||l.has(R))continue;const[N,I,K]=Da(zn(R));p[B*4]=N,p[B*4+1]=I,p[B*4+2]=K,p[B*4+3]=255,_=!0}}E-=1,E===0&&w()}},A.onerror=()=>{E-=1,E===0&&w()},A.src=`data:image/png;base64,${T.png_b64}`}return()=>{x=!0}},[d,u,n,r,g]),!c)return f.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const h=e.boxes??[],b=t.showBoxes&&h.length>0,v=e.class_labels??{};return f.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[d&&f.jsx("canvas",{ref:s,className:"absolute",style:{left:c.left,top:c.top,width:c.width,height:c.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),b&&f.jsx("svg",{className:"absolute",style:{left:c.left,top:c.top,width:c.width,height:c.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:h.map((y,M)=>{if(!Wr(y,t,l))return null;const x=y.domain==="pixel"?1:n,m=y.domain==="pixel"?1:r,p=y.position.minX*x,E=y.position.minY*m,_=(y.position.maxX-y.position.minX)*x,w=(y.position.maxY-y.position.minY)*m;return f.jsx("rect",{x:p,y:E,width:_,height:w,fill:"none",stroke:zn(y.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},M)})}),b&&f.jsx("div",{className:"absolute",style:{left:c.left,top:c.top,width:c.width,height:c.height},children:h.map((y,M)=>{if(!Wr(y,t,l))return null;const x=y.domain==="pixel"?1/n:1,m=y.domain==="pixel"?1/r:1,p=y.position.minX*x*100,E=y.position.minY*m*100,_=y.label??v[String(y.class_id)]??`#${y.class_id}`,w=y.score!=null?` ${(y.score*100).toFixed(0)}%`:"";return!_&&!w?null:f.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${p}%`,top:`${E}%`,transform:"translateY(-100%)",backgroundColor:zn(y.class_id)},children:f.jsxs("span",{className:"mono",children:[_,w]})},M)})})]})}function ka(e,t){const n=t==null?void 0:t.precision,r=La(e,n);return t!=null&&t.minus?r.replace("-","−"):r}function La(e,t){if(!Number.isFinite(e))return String(e);if(e===0)return"0";const n=Math.abs(e);return n>=1e3||n<.001?e.toExponential(Math.max(0,t-2)):Number(e.toPrecision(t)).toString()}const Oa={x:0,y:0,w:1,h:1};function an(e){const t=e.sourceWindow??Oa,n=t.x*e.naturalWidth,r=t.y*e.naturalHeight,o=t.w*e.naturalWidth,a=t.h*e.naturalHeight,s=Math.min(e.box.width/o,e.box.height/a),l=o*s,c=a*s;return{scale:s,imgLeft:e.box.left+(e.box.width-l)/2,imgTop:e.box.top+(e.box.height-c)/2,srcOriginX:n,srcOriginY:r,visibleW:o,visibleH:a}}function Ba(e){return an(e).scale}function Hr(e,t,n){const r=an(n);return{x:r.srcOriginX+(e-r.imgLeft)/r.scale,y:r.srcOriginY+(t-r.imgTop)/r.scale}}function Yr(e,t,n){const r=an(n);return{x:r.imgLeft+(e-r.srcOriginX)*r.scale,y:r.imgTop+(t-r.srcOriginY)*r.scale}}function Na(e,t){const n=Yr(e.x0,e.y0,t),r=Yr(e.x1+1,e.y1+1,t);return{left:n.x,top:n.y,width:r.x-n.x,height:r.y-n.y}}function Kr(e,t,n,r,o){const a=Hr(e,t,o),s=Hr(n,r,o),l=o.naturalWidth-1,c=o.naturalHeight-1,u=Math.min(a.x,s.x),d=Math.max(a.x,s.x),g=Math.min(a.y,s.y),h=Math.max(a.y,s.y);return d<0||u>l||h<0||g>c?null:{x0:Kt(u,0,l),y0:Kt(g,0,c),x1:Kt(d,0,l),y1:Kt(h,0,c)}}const cn=30,Ia=.14,qr=1.15,Fa=.62,Ga=4,Ua=24,za=6;function Va(e,t,n=Ga){if(e<=0||t<=0)return 0;const r=Math.max(1,n),o=e*(1-2*Ia),a=o/(t*qr),s=o/(r*Fa);return Math.min(a,s,Ua)}function $a(e){return e>=cn}const ln=["#ff5a5a","#39d353","#5b9bff"],Xa="#ffffff",Wa="rgba(0,0,0,0.9)",Ha=.15,Ya=.06;function Hn(e){return ka(e,{precision:3})}function Lt(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):Hn(e/255):Hn(n==="int"?e*255:e)}function _t(e,t,n){return e.length===1?{lines:[Lt(e[0],t,n)]}:{lines:e.map(r=>Lt(r,t,n)),colors:e.map((r,o)=>ln[o]??null)}}const Ka={x:0,y:0,w:1,h:1};function Mt({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:a,notation:s="decimal",version:l=0,onActiveChange:c,sourceWindow:u=Ka}){const d=i.useRef(null),g=i.useRef(!1),h=Xn(),b=i.useRef(c);b.current=c;const v=i.useCallback(M=>{var x;M!==g.current&&(g.current=M,(x=b.current)==null||x.call(b,M))},[]),y=i.useCallback(()=>{var j;const M=d.current,x=e.current;if(!M)return;const m=window.devicePixelRatio||1,p=M.clientWidth,E=M.clientHeight;if(p===0||E===0)return;M.width!==Math.round(p*m)&&(M.width=Math.round(p*m)),M.height!==Math.round(E*m)&&(M.height=Math.round(E*m));const _=M.getContext("2d");if(!_)return;if(_.setTransform(m,0,0,m,0,0),_.clearRect(0,0,p,E),!x||t<=0||n<=0){v(!1);return}const w=x.getBoundingClientRect(),P=M.getBoundingClientRect();if(w.width===0||w.height===0){v(!1);return}const T=an({box:w,naturalWidth:t,naturalHeight:n,sourceWindow:u}),{srcOriginX:A,srcOriginY:C,visibleW:B,visibleH:R,scale:N}=T;if(B<=0||R<=0){v(!1);return}if(!$a(N)){v(!1);return}const I=T.imgLeft-P.left,K=T.imgTop-P.top,X=Math.max(Math.floor(A),Math.floor(A+(0-I)/N)),F=Math.min(Math.ceil(A+B),Math.ceil(A+(p-I)/N)),z=Math.max(Math.floor(C),Math.floor(C+(0-K)/N)),ee=Math.min(Math.ceil(C+R),Math.ceil(C+(E-K)/N));if(F<=X||ee<=z){v(!1);return}const ce=[];let ae=1,pe=1;for(let te=z;te<ee;te++)for(let ne=X;ne<F;ne++){if(ne<0||te<0||ne>=t||te>=n)continue;const oe=a(ne,te,s);if(!(!oe||oe.lines.length===0)){oe.lines.length>pe&&(pe=oe.lines.length);for(const me of oe.lines)me.length>ae&&(ae=me.length);ce.push({px:ne,py:te,s:oe})}}if(ce.length===0){v(!1);return}const fe=Va(N,pe,ae);if(fe<za){v(!1);return}v(!0);const k=I+(0-A)*N,G=K+(0-C)*N,Z=I+(t-A)*N,W=K+(n-C)*N;_.save(),_.beginPath(),_.rect(k,G,Z-k,W-G),_.clip(),_.textAlign="center",_.textBaseline="middle";const le=fe*qr;_.font=`${fe}px ui-monospace, SFMono-Regular, Menlo, monospace`,_.shadowColor=Wa,_.shadowBlur=Math.max(2,fe*Ha),_.shadowOffsetX=0,_.shadowOffsetY=Math.max(1,fe*Ya);for(const{px:te,py:ne,s:oe}of ce){const me=oe.lines.length,Re=I+(te-A+.5)*N;let Pe=K+(ne-C+.5)*N-me*le/2+le/2;for(let Te=0;Te<oe.lines.length;Te++){const _e=oe.lines[Te];_.fillStyle=((j=oe.colors)==null?void 0:j[Te])??Xa,_.fillText(_e,Re,Pe),Pe+=le}}_.restore()},[e,t,n,a,s,v,u]);return i.useEffect(()=>{y()},[y,r,o.x,o.y,l,s,u,h]),i.useEffect(()=>{const M=d.current;if(!M)return;const x=new ResizeObserver(()=>y());return x.observe(M),()=>x.disconnect()},[y]),f.jsx("canvas",{ref:d,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function Zr({notation:e,onChange:t,className:n=""}){return f.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const qa=`
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
`,We=`
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
`,St=`
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
`,Gt=`
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
`,Za=`
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
`,un=`
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
`;function jr(e){return`
${We}
${St}
${Za}

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
`}const ja=jr("select(colorB, colorA, uv.x < split)"),Qa=jr("mix(colorA, colorB, alpha)");function Ja(e){switch(e){case"center":return{v:"center",h:"center"};case"top-right":return{v:"top",h:"right"};case"bottom-left":return{v:"bottom",h:"left"};case"bottom-right":return{v:"bottom",h:"right"};case"top-left":default:return{v:"top",h:"left"}}}function Qr(e,t,n){const{v:r,h:o}=Ja(n),a=e.w-t.w,s=e.h-t.h,l=o==="left"?0:o==="right"?a:Math.floor(a/2),c=r==="top"?0:r==="bottom"?s:Math.floor(s/2);return{x:l,y:c}}function Ut(e,t,n,r,o="b"){if(r==="fill"){const s=o==="a"?{w:e.w,h:e.h}:{w:t.w,h:t.h};return{fit:r,result:s,offsetA:{x:0,y:0},offsetB:{x:0,y:0}}}const a={w:Math.min(e.w,t.w),h:Math.min(e.h,t.h)};return{fit:r,result:a,offsetA:Qr(e,a,n),offsetB:Qr(t,a,n)}}function Yn(e){return`${e.fit}:${e.result.w}x${e.result.h}:${e.offsetA.x},${e.offsetA.y}:${e.offsetB.x},${e.offsetB.y}`}const fn={linear:0,srgb:1,reinhard:2,aces:3,extended:4,"extended-reinhard":5,"extended-aces":6,"extended-clamp":7,gamma:8},Jr=new WeakMap;function ei(e,t){let n=Jr.get(e);n||(n=new Map,Jr.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:qa,targetFormat:t}),n.set(t,r)),r}function eo(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function to(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function ti(e,t,n,r){var x;const o=eo(t),a=ei(e,o),s=to(e,r.isScalar?r.colormap:void 0),l=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,c=fn[r.operator]??fn.srgb,u=new Float32Array([r.exposureEV,c,l,r.isScalar?1:0]),d=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),g=new Float32Array([r.hdrOut?1:0]),h=new Float32Array([r.filter==="nearest"?0:1]),b=new Float32Array([r.offset??0]),v=new Float32Array([r.peak??qt]),y=new Float32Array([r.srgbDecode?1:0]);let M;try{M=e.createBindGroup(a,[{binding:0,resource:n},{binding:1,resource:s},{binding:2,resource:{uniform:u}},{binding:3,resource:{uniform:d}},{binding:4,resource:{uniform:g}},{binding:5,resource:{uniform:h}},{binding:6,resource:{uniform:b}},{binding:7,resource:{uniform:v}},{binding:8,resource:{uniform:y}}]),e.renderFullscreen(t,a,M)}finally{(x=M==null?void 0:M.destroy)==null||x.call(M),s.destroy()}}const no=new WeakMap;function ni(e,t,n){let r=no.get(e);r||(r=new Map,no.set(e,r));const o=`${t}:${n}`;let a=r.get(o);return a||(a=e.createRenderPipeline({shaderWGSL:t==="split"?ja:Qa,targetFormat:n}),r.set(o,a)),a}function ri(e,t,n,r,o){var y;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const a=eo(t),s=ni(e,o.mode,a),l=to(e,o.isScalar?o.colormap:void 0),c=typeof o.gamma=="number"&&o.gamma>0?o.gamma:0,u=fn[o.operator]??fn.srgb,d=new Float32Array([o.exposureEV,u,c,o.isScalar?1:0]),g=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),h=new Float32Array([o.split,o.alpha,o.hdrOut?1:0,o.filter==="nearest"?0:1]),b=new Float32Array([o.offset??0,o.peak??qt,o.srgbDecodeA?1:0,o.srgbDecodeB?1:0]);let v;try{v=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:l},{binding:3,resource:{uniform:d}},{binding:4,resource:{uniform:g}},{binding:5,resource:{uniform:h}},{binding:6,resource:{uniform:b}}]),e.renderFullscreen(t,s,v)}finally{(y=v==null?void 0:v.destroy)==null||y.call(v),l.destroy()}}function ro(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,a=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:a,mae:o}}async function oo(e,t,n,r){const o=r??Ut({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),a=o.result.w,s=o.result.h,l=a*s*3;if(l<=0)return{mse:0,psnr:1/0,mae:0};if(o.fit==="crop"&&o.offsetA.x===0&&o.offsetA.y===0&&o.offsetB.x===0&&o.offsetB.y===0&&e.reduceDiffSumSquaredAbs){const{sumSq:p,sumAbs:E}=await e.reduceDiffSumSquaredAbs(t,n,a,s);return ro(p,E,l)}const u=await e.readback(t),d=await e.readback(n),g=u instanceof Uint8Array?255:1,h=d instanceof Uint8Array?255:1,b=dn(u,t.width,t.height,g,o.offsetA,o.fit==="fill",a,s),v=dn(d,n.width,n.height,h,o.offsetB,o.fit==="fill",a,s);let y=0,M=0;const x=[0,0,0],m=[0,0,0];for(let p=0;p<s;p++)for(let E=0;E<a;E++){b(E,p,x),v(E,p,m);for(let _=0;_<3;_++){const w=x[_]-m[_];y+=w*w,M+=Math.abs(w)}}return ro(y,M,l)}function dn(e,t,n,r,o,a,s,l){const c=(g,h,b)=>e[(h*t+g)*4+b]??0;if(!a)return(g,h,b)=>{const v=Math.min(Math.max(g+o.x,0),t-1),y=Math.min(Math.max(h+o.y,0),n-1);b[0]=c(v,y,0)/r,b[1]=c(v,y,1)/r,b[2]=c(v,y,2)/r};const u=t-1,d=n-1;return(g,h,b)=>{const v=(g+.5)/s,y=(h+.5)/l,M=v*t-.5,x=y*n-.5,m=Math.floor(M),p=Math.floor(x),E=M-m,_=x-p,w=Math.min(Math.max(m,0),u),P=Math.min(Math.max(m+1,0),u),S=Math.min(Math.max(p,0),d),T=Math.min(Math.max(p+1,0),d);for(let A=0;A<3;A++){const C=c(w,S,A),B=c(P,S,A),R=c(w,T,A),N=c(P,T,A),I=C+(B-C)*E,K=R+(N-R)*E;b[A]=(I+(K-I)*_)/r}}}function so(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const oi=12,gt=[];function ao(e){const t=gt.indexOf(e);t!==-1&&gt.splice(t,1),gt.push(e)}function si(e){const t=gt.indexOf(e);t!==-1&&gt.splice(t,1)}function pn(e){e.parked||(si(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),e.surface=null,e.parked=!0)}function io(e){for(;gt.length>oi;){const t=gt.find(n=>n!==e&&!n.visible)??gt.find(n=>n!==e);if(!t)break;pn(t)}}function co(e){var o,a,s,l;if(e.disposed)return;if(so())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){ao(e),io(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||((a=e.deep)==null?void 0:a.width)||1,r=e.backingHeight||((s=e.source)==null?void 0:s.height)||((l=e.deep)==null?void 0:l.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.deep){const c=t.createTexture(e.deep.width,e.deep.height,"rgba16float");e.srcTexture=c,e.deepBuffers=t.createDeepSampleBuffers(e.deep),t.compositeDeep(e.deepBuffers,c,e.deepZNear,e.deepZFar)}else if(e.source){const c=t.createTexture(e.source.width,e.source.height,e.source.format);c.write(e.source.data),e.srcTexture=c}e.parked=!1,ao(e),io(e)}function ai(e,t){if(e.disposed||!e.source&&!e.deep)return!0;try{return co(e),!e.surface||!e.srcTexture?!1:(ti(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,pn(e),!1}}function ii(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,e.deep=null,e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},setDeepSource(t,n,r){if(!e.disposed&&(e.deep=t,e.deepZNear=n,e.deepZFar=r,e.source=null,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy(),e.deepBuffers&&e.deepBuffers.destroy();const o=e.device.createTexture(t.width,t.height,"rgba16float");e.srcTexture=o,e.deepBuffers=e.device.createDeepSampleBuffers(t),e.device.compositeDeep(e.deepBuffers,o,n,r)}},setDeepWindow(t,n){e.disposed||(e.deepZNear=t,e.deepZFar=n,!e.parked&&e.deepBuffers&&e.srcTexture&&e.device.compositeDeep(e.deepBuffers,e.srcTexture,t,n))},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return ai(e,t)},park(){e.disposed||pn(e)},restore(){e.disposed||!e.source&&!e.deep||co(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(pn(e),e.source=null,e.deep=null,e.disposed=!0)}}}async function ci(e,t){const n=await Yt(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,deep:null,deepZNear:-1/0,deepZFar:1/0,deepBuffers:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return ii(r)}function lo(e){e.dispose()}function uo({title:e,body:t,className:n}){return f.jsx("div",{className:n??"relative h-full w-full",children:f.jsxs("div",{className:"flex h-full w-full flex-col items-center justify-center gap-1 rounded bg-bg-hover p-4 text-center",children:[f.jsx("div",{className:"text-sm font-semibold text-fg",children:e}),f.jsx("div",{className:"text-xs text-fg-muted",children:t})]})})}function li(e,t,n){return t<=0||n<=0||e.width<=0||e.height<=0?0:Math.min(e.width/t,e.height/n)}function ui(e,t){return e>=t?"pixelated":void 0}function fi(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:a}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...a?["invert(1)"]:[]].join(" ")}function fo(e){const n=`cairn-gamma-${i.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:a,exposure:s,offset:l,flipSign:c}=e,u=i.useMemo(()=>fi(e,n),[n,r,o,s,c]);return{gammaFilterId:n,filterStr:u,gamma:a,offset:l}}function po({id:e,gamma:t,offset:n}){return f.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:f.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:f.jsxs("feComponentTransfer",{children:[f.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),f.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),f.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}const di=["nw","n","ne","e","se","s","sw","w"];function pi(e,t,n,r,o,a=1){const s=o.w-1,l=o.h-1,c=Math.round(n),u=Math.round(r);if(t==="move"){const m=e.x1-e.x0,p=e.y1-e.y0,E=wt(e.x0+c,0,s-m),_=wt(e.y0+u,0,l-p);return{x0:E,y0:_,x1:E+m,y1:_+p}}let{x0:d,y0:g,x1:h,y1:b}=e;const v=t==="nw"||t==="w"||t==="sw",y=t==="ne"||t==="e"||t==="se",M=t==="nw"||t==="n"||t==="ne",x=t==="sw"||t==="s"||t==="se";return v&&(d=wt(d+c,0,h-(a-1))),y&&(h=wt(h+c,d+(a-1),s)),M&&(g=wt(g+u,0,b-(a-1))),x&&(b=wt(b+u,g+(a-1),l)),{x0:d,y0:g,x1:h,y1:b}}function mo(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function mi({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=mo(e),a=mo(t),s=[];for(let m=0;m<=e;m+=o)s.push(m);const l=[];for(let m=0;m<=t;m+=a)l.push(m);const c=1/n,u=8*c,d=-12*c,g=-2*c,h=r==null?void 0:r.current;let b=0,v=0,y=0,M=0;if(h){const m=h.clientWidth,p=h.clientHeight,E=m/e,_=p/t,w=Math.min(E,_);y=e*w,M=t*w,b=(m-y)/2,v=(p-M)/2}const x=h&&y>0;return f.jsxs(f.Fragment,{children:[f.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:x?v:0,transform:`translateY(${d}px)`,fontSize:u},children:s.map(m=>f.jsx("span",{className:"mono",style:{position:"absolute",left:x?b+m/e*y:`${m/e*100}%`,transform:"translateX(-50%)"},children:m},m))}),f.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:x?b:0,transform:`translateX(${g}px)`,fontSize:u},children:l.map(m=>f.jsx("span",{className:"mono",style:{position:"absolute",top:x?v+m/t*M:`${m/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*c}px`},children:m},m))})]})}function Kn({label:e,corner:t="bottom-left",isDraggable:n=!1,grip:r=n,onDragStart:o}){const a=t==="bottom-right"?"bottom-1 right-1":"bottom-1 left-1";return f.jsxs("span",{className:`absolute ${a} z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${n?" cairn-drag-grip":""}`,draggable:n,onDragStart:o,style:{cursor:n?"grab":void 0},children:[r&&f.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const hi=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function ho(e,t){const n=getComputedStyle(e),r=hi.map(c=>`${c}:${n.getPropertyValue(c)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const a=e.children,s=t.children,l=Math.min(a.length,s.length);for(let c=0;c<l;c++)ho(a[c],s[c])}function qn(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function Zn(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function jn(e,t,n,r,o){const a=document.createElement("canvas");a.width=Math.max(1,Math.round(e*n)),a.height=Math.max(1,Math.round(t*n));const s=a.getContext("2d");if(!s)throw new Error("plot-to-png: 2D canvas context unavailable");return s.scale(n,n),r&&(s.fillStyle=r,s.fillRect(0,0,e,t)),o(s),await new Promise((l,c)=>a.toBlob(u=>u?l(u):c(new Error("plot-to-png: toBlob returned null")),"image/png"))}function gi(e,t,n){const r=e.cloneNode(!0);ho(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),a="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((s,l)=>{const c=new Image;c.onload=()=>s(c),c.onerror=()=>l(new Error("plot-to-png: SVG rasterization failed")),c.src=a})}async function go(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,a=(t==null?void 0:t.background)??qn(e);return jn(r,o,Zn(t),a,s=>s.drawImage(e,0,0,r,o))}async function xi(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,a=(t==null?void 0:t.background)??qn(e);try{return await jn(r,o,Zn(t),a,s=>s.drawImage(e,0,0,r,o))}catch(s){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${s instanceof Error?s.message:String(s)})`)}}function bi(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const a=o.getBoundingClientRect(),s=a.width*a.height;s>r&&(r=s,n=o)}return n}async function vi(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),a=o.width||300,s=o.height||150,l=(t==null?void 0:t.background)??qn(e);if(n){const u=n.getBoundingClientRect(),d=await gi(n,u.width||a,u.height||s);return jn(a,s,Zn(t),l,g=>{for(const h of r){const b=h.getBoundingClientRect();g.drawImage(h,b.left-o.left,b.top-o.top,b.width,b.height)}g.drawImage(d,u.left-o.left,u.top-o.top,u.width,u.height)})}if(r.length)return go(r[0],t);const c=bi(e);if(c)return xi(c,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function yi(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const wi=8;function Ei(e,t,n,r=wi){return!(t>0)||!(e>0)?n:e<t+r}function xo(e,t){return Math.max(0,e.findIndex(n=>n.id===t))}function _i(e){const t=e.trim();if(t==="")return null;const n=t.replace(/−/g,"-").replace(",","."),r=/^([+-]?)(inf(?:inity)?|∞)$/i.exec(n);if(r)return r[1]==="-"?-1/0:1/0;const o=Number(n);return Number.isNaN(o)?null:o}function Mi(e,t){const n=_i(e);return n===null?t:n}function Si(e){return String(e)}const Ai={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},Ti={boxZoom:f.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:f.jsxs(f.Fragment,{children:[f.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),f.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),f.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),f.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 2v20M2 12h20"}),f.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),f.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),f.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:f.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:f.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),f.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:f.jsx("path",{d:"M6 9l6 6 6-6"}),ellipsis:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"5",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),f.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),f.jsx("circle",{cx:"19",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"})]}),sun:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"12",cy:"12",r:"4"}),f.jsx("path",{d:"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"})]}),plusminus:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M4 7h6M7 4v6"}),f.jsx("path",{d:"M14 17h6"}),f.jsx("path",{d:"M6 20l12-16"})]}),layers:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 3l9 5-9 5-9-5 9-5z"}),f.jsx("path",{d:"M3 13l9 5 9-5"})]})};function ct({name:e}){return f.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:Ti[e]??null})}function bo({icon:e,label:t,title:n,active:r,disabled:o,onClick:a}){return f.jsx("button",{type:"button",disabled:o,onClick:s=>{s.stopPropagation(),!o&&a()},onPointerDown:s=>s.stopPropagation(),onDoubleClick:s=>s.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?f.jsx("span",{"aria-hidden":"true",children:t}):f.jsx(ct,{name:e??""})})}function vo(){return f.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function yo(e,t,n){const r=i.useRef(n);r.current=n,i.useEffect(()=>{if(!e)return;const o=s=>{t.current&&!t.current.contains(s.target)&&r.current()},a=s=>{s.key==="Escape"&&(s.stopPropagation(),r.current())};return document.addEventListener("pointerdown",o,!0),document.addEventListener("keydown",a,!0),()=>{document.removeEventListener("pointerdown",o,!0),document.removeEventListener("keydown",a,!0)}},[e,t])}function Ci({icon:e,title:t,menu:n}){var M;const{options:r,value:o,onSelect:a}=n,[s,l]=i.useState(!1),[c,u]=i.useState(0),d=i.useRef(null),g=xo(r,o),h=e?void 0:((M=r[g])==null?void 0:M.label)??"",b=i.useCallback(()=>{l(x=>{const m=!x;return m&&u(g),m})},[g]),v=i.useCallback(x=>{a(x),l(!1)},[a]);yo(s,d,()=>l(!1));const y=x=>{if(!s){(x.key==="ArrowDown"||x.key==="Enter"||x.key===" ")&&(x.preventDefault(),u(g),l(!0));return}if(x.key==="ArrowDown")x.preventDefault(),u(m=>(m+1)%r.length);else if(x.key==="ArrowUp")x.preventDefault(),u(m=>(m-1+r.length)%r.length);else if(x.key==="Enter"||x.key===" "){x.preventDefault();const m=r[c];m&&v(m.id)}};return f.jsxs("div",{ref:d,className:"relative inline-flex",onPointerDown:x=>x.stopPropagation(),children:[f.jsxs("button",{type:"button",onClick:x=>{x.stopPropagation(),b()},onDoubleClick:x=>x.stopPropagation(),onKeyDown:y,"aria-haspopup":"listbox","aria-expanded":s,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",h?"px-1.5 text-[10px] font-mono":"px-1 text-xs",s?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[h?f.jsx("span",{"aria-hidden":"true",children:h}):f.jsx(ct,{name:e??""}),f.jsx(ct,{name:"caret"})]}),s&&f.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((x,m)=>{const p=x.id===o,E=m===c;return f.jsx("li",{role:"option","aria-selected":p,children:f.jsx("button",{type:"button",onClick:_=>{_.stopPropagation(),v(x.id)},onPointerEnter:()=>u(m),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",E?"bg-bg-hover":"",p?"text-accent font-medium":"text-fg"].join(" "),children:x.label})},x.id)})})]})}const Ri=e=>e.format?e.format(e.value):String(e.value);function wo({spec:e}){const[t,n]=i.useState(!1),[r,o]=i.useState(""),a=i.useRef(null),s=i.useCallback(()=>{o(Si(e.value)),n(!0)},[e.value]);i.useEffect(()=>{t&&a.current&&(a.current.focus(),a.current.select())},[t]);const l=i.useCallback(()=>{n(u=>(u&&e.onChange(Mi(r,e.value)),!1))},[r,e]),c=i.useCallback(()=>n(!1),[]);return f.jsxs("label",{className:"inline-flex items-center gap-1 text-fg-muted",title:e.title,onPointerDown:u=>u.stopPropagation(),onDoubleClick:u=>{u.stopPropagation(),t||s()},children:[e.icon?f.jsx("span",{"aria-hidden":"true",className:"inline-flex",children:f.jsx(ct,{name:e.icon})}):f.jsx("span",{"aria-hidden":"true",className:"text-[9px] font-mono",children:e.label}),t?f.jsx("input",{ref:a,type:"text",inputMode:"decimal","aria-label":`${e.title} (numeric entry)`,value:r,onChange:u=>o(u.target.value),onPointerDown:u=>u.stopPropagation(),onDoubleClick:u=>u.stopPropagation(),onKeyDown:u=>{u.stopPropagation(),u.key==="Enter"?(u.preventDefault(),l()):u.key==="Escape"&&(u.preventDefault(),c())},onBlur:l,className:"cairn-plot-toolbar-slider-entry h-3.5 w-[6.5rem] rounded border border-border bg-bg px-1 text-[9px] font-mono tabular-nums text-fg outline-none focus:border-accent"}):f.jsxs(f.Fragment,{children:[f.jsx("input",{type:"range","aria-label":e.title,min:e.min,max:e.max,step:e.step,value:e.value,onChange:u=>e.onChange(Number(u.target.value)),onPointerDown:u=>u.stopPropagation(),className:"cairn-plot-toolbar-slider h-1 w-16 cursor-pointer accent-accent"}),f.jsx("span",{"aria-hidden":"true",className:"w-8 text-right text-[9px] font-mono tabular-nums",children:Ri(e)})]})]})}function Pi({icon:e,title:t,menu:n,onClose:r}){var g;const{options:o,value:a,onSelect:s}=n,[l,c]=i.useState(!1),u=xo(o,a),d=((g=o[u])==null?void 0:g.label)??"";return f.jsxs("div",{children:[f.jsxs("button",{type:"button","aria-haspopup":"menu","aria-expanded":l,"aria-label":t,onClick:h=>{h.stopPropagation(),c(b=>!b)},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",l?"text-accent":"text-fg hover:bg-bg-hover"].join(" "),children:[e?f.jsx(ct,{name:e}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{className:"flex-1",children:t}),f.jsx("span",{className:"font-mono text-[10px] text-fg-muted",children:d}),f.jsx("span",{className:l?"rotate-180 transition-transform":"transition-transform",children:f.jsx(ct,{name:"caret"})})]}),l&&o.map(h=>{const b=h.id===a;return f.jsxs("button",{type:"button",role:"menuitemradio","aria-checked":b,"data-menu-option":"",onClick:v=>{v.stopPropagation(),s(h.id),r()},className:["flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-[11px]",b?"text-accent font-medium bg-bg-hover/40":"text-fg hover:bg-bg-hover"].join(" "),children:[f.jsx("span",{"aria-hidden":"true",className:"w-3 text-center text-accent",children:b?"✓":""}),f.jsx("span",{children:h.label})]},h.id)})]})}function Di({actions:e,leading:t,sliders:n}){const[r,o]=i.useState(!1),a=i.useRef(null);return yo(r,a,()=>o(!1)),f.jsxs("div",{ref:a,className:"relative inline-flex",onPointerDown:s=>s.stopPropagation(),children:[f.jsx("button",{type:"button",onClick:s=>{s.stopPropagation(),o(l=>!l)},onDoubleClick:s=>s.stopPropagation(),"aria-haspopup":"menu","aria-expanded":r,"aria-label":"More controls",title:"More controls",className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded text-xs",r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:f.jsx(ct,{name:"ellipsis"})}),r&&f.jsxs("div",{role:"menu",className:["absolute right-0 top-full z-40 mt-1 min-w-[10rem] max-h-80 overflow-auto","rounded border border-border bg-bg-elevated py-1 shadow-md"].join(" "),children:[t.map(s=>s.menu?f.jsx(Pi,{icon:s.icon,title:s.title,menu:s.menu,onClose:()=>o(!1)},s.id):f.jsxs("button",{type:"button",disabled:s.disabled,onClick:l=>{var c;l.stopPropagation(),!s.disabled&&((c=s.onClick)==null||c.call(s),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?f.jsx(ct,{name:s.icon}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{children:s.label??s.title})]},s.id)),t.length>0&&e.length>0&&f.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),e.map(s=>f.jsxs("button",{type:"button",role:"menuitem",disabled:s.disabled,onClick:l=>{l.stopPropagation(),!s.disabled&&(s.onClick(),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?f.jsx(ct,{name:s.icon}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{children:s.title})]},s.id)),n.length>0&&(e.length>0||t.length>0)&&f.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),n.map(s=>f.jsx("div",{className:"px-2 py-1",children:f.jsx(wo,{spec:s})},s.id))]})]})}function ki({controller:e,config:t}){var C,B;const n=i.useRef(null),[r,o]=i.useState(!1),a=i.useRef(r);a.current=r;const s=i.useRef(0),l=`${((C=t==null?void 0:t.leadingButtons)==null?void 0:C.length)??0}:${((B=t==null?void 0:t.sliders)==null?void 0:B.length)??0}:${(t==null?void 0:t.visibility)??"hover"}`;if(i.useEffect(()=>{const R=n.current,N=R==null?void 0:R.parentElement;if(!N)return;const I=()=>{const z=N.clientWidth;if(!a.current&&n.current){const ee=n.current.scrollWidth;ee>0&&(s.current=ee)}o(Ei(z,s.current,a.current))};let K=0;const X=()=>{K||(K=requestAnimationFrame(()=>{K=0,I()}))},F=new ResizeObserver(X);return F.observe(N),I(),()=>{F.disconnect(),K&&cancelAnimationFrame(K)}},[l]),(t==null?void 0:t.enabled)===!1)return null;const c=e.capabilities,u=t==null?void 0:t.buttons,d=(R,N)=>N&&(u==null?void 0:u[R])!==!1,g=R=>()=>e.setDragMode(R),h=()=>{e.toPNG({filename:"plot"}).then(R=>yi(R,"plot.png")).catch(()=>{})},b=[];d("zoom",c.zoom)&&b.push({id:"zoom",icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:g("zoom")}),d("pan",c.pan)&&b.push({id:"pan",icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:g("pan")}),d("select",c.select)&&b.push({id:"select",icon:"select",title:"Box select",active:e.dragMode==="select",onClick:g("select")}),d("lasso",c.lasso)&&b.push({id:"lasso",icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:g("lasso")});const v=[];d("zoomIn",c.zoom)&&v.push({id:"zoomIn",icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),d("zoomOut",c.zoom)&&v.push({id:"zoomOut",icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()});const y=[];d("autoscale",c.autoscale)&&y.push({id:"autoscale",icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),d("reset",c.reset)&&y.push({id:"reset",icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()});const M=[];d("screenshot",c.screenshot)&&M.push({id:"screenshot",icon:"camera",title:"Download plot as PNG",onClick:h});const x=[b,v,y,M].filter(R=>R.length>0),m=x.flat(),p=(t==null?void 0:t.leadingButtons)??[],E=(t==null?void 0:t.sliders)??[];if(!p.length&&m.length===0&&E.length===0)return null;const _=(t==null?void 0:t.position)??"top-right",w=(t==null?void 0:t.visibility)==="always",P=_==="top-right"||_==="bottom-right",T=["cairn-plot-toolbar z-30 rounded border border-border bg-bg-elevated/90 shadow-sm backdrop-blur-sm transition-opacity",w?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),A={position:"absolute",pointerEvents:"auto",...Ai[_]};return r?f.jsx("div",{ref:n,style:A,className:`${T} inline-flex px-0.5 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:f.jsx(Di,{actions:m,leading:p,sliders:E})}):f.jsxs("div",{ref:n,style:A,className:`${T} flex flex-col gap-0.5 px-1 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:[f.jsxs("div",{className:`flex items-center gap-0.5 ${P?"justify-end":"justify-start"}`,children:[p.length>0&&f.jsxs(f.Fragment,{children:[p.map(R=>R.menu?f.jsx(Ci,{icon:R.icon,title:R.title,menu:R.menu},R.id):f.jsx(bo,{icon:R.icon,label:R.label,title:R.title,active:R.active,disabled:R.disabled,onClick:R.onClick??(()=>{})},R.id)),x.length>0&&f.jsx(vo,{})]}),x.map((R,N)=>f.jsxs("span",{className:"inline-flex items-center gap-0.5",children:[N>0&&f.jsx(vo,{}),R.map(I=>f.jsx(bo,{icon:I.icon,title:I.title,active:I.active,disabled:I.disabled,onClick:I.onClick},I.id))]},R[0].id))]}),E.length>0&&f.jsx("div",{className:`flex items-center gap-2 ${P?"justify-end":"justify-start"}`,children:E.map(R=>f.jsx(wo,{spec:R},R.id))})]})}const Li={zoom:1,pan:{x:0,y:0}},Eo=1.3,Oi=.25,Bi=64,Ni={buttons:{zoom:!1}};function Ii(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const Fi=[{id:"none",label:"None"},...Zs];function zt(e,t){return{id:"colormap",title:"Colormap",menu:{options:Fi,value:e,onSelect:t}}}const _o={linear:"Linear",srgb:"sRGB",gamma:"Gamma",reinhard:"Reinhard",aces:"ACES",extended:"Extended · Linear","extended-clamp":"Extended · Linear (managed)","extended-reinhard":"Extended · Reinhard","extended-aces":"Extended · ACES"},Gi=Ar.map(e=>({id:e,label:_o[e]}));function mn(e,t){return{id:"tonemap",title:"Tone-mapping operator",menu:{options:Gi,value:e,onSelect:t}}}const Ui=Qs.map(e=>({id:e,label:_o[e]}));function zi(e,t){return{id:"tonemap",title:"Display transfer (sRGB · Gamma · Linear)",menu:{options:Ui,value:e,onSelect:t}}}function Vi({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:a,naturalHeight:s,minZoom:l=Oi,maxZoom:c=Bi,requestRender:u,onReset:d,extraModified:g=!1}){const h=i.useCallback(w=>{var K;if(!o)return;const P=(K=e.current)==null?void 0:K.getBoundingClientRect(),S=(P==null?void 0:P.width)??0,T=(P==null?void 0:P.height)??0,A=a&&s&&S>0&&T>0?$n(a,s,S,T):c,C=Math.max(l,Math.min(A,n*w));if(C===n)return;const B=S/2,R=T/2,N=B-(B-r.x)/n*C,I=R-(R-r.y)/n*C;o({zoom:C,pan:{x:N,y:I}})},[o,e,a,s,c,l,n,r.x,r.y]),b=i.useCallback(()=>h(Eo),[h]),v=i.useCallback(()=>h(1/Eo),[h]),y=i.useCallback(()=>{o==null||o(Li),d==null||d()},[o,d]),M=i.useCallback(w=>{const P={scale:w==null?void 0:w.scale,filename:w==null?void 0:w.filename};u==null||u();const S=t==null?void 0:t.current;if(S)return go(S,P);const T=e.current;return T?vi(T,P):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,u]),x=i.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),m=n!==1||r.x!==0||r.y!==0||g,p=i.useCallback(w=>{},[]),E=i.useCallback(w=>{},[]),_=i.useCallback(()=>{},[]);return i.useMemo(()=>({capabilities:x,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:m,setDragMode:p,setHoverMode:E,toggleSpikelines:_,zoomIn:b,zoomOut:v,autoscale:y,reset:y,toPNG:M}),[x,m,p,E,_,b,v,y,M])}const $i={zoom:1,pan:{x:0,y:0}};function hn({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:a,pan:s,onViewportChange:l,naturalDims:c,checkerboard:u,wrapperClassName:d,wrapperStyle:g,viewportPadding:h,header:b,surface:v,showAxes:y,overlayNode:M,overlay:x,notationSeed:m,exportCanvasRef:p,requestRender:E,leadingMenus:_,displayAdjust:w,depthSliders:P,extraSliders:S,regionSelect:T,onReset:A,extraModified:C,label:B,showLabelChip:R,isDraggable:N=!1,onDragStart:I,extraChips:K}){const[X,F]=i.useState(m),[z,ee]=i.useState(!1),[ce,ae]=i.useState(!1),pe="render"in x?null:x,fe=!!T&&!!pe,{containerProps:k}=Xr({containerRef:r,zoom:a,pan:s,onViewportChange:l,naturalWidth:c==null?void 0:c.w,naturalHeight:c==null?void 0:c.h}),G=i.useCallback(()=>{w==null||w.onExposureChange(0),w==null||w.onOffsetChange(0),A==null||A()},[w,A]),Z=i.useCallback(()=>{l==null||l($i),G()},[l,G]),W=Vi({rootRef:r,canvasRef:p,zoom:a,pan:s,onViewportChange:l,naturalWidth:c==null?void 0:c.w,naturalHeight:c==null?void 0:c.h,requestRender:E,onReset:G,extraModified:((w==null?void 0:w.exposureEV)??0)!==0||((w==null?void 0:w.offset)??0)!==0||!!C}),le=i.useMemo(()=>{const ye=[];if(P&&ye.push(...P),!w)return S&&ye.push(...S),ye.length?ye:void 0;const Pe=(Te,_e)=>`${Te>=0?"+":"−"}${Math.abs(Te).toFixed(_e)}`;return ye.push({id:"exposure",icon:"sun",label:"EV",title:"Exposure (EV stops) — color × 2^EV. Double-click to type a value (may exceed the slider range).",min:-8,max:8,step:.1,value:w.exposureEV,onChange:w.onExposureChange,format:Te=>Pe(Te,1)},{id:"offset",icon:"plusminus",label:"OFF",title:"Offset — added after exposure (before tonemap). Double-click to type a value (may exceed the slider range).",min:-1,max:1,step:.01,value:w.offset,onChange:w.onOffsetChange,format:Te=>Pe(Te,2)}),S&&ye.push(...S),ye},[w,P,S]),j=i.useMemo(()=>fe?{id:"region-depth",icon:"select",title:"Select depth from region — drag a rectangle to set the Z window to the samples it covers (Esc to cancel)",active:ce,onClick:()=>ae(ye=>!ye)}:null,[fe,ce]),te=i.useMemo(()=>({...Ni,leadingButtons:[..._??[],...j?[j]:[],...z?[Ii(X,F)]:[]],sliders:le}),[z,X,_,j,le]),ne=" cairn-checkerboard",oe="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(u==="pane"?ne:""),me=d+(u==="wrapper"?ne:""),Re="render"in x?x.render({notation:X,setOverlayActive:ee}):x.hasSource&&c?f.jsx(Mt,{imageElRef:x.displayElRef,naturalWidth:c.w,naturalHeight:c.h,zoom:a,pan:s,sourceWindow:x.sourceWindow,sample:x.sample,notation:X,version:x.version,onActiveChange:ee}):null;return f.jsxs("div",{className:`relative isolate flex flex-col h-full${n?" group":""}`,...e,children:[b,n&&f.jsx(ki,{controller:W,config:te}),f.jsxs("div",{ref:r,className:oe,style:{padding:h,...k.style},onPointerDown:k.onPointerDown,onPointerMove:k.onPointerMove,onPointerUp:k.onPointerUp,onPointerCancel:k.onPointerCancel,onDoubleClick:Z,...t,children:[f.jsxs("div",{ref:o,className:me,style:g,children:[v,y&&c&&f.jsx(mi,{naturalWidth:c.w,naturalHeight:c.h,zoom:a,containerRef:o}),M]}),Re,!n&&z&&f.jsx(Zr,{notation:X,onChange:F}),ce&&T&&pe&&c&&f.jsx(Xi,{imageElRef:pe.displayElRef,naturalDims:c,sourceWindow:pe.sourceWindow,onQueryLive:T.queryLive,onSelect:(ye,Pe,Te,_e)=>{ae(!1),T.commit(ye,Pe,Te,_e)},onExit:()=>ae(!1)}),!ce&&(T==null?void 0:T.rect)&&pe&&c&&f.jsx(Hi,{rect:T.rect,imageElRef:pe.displayElRef,naturalDims:c,sourceWindow:pe.sourceWindow,zoom:a,pan:s,onQueryLive:T.queryLive,onCommit:T.commit,onRemove:T.remove})]}),R&&f.jsx(Kn,{label:B,isDraggable:N,onDragStart:I}),K]})}function Xi({imageElRef:e,naturalDims:t,sourceWindow:n,onQueryLive:r,onSelect:o,onExit:a}){var M;const s=i.useRef(null),l=i.useRef(null),[c,u]=i.useState(null),d=i.useCallback((x,m,p,E)=>{const _=e.current;return _?Kr(x,m,p,E,{box:_.getBoundingClientRect(),naturalWidth:t.w,naturalHeight:t.h,sourceWindow:n}):null},[e,t,n]);i.useEffect(()=>{const x=m=>{m.key==="Escape"&&a()};return window.addEventListener("keydown",x),()=>window.removeEventListener("keydown",x)},[a]);const g=i.useCallback(x=>{var m,p;(p=(m=x.target).setPointerCapture)==null||p.call(m,x.pointerId),l.current={x:x.clientX,y:x.clientY},u({x0:x.clientX,y0:x.clientY,x1:x.clientX,y1:x.clientY})},[]),h=i.useCallback(x=>{const m=l.current;if(!m)return;u({x0:m.x,y0:m.y,x1:x.clientX,y1:x.clientY});const p=d(m.x,m.y,x.clientX,x.clientY);p&&r(p.x0,p.y0,p.x1,p.y1)},[d,r]),b=i.useCallback(x=>{const m=l.current;l.current=null,u(null);const p=e.current;if(!m||!p){a();return}if(Math.abs(x.clientX-m.x)<3&&Math.abs(x.clientY-m.y)<3){a();return}const E=p.getBoundingClientRect(),_=Kr(m.x,m.y,x.clientX,x.clientY,{box:E,naturalWidth:t.w,naturalHeight:t.h,sourceWindow:n});if(!_){a();return}o(_.x0,_.y0,_.x1,_.y1)},[e,t,n,o,a]),v=(M=s.current)==null?void 0:M.getBoundingClientRect(),y=c&&v?{left:Math.min(c.x0,c.x1)-v.left,top:Math.min(c.y0,c.y1)-v.top,width:Math.abs(c.x1-c.x0),height:Math.abs(c.y1-c.y0)}:null;return f.jsx("div",{ref:s,className:"absolute inset-0 z-20",style:{cursor:"crosshair",touchAction:"none"},onPointerDown:g,onPointerMove:h,onPointerUp:b,children:y&&f.jsx("div",{className:"absolute border-2 border-dashed border-sky-400 bg-sky-400/15 pointer-events-none",style:y})})}const Wi={nw:{cursor:"nwse-resize",fx:0,fy:0},n:{cursor:"ns-resize",fx:.5,fy:0},ne:{cursor:"nesw-resize",fx:1,fy:0},e:{cursor:"ew-resize",fx:1,fy:.5},se:{cursor:"nwse-resize",fx:1,fy:1},s:{cursor:"ns-resize",fx:.5,fy:1},sw:{cursor:"nesw-resize",fx:0,fy:1},w:{cursor:"ew-resize",fx:0,fy:.5}};function Hi({rect:e,imageElRef:t,naturalDims:n,sourceWindow:r,zoom:o,pan:a,onQueryLive:s,onCommit:l,onRemove:c}){const u=i.useRef(null),[d,g]=i.useState(null),h=i.useRef(null),[b,v]=i.useState(null),y=d??e;i.useLayoutEffect(()=>{const p=()=>{const w=t.current,P=u.current;if(!w||!P)return;const S=w.getBoundingClientRect(),T=P.getBoundingClientRect(),A=Na(y,{box:S,naturalWidth:n.w,naturalHeight:n.h,sourceWindow:r});v({left:A.left-T.left,top:A.top-T.top,width:A.width,height:A.height})};p();const E=t.current;if(!E||typeof ResizeObserver>"u")return;const _=new ResizeObserver(p);return _.observe(E),()=>_.disconnect()},[y,n.w,n.h,r,o,a.x,a.y]);const M=i.useCallback(p=>E=>{var _,w;E.stopPropagation(),(w=(_=E.target).setPointerCapture)==null||w.call(_,E.pointerId),h.current={handle:p,sx:E.clientX,sy:E.clientY,start:y},g(y)},[y]),x=i.useCallback(p=>{const E=h.current,_=t.current;if(!E||!_)return;const w=Ba({box:_.getBoundingClientRect(),naturalWidth:n.w,naturalHeight:n.h,sourceWindow:r}),P=(p.clientX-E.sx)/(w||1),S=(p.clientY-E.sy)/(w||1),T=pi(E.start,E.handle,P,S,{w:n.w,h:n.h},1);g(T),s(T.x0,T.y0,T.x1,T.y1)},[t,n.w,n.h,r,s]),m=i.useCallback(()=>{const p=h.current;h.current=null;const E=d;g(null),p&&E&&l(E.x0,E.y0,E.x1,E.y1)},[d,l]);return b?f.jsxs("div",{ref:u,className:"absolute inset-0 z-20 pointer-events-none",style:{touchAction:"none"},children:[f.jsx("div",{className:"absolute border-2 border-sky-400 bg-sky-400/10 pointer-events-auto",style:{...b,cursor:"move",touchAction:"none"},onPointerDown:M("move"),onPointerMove:x,onPointerUp:m}),di.map(p=>{const E=Wi[p];return f.jsx("div",{className:"absolute pointer-events-auto flex items-center justify-center",style:{left:b.left+E.fx*b.width-12,top:b.top+E.fy*b.height-12,width:24,height:24,cursor:E.cursor,touchAction:"none"},onPointerDown:M(p),onPointerMove:x,onPointerUp:m,children:f.jsx("div",{className:"w-2.5 h-2.5 rounded-sm bg-sky-400 border border-white/80"})},p)}),f.jsx("button",{type:"button","aria-label":"Remove depth region",title:"Remove region (reset the depth window)",className:"absolute pointer-events-auto flex items-center justify-center rounded-full text-white",style:{left:b.left+b.width-8,top:b.top-32,width:40,height:40},onPointerDown:p=>p.stopPropagation(),onClick:c,children:f.jsx("span",{className:"flex items-center justify-center w-5 h-5 rounded-full bg-slate-800/90 border border-white/70 text-[11px] leading-none",children:"×"})})]}):f.jsx("div",{ref:u,className:"absolute inset-0 z-20 pointer-events-none"})}const Qn="image-settings-state",Mo=new Map,Jn=new Map;function So(e){let t=Mo.get(e);return t||(t=new EventTarget,Mo.set(e,t)),t}function Ao(e,t,n){const r={...Jn.get(e)??{},...n};Jn.set(e,r),So(e).dispatchEvent(new CustomEvent(Qn,{detail:{patch:n,sourceId:t}}))}function Yi(e){return Jn.get(e)}function Ki(e,t,n){const r=So(e),o=a=>{const s=a.detail;s.sourceId!==t&&n(s.patch)};return r.addEventListener(Qn,o),()=>r.removeEventListener(Qn,o)}function qi(){return typeof crypto<"u"&&"randomUUID"in crypto?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`}function er(e,t,n,r){const o=i.useRef();o.current||(o.current=qi());const a=i.useRef(n);a.current=n;const s=i.useRef(r);return s.current=r,i.useEffect(()=>{if(e){if(!t){const l=Yi(e);l&&s.current(l)}return Ki(e,o.current,l=>{s.current(l)})}},[e,t]),i.useEffect(()=>{e&&t&&Ao(e,o.current,a.current())},[e,t]),i.useCallback(l=>{e&&Ao(e,o.current,l)},[e])}const tr={inFlight:!1,pending:null};function To(e,t){return e.inFlight?{state:{inFlight:!0,pending:t},launch:null}:{state:{inFlight:!0,pending:null},launch:t}}function Co(e){return e.pending!=null?{state:{inFlight:!0,pending:null},launch:e.pending}:{state:tr,launch:null}}const Zi=1e3,ji=typeof requestAnimationFrame=="function"?e=>requestAnimationFrame(()=>e()):e=>setTimeout(e,0),Ro=typeof cancelAnimationFrame=="function"?cancelAnimationFrame:e=>clearTimeout(e);function Po(e,t){const n=e.deep,r=(n==null?void 0:n.zMin)??0,o=(n==null?void 0:n.zMax)??0,a=t!=null,[s,l,c]=Fe(r),[u,d,g]=Fe(o),[h,b]=i.useState(null),[v,y]=i.useState(null),M=i.useRef(n);M.current=n;const x=i.useRef(r);x.current=r;const m=i.useRef(o);m.current=o;const p=i.useRef(s);p.current=s;const E=i.useRef(u);E.current=u;const _=i.useRef({near:s,far:u,ver:0}),w=i.useRef(0),P=i.useRef(!0),S=i.useRef(tr),T=i.useRef(null),A=l,C=d,B=i.useCallback(()=>{const k=M.current;if(!k)return;const{near:G,far:Z,ver:W}=_.current,le=()=>{const j=Co(S.current);S.current=j.state,j.launch!=null&&B()};k.flatten(G,Z).then(j=>{_.current.ver===W&&!P.current&&(T.current!=null&&Ro(T.current),T.current=ji(()=>{T.current=null,b(j)})),le()}).catch(le)},[]),R=i.useCallback(()=>{const k=To(S.current,1);S.current=k.state,k.launch!=null&&B()},[B]);i.useEffect(()=>()=>{T.current!=null&&Ro(T.current),n==null||n.dispose()},[n]),i.useEffect(()=>{if(!n)return;const k=s<=r&&u>=o;if(P.current=k,w.current+=1,_.current={near:s,far:u,ver:w.current},a){t(s,u);return}if(k){b(null);return}R()},[n,s,u,r,o,R,a,t]);const N=i.useMemo(()=>n&&!a&&h!=null?{...e,data:h}:e,[e,n,a,h]),I=n!=null&&r>0&&o/r>Zi,K=i.useMemo(()=>{if(!n||!(o>r))return;const k=Z=>Math.abs(Z)>=1e3||Math.abs(Z)<.01&&Z!==0?Z.toExponential(2):Z.toFixed(3),G=(Z,W,le,j,te)=>{if(I){const ne=Math.log10(r),oe=Math.log10(o);return{id:Z,icon:"layers",label:W,title:`${le} (log scale). Double-click to type a Z.`,min:ne,max:oe,step:(oe-ne)/200,value:Math.log10(Math.max(r,Math.min(j,o))),onChange:me=>te(10**me),format:me=>k(10**me)}}return{id:Z,icon:"layers",label:W,title:`${le}. Double-click to type a Z.`,min:r,max:o,step:(o-r)/200,value:j,onChange:te,format:k}};return[G("depth-near","ZN","Depth window NEAR — composite only samples with Z ≥ this",s,A),G("depth-far","ZF","Depth window FAR — composite only samples with Z ≤ this",u,C)]},[n,r,o,s,u,I,A,C]),X=i.useCallback(k=>{if(k.count===0){const W=x.current,le=m.current,j=le>W?0:1;l(le+j),d(W-j);return}const G=m.current-x.current,Z=Math.max(Math.abs(G)*1e-4,1e-4);l(k.zMin-Z),d(k.zMax+Z)},[l,d]),F=i.useRef(null),z=i.useRef(tr),ee=i.useCallback(()=>{const k=M.current,G=F.current,Z=()=>{const W=Co(z.current);z.current=W.state,W.launch!=null&&ee()};if(!k||!G){Z();return}k.zRangeInRect(G.x0,G.y0,G.x1,G.y1).then(W=>{X(W),Z()}).catch(Z)},[X]),ce=i.useCallback((k,G,Z,W)=>{F.current={x0:k,y0:G,x1:Z,y1:W};const le=To(z.current,1);z.current=le.state,le.launch!=null&&ee()},[ee]),ae=i.useCallback((k,G,Z,W)=>{y({x0:k,y0:G,x1:Z,y1:W}),ce(k,G,Z,W)},[ce]),pe=i.useCallback(()=>{y(null),c.reset(),g.reset(),b(null)},[c,g]),fe=i.useCallback(()=>{c.reset(),g.reset(),y(null),b(null)},[c,g]);return{hdr:N,sliders:K,hasDeep:n!=null,region:v,queryRegionWindow:ce,commitRegion:ae,removeRegion:pe,reset:fe,isModified:c.isModified||g.isModified}}function Do(e){return"hdr"in e&&e.hdr!=null}function Qi(e){return{dtype:"uint8",url:e}}function ko(e){const t=e.source,n=t.dtype==="float"?t.data:null,r=t.dtype==="float"?t.shape:null,o=t.dtype==="float"?t.precision:void 0,a=t.dtype==="float"?t.numpyDtype:void 0,s=t.dtype==="float"?t.deep:void 0,l=i.useMemo(()=>n?{data:n,shape:r??[],dtype:a??"<f4",precision:o,deep:s}:null,[n,r,o,a,s]);return l?{hdr:l,tonemap:e.tonemap,exposure:e.exposure,offset:e.offset,gamma:e.gamma,peak:e.peak,showAxes:e.showAxes,label:e.label,interpolation:e.interpolation,zoom:e.zoom,pan:e.pan,onViewportChange:e.onViewportChange,pixelValueNotation:e.pixelValueNotation,toolbar:e.toolbar}:{imageUrl:t.dtype==="uint8"?t.url:null,baselineUrl:e.baselineUrl,isBaseline:e.isBaseline,diffMode:e.diffMode,interpolation:e.interpolation,tonemap:e.tonemap,gamma:e.gamma,peak:e.peak,exposure:e.exposure,offset:e.offset,colormap:e.colormap,showAxes:e.showAxes,processing:e.processing,zoom:e.zoom,pan:e.pan,onViewportChange:e.onViewportChange,onNaturalSize:e.onNaturalSize,label:e.label??"",isDraggable:e.isDraggable,onDragStart:e.onDragStart,className:e.className,overlay:e.overlay,overlaySettings:e.overlaySettings,pixelValueNotation:e.pixelValueNotation,toolbar:e.toolbar}}function Lo(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function Be(e){return Number.isFinite(e)?e:0}const Ji={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function ec(e,t,n,r,o=0){const{h:a,w:s,c:l}=Lo(e.shape),c=e.precision==="f16-bits"?Ir(e.data):e.data,u=Js(t),d=new Uint8ClampedArray(s*a*4);for(let g=0;g<s*a;g++){const h=g*l;let b,v,y,M=1;l===1?b=v=y=Be(c[h]):l===3?(b=Be(c[h]),v=Be(c[h+1]),y=Be(c[h+2])):(b=Be(c[h]),v=Be(c[h+1]),y=Be(c[h+2]),M=Be(c[h+3]));const x=[jt(b,n,o),jt(v,n,o),jt(y,n,o)],[m,p,E]=u(x),_=g*4;d[_]=255*Dt(m,r),d[_+1]=255*Dt(p,r),d[_+2]=255*Dt(E,r),d[_+3]=255*(M<0?0:M>1?1:M)}return new ImageData(d,s,a)}function tc(e,t,n){const r=Nn(t,n??kt),o=new Uint8ClampedArray(e.data.length),a=e.data;for(let s=0;s<a.length;s+=4)o[s]=255*Dt(Bn(a[s]/255),r),o[s+1]=255*Dt(Bn(a[s+1]/255),r),o[s+2]=255*Dt(Bn(a[s+2]/255),r),o[s+3]=a[s+3];return new ImageData(o,e.width,e.height)}function Oo(e,t,n,r){const[o,a]=i.useState(null);if(i.useEffect(()=>{const l=e.current;if(!l||typeof ResizeObserver>"u")return;const c=new ResizeObserver(u=>{var g;const d=(g=u[u.length-1])==null?void 0:g.contentRect;d&&a(h=>h&&h.width===d.width&&h.height===d.height?h:{width:d.width,height:d.height})});return c.observe(l),()=>c.disconnect()},[e]),r!=="auto")return r;if(!o||!n)return;const s=li({width:o.width*t,height:o.height*t},n.w,n.h);return ui(s,cn)}function nc(e){var ft,dt;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:a="auto",colormap:s="none",tonemap:l,gamma:c,showAxes:u=!1,processing:d=Ji,zoom:g=1,pan:h={x:0,y:0},onViewportChange:b,onNaturalSize:v,label:y,isDraggable:M=!1,onDragStart:x,overlay:m,overlaySettings:p,pixelValueNotation:E="decimal",toolbar:_=!0}=e,[w,P,S]=Fe(s);i.useEffect(()=>{P(s)},[s,P]);const T=(()=>{const O=Zt(l);return O==="gamma"||O==="linear"?O:"srgb"})(),[A,C,B]=Fe(T);i.useEffect(()=>{C(T)},[l]);const[R,N,I]=Fe(c&&c>0?c:kt);i.useEffect(()=>{c&&c>0&&N(c)},[c,N]);const K=i.useCallback(O=>{O.colormap!==void 0&&P(O.colormap),O.tonemap!==void 0&&C(O.tonemap),O.tonemapGamma!==void 0&&N(O.tonemapGamma)},[P,C,N]),X=i.useCallback(()=>({colormap:w,tonemap:A,tonemapGamma:R}),[w,A,R]),F=er(e.settingsSyncGroupId,!!e.syncIsAnchor,X,K),z=i.useCallback(O=>{P(O),F({colormap:O})},[P,F]),ee=i.useCallback(O=>{C(O),F({tonemap:O})},[C,F]),ce=i.useCallback(O=>{N(O),F({tonemapGamma:O})},[N,F]),ae=i.useRef(null),pe=i.useRef(null),fe=i.useRef(null),[k,G]=i.useState(!1),Z=i.useRef(null),W=i.useRef(null),le=i.useRef(null),j=i.useRef(null),[te,ne]=i.useState(0),oe=i.useCallback(()=>ne(O=>O+1),[]),me=i.useMemo(()=>({get current(){const O=le.current;return O instanceof HTMLCanvasElement?O:null}}),[]),Re=i.useCallback(O=>{ae.current=O,O&&(le.current=O)},[]),ye=i.useCallback(O=>{pe.current=O,O&&(le.current=O)},[]),Pe=i.useCallback(O=>{fe.current=O,O&&(le.current=O)},[]),Te=i.useCallback(O=>{O&&(le.current=O)},[]),[_e,He]=i.useState(!1),[ze,Ye]=i.useState(!1),[be,Je]=i.useState(!1),[Ce,Ge]=i.useState(null),{flipSign:Ve}=d,{gammaFilterId:lt,filterStr:At,gamma:Tt,offset:Ct}=fo(d),Xe=!r&&o!=="none"&&n!=null&&t!=null,Ke=o!=="none"&&n!=null,ut=w!=="none"&&!Xe&&!(r&&Ke)&&t!=null;i.useEffect(()=>{if(!ut||!t){Je(!1);return}let O=!1;Je(!1);const ve=`${t}::${w}`,he=Gn(ve);if(he){const ue=pe.current;if(ue){ue.width=he.width,ue.height=he.height;const Ee=ue.getContext("2d");Ee&&Ee.putImageData(he,0,0),oe(),Ge({w:he.width,h:he.height}),v==null||v(he.width,he.height),Je(!0)}return}const Me=new Image;return Me.onload=()=>{if(O)return;const ue=document.createElement("canvas");ue.width=Me.naturalWidth,ue.height=Me.naturalHeight;const Ee=ue.getContext("2d");if(!Ee)return;Ee.drawImage(Me,0,0);const D=Ee.getImageData(0,0,ue.width,ue.height),H=Fn(w),Q=In(D,w,H);Un(ve,Q);const U=pe.current;if(!U||O)return;U.width=Q.width,U.height=Q.height;const q=U.getContext("2d");q&&q.putImageData(Q,0,0),oe(),Ge({w:Q.width,h:Q.height}),v==null||v(Q.width,Q.height),Je(!0)},Me.src=t,()=>{O=!0}},[ut,t,w]);const qe=t!=null&&!Xe&&!ut&&A!=="srgb";i.useEffect(()=>{if(!qe||!t){G(!1);return}let O=!1;return G(!1),mt(t).then(ve=>{if(O||!ve)return;const he=tc(ve,A,R),Me=fe.current;if(!Me)return;Me.width=he.width,Me.height=he.height;const ue=Me.getContext("2d");ue&&ue.putImageData(he,0,0),oe(),Ge({w:he.width,h:he.height}),v==null||v(he.width,he.height),G(!0)}),()=>{O=!0}},[qe,t,A,R]);const Ze=i.useCallback((O,ve)=>{Ge(he=>he&&he.w===O&&he.h===ve?he:{w:O,h:ve}),v==null||v(O,ve)},[]);i.useEffect(()=>{if(!t){j.current=null,oe();return}let O=!1;return mt(t).then(ve=>{O||(j.current=ve,oe())}),()=>{O=!0}},[t,oe]);const Bt=i.useCallback((O,ve,he)=>{const Me=j.current;if(!Me||O<0||ve<0||O>=Me.width||ve>=Me.height)return null;const ue=(ve*Me.width+O)*4,Ee=Me.data[ue],D=Me.data[ue+1],H=Me.data[ue+2];return _t(w!=="none"||Ee===D&&D===H?[Ee]:[Ee,D,H],"uint8",he)},[w]);i.useEffect(()=>{if(Ye(!1),!Xe){He(!1);return}let O=!1;const ve=ma(),he=ve==="gpu"||ve==="auto",Me=`${n}::${t}::${o}::${w}`;if(ve!=="gpu"){const ue=Gn(Me);if(ue){const Ee=ae.current;if(Ee){(Ee.width!==ue.width||Ee.height!==ue.height)&&(Ee.width=ue.width,Ee.height=ue.height);const D=Ee.getContext("2d");D&&D.putImageData(ue,0,0),Ze(ue.width,ue.height),He(!0)}return}}return(async()=>{const[ue,Ee]=await Promise.all([mt(n),mt(t)]);if(O||!ue||!Ee)return;const H=o.includes("signed")?"signed":"positive",Q=w!=="none"?kn(w):null,U={diffMode:o,colormap:Q,cmapMode:H};if(he)try{const ke=ae.current;if(ke){const Le=da(ue,Ee,U,ke);if(Le){if(O)return;Ze(Le.width,Le.height),He(!0);return}}}catch(ke){console.warn("[cairn] WebGL 2 diff error:",ke)}if(ve==="gpu"){O||Ye(!0);return}let q=sa(ue,Ee,o);w!=="none"&&(q=In(q,w,H)),Un(Me,q);const J=ae.current;if(!J||O)return;(J.width!==q.width||J.height!==q.height)&&(J.width=q.width,J.height=q.height);const De=J.getContext("2d");De&&De.putImageData(q,0,0),Ze(q.width,q.height),He(!0)})(),()=>{O=!0}},[n,t,o,Xe,w,v]);const et=Oo(W,g,Ce,a),at=Ve?{filter:"invert(1)"}:{},vt=m&&(p!=null&&p.enabled)&&Ce&&t&&((((ft=m.boxes)==null?void 0:ft.length)??0)>0||(((dt=m.masks)==null?void 0:dt.length)??0)>0)?f.jsx(Wn,{data:m,settings:p,naturalWidth:Ce.w,naturalHeight:Ce.h}):void 0,Rt=t?Xe&&ze?f.jsx(uo,{title:"WebGL 2 unavailable",body:"GPU render mode needs WebGL 2 here — switch render mode to Auto or CPU."}):Xe?f.jsxs(f.Fragment,{children:[!_e&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),f.jsx("canvas",{ref:Re,className:"w-full h-full object-contain block",style:{display:_e?"block":"none",imageRendering:et,...at}})]}):ut?f.jsxs(f.Fragment,{children:[!be&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),f.jsx("canvas",{ref:ye,className:"w-full h-full object-contain block",style:{display:be?"block":"none",imageRendering:et,...at}})]}):qe?f.jsxs(f.Fragment,{children:[!k&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying transfer..."}),f.jsx("canvas",{ref:Pe,className:"w-full h-full object-contain block",style:{display:k?"block":"none",imageRendering:et,...at}})]}):f.jsx("img",{ref:Te,src:t,alt:y,className:"w-full h-full object-contain block",draggable:!1,style:{filter:At,imageRendering:et},onLoad:O=>{const ve=O.currentTarget;Ge({w:ve.naturalWidth,h:ve.naturalHeight}),v==null||v(ve.naturalWidth,ve.naturalHeight)}}):f.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return f.jsx(hn,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:_,paneRef:Z,wrapperRef:W,zoom:g,pan:h,onViewportChange:b,naturalDims:Ce,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${h.x}px, ${h.y}px) scale(${g})`,transformOrigin:"0 0"},viewportPadding:u&&Ce?"16px 4px 4px 28px":"4px",header:f.jsx(po,{id:lt,gamma:Tt,offset:Ct}),surface:Rt,showAxes:u,overlayNode:vt,overlay:{displayElRef:le,sample:Bt,version:te,hasSource:!!t},notationSeed:E,exportCanvasRef:me,leadingMenus:w==="none"?[zt(w,O=>z(O)),zi(A,O=>ee(O))]:[zt(w,O=>z(O))],extraSliders:w==="none"&&tn(A)?[{id:"gamma",label:"γ",title:"Display gamma γ for the Gamma transfer — display = clamp(value)^(1/γ), tev-style. Default 2.2 (close to sRGB, not identical). Double-click to type a value.",min:Qt,max:Jt,step:en,value:R,onChange:ce,format:O=>O.toFixed(1)}]:void 0,onReset:()=>{S.reset(),B.reset(),I.reset()},extraModified:S.isModified||B.isModified||I.isModified,label:y,showLabelChip:!!y,isDraggable:M,onDragStart:x})}function rc(e){const{tonemap:t="srgb",exposure:n=0,offset:r=0,gamma:o,showAxes:a=!1,label:s="",interpolation:l="auto",zoom:c=1,pan:u={x:0,y:0},onViewportChange:d,pixelValueNotation:g="decimal",toolbar:h=!0}=e,b=Po(e.hdr),v=b.hdr,[y,M,x]=Fe(Zt(t));i.useEffect(()=>{M(Zt(t))},[t,M]);const[m,p,E]=Fe(o&&o>0?o:kt);i.useEffect(()=>{o&&o>0&&p(o)},[o,p]);const _=i.useRef(null),w=i.useRef(null),P=i.useRef(null),[S,T]=i.useState(null),[A,C]=i.useState(0),[B,R]=i.useState(0),[N,I]=i.useState(0),K=i.useCallback(k=>{k.tonemap!==void 0&&M(k.tonemap),k.tonemapGamma!==void 0&&p(k.tonemapGamma),k.exposureEV!==void 0&&R(k.exposureEV),k.offset!==void 0&&I(k.offset)},[M,p]),X=i.useCallback(()=>({tonemap:y,tonemapGamma:m,exposureEV:B,offset:N}),[y,m,B,N]),F=er(e.settingsSyncGroupId,!!e.syncIsAnchor,X,K),z=i.useCallback(k=>{M(k),F({tonemap:k})},[M,F]),ee=i.useCallback(k=>{p(k),F({tonemapGamma:k})},[p,F]),ce=i.useCallback(k=>{R(k),F({exposureEV:k})},[F]),ae=i.useCallback(k=>{I(k),F({offset:k})},[F]);i.useEffect(()=>{const k=_.current;if(!k)return;let G;try{G=ec(v,y,n+B,Nn(y,m),r+N)}catch(W){console.error("[cairn] HDR tone-map error:",W);return}(k.width!==G.width||k.height!==G.height)&&(k.width=G.width,k.height=G.height);const Z=k.getContext("2d");Z&&(Z.putImageData(G,0,0),C(W=>W+1),T(W=>W&&W.w===G.width&&W.h===G.height?W:{w:G.width,h:G.height}))},[v,y,n,r,m,B,N]);const pe=i.useCallback((k,G,Z)=>{const W=S;if(!W||k<0||G<0||k>=W.w||G>=W.h)return null;const le=v.shape.length===2?1:v.shape[2]??1,j=(G*W.w+k)*le,te=v.data,ne=v.precision==="f16-bits"?me=>on(te[me]??0):me=>te[me]??0,oe=le===1?[ne(j)]:[ne(j),ne(j+1),ne(j+2)];return _t(oe,"unit",Z)},[v,S]),fe=Oo(P,c,S,l);return f.jsx(hn,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:h,paneRef:w,wrapperRef:P,zoom:c,pan:u,onViewportChange:d,naturalDims:S,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${u.x}px, ${u.y}px) scale(${c})`,transformOrigin:"0 0"},viewportPadding:a&&S?"16px 4px 4px 28px":"4px",surface:f.jsx("canvas",{ref:_,className:"w-full h-full object-contain block",style:{imageRendering:fe}}),showAxes:a,overlay:{displayElRef:_,sample:pe,version:A,hasSource:!0},notationSeed:g,exportCanvasRef:_,leadingMenus:[mn(y,k=>z(k))],displayAdjust:{exposureEV:B,offset:N,onExposureChange:ce,onOffsetChange:ae},extraSliders:tn(y)?[{id:"gamma",label:"γ",title:"Display gamma γ for the Gamma transfer — display = clamp(value)^(1/γ), tev-style. Default 2.2 (close to sRGB, not identical). Double-click to type a value.",min:Qt,max:Jt,step:en,value:m,onChange:ee,format:k=>k.toFixed(1)}]:void 0,depthSliders:b.sliders,regionSelect:b.hasDeep?{rect:b.region,queryLive:b.queryRegionWindow,commit:b.commitRegion,remove:b.removeRegion}:void 0,onReset:()=>{b.reset(),x.reset(),E.reset()},extraModified:b.isModified||x.isModified||E.isModified,label:s,showLabelChip:!!s})}function Bo(e){const t=ko(e),n={settingsSyncGroupId:e.settingsSyncGroupId,syncIsAnchor:e.syncIsAnchor};return Do(t)?f.jsx(rc,{...t,...n}):f.jsx(nc,{...t,...n})}const No={"no-webgpu":0,"no-hdr-browser":1,"no-hdr-display":2},oc="https://github.com/doeringchristian/cairn-plot/blob/main/docs/browser-support.md";function sc(e,t=!1){const n=e||"";return t?"brave":/firefox/i.test(n)?"firefox":/safari/i.test(n)&&!/chrome|chromium|crios|android/i.test(n)?"safari":/linux/i.test(n)&&/chrome|chromium/i.test(n)?"chromium-linux":"chromium"}function ac(e){const t=e||"";return/mac os x|macintosh/i.test(t)?"macos":/windows/i.test(t)?"windows":"other"}function ic(e,t){if(e==="no-hdr-display")switch(ac(t.userAgent)){case"macos":return"macOS: EDR engages automatically on HDR-capable displays — confirm your display supports HDR.";case"windows":return"Windows: turn on Settings → System → Display → Use HDR.";default:return"Enable HDR in your display and OS settings."}const n=sc(t.userAgent,t.isBrave);if(e==="no-hdr-browser")switch(n){case"firefox":return"Firefox has no extended-tone-mapping canvas path at all — true HDR output is impossible until Firefox implements it (fundamental browser limitation).";case"safari":return"Safari's WebGPU HDR canvas tone-mapping is still maturing — update to the latest Safari 26+.";default:return"Chrome/Edge 129+ is required for HDR canvas output (toneMapping: extended) — update your browser."}switch(n){case"firefox":return"Firefox: about:config → dom.webgpu.enabled (HDR output is not available in Firefox at all — browser limitation).";case"safari":return"Safari: Develop → Feature Flags → WebGPU (Safari 26+ has it by default).";case"brave":return"Brave: check Shields fingerprint blocking + brave://flags.";case"chromium-linux":return"Chromium on Linux: enable chrome://flags/#enable-unsafe-webgpu.";case"chromium":default:return"Chrome/Edge: enable chrome://flags/#enable-unsafe-webgpu and hardware acceleration."}}function cc(e){switch(e){case"no-webgpu":return"GPU renderer unavailable → CPU fallback active; FLIP kernels + HDR compare disabled.";case"no-hdr-browser":return"True HDR output is unsupported by this browser — a fundamental browser limitation, not a cairn-plot bug → HDR images tone-mapped to SDR.";case"no-hdr-display":return"Your display/OS is not in HDR mode → HDR images tone-mapped to SDR."}}function Io(e,t){return`cairn-plot:capnotice:${e}:${t}`}const Fo=new Set;function Go(e){try{if(window.localStorage.getItem(e)==="1")return!0}catch{}try{if(window.sessionStorage.getItem(e)==="1")return!0}catch{}return Fo.has(e)}function lc(e){try{window.localStorage.setItem(e,"1");return}catch{}try{window.sessionStorage.setItem(e,"1");return}catch{}Fo.add(e)}const Uo=new Set;let gn=null,Ot=null;function zo(){Ot&&Ot.parentNode&&Ot.parentNode.removeChild(Ot),Ot=null,gn=null}function uc(e){const t=Io(e,window.location.pathname),n=ic(e,{userAgent:navigator.userAgent,isBrave:!!navigator.brave}),r=document.createElement("div");r.setAttribute("role","status"),r.setAttribute("data-cairn-plot-capnotice",e),Object.assign(r.style,{position:"fixed",bottom:"12px",right:"12px",zIndex:"2147483000",maxWidth:"340px",boxSizing:"border-box",padding:"10px 30px 10px 12px",borderRadius:"6px",border:"1px solid var(--color-border, #d0d7de)",background:"rgb(var(--color-bg-elevated-rgb, 246 248 250) / 0.9)",color:"var(--color-fg-muted, #656d76)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",boxShadow:"0 4px 12px rgba(0, 0, 0, 0.18)",font:"12px/1.4 system-ui, sans-serif"});const o=document.createElement("div");o.textContent=cc(e),Object.assign(o.style,{fontWeight:"600",color:"var(--color-fg, #1f2328)",marginBottom:"4px"});const a=document.createElement("div");a.textContent=n,a.style.marginBottom="4px";const s=document.createElement("a");s.href=oc,s.target="_blank",s.rel="noopener noreferrer",s.textContent="Learn more",Object.assign(s.style,{color:"var(--color-accent, #0969da)",textDecoration:"none"});const l=document.createElement("button");l.type="button",l.textContent="×",l.setAttribute("aria-label","Dismiss browser capability notice"),l.title="Dismiss",Object.assign(l.style,{position:"absolute",top:"4px",right:"6px",padding:"0 4px",border:"0",background:"transparent",color:"var(--color-fg-subtle, #8b949e)",cursor:"pointer",fontSize:"16px",lineHeight:"1"}),l.addEventListener("click",()=>{lc(t),zo()}),r.appendChild(o),r.appendChild(a),r.appendChild(s),r.appendChild(l),document.body.appendChild(r),Ot=r,gn=e}function Vo(e){if(typeof document>"u"||typeof window>"u"||Uo.has(e))return;Uo.add(e);const t=Io(e,window.location.pathname);if(Go(t))return;const n=()=>{if(!Go(t)){if(gn!==null)if(No[e]<No[gn])zo();else return;uc(e)}};document.body?n():window.addEventListener("DOMContentLoaded",n,{once:!0})}const fc={data:new Float32Array(0),shape:[0,0],dtype:"<f4"};function dc(e){const{h:t,w:n,c:r}=Lo(e.shape);if(e.precision==="f16-bits"){const s=e.data,l=new Uint16Array(n*t*4);for(let c=0;c<n*t;c++){const u=c*r,d=c*4;if(r===1){const g=s[u];l[d]=g,l[d+1]=g,l[d+2]=g,l[d+3]=rn}else l[d]=s[u],l[d+1]=s[u+1],l[d+2]=s[u+2],l[d+3]=r>=4?s[u+3]:rn}return{data:l,width:n,height:t,format:"rgba16float"}}const o=e.data,a=new Float32Array(n*t*4);for(let s=0;s<n*t;s++){const l=s*r;let c,u,d,g=1;r===1?c=u=d=Be(o[l]):r===3?(c=Be(o[l]),u=Be(o[l+1]),d=Be(o[l+2])):(c=Be(o[l]),u=Be(o[l+1]),d=Be(o[l+2]),g=Be(o[l+3]));const h=s*4;a[h]=c,a[h+1]=u,a[h+2]=d,a[h+3]=g}return{data:a,width:n,height:t,format:"rgba32float"}}function $o(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),a=n*o,s=r*o,l=(t.width-a)/2,c=(t.height-s)/2,u=Math.max(e.zoom,1e-6),d=t.width/(u*a),g=t.height/(u*s),h=-l/a-e.pan.x/(u*a),b=-c/s-e.pan.y/(u*s);return{x:h,y:b,w:d,h:g}}function Xo(e,t,n,r){const o=e.w*n,a=e.h*r;return o<=0||a<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/a)}function pc(e){var Me,ue,Ee;const t=ko(e),n=Do(t),r=i.useRef(null),o=i.useRef(null),a=i.useRef(null),s=i.useRef(null),l=i.useRef(null),c=n&&!!((Me=t.hdr)!=null&&Me.deep),u=i.useCallback((D,H)=>{var Q,U;(Q=s.current)==null||Q.setDeepWindow(D,H),(U=l.current)==null||U.call(l)},[]),d=Po(n?t.hdr:fc,c?u:void 0),g=i.useRef(!1),[h,b]=i.useState(!1),[v,y]=i.useState(!1),[M,x]=i.useState(!1),[m,p]=i.useState(null),[E,_]=i.useState(0),[w,P]=i.useState(0),[S,T]=i.useState({x:0,y:0,w:1,h:1}),A=i.useRef(null),C=i.useRef(null),[B,R]=i.useState(0),N=t.zoom??1,I=t.pan??{x:0,y:0},K=t.onViewportChange,X=t.toolbar??!0,F=n?"none":t.colormap??"none",[z,ee,ce]=Fe(F);i.useEffect(()=>{ee(F)},[F,ee]);const ae=n?"none":z,pe=t.tonemap,[fe,k]=i.useState(null);i.useEffect(()=>{k(null)},[pe]);const G=Pr(pe),Z=fe??G,W=fe!==null&&fe!==G,le=i.useCallback(()=>k(null),[]),j=t.peak,te=()=>j!=null&&j>0?j:Rr(pe)??qt,[ne,oe,me]=Fe(te());i.useEffect(()=>{oe(te())},[j,pe]);const Re=t.gamma,[ye,Pe,Te]=Fe(Re&&Re>0?Re:kt);i.useEffect(()=>{Re&&Re>0&&Pe(Re)},[Re,Pe]);const[_e,He]=i.useState(0),[ze,Ye]=i.useState(0),be=i.useCallback(D=>{D.colormap!==void 0&&ee(D.colormap),D.tonemap!==void 0&&k(D.tonemap),D.tonemapGamma!==void 0&&Pe(D.tonemapGamma),D.peak!==void 0&&oe(D.peak),D.exposureEV!==void 0&&He(D.exposureEV),D.offset!==void 0&&Ye(D.offset)},[ee,k,Pe,oe]),Je=i.useCallback(()=>({colormap:ae,tonemap:Z,tonemapGamma:ye,peak:ne,exposureEV:_e,offset:ze}),[ae,Z,ye,ne,_e,ze]),Ce=er(t.settingsSyncGroupId,!!t.syncIsAnchor,Je,be),Ge=i.useCallback(D=>{ee(D),Ce({colormap:D})},[ee,Ce]),Ve=i.useCallback(D=>{k(D),Ce({tonemap:D})},[Ce]),lt=i.useCallback(D=>{He(D),Ce({exposureEV:D})},[Ce]),At=i.useCallback(D=>{Ye(D),Ce({offset:D})},[Ce]),Tt=i.useCallback(D=>{oe(D),Ce({peak:D})},[oe,Ce]),Ct=i.useCallback(D=>{Pe(D),Ce({tonemapGamma:D})},[Pe,Ce]),Xe=Xn();i.useEffect(()=>{const D=r.current;if(!D)return;let H=!1;return Yt().then(Q=>{var ke;if(H)return;const U=((ke=Q.probeExtendedToneMapping)==null?void 0:ke.call(Q))??!1,q=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,De=U&&q&&(n||F==="none");g.current=De,b(De),n&&!De&&Vo(U?"no-hdr-display":"no-hdr-browser"),ci(D,{hdr:De}).then(Le=>{if(H){lo(Le);return}s.current=Le,x(!0)}).catch(Le=>{H||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",Le),y(!0))})}).catch(Q=>{H||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",Q),y(!0))}),()=>{H=!0,s.current&&(lo(s.current),s.current=null)}},[]),i.useEffect(()=>{const D=o.current;if(!D)return;const H=new ResizeObserver(()=>P(Q=>Q+1));return H.observe(D),()=>H.disconnect()},[]),i.useEffect(()=>{const D=o.current;if(!D)return;const H=new IntersectionObserver(Q=>{const U=Q[0];if(!U)return;const q=s.current;q&&(q.setVisible(U.isIntersecting),U.isIntersecting?q.isParked&&(q.restore(),P(J=>J+1)):q.park())},{threshold:0});return H.observe(D),()=>H.disconnect()},[]),i.useEffect(()=>{var Q;if(!n||!M||c)return;const D=d.hdr;A.current=D;const H=dc(D);(Q=s.current)==null||Q.setSource(H),p(U=>U&&U.w===H.width&&U.h===H.height?U:{w:H.width,h:H.height}),R(U=>U+1),_(U=>U+1)},[n,M,c,n?d.hdr:null]),i.useEffect(()=>{if(!n||!M||!c)return;const D=t.hdr,H=D.deep;A.current=D;let Q=!1;return H.getGpuCsr().then(U=>{var q;Q||((q=s.current)==null||q.setDeepSource(U,H.zMin,H.zMax),p(J=>J&&J.w===U.width&&J.h===U.height?J:{w:U.width,h:U.height}),R(J=>J+1),_(J=>J+1))}).catch(U=>{Q||console.warn("[cairn] deep GPU CSR upload failed:",U)}),()=>{Q=!0}},[n,M,c,n?t.hdr.deep:null]),i.useEffect(()=>{if(n||!M)return;const D=t,H=D.imageUrl,Q=z;if(!H){C.current=null,p(null),R(q=>q+1);return}let U=!1;return mt(H).then(q=>{var ke,Le;if(U||!q)return;let J=q;if(Q!=="none"){const xe=`gpu::${H}::${Q}::ev${_e}::off${ze}`,je=Gn(xe);if(je)J=je;else{const Oe=Fn(Q);J=In(q,Q,Oe,_e,ze),Un(xe,J)}}C.current=q;const De={data:J.data,width:J.width,height:J.height,format:"rgba8unorm"};(ke=s.current)==null||ke.setSource(De),p(xe=>xe&&xe.w===J.width&&xe.h===J.height?xe:{w:J.width,h:J.height}),(Le=D.onNaturalSize)==null||Le.call(D,J.width,J.height),R(xe=>xe+1),_(xe=>xe+1)}),()=>{U=!0}},[n,M,n?null:t.imageUrl,n?null:z,n?0:_e,n?0:ze]);const Ke=t.exposure??0,ut=t.offset??0,qe=!n&&ae==="none",Ze=i.useCallback(()=>{const D=s.current;if(!D||!M||!m)return;const H=o.current,Q=a.current,U=Q?Q.getBoundingClientRect():H?H.getBoundingClientRect():{width:m.w,height:m.h},q=$o({zoom:N,pan:I},U,m.w,m.h);T(xe=>xe.x===q.x&&xe.y===q.y&&xe.w===q.w&&xe.h===q.h?xe:q),U.width>0&&U.height>0&&D.resize(Math.round(U.width*Xe),Math.round(U.height*Xe));const J=Xo(q,U,m.w,m.h)>=cn?"nearest":"linear",De=q,ke=Dr(Z,g.current?ne:1,g.current,ye),Le=n||qe?{exposureEV:Ke+_e,offset:ut+ze,operator:ke.operator,gamma:ke.gamma,isScalar:!1,hdrOut:ke.hdrOut,peak:ke.peak,srgbDecode:!n,uv:De,filter:J}:{exposureEV:0,offset:0,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,srgbDecode:!1,uv:De,filter:J};try{D.render(Le)||y(!0)}catch(xe){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",xe),y(!0)}},[M,m,N,I.x,I.y,Ke,ut,_e,ze,Z,ne,ye,qe,n,ae,Xe]);l.current=Ze,i.useEffect(()=>{Ze()},[Ze,E,w]);const Bt=i.useCallback((D,H,Q)=>{if(n){const xe=A.current,je=m;if(!xe||!je||D<0||H<0||D>=je.w||H>=je.h)return null;const Oe=xe.shape.length===2?1:xe.shape[2]??1,it=(H*je.w+D)*Oe,Xt=xe.data,Pt=xe.precision==="f16-bits"?Wt=>on(Xt[Wt]??0):Wt=>Xt[Wt]??0,tt=Oe===1?[Pt(it)]:[Pt(it),Pt(it+1),Pt(it+2)];return _t(tt,"unit",Q)}const U=C.current;if(!U||D<0||H<0||D>=U.width||H>=U.height)return null;const q=(H*U.width+D)*4,J=U.data[q],De=U.data[q+1],ke=U.data[q+2];return _t(ae!=="none"||J===De&&De===ke?[J]:[J,De,ke],"uint8",Q)},[n,m,ae]),et=t.showAxes??!1,at=n?t.label??"":t.label,vt=t.interpolation??"auto",Rt=vt==="auto"?void 0:vt,ft=n?void 0:t.overlay,dt=n?void 0:t.overlaySettings,O=n?!1:t.isDraggable??!1,ve=n?void 0:t.onDragStart;if(v)return f.jsx(Bo,{...e});const he=ft&&(dt!=null&&dt.enabled)&&m&&((((ue=ft.boxes)==null?void 0:ue.length)??0)>0||(((Ee=ft.masks)==null?void 0:Ee.length)??0)>0)?f.jsx(Wn,{data:ft,settings:dt,naturalWidth:m.w,naturalHeight:m.h}):void 0;return f.jsx(hn,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":M},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:X,paneRef:o,wrapperRef:a,zoom:N,pan:I,onViewportChange:K,naturalDims:m,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:et&&m?"16px 4px 4px 28px":0,surface:f.jsx("canvas",{ref:r,className:"w-full h-full block",style:{imageRendering:Rt},"data-gpu-image-canvas":!0}),showAxes:et,overlayNode:he,overlay:{displayElRef:r,sample:Bt,version:B,hasSource:!0,sourceWindow:S},notationSeed:t.pixelValueNotation??"decimal",exportCanvasRef:r,requestRender:Ze,leadingMenus:n?[mn(Z,D=>Ve(D))]:qe?[zt(ae,D=>Ge(D)),mn(Z,D=>Ve(D))]:[zt(ae,D=>Ge(D))],displayAdjust:{exposureEV:_e,offset:ze,onExposureChange:lt,onOffsetChange:At},extraSliders:[...(n||qe)&&h?[{id:"peak",label:"PK",title:"Peak white (×SDR white) — the HDR ceiling P every operator clips at (Linear/sRGB/Gamma hard-clip at P; Reinhard/ACES roll off toward P). P=1 reproduces the SDR rendition exactly; double-click to type a value, including 'inf' for the raw browser-clipped extended look.",min:Er,max:It,step:_r,value:ne,onChange:Tt,format:D=>Number.isFinite(D)?`${D.toFixed(1)}×`:"∞"}]:[],...(n||qe)&&tn(Z)?[{id:"gamma",label:"γ",title:"Display gamma γ for the Gamma transfer — display = clamp(value)^(1/γ), tev-style. Default 2.2 (close to sRGB, not identical). Double-click to type a value.",min:Qt,max:Jt,step:en,value:ye,onChange:Ct,format:D=>D.toFixed(1)}]:[]],depthSliders:d.sliders,regionSelect:c?{rect:d.region,queryLive:d.queryRegionWindow,commit:d.commitRegion,remove:d.removeRegion}:void 0,onReset:()=>{ce.reset(),le(),me.reset(),Te.reset(),d.reset()},extraModified:ce.isModified||W||me.isModified||Te.isModified||d.isModified,label:at,showLabelChip:!!at,isDraggable:O,onDragStart:ve})}const xn=new Map;function ot(e){if(xn.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);xn.set(e.id,e)}function xt(e){return xn.get(e)}function mc(){return Array.from(xn.values())}function Wo(e,t){return{...e.params??{},...t??{}}}const hc={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},gc={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},xc={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},bc={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},vc={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},yc={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},Ho=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];Ec(Ho);const nr=[1.052156925,1,.91835767],wc=.7;function Ec(e){const[t,n,r]=e[0],[o,a,s]=e[1],[l,c,u]=e[2],d=a*u-s*c,g=-(o*u-s*l),h=o*c-a*l,v=1/(t*d+n*g+r*h);return[[d*v,-(n*u-r*c)*v,(n*s-r*a)*v],[g*v,(t*u-r*l)*v,-(t*s-r*o)*v],[h*v,-(t*c-n*l)*v,(t*a-n*o)*v]]}function _c(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const rr=6/29;function or(e){return e>rr**3?Math.cbrt(e):e/(3*rr*rr)+4/29}function Yo(e,t,n){const[r,o,a]=_c(Ho,e,t,n),s=or(r*nr[0]),l=or(o*nr[1]),c=or(a*nr[2]),u=116*l-16,d=500*(s-l),g=200*(l-c);return[u,.01*u*d,.01*u*g]}function Mc(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function Sc(){const e=Yo(0,1,0),t=Yo(0,0,1);return Math.pow(Mc(e,t),wc)}const Ko=Sc(),Ac=.082;function qo(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],a=Math.max(...n,...o),s=Math.ceil(3*Math.sqrt(a/(2*Math.PI**2))*e),l=1/e,c=Math.PI**2,u=[0,0,0];for(let d=-s;d<=s;d++)for(let g=-s;g<=s;g++){const h=(g*l)**2+(d*l)**2;for(let b=0;b<3;b++)u[b]+=t[b]*Math.sqrt(Math.PI/n[b])*Math.exp(-c*h/n[b])+r[b]*Math.sqrt(Math.PI/o[b])*Math.exp(-c*h/o[b])}return{r:s,deltaX:l,sums:u}}function Zo(e){const t=.5*Ac*e,n=Math.ceil(3*t);let r=0,o=0,a=0;for(let s=-n;s<=n;s++)for(let l=-n;l<=n;l++){const c=Math.exp(-(l*l+s*s)/(2*t*t)),u=-l*c,d=(l*l/(t*t)-1)*c;u>0&&(r+=u),d>0?o+=d:a-=d}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:a}}const Tc=`
${We}
${un}
${St}
${Gt}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_map0: vec4<f32>; // offX, offY, fitFill, 0
@group(0) @binding(8) var<uniform> u_map1: vec4<f32>; // resultW, resultH, 0, 0
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = mapSample(src, px, u_map0.x, u_map0.y, u_map1.x, u_map1.y, u_map0.z);
  return vec4<f32>(flip_rgb2ycxcz(s.rgb), 1.0);
}
`,Cc=`
${We}
${un}
${St}
${Gt}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_map0: vec4<f32>; // offX, offY, fitFill, 0
@group(0) @binding(8) var<uniform> u_map1: vec4<f32>; // resultW, resultH, 0, 0
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = mapSample(src, px, u_map0.x, u_map0.y, u_map1.x, u_map1.y, u_map0.z);
  return vec4<f32>(flip_linrgb2ycxcz(clamp(s.rgb, vec3<f32>(0.0), vec3<f32>(1.0))), 1.0);
}
`,bn=`
${We}
${un}
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
`,jo=`
${We}
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
`;function st(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function vn(e,t,n){const r=n.sourceMap,o=r?t==="a"?r.offsetA:r.offsetB:{x:0,y:0},a=r!=null&&r.fill?1:0;return[st(e,[o.x,o.y,a,0]),st(e+1,[n.width,n.height,0,0])]}function yn(e){return[st(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),st(2,[e.sums[2],0,0,0])]}function Qo(e){return[st(4,[Ko,e.sd,e.r,e.edgeNorm]),st(5,[e.pointPos,e.pointNeg,0,0])]}function Jo(e,t,n,r,o,a=""){const s=qo(e),l=Zo(e),c=`ycxczA${a}`,u=`ycxczB${a}`,d=`labA${a}`,g=`labB${a}`,h=`flip${a}`;return{passes:[{name:c,shader:t,inputs:[n],output:c,uniforms:()=>vn(1,"a",o)},{name:u,shader:t,inputs:[r],output:u,uniforms:()=>vn(1,"b",o)},{name:d,shader:bn,inputs:[c],output:d,uniforms:()=>yn(s)},{name:g,shader:bn,inputs:[u],output:g,uniforms:()=>yn(s)},{name:h,shader:jo,inputs:[d,g,c,u],output:h,uniforms:()=>Qo(l)}],flipRef:h}}const Rc={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=Jo(t,Tc,"srcA","srcB",e);return{passes:n,final:r}}},Pc={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=Jo(t,Cc,"srcA","srcB",e);return{passes:n,final:r}}},es=`
${We}
${un}
${St}
${Gt}
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
`,Dc=`
${We}
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
`,kc={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",output:"scalar",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),a=(r-n)/Math.max(o-1,1),s=qo(t),l=Zo(t),c=[];let u=null;for(let d=0;d<o;d++){const g=n+d*a,h=`_e${d}`,b=`ycxczA${h}`,v=`ycxczB${h}`,y=`labA${h}`,M=`labB${h}`,x=`acc${h}`;c.push({name:b,shader:es,inputs:["srcA"],output:b,uniforms:()=>[st(1,[g,0,0,0]),...vn(2,"a",e)]},{name:v,shader:es,inputs:["srcB"],output:v,uniforms:()=>[st(1,[g,0,0,0]),...vn(2,"b",e)]},{name:y,shader:bn,inputs:[b],output:y,uniforms:()=>yn(s)},{name:M,shader:bn,inputs:[v],output:M,uniforms:()=>yn(s)}),u===null?c.push({name:x,shader:jo,inputs:[y,M,b,v],output:x,uniforms:()=>Qo(l)}):c.push({name:x,shader:Dc,inputs:[y,M,b,v,u],output:x,uniforms:()=>[st(5,[Ko,l.sd,l.r,l.edgeNorm]),st(6,[l.pointPos,l.pointNeg,0,0])]}),u=x}return{passes:c,final:u}}},ts=.01,ns=.03,wn=1,sr=1.5,bt=5,ar=[.2126,.7152,.0722];function ir(e){return e<=.04045?e/12.92:Math.pow((e+.055)/1.055,2.4)}function rs(e,t,n){const r=ar[0]*ir(e)+ar[1]*ir(t)+ar[2]*ir(n);return Math.min(1,Math.max(0,r))}function Lc(e,t){const n=2*t+1,r=new Float64Array(n);let o=0;for(let a=-t,s=0;a<=t;a++,s++){const l=Math.exp(-.5*a*a/(e*e));r[s]=l,o+=l}for(let a=0;a<n;a++)r[a]=r[a]/o;return r}function os(e,t){if(t===1)return 0;const n=2*t;let r=(e%n+n)%n;return r>=t&&(r=n-1-r),r}const ss=()=>new Promise(e=>{typeof setTimeout=="function"?setTimeout(e,0):Promise.resolve().then(e)}),cr=64;async function Vt(e,t,n,r,o,a){const s=new Float64Array(t*n);for(let c=0;c<n;c++){for(let u=0;u<t;u++){let d=0;for(let g=-o,h=0;g<=o;g++,h++)d+=r[h]*e[c*t+os(u+g,t)];s[c*t+u]=d}(c+1)%cr===0&&await a()}const l=new Float64Array(t*n);for(let c=0;c<n;c++){for(let u=0;u<t;u++){let d=0;for(let g=-o,h=0;g<=o;g++,h++)d+=r[h]*s[os(c+g,n)*t+u];l[c*t+u]=d}(c+1)%cr===0&&await a()}return l}async function Oc(e,t,n,r,o=ss){const a=n*r;if(a<=0)return NaN;const s=Lc(sr,bt),l=new Float64Array(a),c=new Float64Array(a),u=new Float64Array(a);for(let m=0;m<a;m++)l[m]=e[m]*e[m],c[m]=t[m]*t[m],u[m]=e[m]*t[m];const d=await Vt(e,n,r,s,bt,o),g=await Vt(t,n,r,s,bt,o),h=await Vt(l,n,r,s,bt,o),b=await Vt(c,n,r,s,bt,o),v=await Vt(u,n,r,s,bt,o),y=(ts*wn)**2,M=(ns*wn)**2;let x=0;for(let m=0;m<a;m++){const p=h[m]-d[m]*d[m],E=b[m]-g[m]*g[m],_=v[m]-d[m]*g[m],w=2*d[m]*g[m]+y,P=2*_+M,S=d[m]*d[m]+g[m]*g[m]+y,T=p+E+M;x+=w*P/(S*T)}return x/a}const as=`
${We}

fn ssim_srgb2linear(c: f32) -> f32 {
  if (c <= 0.04045) { return c / 12.92; }
  return pow((c + 0.055) / 1.055, 2.4);
}
fn ssim_luma(srgb: vec3<f32>) -> f32 {
  let lin = vec3<f32>(ssim_srgb2linear(srgb.r), ssim_srgb2linear(srgb.g), ssim_srgb2linear(srgb.b));
  return clamp(dot(lin, vec3<f32>(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
}

${St}
${Gt}
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
`,Bc=`
${as}
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let y = ssim_moment_luma(in);
  return vec4<f32>(y.x, y.y, y.x * y.x, y.y * y.y);
}
`,Nc=`
${as}
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let y = ssim_moment_luma(in);
  return vec4<f32>(y.x * y.y, 0.0, 0.0, 0.0);
}
`,is=`
${We}
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
`,Ic=`
${We}
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
`;function $t(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function cs(e){const t=e.sourceMap,n=t?t.offsetA:{x:0,y:0},r=t?t.offsetB:{x:0,y:0},o=t!=null&&t.fill?1:0;return[$t(2,[n.x,n.y,r.x,r.y]),$t(3,[e.width,e.height,o,0])]}function ls(e,t){const n=`${t}H`,r=`${t}V`;return{passes:[{name:n,shader:is,inputs:[e],output:n,uniforms:()=>[$t(1,[1,0,bt,sr])]},{name:r,shader:is,inputs:[n],output:r,uniforms:()=>[$t(1,[0,1,bt,sr])]}],out:r}}const Fc={kind:"multipass",id:"ssim",label:"SSIM (1−SSIM)",publicName:"ssim",displayRange:"unit",output:"scalar",buildPasses(e){const t=(ts*wn)**2,n=(ns*wn)**2,r=ls("momA","statsA"),o=ls("momB","statsB");return{passes:[{name:"momA",shader:Bc,inputs:["srcA","srcB"],output:"momA",uniforms:cs},{name:"momB",shader:Nc,inputs:["srcA","srcB"],output:"momB",uniforms:cs},...r.passes,...o.passes,{name:"ssim",shader:Ic,inputs:[r.out,o.out],output:"ssim",uniforms:()=>[$t(2,[t,n,0,0])]}],final:"ssim"}}};let us=!1;function Gc(){us||(us=!0,ot(gc),ot(hc),ot(xc),ot(vc),ot(bc),ot(yc),ot(Rc),ot(kc),ot(Pc),ot(Fc))}Gc();function fs(){const e=[];for(const n of mc())n.kind==="pointwise"&&e.push({id:n.id,label:n.label});e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"});const t=xt("ssim");return t&&e.push({id:t.id,label:t.label}),e}function Uc(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}const zc=128,Vc=512*1024*1024;class $c{constructor(t=zc,n=Vc){ie(this,"map",new Map);ie(this,"totalBytes",0);ie(this,"maxEntries");ie(this,"maxBytes");this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}accountReadbackBytes(t,n){let r=!1;for(const o of this.map.values())if(o===t){r=!0;break}r&&(t.bytes+=n,this.totalBytes+=n,this.evict())}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const ds=new WeakMap;function lr(e){let t=ds.get(e);return t||(t=new $c,ds.set(e,t)),t}function Xc(e,t,n){const r=t*n;if(r<=0)return NaN;let o=0;for(let a=0;a<r;a++)o+=e[a*4]??0;return 1-o/r}function ps(e){return e==null||Number.isNaN(e)?"—":e.toFixed(4)}const ms=new WeakMap;function Wc(e,t,n){let r=ms.get(e);r||(r=new Map,ms.set(e,r));const o=r.get(t);if(o)return o;const a=n().catch(s=>{throw r.get(t)===a&&r.delete(t),s});return r.set(t,a),a}const hs=new WeakMap;function ur(e,t,n,r){let o=hs.get(e);o||(o=new Map,hs.set(e,o));const a=`${t}::${r}`;let s=o.get(a);return s||(s=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(a,s)),s}function Hc(e){return`
${We}
${St}
${Gt}
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
`}const En="rgba16float";let gs=0;function Yc(){return gs}function Kc(e,t,n,r,o,a){var M,x;const s=xt(r);if(!s)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const l=a??Ut({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),c=l.result.w,u=l.result.h,d=l.fit==="fill"?1:0,g=Wo(s,o);if(gs++,s.kind==="pointwise"){const m=e.createTexture(c,u,En),p=ur(e,`pw:${s.id}`,Hc(s.source),En),E=new Float32Array([l.offsetA.x,l.offsetA.y,l.offsetB.x,l.offsetB.y]),_=new Float32Array([c,u,d,0]);let w;try{w=e.createBindGroup(p,[{binding:0,resource:t},{binding:1,resource:n},{binding:2,resource:{uniform:E}},{binding:3,resource:{uniform:_}}]),e.renderFullscreen(m,p,w)}finally{(M=w==null?void 0:w.destroy)==null||M.call(w)}return m}const h={width:c,height:u,params:g,sourceMap:{fill:l.fit==="fill",offsetA:l.offsetA,offsetB:l.offsetB}},b=s.buildPasses(h),v=new Map([["srcA",t],["srcB",n]]),y=[];try{for(const p of b.passes){const E=e.createTexture(c,u,En);y.push(E),v.set(p.output,E);const _=ur(e,`mp:${s.id}:${p.name}`,p.shader,En),w=p.inputs.map((S,T)=>{const A=v.get(S);if(!A)throw new Error(`computeDiff: pass "${p.name}" input "${S}" not produced yet`);return{binding:T,resource:A}});p.uniforms&&w.push(...p.uniforms(h));let P;try{P=e.createBindGroup(_,w),e.renderFullscreen(E,_,P)}finally{(x=P==null?void 0:P.destroy)==null||x.call(P)}}const m=v.get(b.final);if(!m)throw new Error(`computeDiff: final ref "${b.final}" not produced`);for(const p of y)p!==m&&p.destroy();return m}catch(m){for(const p of y)p.destroy();throw m}}function qc(e,t){const n=Wo(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function Zc(e,t,n,r,o){const a=xt(n),s=a?qc(a,r):"",l=o?Yn(o):"";return`${e}|${t}|${n}|${s}|${l}`}function xs(e,t,n,r,o,a,s,l){const c=xt(r);if(!c)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const u=lr(e),d=l??Ut({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),g=Zc(a,s,r,o,d),h=u.get(g);if(h)return h;const b=Kc(e,t,n,r,o,d),v=d.result.w,y=d.result.h,M={texture:b,width:v,height:y,displayRange:c.displayRange,bytes:v*y*8};return u.set(g,M),M}function jc(e,t,n){return`${e}|${t}|${n?Yn(n):""}`}function Qc(e,t,n,r,o,a){return Wc(e,jc(r,o,a),()=>Jc(e,t,n,r,o,a))}async function Jc(e,t,n,r,o,a){try{const s=xs(e,t,n,"ssim",void 0,r,o,a);return s.ssimMean!==void 0?s.ssimMean:(s.ssimMeanPending||(s.ssimMeanPending=bs(e,s).then(l=>{const c=Xc(l,s.width,s.height);return s.ssimMean=c,c})),await s.ssimMeanPending)}catch{return el(e,t,n,a)}}async function el(e,t,n,r){const o=r??Ut({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),a=o.result.w,s=o.result.h,l=a*s;if(l<=0)return NaN;const c=await e.readback(t),u=await e.readback(n),d=c instanceof Uint8Array?255:1,g=u instanceof Uint8Array?255:1,h=o.fit==="fill",b=dn(c,t.width,t.height,d,o.offsetA,h,a,s),v=dn(u,n.width,n.height,g,o.offsetB,h,a,s),y=new Float64Array(l),M=new Float64Array(l),x=[0,0,0],m=[0,0,0];for(let p=0;p<s;p++){for(let E=0;E<a;E++){b(E,p,x),v(E,p,m);const _=p*a+E;y[_]=rs(x[0],x[1],x[2]),M[_]=rs(m[0],m[1],m[2])}(p+1)%cr===0&&await ss()}return Oc(y,M,a,s)}async function tl(e,t,n,r,o){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=oo(e,n,r,o).then(a=>(t.scalars=a,a))),t.scalarsPending)}async function bs(e,t){return t.resultSamples?t.resultSamples:(t.resultSamplesPending||(t.resultSamplesPending=e.readback(t.texture).then(n=>{const r=n instanceof Float32Array?n:Float32Array.from(n);return t.resultSamples=r,lr(e).accountReadbackBytes(t,r.byteLength),r})),t.resultSamplesPending)}function nl(e){return lr(e).size}const rl=`
${We}
${St}
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
`,ol={unit:0,signed:1,relative:2},sl={linear:0,signed:1,positive:2};function al(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function il(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function cl(e,t,n,r,o){var b,v,y;const a=il(t),s=ur(e,"diff-display",rl,a),l=al(e,o.colormap),c=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),u=new Float32Array([ol[r],sl[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]),d=new Float32Array([o.exposureEV??0,o.offset??0,0,0]),g=new Float32Array([((b=o.sourceDims)==null?void 0:b.w)??0,((v=o.sourceDims)==null?void 0:v.h)??0,0,0]);let h;try{h=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:l},{binding:2,resource:{uniform:c}},{binding:3,resource:{uniform:u}},{binding:4,resource:{uniform:d}},{binding:5,resource:{uniform:g}}]),e.renderFullscreen(t,s,h)}finally{(y=h==null?void 0:h.destroy)==null||y.call(h),l.destroy()}}const vs=.6*.6*2.51,ll=.6*.03,ul=0,ys=.6*.6*2.43,fl=.6*.59,dl=.14;function ws(e){const t=(ll-fl*e)/(vs-ys*e),n=(ul-dl*e)/(vs-ys*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const pl=.85,ml=.85,Es=11920928955078125e-23,fr=[.2126,.7152,.0722];function hl(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function gl(e,t,n,r=3,o={}){const a=t*n,s=ws(pl),l=ws(ml),c=new Float64Array(a);let u=0;for(let m=0;m<a;m++){const[p,E,_]=hl(e,m,r),w=p*fr[0]+E*fr[1]+_*fr[2];c[m]=w,w>u&&(u=w)}const d=Float64Array.from(c).sort(),g=a>>1,h=a%2===1?d[g]:d[g-1],b=Math.max(h,Es),v=Math.max(u,Es),y=o.startExposure??Math.log2(s/v),M=o.stopExposure??Math.log2(l/b),x=Math.max(2,Math.ceil(M-y));return{startExposure:y,stopExposure:M,numExposures:x}}const xl="absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm pointer-events-none select-none",bl="REF";function _s(){return f.jsx("span",{className:xl,children:bl})}function Ms({splitPosition:e,onChange:t,onReset:n}){return f.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${e*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:r=>{r.stopPropagation(),n==null||n()},onPointerDown:r=>{r.stopPropagation(),r.preventDefault();const o=r.currentTarget;try{o.setPointerCapture(r.pointerId)}catch{}const s=o.parentElement.getBoundingClientRect(),l=u=>{t==null||t(Math.max(0,Math.min(1,(u.clientX-s.left)/s.width)))},c=()=>{window.removeEventListener("pointermove",l),window.removeEventListener("pointerup",c)};window.addEventListener("pointermove",l),window.addEventListener("pointerup",c)},children:f.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})}const vl={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function yl({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:a,zoom:s,pan:l,onViewportChange:c,processing:u=vl,interpolation:d="auto",label:g="",isDraggable:h=!1,onDragStart:b,overlay:v,overlaySettings:y,pixelValueNotation:M="decimal"}){var W,le;const x=i.useRef(null),[m,p]=i.useState(null),[E,_]=i.useState(null),[w,P]=i.useState(M),[S,T]=i.useState(!1),A=i.useRef(null),C=i.useRef(null),B=i.useRef(null),R=i.useRef(null),[N,I]=i.useState(0);i.useEffect(()=>{if(!e){B.current=null,I(te=>te+1);return}let j=!1;return mt(e).then(te=>{j||(B.current=te,I(ne=>ne+1))}),()=>{j=!0}},[e]),i.useEffect(()=>{if(!t){R.current=null,I(te=>te+1);return}let j=!1;return mt(t).then(te=>{j||(R.current=te,I(ne=>ne+1))}),()=>{j=!0}},[t]);const K=j=>(te,ne,oe)=>{const me=j.current;if(!me||te<0||ne<0||te>=me.width||ne>=me.height)return null;const Re=(ne*me.width+te)*4,ye=me.data[Re],Pe=me.data[Re+1],Te=me.data[Re+2];return ye===Pe&&Pe===Te?{lines:[Lt(ye,"uint8",oe)]}:{lines:[Lt(ye,"uint8",oe),Lt(Pe,"uint8",oe),Lt(Te,"uint8",oe)],colors:[ln[0],ln[1],ln[2]]}},X=i.useMemo(()=>K(B),[]),F=i.useMemo(()=>K(R),[]),z=!!v&&!!(y!=null&&y.enabled)&&!!m&&!!e&&((((W=v.boxes)==null?void 0:W.length)??0)>0||(((le=v.masks)==null?void 0:le.length)??0)>0),{gammaFilterId:ee,filterStr:ce,gamma:ae,offset:pe}=fo(u),fe=`translate(${l.x}px, ${l.y}px) scale(${s})`,k=d==="auto"?void 0:d,{containerProps:G,modifierActive:Z}=Xr({containerRef:x,zoom:s,pan:l,onViewportChange:c});return f.jsxs("div",{className:"relative isolate flex flex-col h-full",children:[f.jsx(po,{id:ee,gamma:ae,offset:pe}),f.jsxs("div",{ref:x,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...G.style},onPointerDown:G.onPointerDown,onPointerMove:G.onPointerMove,onPointerUp:G.onPointerUp,onPointerCancel:G.onPointerCancel,children:[f.jsxs("div",{className:"relative w-full h-full",children:[f.jsxs("div",{className:"relative w-full h-full",style:{transform:fe,transformOrigin:"0 0"},children:[f.jsx("img",{ref:A,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:ce,imageRendering:k,...n==="blend"?{opacity:o}:{}},onLoad:j=>{const te=j.currentTarget;p({w:te.naturalWidth,h:te.naturalHeight})}}),z&&f.jsx(Wn,{data:v,settings:y,naturalWidth:m.w,naturalHeight:m.h})]}),f.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:f.jsx("div",{className:"w-full h-full",style:{transform:fe,transformOrigin:"0 0"},children:f.jsx("img",{ref:C,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:ce,imageRendering:k,...n==="blend"?{opacity:1-o}:{}},onLoad:j=>{const te=j.currentTarget;_({w:te.naturalWidth,h:te.naturalHeight})}})})}),n==="split"&&f.jsx(Ms,{splitPosition:r,onChange:a,onReset:()=>a==null?void 0:a(.5)})]}),n==="split"?f.jsxs(f.Fragment,{children:[t&&E&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:f.jsx(Mt,{imageElRef:C,naturalWidth:E.w,naturalHeight:E.h,zoom:s,pan:l,sample:F,notation:w,version:N})}),e&&m&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:f.jsx(Mt,{imageElRef:A,naturalWidth:m.w,naturalHeight:m.h,zoom:s,pan:l,sample:X,notation:w,version:N,onActiveChange:T})})]}):e&&m&&f.jsx(Mt,{imageElRef:A,naturalWidth:m.w,naturalHeight:m.h,zoom:s,pan:l,sample:X,notation:w,version:N,onActiveChange:T}),S&&f.jsx(Zr,{notation:w,onChange:P})]}),n==="split"&&f.jsx(_s,{}),f.jsx(Kn,{label:g,corner:"bottom-right",isDraggable:h&&!Z,grip:!0,onDragStart:b})]})}function wl(){return f.jsx(uo,{title:"GPU compare unavailable",body:"Float image sources need the GPU compare (WebGPU), which isn't available in this browser."})}function El({mode:e,kernel:t,kernelOptions:n,onSlide:r,onBlend:o,onKernel:a,onSide:s}){return{id:"compare-mode",title:"Compare / diff mode",menu:{options:[...s?[{id:"side",label:"Side"}]:[],{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...n],value:e==="side"?"side":e==="split"?"slide":e==="blend"?"blend":t,onSelect:u=>{u==="side"?s==null||s():u==="slide"?r():u==="blend"?o():a(u)}}}}function _l(e){const t=kn(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function Ml(e){const{width:t,height:n,channels:r}=e,o=t*n;if(e.precision==="f16-bits"){const c=e.data,u=new Uint16Array(o*4);for(let d=0;d<o;d++){const g=d*r,h=d*4;if(r===1){const b=c[g];u[h]=b,u[h+1]=b,u[h+2]=b,u[h+3]=rn}else u[h]=c[g],u[h+1]=c[g+1],u[h+2]=c[g+2],u[h+3]=r>=4?c[g+3]:rn}return{data:u,format:"rgba16float"}}const a=e.data,s=new Float32Array(o*4),l=c=>Number.isFinite(c)?c:0;for(let c=0;c<o;c++){const u=c*r;let d,g,h,b=1;r===1?d=g=h=l(a[u]):r===3?(d=l(a[u]),g=l(a[u+1]),h=l(a[u+2])):(d=l(a[u]),g=l(a[u+1]),h=l(a[u+2]),b=l(a[u+3]));const v=c*4;s[v]=d,s[v+1]=g,s[v+2]=h,s[v+3]=b}return{data:s,format:"rgba32float"}}function Sl({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:a,blendAlpha:s,onSplitPositionChange:l,diffSubmode:c,colormap:u="none",align:d="top-left",fit:g="crop",diffKernel:h,onDiffKernelChange:b,onCompareModeChange:v,onRequestSide:y,zoom:M,pan:x,onViewportChange:m,interpolation:p="auto",label:E="",pixelValueNotation:_="decimal",tonemap:w,peak:P,gamma:S,toolbar:T=!0}){var Ts;const A=i.useRef(null),C=i.useRef(null),B=i.useRef(null),R=i.useRef(null),N=i.useRef(null),[I,K]=i.useState(!1),[X,F]=i.useState(!1),z=i.useRef(!1),[ee,ce]=i.useState(!1),[ae,pe]=i.useState(null),[fe,k]=i.useState(null),[G,Z]=i.useState({a:!1,b:!1}),[W,le]=i.useState(0),[j,te]=i.useState(0),[ne,oe]=i.useState(null),[me,Re]=i.useState(null),[ye,Pe]=i.useState({x:0,y:0,w:1,h:1}),Te=h??c??"absolute",[_e,He,ze]=Fe(Te);i.useEffect(()=>{He(h??c??"absolute")},[h,c,He]);const Ye=i.useCallback(L=>{He(L),b==null||b(L)},[b,He]);i.useEffect(()=>{const L=A.current;if(L)return L.__cairnDiffKernel={current:_e,set:Ye},()=>{L&&delete L.__cairnDiffKernel}},[_e,Ye]);const[be,Je,Ce]=Fe(o);i.useEffect(()=>{Je(o)},[o,Je]);const Ge=i.useCallback(L=>{Je(L),v==null||v(L)},[v,Je]),[Ve,lt,At]=Fe(u);i.useEffect(()=>{lt(u)},[u,lt]);const[Tt,Ct]=i.useState(null);i.useEffect(()=>{Ct(null)},[w]);const Xe=Pr(w),Ke=Tt??Xe,ut=Tt!==null&&Tt!==Xe,qe=()=>P!=null&&P>0?P:Rr(w)??qt,[Ze,Bt,et]=Fe(qe()),[at,vt,Rt]=Fe(S&&S>0?S:kt);i.useEffect(()=>{Bt(qe())},[P,w]),i.useEffect(()=>{S&&S>0&&vt(S)},[S,vt]);const ft=i.useCallback(()=>{Ge(Ce.default),lt(At.default),Ye(ze.default),Ct(null),et.reset(),Rt.reset()},[Ge,lt,Ye,Ce.default,At.default,ze.default,et,Rt]),dt=Ce.isModified||At.isModified||ze.isModified||ut||et.isModified||Rt.isModified,[O,ve]=i.useState(0),[he,Me]=i.useState(0),ue=i.useMemo(()=>{const Y=[El({mode:be,kernel:_e,kernelOptions:fs().map(V=>({id:V.id,label:V.label})),onSide:y,onSlide:()=>Ge("split"),onBlend:()=>Ge("blend"),onKernel:V=>{Ge("diff"),Ye(V)}})];return be==="diff"?Y.push(zt(Ve,V=>lt(V))):Y.push(mn(Ke,V=>Ct(V))),Y},[be,_e,Ve,Ke,Ye,Ge,y]),Ee=i.useRef(null),D=i.useRef(null),H=i.useRef(null),Q=i.useRef(null),[U,q]=i.useState(0),J=i.useRef(null),De=i.useRef(null),[ke,Le]=i.useState(0),xe=Xn();i.useEffect(()=>{const L=B.current;if(!L)return;let Y=!1;return Yt().then(V=>{var $;if(!Y)try{if(so())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const se=(($=V.probeExtendedToneMapping)==null?void 0:$.call(V))??!1,de=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,we=se&&de;z.current=we,ce(we);const Ae=V.createSurface(L,{hdr:we});R.current={device:V,surface:Ae,texA:null,texB:null},F(!0)}catch(se){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",se),K(!0)}}).catch(V=>{Y||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",V),K(!0))}),()=>{var $,se;Y=!0;const V=R.current;V&&(($=V.texA)==null||$.destroy(),(se=V.texB)==null||se.destroy(),R.current=null)}},[]),i.useEffect(()=>{const L=A.current;if(!L)return;const Y=new ResizeObserver(()=>te(V=>V+1));return Y.observe(L),()=>Y.disconnect()},[]),i.useEffect(()=>{if(!X)return;let L=!1;if(!R.current)return;async function V($,se){if(se){const we=Ml(se);return{width:se.width,height:se.height,imageData:null,make:Ae=>{const ge=Ae.createTexture(se.width,se.height,we.format);return ge.write(we.data),ge}}}if(!$)return null;const de=await mt($);return de?{width:de.width,height:de.height,imageData:de,make:we=>{const Ae=we.createTexture(de.width,de.height,"rgba8unorm");return Ae.write(de.data),Ae}}:null}return Promise.all([V(e,n),V(t,r)]).then(([$,se])=>{var Ne,Qe;if(L||!R.current)return;const de=R.current;Ee.current=($==null?void 0:$.imageData)??null,D.current=(se==null?void 0:se.imageData)??null,H.current=n??null,Q.current=r??null,(Ne=de.texA)==null||Ne.destroy(),(Qe=de.texB)==null||Qe.destroy(),de.texA=null,de.texB=null;const we=$??se;if(!we){pe(null),k(null),q(yt=>yt+1);return}const Ae=se??we,ge=$??we;de.texA=Ae.make(de.device),de.texB=ge.make(de.device),k({a:{w:Ae.width,h:Ae.height},b:{w:ge.width,h:ge.height}}),Z({a:Ae.imageData!=null,b:ge.imageData!=null}),pe({w:we.width,h:we.height}),q(yt=>yt+1),le(yt=>yt+1)}),()=>{L=!0}},[X,e,t,n,r]);const je=n!=null||r!=null,Oe=i.useMemo(()=>Uc(_e,je),[_e,je]),it=i.useMemo(()=>{if(!je)return null;const L=r??n;if(!L)return null;const Y=L.precision==="f16-bits"?Ir(L.data):L.data;return gl(Y,L.width,L.height,L.channels)},[je,r,n]),Xt=i.useMemo(()=>{var L;return na(((L=xt(Oe))==null?void 0:L.displayRange)??"unit",Ve==="none"?null:Ve)},[Oe,Ve]),Pt=i.useMemo(()=>Ve!=="none"?_l(Ve):void 0,[Ve]),tt=i.useMemo(()=>fe?Ut(fe.a,fe.b,d,g,"b"):null,[fe,d,g]),Wt=i.useMemo(()=>tt?Yn(tt):"none",[tt]),_n=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",Mn=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",$e=ae,dr=i.useCallback(()=>{const L=R.current;if(!X||!L||!L.surface||!L.texA||!L.texB||!ae)return;const Y=$e??ae,V=A.current,$=V?V.getBoundingClientRect():{width:Y.w,height:Y.h},se=$o({zoom:M,pan:x},$,Y.w,Y.h);Pe(ge=>ge.x===se.x&&ge.y===se.y&&ge.w===se.w&&ge.h===se.h?ge:se);const de=B.current;if($.width>0&&$.height>0&&de&&L.surface){const ge=Math.max(1,Math.round($.width*xe)),Ne=Math.max(1,Math.round($.height*xe));(de.width!==ge||de.height!==Ne)&&(de.width=ge,de.height=Ne,L.surface.configure(ge,Ne))}const we=Xo(se,$,Y.w,Y.h)>=cn?"nearest":"linear",Ae=se;try{if(be==="diff"){const ge=xt(Oe)?Oe:"absolute",Ne=ge==="hdr-flip"&&it?{ppd:67,startExposure:it.startExposure,stopExposure:it.stopExposure,numExposures:it.numExposures}:void 0,Qe=xs(L.device,L.texA,L.texB,ge,Ne,_n,Mn,tt??void 0);N.current=Qe,cl(L.device,L.surface,Qe.texture,Qe.displayRange,{uv:Ae,cmapMode:Xt,colormap:Pt,filter:we,sourceDims:Y,exposureEV:O,offset:he})}else{const ge=Dr(Ke,z.current?Ze:1,z.current,at),Ne={exposureEV:O,offset:he,operator:ge.operator,gamma:ge.gamma,isScalar:!1,hdrOut:ge.hdrOut,peak:ge.peak,srgbDecodeA:G.a,srgbDecodeB:G.b,uv:Ae,filter:we,mode:be,split:a,alpha:s};ri(L.device,L.surface,L.texA,L.texB,Ne)}}catch(ge){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",ge),K(!0)}},[X,ae,$e,tt,M,x.x,x.y,be,a,s,O,he,Ke,Ze,at,G,_e,Oe,it,Xt,Pt,e,t,n,r,_n,Mn,xe]);i.useEffect(()=>{dr()},[dr,W,j]);const Nt=t!=null||r!=null;i.useEffect(()=>{const L=R.current;if(!X||!L||!L.texA||!L.texB||!Nt){oe(null);return}let Y=!1;const V=L.texA,$=L.texB,se=N.current,de=be==="diff"?tt??void 0:void 0;return(be==="diff"&&se?tl(L.device,se,V,$,de):oo(L.device,V,$,de)).then(Ae=>{Y||oe(Ae)}),()=>{Y=!0}},[X,W,Nt,be,_e,tt]),i.useEffect(()=>{const L=R.current;if(!X||!L||!L.texA||!L.texB||!Nt){Re(null);return}let Y=!1;Re(null);const V=be==="diff"?tt??void 0:void 0;return Qc(L.device,L.texA,L.texB,_n,Mn,V).then($=>{Y||Re($)}).catch(()=>{Y||Re(null)}),()=>{Y=!0}},[X,W,Nt,be,Wt,_n,Mn]),i.useEffect(()=>{if(be!=="diff"){J.current=null,De.current=null;return}const L=R.current,Y=N.current;if(!X||!L||!Y)return;let V=!1;return J.current=null,De.current=null,Le($=>$+1),bs(L.device,Y).then($=>{V||(J.current=$,De.current={w:Y.width,h:Y.height},Le(se=>se+1))}).catch(()=>{}),()=>{V=!0}},[X,be,Oe,W,tt]);const Ss=(L,Y)=>(V,$,se)=>{const de=Y.current;if(de){const{data:yt,width:Cs,height:Dl,channels:Rs}=de;if(V<0||$<0||V>=Cs||$>=Dl)return null;const An=($*Cs+V)*Rs,Tn=de.precision==="f16-bits"?hr=>on(yt[hr]??0):hr=>yt[hr]??0,kl=Rs===1?[Tn(An)]:[Tn(An),Tn(An+1),Tn(An+2)];return _t(kl,"unit",se)}const we=L.current;if(!we||V<0||$<0||V>=we.width||$>=we.height)return null;const Ae=($*we.width+V)*4,ge=we.data[Ae],Ne=we.data[Ae+1],Qe=we.data[Ae+2];return _t(ge===Ne&&Ne===Qe?[ge]:[ge,Ne,Qe],"uint8",se)},Sn=i.useMemo(()=>Ss(Ee,H),[]),pr=i.useMemo(()=>Ss(D,Q),[]),mr=i.useMemo(()=>(L,Y,V)=>{var Qe;const $=J.current,se=De.current;if(!$||!se)return null;const{w:de,h:we}=se;if(L<0||Y<0||L>=de||Y>=we)return null;const Ae=(Y*de+L)*4,Ne=(((Qe=xt(Oe))==null?void 0:Qe.output)??"per-channel")==="scalar"?[$[Ae]??0]:[$[Ae]??0,$[Ae+1]??0,$[Ae+2]??0];return _t(Ne,"unit",V)},[Oe]);i.useEffect(()=>{const L=A.current;if(L)return L.__cairnCompareProbe={sampleDiff:(Y,V,$="decimal")=>mr(Y,V,$),sampleFg:(Y,V,$="decimal")=>Sn(Y,V,$),sampleRef:(Y,V,$="decimal")=>pr(Y,V,$),get diffSamples(){return J.current},get dims(){return $e},get primaryDims(){return ae},get diffResultDims(){return De.current},get align(){return d},get fit(){return g},get resolvedKernelId(){return Oe},get compareMode(){return be},computeCount:()=>Yc(),cacheSize:()=>R.current?nl(R.current.device):0,get ssimScalar(){return me},get ssimText(){return ps(me)},get effectiveTonemap(){return Ke},get hdrEngaged(){return ee}},()=>{L&&delete L.__cairnCompareProbe}},[mr,Sn,pr,ae,$e,d,g,Oe,be,me,Ke,ee]);const Cl=p==="auto"?void 0:p;if(I)return n!=null||r!=null?f.jsx(wl,{}):be==="diff"?f.jsx(Bo,{toolbar:T,source:Qi(e),baselineUrl:t,diffMode:((Ts=xt(Oe))==null?void 0:Ts.kind)==="pointwise"?Oe:"absolute",interpolation:p,colormap:Ve,showAxes:!1,zoom:M,pan:x,onViewportChange:m,label:E,pixelValueNotation:_}):f.jsx(yl,{imageUrl:e,baselineUrl:t,mode:be,splitPosition:a,blendAlpha:s,onSplitPositionChange:l,zoom:M,pan:x,onViewportChange:m,interpolation:p,label:E,pixelValueNotation:_});const Rl=f.jsxs(f.Fragment,{children:[f.jsx("canvas",{ref:B,className:"w-full h-full block",style:{imageRendering:Cl},"data-gpu-compare-canvas":!0}),be==="split"&&f.jsx(Ms,{splitPosition:a,onChange:l,onReset:()=>l==null?void 0:l(.5)})]}),As=!!E,Pl=As?"bottom-7":"bottom-1";return f.jsx(hn,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":X},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:T,paneRef:A,wrapperRef:C,zoom:M,pan:x,onViewportChange:m,naturalDims:$e,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:Rl,showAxes:!1,notationSeed:_,onReset:ft,extraModified:dt,exportCanvasRef:B,requestRender:dr,leadingMenus:ue,displayAdjust:{exposureEV:O,offset:he,onExposureChange:ve,onOffsetChange:Me},extraSliders:[...ee&&be!=="diff"?[{id:"peak",label:"PK",title:"Peak white (×SDR white) — the HDR ceiling P every operator clips at (Linear/sRGB/Gamma hard-clip at P; Reinhard/ACES roll off toward P). P=1 reproduces the SDR rendition exactly; double-click to type a value, including 'inf' for the raw browser-clipped extended look.",min:Er,max:It,step:_r,value:Ze,onChange:Bt,format:L=>Number.isFinite(L)?`${L.toFixed(1)}×`:"∞"}]:[],...be!=="diff"&&tn(Ke)?[{id:"gamma",label:"γ",title:"Display gamma γ for the Gamma transfer — display = clamp(value)^(1/γ), tev-style. Default 2.2 (close to sRGB, not identical). Double-click to type a value.",min:Qt,max:Jt,step:en,value:at,onChange:vt,format:L=>L.toFixed(1)}]:[]],label:"",showLabelChip:!1,overlay:{render:({notation:L,setOverlayActive:Y})=>be==="split"?f.jsxs(f.Fragment,{children:[Nt&&$e&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-a)*100}% 0 0)`},children:f.jsx(Mt,{imageElRef:B,naturalWidth:$e.w,naturalHeight:$e.h,zoom:M,pan:x,sourceWindow:ye,sample:pr,notation:L,version:U})}),Nt&&$e&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${a*100}%)`},children:f.jsx(Mt,{imageElRef:B,naturalWidth:$e.w,naturalHeight:$e.h,zoom:M,pan:x,sourceWindow:ye,sample:Sn,notation:L,version:U,onActiveChange:Y})})]}):$e&&f.jsx(Mt,{imageElRef:B,naturalWidth:$e.w,naturalHeight:$e.h,zoom:M,pan:x,sourceWindow:ye,sample:be==="diff"?mr:Sn,notation:L,version:be==="diff"?ke:U,onActiveChange:Y})},extraChips:f.jsxs(f.Fragment,{children:[be==="split"&&f.jsx(_s,{}),As?f.jsx(Kn,{label:E,corner:"bottom-right"}):null,ne&&f.jsxs("span",{className:`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${Pl}`,"data-gpu-compare-metrics":!0,children:["MSE ",ne.mse.toExponential(2)," · PSNR ",Number.isFinite(ne.psnr)?ne.psnr.toFixed(1):"∞"," dB · MAE"," ",ne.mae.toExponential(2)," · SSIM ",ps(me)]})]})})}const Al="cairn-plot:gpu-image-ready";async function Tl(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await Yt(),window.__cairnPlotGpuImagePane=pc,window.__cairnPlotGpuComparePane=Sl,window.__cairnPlotDiffMenuModes=fs(),window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(Al))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e),Vo("no-webgpu")}}}Tl()})(__cairnPlotJsxRuntime,__cairnPlotReact);
