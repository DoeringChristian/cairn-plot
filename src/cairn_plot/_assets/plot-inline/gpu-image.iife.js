var vl=Object.defineProperty;var wl=(f,c,st)=>c in f?vl(f,c,{enumerable:!0,configurable:!0,writable:!0,value:st}):f[c]=st;var oe=(f,c,st)=>wl(f,typeof c!="symbol"?c+"":c,st);(function(f,c){"use strict";const st=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function cr(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:st}),{hdr:!1,format:n}}function ws(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:st}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:st}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return cr(e,t)}}}const ys=`
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
`,Es=`
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
`;class _s extends Error{constructor(n){super(n);oe(this,"deviceLost",!0);this.name="DeviceLostError"}}async function lr(e,t){try{await e.mapAsync(GPUMapMode.READ)}catch(n){if((n instanceof Error?n.name:"")==="AbortError"){const o=t.info;throw new _s("webgpu readback: buffer map aborted — device lost or destroyed mid-readback"+(o?` (reason=${String(o.reason)}${o.message?`: ${o.message}`:""})`:"")+`: ${n instanceof Error?n.message:String(n)}`)}throw n instanceof Error?n:new Error(String(n))}}function En(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function ur(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Ms(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const Ss={texture:0,sampler:1,uniform:2};function _n(e,t){return e*3+Ss[t]}const As={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function Ps(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),a=r[2]!==void 0,s=r[3].trim();if(a){const u=As[s];if(u===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${s}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:u})}else s==="sampler"||s==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class fr{constructor(t,n,r,o){oe(this,"width");oe(this,"height");oe(this,"format");oe(this,"gpuTexture");oe(this,"device");oe(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:En(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*ur(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class dr{constructor(t){oe(this,"_s");oe(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class Ts{constructor(t,n,r,o,a){oe(this,"_p");oe(this,"gpuPipeline");oe(this,"bindings");oe(this,"bindGroupLayout");oe(this,"variants");oe(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=a,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function Rs(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class Cs{constructor(t){oe(this,"_c");oe(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class Ds{constructor(t,n,r,o,a){oe(this,"width");oe(this,"height");oe(this,"paramsBuffer");oe(this,"bindGroup");oe(this,"buffers");oe(this,"destroyed",!1);this.width=t,this.height=n,this.buffers=r,this.paramsBuffer=o,this.bindGroup=a}destroy(){if(!this.destroyed){for(const t of this.buffers)t.destroy();this.paramsBuffer.destroy(),this.destroyed=!0}}}class ks{constructor(t,n){oe(this,"_b");oe(this,"gpuBindGroup");oe(this,"ownedBuffers");oe(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class Os{constructor(t,n,r,o){oe(this,"canvas");oe(this,"hdr");oe(this,"format");oe(this,"context");oe(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function Gt(e){return"canvas"in e}async function Ls(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function a(p){return Gt(p)?p.getCurrentTextureView():p.gpuTexture.createView()}function s(p){if(Gt(p))return{width:p.canvas.width,height:p.canvas.height};const E=p;return{width:E.width,height:E.height}}let u=!1;const i={};t.lost.then(p=>{i.info=p},()=>{});let l=null;function d(){var E,_;if(l!==null)return l;let p=!1;try{if(typeof document<"u"){const y=document.createElement("canvas");y.width=1,y.height=1;const C=y.getContext("webgpu");if(C)try{C.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:GPUTextureUsage.RENDER_ATTACHMENT});const S=(E=C.getConfiguration)==null?void 0:E.call(C);p=((_=S==null?void 0:S.toneMapping)==null?void 0:_.mode)==="extended"}catch{p=!1}finally{try{C.unconfigure()}catch{}}}}catch{p=!1}return l=p,p}const x=256;let m=null,b=null;function w(){if(!m||!b){const p=t.createShaderModule({code:ys});b=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const E=t.createPipelineLayout({bindGroupLayouts:[b]});m=t.createComputePipeline({layout:E,compute:{module:p,entryPoint:"cs_main"}})}return{pipeline:m,layout:b}}let v=null,M=null;function h(){if(!v||!M){const p=t.createShaderModule({code:Es});M=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});const E=t.createPipelineLayout({bindGroupLayouts:[M]});v=t.createRenderPipeline({layout:E,vertex:{module:p,entryPoint:"vs_main"},fragment:{module:p,entryPoint:"fs_main",targets:[{format:"rgba16float"}]},primitive:{topology:"triangle-list"}})}return{pipeline:v,layout:M}}return{backend:"webgpu",capabilities:n,probeExtendedToneMapping:d,createTexture(p,E,_){return new fr(t,p,E,_)},createSampler(p){const E=(p==null?void 0:p.filter)==="linear"?"linear":"nearest",_=t.createSampler({magFilter:E,minFilter:E,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new dr(_)},createRenderPipeline(p){const E=t.createShaderModule({code:p.shaderWGSL}),_=Ps(p.shaderWGSL),y=En(p.targetFormat),C=Rs(t,_),S=t.createPipelineLayout({bindGroupLayouts:[C]}),A=T=>t.createRenderPipeline({layout:S,vertex:{module:E,entryPoint:"vs_main"},fragment:{module:E,entryPoint:"fs_main",targets:[{format:T}]},primitive:{topology:"triangle-list"}}),P=A(y);return new Ts(P,_,C,y,A)},createComputePipeline(p){const E=t.createShaderModule({code:p.shaderWGSL}),_=t.createComputePipeline({layout:"auto",compute:{module:E,entryPoint:"cs_main"}});return new Cs(_)},createBindGroup(p,E){const _=p,y=new Map,C=[];for(const[A,P]of _.bindings)if(P.kind==="uniform"){const T=t.createBuffer({size:P.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});C.push(T),y.set(A,{binding:A,resource:{buffer:T}})}else P.kind==="sampler"&&y.set(A,{binding:A,resource:o()});for(const A of E){const P=A.resource;if(P instanceof fr){const T=_n(A.binding,"texture");_.bindings.has(T)&&y.set(T,{binding:T,resource:P.gpuTexture.createView()})}else if(P instanceof dr){const T=_n(A.binding,"sampler");_.bindings.has(T)&&y.set(T,{binding:T,resource:P.gpuSampler})}else{const T=_n(A.binding,"uniform"),k=_.bindings.get(T);if(k&&k.kind==="uniform"){const R=P.uniform,L=t.createBuffer({size:Math.max(k.sizeBytes,R.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(L,0,R.buffer,R.byteOffset,R.byteLength),C.push(L),y.set(T,{binding:T,resource:{buffer:L}})}}}const S=t.createBindGroup({layout:_.bindGroupLayout,entries:Array.from(y.values())});return new ks(S,C)},createSurface(p,E){const _=p.getContext("webgpu");if(!_)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const y=E.hdr&&n.hdr,C=()=>y?ws(_,t):cr(_,t),S=C();return new Os(p,_,S,C)},renderFullscreen(p,E,_){const y=E,C=_,S=a(p),{width:A,height:P}=s(p),T=Gt(p)?p.format:En(p.format),k=y.pipelineFor(T),R=t.createCommandEncoder(),L=R.beginRenderPass({colorAttachments:[{view:S,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});L.setPipeline(k),L.setBindGroup(0,C.gpuBindGroup),L.setViewport(0,0,A,P,0,1),L.draw(3),L.end(),t.queue.submit([R.finish()])},createDeepSampleBuffers(p){const{layout:E}=h(),_=T=>{const k=t.createBuffer({size:T.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});return t.queue.writeBuffer(k,0,T.buffer,T.byteOffset,T.byteLength),k},y=_(p.offsets),C=_(p.colors),S=_(p.zs),A=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),P=t.createBindGroup({layout:E,entries:[{binding:0,resource:{buffer:y}},{binding:1,resource:{buffer:C}},{binding:2,resource:{buffer:S}},{binding:3,resource:{buffer:A}}]});return new Ds(p.width,p.height,[y,C,S],A,P)},compositeDeep(p,E,_,y){const C=p,S=E,{pipeline:A}=h();t.queue.writeBuffer(C.paramsBuffer,0,new Float32Array([C.width,C.height,y,_]));const P=t.createCommandEncoder(),T=P.beginRenderPass({colorAttachments:[{view:S.gpuTexture.createView(),loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});T.setPipeline(A),T.setBindGroup(0,C.bindGroup),T.setViewport(0,0,S.width,S.height,0,1),T.draw(3),T.end(),t.queue.submit([P.finish()])},async readback(p){const E=Gt(p),{width:_,height:y}=s(p),C=E?p.hdr?"rgba16float":"rgba8unorm":p.format,S=E&&p.format==="bgra8unorm",A=E?p.getCurrentGPUTexture():p.gpuTexture,P=ur(C),T=_*P,k=256,R=Math.ceil(T/k)*k,L=R*y,I=t.createBuffer({size:L,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),H=t.createCommandEncoder();H.copyTextureToBuffer({texture:A},{buffer:I,bytesPerRow:R,rowsPerImage:y},{width:_,height:y,depthOrArrayLayers:1}),t.queue.submit([H.finish()]);try{await lr(I,i)}catch(N){try{I.destroy()}catch{}throw N}const V=new Uint8Array(I.getMappedRange()),z=new Uint8Array(T*y);for(let N=0;N<y;N++){const j=N*R,$=N*T;z.set(V.subarray(j,j+T),$)}if(I.unmap(),I.destroy(),C==="rgba8unorm"){if(S)for(let N=0;N<z.length;N+=4){const j=z[N],$=z[N+2];z[N]=$,z[N+2]=j}return z}if(C==="rgba16float"){const N=new Uint16Array(z.buffer,z.byteOffset,z.byteLength/2),j=new Float32Array(N.length);for(let $=0;$<N.length;$++)j[$]=Ms(N[$]);return j}return new Float32Array(z.buffer,z.byteOffset,z.byteLength/4)},async reduceDiffSumSquaredAbs(p,E,_,y){const C=p,S=E,A=Math.max(0,_*y),P=Math.max(1,Math.ceil(A/x)),{pipeline:T,layout:k}=w(),R=P*2*4,L=t.createBuffer({size:R,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),I=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(I,0,new Uint32Array([Math.max(1,_),Math.max(1,y),A,0]));const H=t.createBindGroup({layout:k,entries:[{binding:0,resource:C.gpuTexture.createView()},{binding:1,resource:S.gpuTexture.createView()},{binding:2,resource:{buffer:L}},{binding:3,resource:{buffer:I}}]}),V=t.createBuffer({size:R,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),z=t.createCommandEncoder(),N=z.beginComputePass();N.setPipeline(T),N.setBindGroup(0,H),N.dispatchWorkgroups(P),N.end(),z.copyBufferToBuffer(L,0,V,0,R),t.queue.submit([z.finish()]);try{await lr(V,i)}catch(ue){for(const W of[V,L,I])try{W.destroy()}catch{}throw ue}const $=new Float32Array(V.getMappedRange()).slice();V.unmap(),V.destroy(),L.destroy(),I.destroy();let le=0,ae=0;for(let ue=0;ue<P;ue++)le+=$[ue*2],ae+=$[ue*2+1];return{sumSq:le,sumAbs:ae}},destroy(){u||(t.destroy(),u=!0)},isContextLost(){return!1}}}let Mn=null;async function Bs(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return Ls()}function Ut(){return Mn||(Mn=Bs()),Mn}function Ns(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function Is(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),a=Math.floor(o),s=Math.min(a+1,e.length-1),u=o-a,[i,l,d]=Ns(e[a],e[s],u);t[n*3]=Math.round(i),t[n*3+1]=Math.round(l),t[n*3+2]=Math.round(d)}return t}const Sn={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},Fs=Object.keys(Sn),Gs={viridis:"Viridis",plasma:"Plasma",magma:"Magma","red-green":"Red–Green","red-blue":"Red–Blue"},Us=Fs.map(e=>({id:e,label:Gs[e]})),zs=new Set(["red-green","red-blue"]),pr=new Map;function An(e){let t=pr.get(e);if(!t){const n=Sn[e]??Sn.viridis;t=Is(n),pr.set(e,t)}return t}function mt(e,t,n){return e<t?t:e>n?n:e}function Ne(e){return e<0?0:e>1?1:e}function zt(e,t,n){return mt(Math.floor(e),t,n)}const Pn=e=>{const t=e<0?0:e;return t/(1+t)},Tn=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return Ne(n/r)},Vt=4,mr=1,Ct=16,hr=.5,gr={linear:([e,t,n])=>[Ne(e),Ne(t),Ne(n)],srgb:([e,t,n])=>[Ne(e),Ne(t),Ne(n)],gamma:([e,t,n])=>[Ne(e),Ne(t),Ne(n)],reinhard:([e,t,n])=>[Pn(e),Pn(t),Pn(n)],aces:([e,t,n])=>[Tn(e),Tn(t),Tn(n)],extended:([e,t,n])=>[e,t,n]},xr="srgb",br=["linear","srgb","gamma","reinhard","aces"],Vs=["srgb","gamma","linear"],vr={extended:"linear","extended-clamp":"linear","extended-reinhard":"reinhard","extended-aces":"aces","extended-gamma":"gamma"};function $s(e){return e&&gr[e]||gr[xr]}function $t(e){return e&&vr[e]?vr[e]:e&&br.includes(e)?e:xr}const wr=$t;function yr(e){return e==="extended"?Hs:void 0}function Er(e,t){return e==null?"srgb":wr(e)}function Xt(e,t,n){return e*2**t+n}function Xs(e){const t=Ne(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function Rn(e){const t=Ne(e);return t<=.04045?t/12.92:Math.pow((t+.055)/1.055,2.4)}function _t(e,t){return typeof t=="number"&&t>0?Ne(Math.pow(Ne(e),1/t)):Xs(e)}const Mt=2.2,Ht=.5,Wt=4,Yt=.1;function Kt(e){return e==="gamma"}function Cn(e,t){if(e==="gamma")return t>0?t:Mt;if(e==="linear")return 1}const Hs=1/0;function _r(e,t,n,r){const o=wr(e),a=Cn(o,r);if(!n||Number.isFinite(t)&&t<=1)return{operator:o,hdrOut:!1,peak:1,gamma:a};const s=!Number.isFinite(t);switch(o){case"reinhard":return s?{operator:"extended",hdrOut:!0,peak:Ct,gamma:void 0}:{operator:"extended-reinhard",hdrOut:!0,peak:t,gamma:void 0};case"aces":return{operator:"extended-aces",hdrOut:!0,peak:s?Ct:t,gamma:void 0};default:return s?{operator:"extended",hdrOut:!0,peak:Ct,gamma:a}:{operator:"extended-clamp",hdrOut:!0,peak:t,gamma:a}}}function Dn(e,t,n="linear",r=0,o=0){const a=An(t),s=new ImageData(e.width,e.height),u=e.data,i=s.data,l=r!==0||o!==0;for(let d=0;d<u.length;d+=4){let x=(u[d]+u[d+1]+u[d+2])/3;l&&(x=Math.max(0,Math.min(255,Xt(x/255,r,o)*255)));let m;n==="positive"?m=Math.round(128+x/255*127):m=Math.round(x),m=Math.max(0,Math.min(255,m)),i[d]=a[m*3],i[d+1]=a[m*3+1],i[d+2]=a[m*3+2],i[d+3]=u[d+3]}return s}function Ws(e,t){return e==="signed"||e==="relative"?"signed":kn(t)}function kn(e){return zs.has(e??"")?"positive":"linear"}function Mr(e,t){const n=new Map;return{get(r){const o=n.get(r);if(o!==void 0)return n.delete(r),n.set(r,o),o},set(r,o){for(n.get(r)!==void 0&&n.delete(r),n.set(r,o);n.size>e;){const s=n.keys().next().value;if(s===void 0)break;n.get(s),n.delete(s)}},has(r){return n.has(r)},get size(){return n.size}}}const Sr=Mr(50);function On(e){return Sr.get(e)}function Ln(e,t){Sr.set(e,t)}const Ar=Mr(100);function Ys(e){return Ar.get(e)}function Ks(e,t){Ar.set(e,t)}function qs(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),a=new ImageData(r,o);for(let s=0;s<o;s++)for(let u=0;u<r;u++){const i=(s*e.width+u)*4,l=(s*t.width+u)*4,d=(s*r+u)*4;for(let x=0;x<3;x++){const m=e.data[i+x],b=t.data[l+x],w=m-b,v=Math.abs(w),M=Math.max(m,1);let h;switch(n){case"signed":h=(w+255)/2;break;case"absolute":h=v;break;case"squared":h=w*w/255;break;case"relative_signed":h=(w/M+1)*127.5;break;case"relative_absolute":h=v/M*255;break;case"relative_squared":h=w*w/(M*M)*255;break}a.data[d+x]=Math.min(255,Math.max(0,Math.round(h)))}a.data[d+3]=255}return a}async function at(e){const t=Ys(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const a=o.getContext("2d");if(!a){n(null);return}a.drawImage(r,0,0);const s=a.getImageData(0,0,o.width,o.height);Ks(e,s),n(s)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const Zs={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},Qs={linear:0,signed:1,positive:2},js=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,Js=`#version 300 es
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
}`;let ht=null,ee=null,Le=null,qt=null;function ea(){if(ee)return ee;try{if(typeof OffscreenCanvas<"u"?ht=new OffscreenCanvas(1,1):ht=document.createElement("canvas"),ee=ht.getContext("webgl2",{preserveDrawingBuffer:!0}),!ee)return console.warn("[cairn] WebGL 2 not available"),null;const e=ee.createShader(ee.VERTEX_SHADER);if(ee.shaderSource(e,js),ee.compileShader(e),!ee.getShaderParameter(e,ee.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",ee.getShaderInfoLog(e)),null;const t=ee.createShader(ee.FRAGMENT_SHADER);if(ee.shaderSource(t,Js),ee.compileShader(t),!ee.getShaderParameter(t,ee.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",ee.getShaderInfoLog(t)),null;if(Le=ee.createProgram(),ee.attachShader(Le,e),ee.attachShader(Le,t),ee.linkProgram(Le),!ee.getProgramParameter(Le,ee.LINK_STATUS))return console.error("[cairn] WebGL program link:",ee.getProgramInfoLog(Le)),null;qt=ee.createVertexArray(),ee.bindVertexArray(qt);const n=ee.createBuffer();ee.bindBuffer(ee.ARRAY_BUFFER,n),ee.bufferData(ee.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),ee.STATIC_DRAW);const r=ee.getAttribLocation(Le,"a_pos");return ee.enableVertexAttribArray(r),ee.vertexAttribPointer(r,2,ee.FLOAT,!1,0,0),ee.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),ee}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function Pr(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function ta(e,t,n){const r=new Uint8Array(1024);for(let a=0;a<256;a++)r[a*4]=t[a*3],r[a*4+1]=t[a*3+1],r[a*4+2]=t[a*3+2],r[a*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function na(e,t,n,r){const o=ea();if(!o||!Le||!qt||!ht)return null;const a=Math.min(e.width,t.width),s=Math.min(e.height,t.height);ht.width=a,ht.height=s,o.viewport(0,0,a,s);const u=Pr(o,e,0),i=Pr(o,t,1);let l=null;n.colormap?l=ta(o,n.colormap,2):(l=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,l),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(Le),o.uniform1i(o.getUniformLocation(Le,"u_baseline"),0),o.uniform1i(o.getUniformLocation(Le,"u_other"),1),o.uniform1i(o.getUniformLocation(Le,"u_lut"),2),o.uniform1i(o.getUniformLocation(Le,"u_diff_mode"),Zs[n.diffMode]),o.uniform1i(o.getUniformLocation(Le,"u_cmap_mode"),Qs[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(Le,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(qt),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=a,r.height=s;const d=r.getContext("2d");return d&&(d.save(),d.scale(1,-1),d.drawImage(ht,0,0,a,s,0,-s,a,s),d.restore()),o.deleteTexture(u),o.deleteTexture(i),o.deleteTexture(l),{width:a,height:s}}const ra="cairn:render-mode";function oa(){try{const e=localStorage.getItem(ra);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const Zt=15360;function Qt(e){const t=e&32768?-1:1,n=e>>10&31,r=e&1023;return n===0?r===0?t*0:t*r*2**-24:n===31?r===0?t*(1/0):NaN:t*2**(n-15)*(1+r/1024)}const Tr=globalThis.Float16Array;function Rr(e,t=e.length){if(Tr){const r=new Tr(e.buffer,e.byteOffset,t);return Float32Array.from(r)}const n=new Float32Array(t);for(let r=0;r<t;r++)n[r]=Qt(e[r]);return n}const Ze=new Uint32Array(512),Qe=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(Ze[e]=0,Ze[e|256]=32768,Qe[e]=24,Qe[e|256]=24):t<-14?(Ze[e]=1024>>-t-14,Ze[e|256]=1024>>-t-14|32768,Qe[e]=-t-1,Qe[e|256]=-t-1):t<=15?(Ze[e]=t+15<<10,Ze[e|256]=t+15<<10|32768,Qe[e]=13,Qe[e|256]=13):t<128?(Ze[e]=31744,Ze[e|256]=64512,Qe[e]=24,Qe[e|256]=24):(Ze[e]=31744,Ze[e|256]=64512,Qe[e]=13,Qe[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var Dt=Uint8Array,Cr=Uint16Array,sa=Int32Array,aa=new Dt([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),ia=new Dt([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),Dr=function(e,t){for(var n=new Cr(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new sa(n[30]),r=1;r<30;++r)for(var a=n[r];a<n[r+1];++a)o[a]=a-n[r]<<5|r;return{b:n,r:o}},kr=Dr(aa,2),ca=kr.b,la=kr.r;ca[28]=258,la[258]=28,Dr(ia,0);for(var ua=new Cr(32768),ye=0;ye<32768;++ye){var it=(ye&43690)>>1|(ye&21845)<<1;it=(it&52428)>>2|(it&13107)<<2,it=(it&61680)>>4|(it&3855)<<4,ua[ye]=((it&65280)>>8|(it&255)<<8)>>1}for(var jt=new Dt(288),ye=0;ye<144;++ye)jt[ye]=8;for(var ye=144;ye<256;++ye)jt[ye]=9;for(var ye=256;ye<280;++ye)jt[ye]=7;for(var ye=280;ye<288;++ye)jt[ye]=8;for(var fa=new Dt(32),ye=0;ye<32;++ye)fa[ye]=5;var da=new Dt(0),pa=typeof TextDecoder<"u"&&new TextDecoder,ma=0;try{pa.decode(da,{stream:!0}),ma=1}catch{}const Or=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function Bn(e){const t=Or.length;return Or[(e%t+t)%t]}function ha(e){const n=c.useRef(null),[r,o]=c.useState({w:0,h:0}),a=c.useRef(null),s=c.useRef(null),u=c.useRef(null),i=c.useCallback((l,d)=>{o(x=>x.w===l&&x.h===d?x:{w:l,h:d})},[]);return c.useLayoutEffect(()=>{const l=n.current;if(!l||l===u.current)return;const d=l.getBoundingClientRect();(d.width>0||d.height>0)&&(u.current=l,i(d.width,d.height))}),c.useEffect(()=>{var x;const l=n.current;if(l===s.current||((x=a.current)==null||x.disconnect(),a.current=null,s.current=l,!l))return;const d=new ResizeObserver(m=>{for(const b of m)i(b.contentRect.width,b.contentRect.height)});a.current=d,d.observe(l)}),c.useEffect(()=>()=>{var l;return(l=a.current)==null?void 0:l.disconnect()},[]),{ref:n,size:r}}function ga(){const[e,t]=c.useState(!1);return c.useEffect(()=>{const n=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!0)},r=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const xa=.001;function ba(e,t=xa){return Math.exp(-e*t)}function Lr(e,t){return Math.hypot(e.x-t.x,e.y-t.y)}function Br(e,t){return{x:(e.x+t.x)/2,y:(e.y+t.y)/2}}function va(e,t,n,r,o,a,s){const u=t>0&&r>0?r/t:1,i=Math.max(a,Math.min(s,e.zoom*u)),l=(n.x-e.pan.x)/e.zoom,d=(n.y-e.pan.y)/e.zoom;return{zoom:i,pan:{x:o.x-l*i,y:o.y-d*i}}}const wa=.25,Nn=64;function In(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return Nn;const o=Math.min(n/e,r/t);return o<=0?Nn:Math.max(Math.max(n,r)/o,8)}function Nr(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:a=wa,maxZoom:s=Nn,naturalWidth:u,naturalHeight:i}=e,l=ga(),d=c.useRef(l);d.current=l;const x=c.useRef({zoom:n,pan:r});x.current={zoom:n,pan:r};const m=c.useRef(o);m.current=o,c.useEffect(()=>{const S=t.current;if(!S||!o)return;const A=P=>{var j;if(!P.ctrlKey&&!d.current)return;P.preventDefault(),P.stopPropagation();const T=ba(P.deltaY),k=x.current,R=S.getBoundingClientRect(),L=u&&i?In(u,i,R.width,R.height):s,I=Math.max(a,Math.min(L,k.zoom*T));if(k.zoom===I)return;const H=P.clientX-R.left,V=P.clientY-R.top,z=H-(H-k.pan.x)/k.zoom*I,N=V-(V-k.pan.y)/k.zoom*I;(j=m.current)==null||j.call(m,{zoom:I,pan:{x:z,y:N}})};return S.addEventListener("wheel",A,{passive:!1}),()=>S.removeEventListener("wheel",A)},[t,!!o,a,s,u,i]);const b=c.useRef(new Map),w=c.useRef(null),v=c.useRef(null),M=c.useCallback((S,A,P)=>{const T=S.getBoundingClientRect();return{x:A-T.left,y:P-T.top}},[]),h=c.useCallback(S=>{if(!u||!i)return s;const A=S.getBoundingClientRect();return In(u,i,A.width,A.height)},[u,i,s]),g=c.useCallback((S,A)=>{const P=b.current,T=P.get(S),k=P.get(A);!T||!k||(w.current=null,v.current={idA:S,idB:A,startDist:Lr(T,k),startMid:Br(T,k),startZoom:x.current.zoom,startPan:{...x.current.pan}})},[]),p=c.useCallback(S=>{const A=b.current.get(S);A&&(w.current={pointerId:S,startX:A.x,startY:A.y,panX:x.current.pan.x,panY:x.current.pan.y})},[]),E=c.useCallback(S=>{if(!m.current)return;const A=S.pointerType==="touch";if(!A&&!d.current)return;const P=S.currentTarget;if(P.setPointerCapture(S.pointerId),b.current.set(S.pointerId,M(P,S.clientX,S.clientY)),A&&b.current.size>=2){const T=[...b.current.keys()];g(T[T.length-2],T[T.length-1]);return}p(S.pointerId)},[M,g,p]),_=c.useCallback(S=>{var R,L;const A=S.currentTarget,P=b.current.get(S.pointerId);if(P){const I=M(A,S.clientX,S.clientY);P.x=I.x,P.y=I.y}const T=v.current;if(T){const I=b.current.get(T.idA),H=b.current.get(T.idB);if(!I||!H)return;const V=va({zoom:T.startZoom,pan:T.startPan},T.startDist,T.startMid,Lr(I,H),Br(I,H),a,h(A));(R=m.current)==null||R.call(m,V);return}const k=w.current;!k||k.pointerId!==S.pointerId||!P||(L=m.current)==null||L.call(m,{zoom:x.current.zoom,pan:{x:k.panX+(P.x-k.startX),y:k.panY+(P.y-k.startY)}})},[M,a,h]),y=c.useCallback(S=>{var P;try{S.currentTarget.releasePointerCapture(S.pointerId)}catch{}b.current.delete(S.pointerId);const A=v.current;if(A&&(S.pointerId===A.idA||S.pointerId===A.idB)){v.current=null;const T=[...b.current.keys()];T.length===1&&p(T[0]);return}((P=w.current)==null?void 0:P.pointerId)===S.pointerId&&(w.current=null)},[p]);return{containerProps:{onPointerDown:E,onPointerMove:_,onPointerUp:y,onPointerCancel:y,style:{cursor:l&&!!o?"move":void 0,touchAction:o?"none":void 0}},modifierActive:l}}function Fn(){const[e,t]=c.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return c.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),a())};function a(){if(n)return;const s=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${s}dppx)`),r.addEventListener("change",o,{once:!0})}return a(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function Be(e){const t=c.useRef(e),[n,r]=c.useState(e),o=c.useCallback(()=>r(t.current),[]);return[n,r,{reset:o,isModified:!Object.is(n,t.current),default:t.current}]}function ya(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function Ir(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function Gn({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:a}=ha(),s=c.useRef(null),u=c.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),i=c.useMemo(()=>{const v=a.w,M=a.h;if(v<=0||M<=0||n<=0||r<=0)return null;const h=Math.min(v/n,M/r),g=n*h,p=r*h;return{left:(v-g)/2,top:(M-p)/2,width:g,height:p}},[a.w,a.h,n,r]),l=e.masks,d=t.showMasks&&!!l&&l.length>0,x=c.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(c.useEffect(()=>{if(!d||!l)return;const v=s.current;if(!v)return;(v.width!==n||v.height!==r)&&(v.width=n,v.height=r);const M=v.getContext("2d");if(!M)return;M.clearRect(0,0,v.width,v.height);let h=!1;const g=M.createImageData(n,r),p=g.data;let E=l.length,_=!1;const y=()=>{h||_&&M.putImageData(g,0,0)},C=document.createElement("canvas");C.width=n,C.height=r;const S=C.getContext("2d",{willReadFrequently:!0});for(const A of l){const P=new Image;P.onload=()=>{if(!h){if(S){S.clearRect(0,0,n,r),S.drawImage(P,0,0,n,r);const T=S.getImageData(0,0,n,r).data;for(let k=0;k<n*r;k++){const R=T[k*4];if(R===0||u.has(R))continue;const[L,I,H]=ya(Bn(R));p[k*4]=L,p[k*4+1]=I,p[k*4+2]=H,p[k*4+3]=255,_=!0}}E-=1,E===0&&y()}},P.onerror=()=>{E-=1,E===0&&y()},P.src=`data:image/png;base64,${A.png_b64}`}return()=>{h=!0}},[d,l,n,r,x]),!i)return f.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const m=e.boxes??[],b=t.showBoxes&&m.length>0,w=e.class_labels??{};return f.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[d&&f.jsx("canvas",{ref:s,className:"absolute",style:{left:i.left,top:i.top,width:i.width,height:i.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),b&&f.jsx("svg",{className:"absolute",style:{left:i.left,top:i.top,width:i.width,height:i.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:m.map((v,M)=>{if(!Ir(v,t,u))return null;const h=v.domain==="pixel"?1:n,g=v.domain==="pixel"?1:r,p=v.position.minX*h,E=v.position.minY*g,_=(v.position.maxX-v.position.minX)*h,y=(v.position.maxY-v.position.minY)*g;return f.jsx("rect",{x:p,y:E,width:_,height:y,fill:"none",stroke:Bn(v.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},M)})}),b&&f.jsx("div",{className:"absolute",style:{left:i.left,top:i.top,width:i.width,height:i.height},children:m.map((v,M)=>{if(!Ir(v,t,u))return null;const h=v.domain==="pixel"?1/n:1,g=v.domain==="pixel"?1/r:1,p=v.position.minX*h*100,E=v.position.minY*g*100,_=v.label??w[String(v.class_id)]??`#${v.class_id}`,y=v.score!=null?` ${(v.score*100).toFixed(0)}%`:"";return!_&&!y?null:f.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${p}%`,top:`${E}%`,transform:"translateY(-100%)",backgroundColor:Bn(v.class_id)},children:f.jsxs("span",{className:"mono",children:[_,y]})},M)})})]})}function Ea(e,t){const n=t==null?void 0:t.precision,r=_a(e,n);return t!=null&&t.minus?r.replace("-","−"):r}function _a(e,t){if(!Number.isFinite(e))return String(e);if(e===0)return"0";const n=Math.abs(e);return n>=1e3||n<.001?e.toExponential(Math.max(0,t-2)):Number(e.toPrecision(t)).toString()}const Ma={x:0,y:0,w:1,h:1};function Jt(e){const t=e.sourceWindow??Ma,n=t.x*e.naturalWidth,r=t.y*e.naturalHeight,o=t.w*e.naturalWidth,a=t.h*e.naturalHeight,s=Math.min(e.box.width/o,e.box.height/a),u=o*s,i=a*s;return{scale:s,imgLeft:e.box.left+(e.box.width-u)/2,imgTop:e.box.top+(e.box.height-i)/2,srcOriginX:n,srcOriginY:r,visibleW:o,visibleH:a}}function Sa(e){return Jt(e).scale}function Fr(e,t,n){const r=Jt(n);return{x:r.srcOriginX+(e-r.imgLeft)/r.scale,y:r.srcOriginY+(t-r.imgTop)/r.scale}}function Gr(e,t,n){const r=Jt(n);return{x:r.imgLeft+(e-r.srcOriginX)*r.scale,y:r.imgTop+(t-r.srcOriginY)*r.scale}}function Aa(e,t){const n=Gr(e.x0,e.y0,t),r=Gr(e.x1+1,e.y1+1,t);return{left:n.x,top:n.y,width:r.x-n.x,height:r.y-n.y}}function Ur(e,t,n,r,o){const a=Fr(e,t,o),s=Fr(n,r,o),u=o.naturalWidth-1,i=o.naturalHeight-1,l=Math.min(a.x,s.x),d=Math.max(a.x,s.x),x=Math.min(a.y,s.y),m=Math.max(a.y,s.y);return d<0||l>u||m<0||x>i?null:{x0:zt(l,0,u),y0:zt(x,0,i),x1:zt(d,0,u),y1:zt(m,0,i)}}const en=30,Pa=.14,zr=1.15,Ta=.62,Ra=4,Ca=24,Da=6;function ka(e,t){if(e<=0||t<=0)return 0;const n=e*(1-2*Pa),r=n/(t*zr),o=n/(Ra*Ta);return Math.min(r,o,Ca)}function Oa(e){return e>=en}const tn=["#ff5a5a","#39d353","#5b9bff"],La="#ffffff",Ba="rgba(0,0,0,0.9)",Na=.15,Ia=.06;function Un(e){return Ea(e,{precision:3})}function St(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):Un(e/255):Un(n==="int"?e*255:e)}function gt(e,t,n){return e.length===1?{lines:[St(e[0],t,n)]}:{lines:e.map(r=>St(r,t,n)),colors:e.map((r,o)=>tn[o]??null)}}const Fa={x:0,y:0,w:1,h:1};function xt({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:a,notation:s="decimal",version:u=0,onActiveChange:i,sourceWindow:l=Fa}){const d=c.useRef(null),x=c.useRef(!1),m=Fn(),b=c.useRef(i);b.current=i;const w=c.useCallback(M=>{var h;M!==x.current&&(x.current=M,(h=b.current)==null||h.call(b,M))},[]),v=c.useCallback(()=>{var W;const M=d.current,h=e.current;if(!M)return;const g=window.devicePixelRatio||1,p=M.clientWidth,E=M.clientHeight;if(p===0||E===0)return;M.width!==Math.round(p*g)&&(M.width=Math.round(p*g)),M.height!==Math.round(E*g)&&(M.height=Math.round(E*g));const _=M.getContext("2d");if(!_)return;if(_.setTransform(g,0,0,g,0,0),_.clearRect(0,0,p,E),!h||t<=0||n<=0){w(!1);return}const y=h.getBoundingClientRect(),C=M.getBoundingClientRect();if(y.width===0||y.height===0){w(!1);return}const A=Jt({box:y,naturalWidth:t,naturalHeight:n,sourceWindow:l}),{srcOriginX:P,srcOriginY:T,visibleW:k,visibleH:R,scale:L}=A;if(k<=0||R<=0){w(!1);return}if(!Oa(L)){w(!1);return}const I=A.imgLeft-C.left,H=A.imgTop-C.top,V=Math.max(Math.floor(P),Math.floor(P+(0-I)/L)),z=Math.min(Math.ceil(P+k),Math.ceil(P+(p-I)/L)),N=Math.max(Math.floor(T),Math.floor(T+(0-H)/L)),j=Math.min(Math.ceil(T+R),Math.ceil(T+(E-H)/L));if(z<=V||j<=N){w(!1);return}w(!0);const $=I+(0-P)*L,le=H+(0-T)*L,ae=I+(t-P)*L,ue=H+(n-T)*L;_.save(),_.beginPath(),_.rect($,le,ae-$,ue-le),_.clip(),_.textAlign="center",_.textBaseline="middle";for(let K=N;K<j;K++)for(let q=V;q<z;q++){if(q<0||K<0||q>=t||K>=n)continue;const ne=a(q,K,s);if(!ne||ne.lines.length===0)continue;const ge=ne.lines.length,te=ka(L,ge);if(te<Da)continue;const fe=I+(q-P+.5)*L,ve=H+(K-T+.5)*L,Me=te*zr;_.font=`${te}px ui-monospace, SFMono-Regular, Menlo, monospace`,_.shadowColor=Ba,_.shadowBlur=Math.max(2,te*Na),_.shadowOffsetX=0,_.shadowOffsetY=Math.max(1,te*Ia);let ie=ve-ge*Me/2+Me/2;for(let Ae=0;Ae<ne.lines.length;Ae++){const xe=ne.lines[Ae];_.fillStyle=((W=ne.colors)==null?void 0:W[Ae])??La,_.fillText(xe,fe,ie),ie+=Me}}_.restore()},[e,t,n,a,s,w,l]);return c.useEffect(()=>{v()},[v,r,o.x,o.y,u,s,l,m]),c.useEffect(()=>{const M=d.current;if(!M)return;const h=new ResizeObserver(()=>v());return h.observe(M),()=>h.disconnect()},[v]),f.jsx("canvas",{ref:d,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function Vr({notation:e,onChange:t,className:n=""}){return f.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const Ga=`
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
`,bt=`
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
`,Ua=`
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
fn processSide(lut: texture_2d<f32>, sampled: vec4<f32>, exposureEV: f32, offset: f32, operatorId: i32, gamma: f32, isScalar: bool, hdrOut: bool, peak: f32, srgbDecode: bool) -> vec3<f32> {
  var src = sampled.rgb;
  if (srgbDecode) { src = vec3<f32>(srgbEotf(src.r), srgbEotf(src.g), srgbEotf(src.b)); }
  var rgb = src * exp2(exposureEV) + vec3<f32>(offset);
  if (isScalar) { rgb = sampleLUT(lut, rgb.x); }
  rgb = applyOperator(rgb, operatorId, peak);
  let hasGamma = gamma > 0.0;
  if (hdrOut) {
    return vec3<f32>(extendedOutputEncodeF(rgb.r, gamma, hasGamma), extendedOutputEncodeF(rgb.g, gamma, hasGamma), extendedOutputEncodeF(rgb.b, gamma, hasGamma));
  }
  return vec3<f32>(outputEncodeF(rgb.r, gamma, hasGamma), outputEncodeF(rgb.g, gamma, hasGamma), outputEncodeF(rgb.b, gamma, hasGamma));
}
`,nn=`
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
`;function $r(e){return`
${ze}
${bt}
${Ua}

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

  let colorA = processSide(lut, sampledA, exposureEV, offset, operatorId, gamma, isScalar, hdrOut, peak, srgbDecodeA);
  let colorB = processSide(lut, sampledB, exposureEV, offset, operatorId, gamma, isScalar, hdrOut, peak, srgbDecodeB);

  let split = u_compose.x;
  let alpha = u_compose.y;
  let outColor = ${e};
  return vec4<f32>(outColor, 1.0);
}
`}const za=$r("select(colorB, colorA, uv.x < split)"),Va=$r("mix(colorA, colorB, alpha)");function $a(e){switch(e){case"center":return{v:"center",h:"center"};case"top-right":return{v:"top",h:"right"};case"bottom-left":return{v:"bottom",h:"left"};case"bottom-right":return{v:"bottom",h:"right"};case"top-left":default:return{v:"top",h:"left"}}}function Xr(e,t,n){const{v:r,h:o}=$a(n),a=e.w-t.w,s=e.h-t.h,u=o==="left"?0:o==="right"?a:Math.floor(a/2),i=r==="top"?0:r==="bottom"?s:Math.floor(s/2);return{x:u,y:i}}function Ot(e,t,n,r,o="b"){if(r==="fill"){const s=o==="a"?{w:e.w,h:e.h}:{w:t.w,h:t.h};return{fit:r,result:s,offsetA:{x:0,y:0},offsetB:{x:0,y:0}}}const a={w:Math.min(e.w,t.w),h:Math.min(e.h,t.h)};return{fit:r,result:a,offsetA:Xr(e,a,n),offsetB:Xr(t,a,n)}}function zn(e){return`${e.fit}:${e.result.w}x${e.result.h}:${e.offsetA.x},${e.offsetA.y}:${e.offsetB.x},${e.offsetB.y}`}const rn={linear:0,srgb:1,reinhard:2,aces:3,extended:4,"extended-reinhard":5,"extended-aces":6,"extended-clamp":7,gamma:8},Hr=new WeakMap;function Xa(e,t){let n=Hr.get(e);n||(n=new Map,Hr.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:Ga,targetFormat:t}),n.set(t,r)),r}function Wr(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function Yr(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function Ha(e,t,n,r){var h;const o=Wr(t),a=Xa(e,o),s=Yr(e,r.isScalar?r.colormap:void 0),u=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,i=rn[r.operator]??rn.srgb,l=new Float32Array([r.exposureEV,i,u,r.isScalar?1:0]),d=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),x=new Float32Array([r.hdrOut?1:0]),m=new Float32Array([r.filter==="nearest"?0:1]),b=new Float32Array([r.offset??0]),w=new Float32Array([r.peak??Vt]),v=new Float32Array([r.srgbDecode?1:0]);let M;try{M=e.createBindGroup(a,[{binding:0,resource:n},{binding:1,resource:s},{binding:2,resource:{uniform:l}},{binding:3,resource:{uniform:d}},{binding:4,resource:{uniform:x}},{binding:5,resource:{uniform:m}},{binding:6,resource:{uniform:b}},{binding:7,resource:{uniform:w}},{binding:8,resource:{uniform:v}}]),e.renderFullscreen(t,a,M)}finally{(h=M==null?void 0:M.destroy)==null||h.call(M),s.destroy()}}const Kr=new WeakMap;function Wa(e,t,n){let r=Kr.get(e);r||(r=new Map,Kr.set(e,r));const o=`${t}:${n}`;let a=r.get(o);return a||(a=e.createRenderPipeline({shaderWGSL:t==="split"?za:Va,targetFormat:n}),r.set(o,a)),a}function Ya(e,t,n,r,o){var v;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const a=Wr(t),s=Wa(e,o.mode,a),u=Yr(e,o.isScalar?o.colormap:void 0),i=typeof o.gamma=="number"&&o.gamma>0?o.gamma:0,l=rn[o.operator]??rn.srgb,d=new Float32Array([o.exposureEV,l,i,o.isScalar?1:0]),x=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),m=new Float32Array([o.split,o.alpha,o.hdrOut?1:0,o.filter==="nearest"?0:1]),b=new Float32Array([o.offset??0,o.peak??Vt,o.srgbDecodeA?1:0,o.srgbDecodeB?1:0]);let w;try{w=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:u},{binding:3,resource:{uniform:d}},{binding:4,resource:{uniform:x}},{binding:5,resource:{uniform:m}},{binding:6,resource:{uniform:b}}]),e.renderFullscreen(t,s,w)}finally{(v=w==null?void 0:w.destroy)==null||v.call(w),u.destroy()}}function qr(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,a=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:a,mae:o}}async function Zr(e,t,n,r){const o=r??Ot({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),a=o.result.w,s=o.result.h,u=a*s*3;if(u<=0)return{mse:0,psnr:1/0,mae:0};if(o.fit==="crop"&&o.offsetA.x===0&&o.offsetA.y===0&&o.offsetB.x===0&&o.offsetB.y===0&&e.reduceDiffSumSquaredAbs){const{sumSq:p,sumAbs:E}=await e.reduceDiffSumSquaredAbs(t,n,a,s);return qr(p,E,u)}const l=await e.readback(t),d=await e.readback(n),x=l instanceof Uint8Array?255:1,m=d instanceof Uint8Array?255:1,b=on(l,t.width,t.height,x,o.offsetA,o.fit==="fill",a,s),w=on(d,n.width,n.height,m,o.offsetB,o.fit==="fill",a,s);let v=0,M=0;const h=[0,0,0],g=[0,0,0];for(let p=0;p<s;p++)for(let E=0;E<a;E++){b(E,p,h),w(E,p,g);for(let _=0;_<3;_++){const y=h[_]-g[_];v+=y*y,M+=Math.abs(y)}}return qr(v,M,u)}function on(e,t,n,r,o,a,s,u){const i=(x,m,b)=>e[(m*t+x)*4+b]??0;if(!a)return(x,m,b)=>{const w=Math.min(Math.max(x+o.x,0),t-1),v=Math.min(Math.max(m+o.y,0),n-1);b[0]=i(w,v,0)/r,b[1]=i(w,v,1)/r,b[2]=i(w,v,2)/r};const l=t-1,d=n-1;return(x,m,b)=>{const w=(x+.5)/s,v=(m+.5)/u,M=w*t-.5,h=v*n-.5,g=Math.floor(M),p=Math.floor(h),E=M-g,_=h-p,y=Math.min(Math.max(g,0),l),C=Math.min(Math.max(g+1,0),l),S=Math.min(Math.max(p,0),d),A=Math.min(Math.max(p+1,0),d);for(let P=0;P<3;P++){const T=i(y,S,P),k=i(C,S,P),R=i(y,A,P),L=i(C,A,P),I=T+(k-T)*E,H=R+(L-R)*E;b[P]=(I+(H-I)*_)/r}}}function Qr(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const Ka=12,ct=[];function jr(e){const t=ct.indexOf(e);t!==-1&&ct.splice(t,1),ct.push(e)}function qa(e){const t=ct.indexOf(e);t!==-1&&ct.splice(t,1)}function sn(e){e.parked||(qa(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),e.surface=null,e.parked=!0)}function Jr(e){for(;ct.length>Ka;){const t=ct.find(n=>n!==e&&!n.visible)??ct.find(n=>n!==e);if(!t)break;sn(t)}}function eo(e){var o,a,s,u;if(e.disposed)return;if(Qr())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){jr(e),Jr(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||((a=e.deep)==null?void 0:a.width)||1,r=e.backingHeight||((s=e.source)==null?void 0:s.height)||((u=e.deep)==null?void 0:u.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.deep){const i=t.createTexture(e.deep.width,e.deep.height,"rgba16float");e.srcTexture=i,e.deepBuffers=t.createDeepSampleBuffers(e.deep),t.compositeDeep(e.deepBuffers,i,e.deepZNear,e.deepZFar)}else if(e.source){const i=t.createTexture(e.source.width,e.source.height,e.source.format);i.write(e.source.data),e.srcTexture=i}e.parked=!1,jr(e),Jr(e)}function Za(e,t){if(e.disposed||!e.source&&!e.deep)return!0;try{return eo(e),!e.surface||!e.srcTexture?!1:(Ha(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,sn(e),!1}}function Qa(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,e.deep=null,e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},setDeepSource(t,n,r){if(!e.disposed&&(e.deep=t,e.deepZNear=n,e.deepZFar=r,e.source=null,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy(),e.deepBuffers&&e.deepBuffers.destroy();const o=e.device.createTexture(t.width,t.height,"rgba16float");e.srcTexture=o,e.deepBuffers=e.device.createDeepSampleBuffers(t),e.device.compositeDeep(e.deepBuffers,o,n,r)}},setDeepWindow(t,n){e.disposed||(e.deepZNear=t,e.deepZFar=n,!e.parked&&e.deepBuffers&&e.srcTexture&&e.device.compositeDeep(e.deepBuffers,e.srcTexture,t,n))},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return Za(e,t)},park(){e.disposed||sn(e)},restore(){e.disposed||!e.source&&!e.deep||eo(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(sn(e),e.source=null,e.deep=null,e.disposed=!0)}}}async function ja(e,t){const n=await Ut(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,deep:null,deepZNear:-1/0,deepZFar:1/0,deepBuffers:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return Qa(r)}function to(e){e.dispose()}function no({title:e,body:t,className:n}){return f.jsx("div",{className:n??"relative h-full w-full",children:f.jsxs("div",{className:"flex h-full w-full flex-col items-center justify-center gap-1 rounded bg-bg-hover p-4 text-center",children:[f.jsx("div",{className:"text-sm font-semibold text-fg",children:e}),f.jsx("div",{className:"text-xs text-fg-muted",children:t})]})})}function Ja(e,t,n){return t<=0||n<=0||e.width<=0||e.height<=0?0:Math.min(e.width/t,e.height/n)}function ei(e,t){return e>=t?"pixelated":void 0}function ti(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:a}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...a?["invert(1)"]:[]].join(" ")}function ro(e){const n=`cairn-gamma-${c.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:a,exposure:s,offset:u,flipSign:i}=e,l=c.useMemo(()=>ti(e,n),[n,r,o,s,i]);return{gammaFilterId:n,filterStr:l,gamma:a,offset:u}}function oo({id:e,gamma:t,offset:n}){return f.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:f.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:f.jsxs("feComponentTransfer",{children:[f.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),f.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),f.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}const ni=["nw","n","ne","e","se","s","sw","w"];function ri(e,t,n,r,o,a=1){const s=o.w-1,u=o.h-1,i=Math.round(n),l=Math.round(r);if(t==="move"){const g=e.x1-e.x0,p=e.y1-e.y0,E=mt(e.x0+i,0,s-g),_=mt(e.y0+l,0,u-p);return{x0:E,y0:_,x1:E+g,y1:_+p}}let{x0:d,y0:x,x1:m,y1:b}=e;const w=t==="nw"||t==="w"||t==="sw",v=t==="ne"||t==="e"||t==="se",M=t==="nw"||t==="n"||t==="ne",h=t==="sw"||t==="s"||t==="se";return w&&(d=mt(d+i,0,m-(a-1))),v&&(m=mt(m+i,d+(a-1),s)),M&&(x=mt(x+l,0,b-(a-1))),h&&(b=mt(b+l,x+(a-1),u)),{x0:d,y0:x,x1:m,y1:b}}function so(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function oi({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=so(e),a=so(t),s=[];for(let g=0;g<=e;g+=o)s.push(g);const u=[];for(let g=0;g<=t;g+=a)u.push(g);const i=1/n,l=8*i,d=-12*i,x=-2*i,m=r==null?void 0:r.current;let b=0,w=0,v=0,M=0;if(m){const g=m.clientWidth,p=m.clientHeight,E=g/e,_=p/t,y=Math.min(E,_);v=e*y,M=t*y,b=(g-v)/2,w=(p-M)/2}const h=m&&v>0;return f.jsxs(f.Fragment,{children:[f.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:h?w:0,transform:`translateY(${d}px)`,fontSize:l},children:s.map(g=>f.jsx("span",{className:"mono",style:{position:"absolute",left:h?b+g/e*v:`${g/e*100}%`,transform:"translateX(-50%)"},children:g},g))}),f.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:h?b:0,transform:`translateX(${x}px)`,fontSize:l},children:u.map(g=>f.jsx("span",{className:"mono",style:{position:"absolute",top:h?w+g/t*M:`${g/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*i}px`},children:g},g))})]})}function Vn({label:e,corner:t="bottom-left",isDraggable:n=!1,grip:r=n,onDragStart:o}){const a=t==="bottom-right"?"bottom-1 right-1":"bottom-1 left-1";return f.jsxs("span",{className:`absolute ${a} z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${n?" cairn-drag-grip":""}`,draggable:n,onDragStart:o,style:{cursor:n?"grab":void 0},children:[r&&f.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const si=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function ao(e,t){const n=getComputedStyle(e),r=si.map(i=>`${i}:${n.getPropertyValue(i)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const a=e.children,s=t.children,u=Math.min(a.length,s.length);for(let i=0;i<u;i++)ao(a[i],s[i])}function $n(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function Xn(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function Hn(e,t,n,r,o){const a=document.createElement("canvas");a.width=Math.max(1,Math.round(e*n)),a.height=Math.max(1,Math.round(t*n));const s=a.getContext("2d");if(!s)throw new Error("plot-to-png: 2D canvas context unavailable");return s.scale(n,n),r&&(s.fillStyle=r,s.fillRect(0,0,e,t)),o(s),await new Promise((u,i)=>a.toBlob(l=>l?u(l):i(new Error("plot-to-png: toBlob returned null")),"image/png"))}function ai(e,t,n){const r=e.cloneNode(!0);ao(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),a="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((s,u)=>{const i=new Image;i.onload=()=>s(i),i.onerror=()=>u(new Error("plot-to-png: SVG rasterization failed")),i.src=a})}async function io(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,a=(t==null?void 0:t.background)??$n(e);return Hn(r,o,Xn(t),a,s=>s.drawImage(e,0,0,r,o))}async function ii(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,a=(t==null?void 0:t.background)??$n(e);try{return await Hn(r,o,Xn(t),a,s=>s.drawImage(e,0,0,r,o))}catch(s){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${s instanceof Error?s.message:String(s)})`)}}function ci(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const a=o.getBoundingClientRect(),s=a.width*a.height;s>r&&(r=s,n=o)}return n}async function li(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),a=o.width||300,s=o.height||150,u=(t==null?void 0:t.background)??$n(e);if(n){const l=n.getBoundingClientRect(),d=await ai(n,l.width||a,l.height||s);return Hn(a,s,Xn(t),u,x=>{for(const m of r){const b=m.getBoundingClientRect();x.drawImage(m,b.left-o.left,b.top-o.top,b.width,b.height)}x.drawImage(d,l.left-o.left,l.top-o.top,l.width,l.height)})}if(r.length)return io(r[0],t);const i=ci(e);if(i)return ii(i,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function ui(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const fi=8;function di(e,t,n,r=fi){return!(t>0)||!(e>0)?n:e<t+r}function co(e,t){return Math.max(0,e.findIndex(n=>n.id===t))}function pi(e){const t=e.trim();if(t==="")return null;const n=t.replace(/−/g,"-").replace(",","."),r=/^([+-]?)(inf(?:inity)?|∞)$/i.exec(n);if(r)return r[1]==="-"?-1/0:1/0;const o=Number(n);return Number.isNaN(o)?null:o}function mi(e,t){const n=pi(e);return n===null?t:n}function hi(e){return String(e)}const gi={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},xi={boxZoom:f.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:f.jsxs(f.Fragment,{children:[f.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),f.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),f.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),f.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 2v20M2 12h20"}),f.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),f.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),f.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:f.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:f.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),f.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:f.jsx("path",{d:"M6 9l6 6 6-6"}),ellipsis:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"5",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),f.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),f.jsx("circle",{cx:"19",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"})]}),sun:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"12",cy:"12",r:"4"}),f.jsx("path",{d:"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"})]}),plusminus:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M4 7h6M7 4v6"}),f.jsx("path",{d:"M14 17h6"}),f.jsx("path",{d:"M6 20l12-16"})]}),layers:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 3l9 5-9 5-9-5 9-5z"}),f.jsx("path",{d:"M3 13l9 5 9-5"})]})};function nt({name:e}){return f.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:xi[e]??null})}function lo({icon:e,label:t,title:n,active:r,disabled:o,onClick:a}){return f.jsx("button",{type:"button",disabled:o,onClick:s=>{s.stopPropagation(),!o&&a()},onPointerDown:s=>s.stopPropagation(),onDoubleClick:s=>s.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?f.jsx("span",{"aria-hidden":"true",children:t}):f.jsx(nt,{name:e??""})})}function uo(){return f.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function fo(e,t,n){const r=c.useRef(n);r.current=n,c.useEffect(()=>{if(!e)return;const o=s=>{t.current&&!t.current.contains(s.target)&&r.current()},a=s=>{s.key==="Escape"&&(s.stopPropagation(),r.current())};return document.addEventListener("pointerdown",o,!0),document.addEventListener("keydown",a,!0),()=>{document.removeEventListener("pointerdown",o,!0),document.removeEventListener("keydown",a,!0)}},[e,t])}function bi({icon:e,title:t,menu:n}){var M;const{options:r,value:o,onSelect:a}=n,[s,u]=c.useState(!1),[i,l]=c.useState(0),d=c.useRef(null),x=co(r,o),m=e?void 0:((M=r[x])==null?void 0:M.label)??"",b=c.useCallback(()=>{u(h=>{const g=!h;return g&&l(x),g})},[x]),w=c.useCallback(h=>{a(h),u(!1)},[a]);fo(s,d,()=>u(!1));const v=h=>{if(!s){(h.key==="ArrowDown"||h.key==="Enter"||h.key===" ")&&(h.preventDefault(),l(x),u(!0));return}if(h.key==="ArrowDown")h.preventDefault(),l(g=>(g+1)%r.length);else if(h.key==="ArrowUp")h.preventDefault(),l(g=>(g-1+r.length)%r.length);else if(h.key==="Enter"||h.key===" "){h.preventDefault();const g=r[i];g&&w(g.id)}};return f.jsxs("div",{ref:d,className:"relative inline-flex",onPointerDown:h=>h.stopPropagation(),children:[f.jsxs("button",{type:"button",onClick:h=>{h.stopPropagation(),b()},onDoubleClick:h=>h.stopPropagation(),onKeyDown:v,"aria-haspopup":"listbox","aria-expanded":s,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",m?"px-1.5 text-[10px] font-mono":"px-1 text-xs",s?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[m?f.jsx("span",{"aria-hidden":"true",children:m}):f.jsx(nt,{name:e??""}),f.jsx(nt,{name:"caret"})]}),s&&f.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((h,g)=>{const p=h.id===o,E=g===i;return f.jsx("li",{role:"option","aria-selected":p,children:f.jsx("button",{type:"button",onClick:_=>{_.stopPropagation(),w(h.id)},onPointerEnter:()=>l(g),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",E?"bg-bg-hover":"",p?"text-accent font-medium":"text-fg"].join(" "),children:h.label})},h.id)})})]})}const vi=e=>e.format?e.format(e.value):String(e.value);function po({spec:e}){const[t,n]=c.useState(!1),[r,o]=c.useState(""),a=c.useRef(null),s=c.useCallback(()=>{o(hi(e.value)),n(!0)},[e.value]);c.useEffect(()=>{t&&a.current&&(a.current.focus(),a.current.select())},[t]);const u=c.useCallback(()=>{n(l=>(l&&e.onChange(mi(r,e.value)),!1))},[r,e]),i=c.useCallback(()=>n(!1),[]);return f.jsxs("label",{className:"inline-flex items-center gap-1 text-fg-muted",title:e.title,onPointerDown:l=>l.stopPropagation(),onDoubleClick:l=>{l.stopPropagation(),t||s()},children:[e.icon?f.jsx("span",{"aria-hidden":"true",className:"inline-flex",children:f.jsx(nt,{name:e.icon})}):f.jsx("span",{"aria-hidden":"true",className:"text-[9px] font-mono",children:e.label}),t?f.jsx("input",{ref:a,type:"text",inputMode:"decimal","aria-label":`${e.title} (numeric entry)`,value:r,onChange:l=>o(l.target.value),onPointerDown:l=>l.stopPropagation(),onDoubleClick:l=>l.stopPropagation(),onKeyDown:l=>{l.stopPropagation(),l.key==="Enter"?(l.preventDefault(),u()):l.key==="Escape"&&(l.preventDefault(),i())},onBlur:u,className:"cairn-plot-toolbar-slider-entry h-3.5 w-[6.5rem] rounded border border-border bg-bg px-1 text-[9px] font-mono tabular-nums text-fg outline-none focus:border-accent"}):f.jsxs(f.Fragment,{children:[f.jsx("input",{type:"range","aria-label":e.title,min:e.min,max:e.max,step:e.step,value:e.value,onChange:l=>e.onChange(Number(l.target.value)),onPointerDown:l=>l.stopPropagation(),className:"cairn-plot-toolbar-slider h-1 w-16 cursor-pointer accent-accent"}),f.jsx("span",{"aria-hidden":"true",className:"w-8 text-right text-[9px] font-mono tabular-nums",children:vi(e)})]})]})}function wi({icon:e,title:t,menu:n,onClose:r}){var x;const{options:o,value:a,onSelect:s}=n,[u,i]=c.useState(!1),l=co(o,a),d=((x=o[l])==null?void 0:x.label)??"";return f.jsxs("div",{children:[f.jsxs("button",{type:"button","aria-haspopup":"menu","aria-expanded":u,"aria-label":t,onClick:m=>{m.stopPropagation(),i(b=>!b)},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",u?"text-accent":"text-fg hover:bg-bg-hover"].join(" "),children:[e?f.jsx(nt,{name:e}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{className:"flex-1",children:t}),f.jsx("span",{className:"font-mono text-[10px] text-fg-muted",children:d}),f.jsx("span",{className:u?"rotate-180 transition-transform":"transition-transform",children:f.jsx(nt,{name:"caret"})})]}),u&&o.map(m=>{const b=m.id===a;return f.jsxs("button",{type:"button",role:"menuitemradio","aria-checked":b,"data-menu-option":"",onClick:w=>{w.stopPropagation(),s(m.id),r()},className:["flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-[11px]",b?"text-accent font-medium bg-bg-hover/40":"text-fg hover:bg-bg-hover"].join(" "),children:[f.jsx("span",{"aria-hidden":"true",className:"w-3 text-center text-accent",children:b?"✓":""}),f.jsx("span",{children:m.label})]},m.id)})]})}function yi({actions:e,leading:t,sliders:n}){const[r,o]=c.useState(!1),a=c.useRef(null);return fo(r,a,()=>o(!1)),f.jsxs("div",{ref:a,className:"relative inline-flex",onPointerDown:s=>s.stopPropagation(),children:[f.jsx("button",{type:"button",onClick:s=>{s.stopPropagation(),o(u=>!u)},onDoubleClick:s=>s.stopPropagation(),"aria-haspopup":"menu","aria-expanded":r,"aria-label":"More controls",title:"More controls",className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded text-xs",r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:f.jsx(nt,{name:"ellipsis"})}),r&&f.jsxs("div",{role:"menu",className:["absolute right-0 top-full z-40 mt-1 min-w-[10rem] max-h-80 overflow-auto","rounded border border-border bg-bg-elevated py-1 shadow-md"].join(" "),children:[t.map(s=>s.menu?f.jsx(wi,{icon:s.icon,title:s.title,menu:s.menu,onClose:()=>o(!1)},s.id):f.jsxs("button",{type:"button",disabled:s.disabled,onClick:u=>{var i;u.stopPropagation(),!s.disabled&&((i=s.onClick)==null||i.call(s),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?f.jsx(nt,{name:s.icon}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{children:s.label??s.title})]},s.id)),t.length>0&&e.length>0&&f.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),e.map(s=>f.jsxs("button",{type:"button",role:"menuitem",disabled:s.disabled,onClick:u=>{u.stopPropagation(),!s.disabled&&(s.onClick(),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?f.jsx(nt,{name:s.icon}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{children:s.title})]},s.id)),n.length>0&&(e.length>0||t.length>0)&&f.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),n.map(s=>f.jsx("div",{className:"px-2 py-1",children:f.jsx(po,{spec:s})},s.id))]})]})}function Ei({controller:e,config:t}){var T,k;const n=c.useRef(null),[r,o]=c.useState(!1),a=c.useRef(r);a.current=r;const s=c.useRef(0),u=`${((T=t==null?void 0:t.leadingButtons)==null?void 0:T.length)??0}:${((k=t==null?void 0:t.sliders)==null?void 0:k.length)??0}:${(t==null?void 0:t.visibility)??"hover"}`;if(c.useEffect(()=>{const R=n.current,L=R==null?void 0:R.parentElement;if(!L)return;const I=()=>{const N=L.clientWidth;if(!a.current&&n.current){const j=n.current.scrollWidth;j>0&&(s.current=j)}o(di(N,s.current,a.current))};let H=0;const V=()=>{H||(H=requestAnimationFrame(()=>{H=0,I()}))},z=new ResizeObserver(V);return z.observe(L),I(),()=>{z.disconnect(),H&&cancelAnimationFrame(H)}},[u]),(t==null?void 0:t.enabled)===!1)return null;const i=e.capabilities,l=t==null?void 0:t.buttons,d=(R,L)=>L&&(l==null?void 0:l[R])!==!1,x=R=>()=>e.setDragMode(R),m=()=>{e.toPNG({filename:"plot"}).then(R=>ui(R,"plot.png")).catch(()=>{})},b=[];d("zoom",i.zoom)&&b.push({id:"zoom",icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:x("zoom")}),d("pan",i.pan)&&b.push({id:"pan",icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:x("pan")}),d("select",i.select)&&b.push({id:"select",icon:"select",title:"Box select",active:e.dragMode==="select",onClick:x("select")}),d("lasso",i.lasso)&&b.push({id:"lasso",icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:x("lasso")});const w=[];d("zoomIn",i.zoom)&&w.push({id:"zoomIn",icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),d("zoomOut",i.zoom)&&w.push({id:"zoomOut",icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()});const v=[];d("autoscale",i.autoscale)&&v.push({id:"autoscale",icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),d("reset",i.reset)&&v.push({id:"reset",icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()});const M=[];d("screenshot",i.screenshot)&&M.push({id:"screenshot",icon:"camera",title:"Download plot as PNG",onClick:m});const h=[b,w,v,M].filter(R=>R.length>0),g=h.flat(),p=(t==null?void 0:t.leadingButtons)??[],E=(t==null?void 0:t.sliders)??[];if(!p.length&&g.length===0&&E.length===0)return null;const _=(t==null?void 0:t.position)??"top-right",y=(t==null?void 0:t.visibility)==="always",C=_==="top-right"||_==="bottom-right",A=["cairn-plot-toolbar z-30 rounded border border-border bg-bg-elevated/90 shadow-sm backdrop-blur-sm transition-opacity",y?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),P={position:"absolute",pointerEvents:"auto",...gi[_]};return r?f.jsx("div",{ref:n,style:P,className:`${A} inline-flex px-0.5 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:f.jsx(yi,{actions:g,leading:p,sliders:E})}):f.jsxs("div",{ref:n,style:P,className:`${A} flex flex-col gap-0.5 px-1 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:[f.jsxs("div",{className:`flex items-center gap-0.5 ${C?"justify-end":"justify-start"}`,children:[p.length>0&&f.jsxs(f.Fragment,{children:[p.map(R=>R.menu?f.jsx(bi,{icon:R.icon,title:R.title,menu:R.menu},R.id):f.jsx(lo,{icon:R.icon,label:R.label,title:R.title,active:R.active,disabled:R.disabled,onClick:R.onClick??(()=>{})},R.id)),h.length>0&&f.jsx(uo,{})]}),h.map((R,L)=>f.jsxs("span",{className:"inline-flex items-center gap-0.5",children:[L>0&&f.jsx(uo,{}),R.map(I=>f.jsx(lo,{icon:I.icon,title:I.title,active:I.active,disabled:I.disabled,onClick:I.onClick},I.id))]},R[0].id))]}),E.length>0&&f.jsx("div",{className:`flex items-center gap-2 ${C?"justify-end":"justify-start"}`,children:E.map(R=>f.jsx(po,{spec:R},R.id))})]})}const _i={zoom:1,pan:{x:0,y:0}},mo=1.3,Mi=.25,Si=64,Ai={buttons:{zoom:!1}};function Pi(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const Ti=[{id:"none",label:"None"},...Us];function Lt(e,t){return{id:"colormap",title:"Colormap",menu:{options:Ti,value:e,onSelect:t}}}const ho={linear:"Linear",srgb:"sRGB",gamma:"Gamma",reinhard:"Reinhard",aces:"ACES",extended:"Extended · Linear","extended-clamp":"Extended · Linear (managed)","extended-reinhard":"Extended · Reinhard","extended-aces":"Extended · ACES"},Ri=br.map(e=>({id:e,label:ho[e]}));function an(e,t){return{id:"tonemap",title:"Tone-mapping operator",menu:{options:Ri,value:e,onSelect:t}}}const Ci=Vs.map(e=>({id:e,label:ho[e]}));function Di(e,t){return{id:"tonemap",title:"Display transfer (sRGB · Gamma · Linear)",menu:{options:Ci,value:e,onSelect:t}}}function ki({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:a,naturalHeight:s,minZoom:u=Mi,maxZoom:i=Si,requestRender:l,onReset:d,extraModified:x=!1}){const m=c.useCallback(y=>{var H;if(!o)return;const C=(H=e.current)==null?void 0:H.getBoundingClientRect(),S=(C==null?void 0:C.width)??0,A=(C==null?void 0:C.height)??0,P=a&&s&&S>0&&A>0?In(a,s,S,A):i,T=Math.max(u,Math.min(P,n*y));if(T===n)return;const k=S/2,R=A/2,L=k-(k-r.x)/n*T,I=R-(R-r.y)/n*T;o({zoom:T,pan:{x:L,y:I}})},[o,e,a,s,i,u,n,r.x,r.y]),b=c.useCallback(()=>m(mo),[m]),w=c.useCallback(()=>m(1/mo),[m]),v=c.useCallback(()=>{o==null||o(_i),d==null||d()},[o,d]),M=c.useCallback(y=>{const C={scale:y==null?void 0:y.scale,filename:y==null?void 0:y.filename};l==null||l();const S=t==null?void 0:t.current;if(S)return io(S,C);const A=e.current;return A?li(A,C):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,l]),h=c.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),g=n!==1||r.x!==0||r.y!==0||x,p=c.useCallback(y=>{},[]),E=c.useCallback(y=>{},[]),_=c.useCallback(()=>{},[]);return c.useMemo(()=>({capabilities:h,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:g,setDragMode:p,setHoverMode:E,toggleSpikelines:_,zoomIn:b,zoomOut:w,autoscale:v,reset:v,toPNG:M}),[h,g,p,E,_,b,w,v,M])}const Oi={zoom:1,pan:{x:0,y:0}};function cn({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:a,pan:s,onViewportChange:u,naturalDims:i,checkerboard:l,wrapperClassName:d,wrapperStyle:x,viewportPadding:m,header:b,surface:w,showAxes:v,overlayNode:M,overlay:h,notationSeed:g,exportCanvasRef:p,requestRender:E,leadingMenus:_,displayAdjust:y,depthSliders:C,extraSliders:S,regionSelect:A,onReset:P,extraModified:T,label:k,showLabelChip:R,isDraggable:L=!1,onDragStart:I,extraChips:H}){const[V,z]=c.useState(g),[N,j]=c.useState(!1),[$,le]=c.useState(!1),ae="render"in h?null:h,ue=!!A&&!!ae,{containerProps:W}=Nr({containerRef:r,zoom:a,pan:s,onViewportChange:u,naturalWidth:i==null?void 0:i.w,naturalHeight:i==null?void 0:i.h}),K=c.useCallback(()=>{y==null||y.onExposureChange(0),y==null||y.onOffsetChange(0),P==null||P()},[y,P]),q=c.useCallback(()=>{u==null||u(Oi),K()},[u,K]),ne=ki({rootRef:r,canvasRef:p,zoom:a,pan:s,onViewportChange:u,naturalWidth:i==null?void 0:i.w,naturalHeight:i==null?void 0:i.h,requestRender:E,onReset:K,extraModified:((y==null?void 0:y.exposureEV)??0)!==0||((y==null?void 0:y.offset)??0)!==0||!!T}),ge=c.useMemo(()=>{const xe=[];if(C&&xe.push(...C),!y)return S&&xe.push(...S),xe.length?xe:void 0;const De=(Ee,Pe)=>`${Ee>=0?"+":"−"}${Math.abs(Ee).toFixed(Pe)}`;return xe.push({id:"exposure",icon:"sun",label:"EV",title:"Exposure (EV stops) — color × 2^EV. Double-click to type a value (may exceed the slider range).",min:-8,max:8,step:.1,value:y.exposureEV,onChange:y.onExposureChange,format:Ee=>De(Ee,1)},{id:"offset",icon:"plusminus",label:"OFF",title:"Offset — added after exposure (before tonemap). Double-click to type a value (may exceed the slider range).",min:-1,max:1,step:.01,value:y.offset,onChange:y.onOffsetChange,format:Ee=>De(Ee,2)}),S&&xe.push(...S),xe},[y,C,S]),te=c.useMemo(()=>ue?{id:"region-depth",icon:"select",title:"Select depth from region — drag a rectangle to set the Z window to the samples it covers (Esc to cancel)",active:$,onClick:()=>le(xe=>!xe)}:null,[ue,$]),fe=c.useMemo(()=>({...Ai,leadingButtons:[..._??[],...te?[te]:[],...N?[Pi(V,z)]:[]],sliders:ge}),[N,V,_,te,ge]),ve=" cairn-checkerboard",Me="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(l==="pane"?ve:""),ie=d+(l==="wrapper"?ve:""),Ae="render"in h?h.render({notation:V,setOverlayActive:j}):h.hasSource&&i?f.jsx(xt,{imageElRef:h.displayElRef,naturalWidth:i.w,naturalHeight:i.h,zoom:a,pan:s,sourceWindow:h.sourceWindow,sample:h.sample,notation:V,version:h.version,onActiveChange:j}):null;return f.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[b,n&&f.jsx(Ei,{controller:ne,config:fe}),f.jsxs("div",{ref:r,className:Me,style:{padding:m,...W.style},onPointerDown:W.onPointerDown,onPointerMove:W.onPointerMove,onPointerUp:W.onPointerUp,onPointerCancel:W.onPointerCancel,onDoubleClick:q,...t,children:[f.jsxs("div",{ref:o,className:ie,style:x,children:[w,v&&i&&f.jsx(oi,{naturalWidth:i.w,naturalHeight:i.h,zoom:a,containerRef:o}),M]}),Ae,!n&&N&&f.jsx(Vr,{notation:V,onChange:z}),$&&A&&ae&&i&&f.jsx(Li,{imageElRef:ae.displayElRef,naturalDims:i,sourceWindow:ae.sourceWindow,onQueryLive:A.queryLive,onSelect:(xe,De,Ee,Pe)=>{le(!1),A.commit(xe,De,Ee,Pe)},onExit:()=>le(!1)}),!$&&(A==null?void 0:A.rect)&&ae&&i&&f.jsx(Ni,{rect:A.rect,imageElRef:ae.displayElRef,naturalDims:i,sourceWindow:ae.sourceWindow,zoom:a,pan:s,onQueryLive:A.queryLive,onCommit:A.commit,onRemove:A.remove})]}),R&&f.jsx(Vn,{label:k,isDraggable:L,onDragStart:I}),H]})}function Li({imageElRef:e,naturalDims:t,sourceWindow:n,onQueryLive:r,onSelect:o,onExit:a}){var M;const s=c.useRef(null),u=c.useRef(null),[i,l]=c.useState(null),d=c.useCallback((h,g,p,E)=>{const _=e.current;return _?Ur(h,g,p,E,{box:_.getBoundingClientRect(),naturalWidth:t.w,naturalHeight:t.h,sourceWindow:n}):null},[e,t,n]);c.useEffect(()=>{const h=g=>{g.key==="Escape"&&a()};return window.addEventListener("keydown",h),()=>window.removeEventListener("keydown",h)},[a]);const x=c.useCallback(h=>{var g,p;(p=(g=h.target).setPointerCapture)==null||p.call(g,h.pointerId),u.current={x:h.clientX,y:h.clientY},l({x0:h.clientX,y0:h.clientY,x1:h.clientX,y1:h.clientY})},[]),m=c.useCallback(h=>{const g=u.current;if(!g)return;l({x0:g.x,y0:g.y,x1:h.clientX,y1:h.clientY});const p=d(g.x,g.y,h.clientX,h.clientY);p&&r(p.x0,p.y0,p.x1,p.y1)},[d,r]),b=c.useCallback(h=>{const g=u.current;u.current=null,l(null);const p=e.current;if(!g||!p){a();return}if(Math.abs(h.clientX-g.x)<3&&Math.abs(h.clientY-g.y)<3){a();return}const E=p.getBoundingClientRect(),_=Ur(g.x,g.y,h.clientX,h.clientY,{box:E,naturalWidth:t.w,naturalHeight:t.h,sourceWindow:n});if(!_){a();return}o(_.x0,_.y0,_.x1,_.y1)},[e,t,n,o,a]),w=(M=s.current)==null?void 0:M.getBoundingClientRect(),v=i&&w?{left:Math.min(i.x0,i.x1)-w.left,top:Math.min(i.y0,i.y1)-w.top,width:Math.abs(i.x1-i.x0),height:Math.abs(i.y1-i.y0)}:null;return f.jsx("div",{ref:s,className:"absolute inset-0 z-20",style:{cursor:"crosshair",touchAction:"none"},onPointerDown:x,onPointerMove:m,onPointerUp:b,children:v&&f.jsx("div",{className:"absolute border-2 border-dashed border-sky-400 bg-sky-400/15 pointer-events-none",style:v})})}const Bi={nw:{cursor:"nwse-resize",fx:0,fy:0},n:{cursor:"ns-resize",fx:.5,fy:0},ne:{cursor:"nesw-resize",fx:1,fy:0},e:{cursor:"ew-resize",fx:1,fy:.5},se:{cursor:"nwse-resize",fx:1,fy:1},s:{cursor:"ns-resize",fx:.5,fy:1},sw:{cursor:"nesw-resize",fx:0,fy:1},w:{cursor:"ew-resize",fx:0,fy:.5}};function Ni({rect:e,imageElRef:t,naturalDims:n,sourceWindow:r,zoom:o,pan:a,onQueryLive:s,onCommit:u,onRemove:i}){const l=c.useRef(null),[d,x]=c.useState(null),m=c.useRef(null),[b,w]=c.useState(null),v=d??e;c.useLayoutEffect(()=>{const p=()=>{const y=t.current,C=l.current;if(!y||!C)return;const S=y.getBoundingClientRect(),A=C.getBoundingClientRect(),P=Aa(v,{box:S,naturalWidth:n.w,naturalHeight:n.h,sourceWindow:r});w({left:P.left-A.left,top:P.top-A.top,width:P.width,height:P.height})};p();const E=t.current;if(!E||typeof ResizeObserver>"u")return;const _=new ResizeObserver(p);return _.observe(E),()=>_.disconnect()},[v,n.w,n.h,r,o,a.x,a.y]);const M=c.useCallback(p=>E=>{var _,y;E.stopPropagation(),(y=(_=E.target).setPointerCapture)==null||y.call(_,E.pointerId),m.current={handle:p,sx:E.clientX,sy:E.clientY,start:v},x(v)},[v]),h=c.useCallback(p=>{const E=m.current,_=t.current;if(!E||!_)return;const y=Sa({box:_.getBoundingClientRect(),naturalWidth:n.w,naturalHeight:n.h,sourceWindow:r}),C=(p.clientX-E.sx)/(y||1),S=(p.clientY-E.sy)/(y||1),A=ri(E.start,E.handle,C,S,{w:n.w,h:n.h},1);x(A),s(A.x0,A.y0,A.x1,A.y1)},[t,n.w,n.h,r,s]),g=c.useCallback(()=>{const p=m.current;m.current=null;const E=d;x(null),p&&E&&u(E.x0,E.y0,E.x1,E.y1)},[d,u]);return b?f.jsxs("div",{ref:l,className:"absolute inset-0 z-20 pointer-events-none",style:{touchAction:"none"},children:[f.jsx("div",{className:"absolute border-2 border-sky-400 bg-sky-400/10 pointer-events-auto",style:{...b,cursor:"move",touchAction:"none"},onPointerDown:M("move"),onPointerMove:h,onPointerUp:g}),ni.map(p=>{const E=Bi[p];return f.jsx("div",{className:"absolute pointer-events-auto flex items-center justify-center",style:{left:b.left+E.fx*b.width-12,top:b.top+E.fy*b.height-12,width:24,height:24,cursor:E.cursor,touchAction:"none"},onPointerDown:M(p),onPointerMove:h,onPointerUp:g,children:f.jsx("div",{className:"w-2.5 h-2.5 rounded-sm bg-sky-400 border border-white/80"})},p)}),f.jsx("button",{type:"button","aria-label":"Remove depth region",title:"Remove region (reset the depth window)",className:"absolute pointer-events-auto flex items-center justify-center rounded-full text-white",style:{left:b.left+b.width-8,top:b.top-32,width:40,height:40},onPointerDown:p=>p.stopPropagation(),onClick:i,children:f.jsx("span",{className:"flex items-center justify-center w-5 h-5 rounded-full bg-slate-800/90 border border-white/70 text-[11px] leading-none",children:"×"})})]}):f.jsx("div",{ref:l,className:"absolute inset-0 z-20 pointer-events-none"})}const Wn={inFlight:!1,pending:null};function go(e,t){return e.inFlight?{state:{inFlight:!0,pending:t},launch:null}:{state:{inFlight:!0,pending:null},launch:t}}function xo(e){return e.pending!=null?{state:{inFlight:!0,pending:null},launch:e.pending}:{state:Wn,launch:null}}const Ii=1e3,Fi=typeof requestAnimationFrame=="function"?e=>requestAnimationFrame(()=>e()):e=>setTimeout(e,0),bo=typeof cancelAnimationFrame=="function"?cancelAnimationFrame:e=>clearTimeout(e);function vo(e,t){const n=e.deep,r=(n==null?void 0:n.zMin)??0,o=(n==null?void 0:n.zMax)??0,a=t!=null,[s,u,i]=Be(r),[l,d,x]=Be(o),[m,b]=c.useState(null),[w,v]=c.useState(null),M=c.useRef(n);M.current=n;const h=c.useRef(r);h.current=r;const g=c.useRef(o);g.current=o;const p=c.useRef(s);p.current=s;const E=c.useRef(l);E.current=l;const _=c.useRef({near:s,far:l,ver:0}),y=c.useRef(0),C=c.useRef(!0),S=c.useRef(Wn),A=c.useRef(null),P=u,T=d,k=c.useCallback(()=>{const W=M.current;if(!W)return;const{near:K,far:q,ver:ne}=_.current,ge=()=>{const te=xo(S.current);S.current=te.state,te.launch!=null&&k()};W.flatten(K,q).then(te=>{_.current.ver===ne&&!C.current&&(A.current!=null&&bo(A.current),A.current=Fi(()=>{A.current=null,b(te)})),ge()}).catch(ge)},[]),R=c.useCallback(()=>{const W=go(S.current,1);S.current=W.state,W.launch!=null&&k()},[k]);c.useEffect(()=>()=>{A.current!=null&&bo(A.current),n==null||n.dispose()},[n]),c.useEffect(()=>{if(!n)return;const W=s<=r&&l>=o;if(C.current=W,y.current+=1,_.current={near:s,far:l,ver:y.current},a){t(s,l);return}if(W){b(null);return}R()},[n,s,l,r,o,R,a,t]);const L=c.useMemo(()=>n&&!a&&m!=null?{...e,data:m}:e,[e,n,a,m]),I=n!=null&&r>0&&o/r>Ii,H=c.useMemo(()=>{if(!n||!(o>r))return;const W=q=>Math.abs(q)>=1e3||Math.abs(q)<.01&&q!==0?q.toExponential(2):q.toFixed(3),K=(q,ne,ge,te,fe)=>{if(I){const ve=Math.log10(r),Me=Math.log10(o);return{id:q,icon:"layers",label:ne,title:`${ge} (log scale). Double-click to type a Z.`,min:ve,max:Me,step:(Me-ve)/200,value:Math.log10(Math.max(r,Math.min(te,o))),onChange:ie=>fe(10**ie),format:ie=>W(10**ie)}}return{id:q,icon:"layers",label:ne,title:`${ge}. Double-click to type a Z.`,min:r,max:o,step:(o-r)/200,value:te,onChange:fe,format:W}};return[K("depth-near","ZN","Depth window NEAR — composite only samples with Z ≥ this",s,P),K("depth-far","ZF","Depth window FAR — composite only samples with Z ≤ this",l,T)]},[n,r,o,s,l,I,P,T]),V=c.useCallback(W=>{if(W.count===0){const ne=h.current,ge=g.current,te=ge>ne?0:1;u(ge+te),d(ne-te);return}const K=g.current-h.current,q=Math.max(Math.abs(K)*1e-4,1e-4);u(W.zMin-q),d(W.zMax+q)},[u,d]),z=c.useRef(null),N=c.useRef(Wn),j=c.useCallback(()=>{const W=M.current,K=z.current,q=()=>{const ne=xo(N.current);N.current=ne.state,ne.launch!=null&&j()};if(!W||!K){q();return}W.zRangeInRect(K.x0,K.y0,K.x1,K.y1).then(ne=>{V(ne),q()}).catch(q)},[V]),$=c.useCallback((W,K,q,ne)=>{z.current={x0:W,y0:K,x1:q,y1:ne};const ge=go(N.current,1);N.current=ge.state,ge.launch!=null&&j()},[j]),le=c.useCallback((W,K,q,ne)=>{v({x0:W,y0:K,x1:q,y1:ne}),$(W,K,q,ne)},[$]),ae=c.useCallback(()=>{v(null),i.reset(),x.reset(),b(null)},[i,x]),ue=c.useCallback(()=>{i.reset(),x.reset(),v(null),b(null)},[i,x]);return{hdr:L,sliders:H,hasDeep:n!=null,region:w,queryRegionWindow:$,commitRegion:le,removeRegion:ae,reset:ue,isModified:i.isModified||x.isModified}}function wo(e){return"hdr"in e&&e.hdr!=null}function yo(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function Ce(e){return Number.isFinite(e)?e:0}const Gi={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Ui(e,t,n,r,o=0){const{h:a,w:s,c:u}=yo(e.shape),i=e.precision==="f16-bits"?Rr(e.data):e.data,l=$s(t),d=new Uint8ClampedArray(s*a*4);for(let x=0;x<s*a;x++){const m=x*u;let b,w,v,M=1;u===1?b=w=v=Ce(i[m]):u===3?(b=Ce(i[m]),w=Ce(i[m+1]),v=Ce(i[m+2])):(b=Ce(i[m]),w=Ce(i[m+1]),v=Ce(i[m+2]),M=Ce(i[m+3]));const h=[Xt(b,n,o),Xt(w,n,o),Xt(v,n,o)],[g,p,E]=l(h),_=x*4;d[_]=255*_t(g,r),d[_+1]=255*_t(p,r),d[_+2]=255*_t(E,r),d[_+3]=255*(M<0?0:M>1?1:M)}return new ImageData(d,s,a)}function zi(e,t,n){const r=Cn(t,n??Mt),o=new Uint8ClampedArray(e.data.length),a=e.data;for(let s=0;s<a.length;s+=4)o[s]=255*_t(Rn(a[s]/255),r),o[s+1]=255*_t(Rn(a[s+1]/255),r),o[s+2]=255*_t(Rn(a[s+2]/255),r),o[s+3]=a[s+3];return new ImageData(o,e.width,e.height)}function Eo(e,t,n,r){const[o,a]=c.useState(null);if(c.useEffect(()=>{const u=e.current;if(!u||typeof ResizeObserver>"u")return;const i=new ResizeObserver(l=>{var x;const d=(x=l[l.length-1])==null?void 0:x.contentRect;d&&a(m=>m&&m.width===d.width&&m.height===d.height?m:{width:d.width,height:d.height})});return i.observe(u),()=>i.disconnect()},[e]),r!=="auto")return r;if(!o||!n)return;const s=Ja({width:o.width*t,height:o.height*t},n.w,n.h);return ei(s,en)}function Vi(e){var ft,dt;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:a="auto",colormap:s="none",tonemap:u,gamma:i,showAxes:l=!1,processing:d=Gi,zoom:x=1,pan:m={x:0,y:0},onViewportChange:b,onNaturalSize:w,label:v,isDraggable:M=!1,onDragStart:h,overlay:g,overlaySettings:p,pixelValueNotation:E="decimal",toolbar:_=!0}=e,[y,C,S]=Be(s);c.useEffect(()=>{C(s)},[s,C]);const A=(()=>{const F=$t(u);return F==="gamma"||F==="linear"?F:"srgb"})(),[P,T,k]=Be(A);c.useEffect(()=>{T(A)},[u]);const[R,L,I]=Be(i&&i>0?i:Mt);c.useEffect(()=>{i&&i>0&&L(i)},[i,L]);const H=c.useRef(null),V=c.useRef(null),z=c.useRef(null),[N,j]=c.useState(!1),$=c.useRef(null),le=c.useRef(null),ae=c.useRef(null),ue=c.useRef(null),[W,K]=c.useState(0),q=c.useCallback(()=>K(F=>F+1),[]),ne=c.useMemo(()=>({get current(){const F=ae.current;return F instanceof HTMLCanvasElement?F:null}}),[]),ge=c.useCallback(F=>{H.current=F,F&&(ae.current=F)},[]),te=c.useCallback(F=>{V.current=F,F&&(ae.current=F)},[]),fe=c.useCallback(F=>{z.current=F,F&&(ae.current=F)},[]),ve=c.useCallback(F=>{F&&(ae.current=F)},[]),[Me,ie]=c.useState(!1),[Ae,xe]=c.useState(!1),[De,Ee]=c.useState(!1),[Pe,Re]=c.useState(null),{flipSign:vt}=d,{gammaFilterId:Ve,filterStr:me,gamma:rt,offset:Ke}=ro(d),Te=!r&&o!=="none"&&n!=null&&t!=null,Fe=o!=="none"&&n!=null,Ge=y!=="none"&&!Te&&!(r&&Fe)&&t!=null;c.useEffect(()=>{if(!Ge||!t){Ee(!1);return}let F=!1;Ee(!1);const de=`${t}::${y}`,O=On(de);if(O){const U=V.current;if(U){U.width=O.width,U.height=O.height;const B=U.getContext("2d");B&&B.putImageData(O,0,0),q(),Re({w:O.width,h:O.height}),w==null||w(O.width,O.height),Ee(!0)}return}const G=new Image;return G.onload=()=>{if(F)return;const U=document.createElement("canvas");U.width=G.naturalWidth,U.height=G.naturalHeight;const B=U.getContext("2d");if(!B)return;B.drawImage(G,0,0);const Q=B.getImageData(0,0,U.width,U.height),J=kn(y),he=Dn(Q,y,J);Ln(de,he);const Se=V.current;if(!Se||F)return;Se.width=he.width,Se.height=he.height;const we=Se.getContext("2d");we&&we.putImageData(he,0,0),q(),Re({w:he.width,h:he.height}),w==null||w(he.width,he.height),Ee(!0)},G.src=t,()=>{F=!0}},[Ge,t,y]);const et=t!=null&&!Te&&!Ge&&P!=="srgb";c.useEffect(()=>{if(!et||!t){j(!1);return}let F=!1;return j(!1),at(t).then(de=>{if(F||!de)return;const O=zi(de,P,R),G=z.current;if(!G)return;G.width=O.width,G.height=O.height;const U=G.getContext("2d");U&&U.putImageData(O,0,0),q(),Re({w:O.width,h:O.height}),w==null||w(O.width,O.height),j(!0)}),()=>{F=!0}},[et,t,P,R]);const tt=c.useCallback((F,de)=>{Re(O=>O&&O.w===F&&O.h===de?O:{w:F,h:de}),w==null||w(F,de)},[]);c.useEffect(()=>{if(!t){ue.current=null,q();return}let F=!1;return at(t).then(de=>{F||(ue.current=de,q())}),()=>{F=!0}},[t,q]);const wt=c.useCallback((F,de,O)=>{const G=ue.current;if(!G||F<0||de<0||F>=G.width||de>=G.height)return null;const U=(de*G.width+F)*4,B=G.data[U],Q=G.data[U+1],J=G.data[U+2];return gt(y!=="none"||B===Q&&Q===J?[B]:[B,Q,J],"uint8",O)},[y]);c.useEffect(()=>{if(xe(!1),!Te){ie(!1);return}let F=!1;const de=oa(),O=de==="gpu"||de==="auto",G=`${n}::${t}::${o}::${y}`;if(de!=="gpu"){const U=On(G);if(U){const B=H.current;if(B){(B.width!==U.width||B.height!==U.height)&&(B.width=U.width,B.height=U.height);const Q=B.getContext("2d");Q&&Q.putImageData(U,0,0),tt(U.width,U.height),ie(!0)}return}}return(async()=>{const[U,B]=await Promise.all([at(n),at(t)]);if(F||!U||!B)return;const J=o.includes("signed")?"signed":"positive",he=y!=="none"?An(y):null,Se={diffMode:o,colormap:he,cmapMode:J};if(O)try{const Xe=H.current;if(Xe){const qe=na(U,B,Se,Xe);if(qe){if(F)return;tt(qe.width,qe.height),ie(!0);return}}}catch(Xe){console.warn("[cairn] WebGL 2 diff error:",Xe)}if(de==="gpu"){F||xe(!0);return}let we=qs(U,B,o);y!=="none"&&(we=Dn(we,y,J)),Ln(G,we);const se=H.current;if(!se||F)return;(se.width!==we.width||se.height!==we.height)&&(se.width=we.width,se.height=we.height);const Ue=se.getContext("2d");Ue&&Ue.putImageData(we,0,0),tt(we.width,we.height),ie(!0)})(),()=>{F=!0}},[n,t,o,Te,y,w]);const $e=Eo(le,x,Pe,a),ke=vt?{filter:"invert(1)"}:{},It=g&&(p!=null&&p.enabled)&&Pe&&t&&((((ft=g.boxes)==null?void 0:ft.length)??0)>0||(((dt=g.masks)==null?void 0:dt.length)??0)>0)?f.jsx(Gn,{data:g,settings:p,naturalWidth:Pe.w,naturalHeight:Pe.h}):void 0,Pt=t?Te&&Ae?f.jsx(no,{title:"WebGL 2 unavailable",body:"GPU render mode needs WebGL 2 here — switch render mode to Auto or CPU."}):Te?f.jsxs(f.Fragment,{children:[!Me&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),f.jsx("canvas",{ref:ge,className:"w-full h-full object-contain block",style:{display:Me?"block":"none",imageRendering:$e,...ke}})]}):Ge?f.jsxs(f.Fragment,{children:[!De&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),f.jsx("canvas",{ref:te,className:"w-full h-full object-contain block",style:{display:De?"block":"none",imageRendering:$e,...ke}})]}):et?f.jsxs(f.Fragment,{children:[!N&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying transfer..."}),f.jsx("canvas",{ref:fe,className:"w-full h-full object-contain block",style:{display:N?"block":"none",imageRendering:$e,...ke}})]}):f.jsx("img",{ref:ve,src:t,alt:v,className:"w-full h-full object-contain block",draggable:!1,style:{filter:me,imageRendering:$e},onLoad:F=>{const de=F.currentTarget;Re({w:de.naturalWidth,h:de.naturalHeight}),w==null||w(de.naturalWidth,de.naturalHeight)}}):f.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return f.jsx(cn,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:_,paneRef:$,wrapperRef:le,zoom:x,pan:m,onViewportChange:b,naturalDims:Pe,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${m.x}px, ${m.y}px) scale(${x})`,transformOrigin:"0 0"},viewportPadding:l&&Pe?"16px 4px 4px 28px":"4px",header:f.jsx(oo,{id:Ve,gamma:rt,offset:Ke}),surface:Pt,showAxes:l,overlayNode:It,overlay:{displayElRef:ae,sample:wt,version:W,hasSource:!!t},notationSeed:E,exportCanvasRef:ne,leadingMenus:y==="none"?[Lt(y,F=>C(F)),Di(P,F=>T(F))]:[Lt(y,F=>C(F))],extraSliders:y==="none"&&Kt(P)?[{id:"gamma",label:"γ",title:"Display gamma γ for the Gamma transfer — display = clamp(value)^(1/γ), tev-style. Default 2.2 (close to sRGB, not identical). Double-click to type a value.",min:Ht,max:Wt,step:Yt,value:R,onChange:L,format:F=>F.toFixed(1)}]:void 0,onReset:()=>{S.reset(),k.reset(),I.reset()},extraModified:S.isModified||k.isModified||I.isModified,label:v,showLabelChip:!!v,isDraggable:M,onDragStart:h})}function $i(e){const{tonemap:t="srgb",exposure:n=0,offset:r=0,gamma:o,showAxes:a=!1,label:s="",interpolation:u="auto",zoom:i=1,pan:l={x:0,y:0},onViewportChange:d,pixelValueNotation:x="decimal",toolbar:m=!0}=e,b=vo(e.hdr),w=b.hdr,[v,M,h]=Be($t(t));c.useEffect(()=>{M($t(t))},[t,M]);const[g,p,E]=Be(o&&o>0?o:Mt);c.useEffect(()=>{o&&o>0&&p(o)},[o,p]);const _=c.useRef(null),y=c.useRef(null),C=c.useRef(null),[S,A]=c.useState(null),[P,T]=c.useState(0),[k,R]=c.useState(0),[L,I]=c.useState(0);c.useEffect(()=>{const z=_.current;if(!z)return;let N;try{N=Ui(w,v,n+k,Cn(v,g),r+L)}catch($){console.error("[cairn] HDR tone-map error:",$);return}(z.width!==N.width||z.height!==N.height)&&(z.width=N.width,z.height=N.height);const j=z.getContext("2d");j&&(j.putImageData(N,0,0),T($=>$+1),A($=>$&&$.w===N.width&&$.h===N.height?$:{w:N.width,h:N.height}))},[w,v,n,r,g,k,L]);const H=c.useCallback((z,N,j)=>{const $=S;if(!$||z<0||N<0||z>=$.w||N>=$.h)return null;const le=w.shape.length===2?1:w.shape[2]??1,ae=(N*$.w+z)*le,ue=w.data,W=w.precision==="f16-bits"?q=>Qt(ue[q]??0):q=>ue[q]??0,K=le===1?[W(ae)]:[W(ae),W(ae+1),W(ae+2)];return gt(K,"unit",j)},[w,S]),V=Eo(C,i,S,u);return f.jsx(cn,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:m,paneRef:y,wrapperRef:C,zoom:i,pan:l,onViewportChange:d,naturalDims:S,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${l.x}px, ${l.y}px) scale(${i})`,transformOrigin:"0 0"},viewportPadding:a&&S?"16px 4px 4px 28px":"4px",surface:f.jsx("canvas",{ref:_,className:"w-full h-full object-contain block",style:{imageRendering:V}}),showAxes:a,overlay:{displayElRef:_,sample:H,version:P,hasSource:!0},notationSeed:x,exportCanvasRef:_,leadingMenus:[an(v,z=>M(z))],displayAdjust:{exposureEV:k,offset:L,onExposureChange:R,onOffsetChange:I},extraSliders:Kt(v)?[{id:"gamma",label:"γ",title:"Display gamma γ for the Gamma transfer — display = clamp(value)^(1/γ), tev-style. Default 2.2 (close to sRGB, not identical). Double-click to type a value.",min:Ht,max:Wt,step:Yt,value:g,onChange:p,format:z=>z.toFixed(1)}]:void 0,depthSliders:b.sliders,regionSelect:b.hasDeep?{rect:b.region,queryLive:b.queryRegionWindow,commit:b.commitRegion,remove:b.removeRegion}:void 0,onReset:()=>{b.reset(),h.reset(),E.reset()},extraModified:b.isModified||h.isModified||E.isModified,label:s,showLabelChip:!!s})}function Yn(e){return wo(e)?f.jsx($i,{...e}):f.jsx(Vi,{...e})}const _o={"no-webgpu":0,"no-hdr-browser":1,"no-hdr-display":2},Xi="https://github.com/doeringchristian/cairn-plot/blob/main/docs/browser-support.md";function Hi(e,t=!1){const n=e||"";return t?"brave":/firefox/i.test(n)?"firefox":/safari/i.test(n)&&!/chrome|chromium|crios|android/i.test(n)?"safari":/linux/i.test(n)&&/chrome|chromium/i.test(n)?"chromium-linux":"chromium"}function Wi(e){const t=e||"";return/mac os x|macintosh/i.test(t)?"macos":/windows/i.test(t)?"windows":"other"}function Yi(e,t){if(e==="no-hdr-display")switch(Wi(t.userAgent)){case"macos":return"macOS: EDR engages automatically on HDR-capable displays — confirm your display supports HDR.";case"windows":return"Windows: turn on Settings → System → Display → Use HDR.";default:return"Enable HDR in your display and OS settings."}const n=Hi(t.userAgent,t.isBrave);if(e==="no-hdr-browser")switch(n){case"firefox":return"Firefox has no extended-tone-mapping canvas path at all — true HDR output is impossible until Firefox implements it (fundamental browser limitation).";case"safari":return"Safari's WebGPU HDR canvas tone-mapping is still maturing — update to the latest Safari 26+.";default:return"Chrome/Edge 129+ is required for HDR canvas output (toneMapping: extended) — update your browser."}switch(n){case"firefox":return"Firefox: about:config → dom.webgpu.enabled (HDR output is not available in Firefox at all — browser limitation).";case"safari":return"Safari: Develop → Feature Flags → WebGPU (Safari 26+ has it by default).";case"brave":return"Brave: check Shields fingerprint blocking + brave://flags.";case"chromium-linux":return"Chromium on Linux: enable chrome://flags/#enable-unsafe-webgpu.";case"chromium":default:return"Chrome/Edge: enable chrome://flags/#enable-unsafe-webgpu and hardware acceleration."}}function Ki(e){switch(e){case"no-webgpu":return"GPU renderer unavailable → CPU fallback active; FLIP kernels + HDR compare disabled.";case"no-hdr-browser":return"True HDR output is unsupported by this browser — a fundamental browser limitation, not a cairn-plot bug → HDR images tone-mapped to SDR.";case"no-hdr-display":return"Your display/OS is not in HDR mode → HDR images tone-mapped to SDR."}}function Mo(e,t){return`cairn-plot:capnotice:${e}:${t}`}const So=new Set;function Ao(e){try{if(window.localStorage.getItem(e)==="1")return!0}catch{}try{if(window.sessionStorage.getItem(e)==="1")return!0}catch{}return So.has(e)}function qi(e){try{window.localStorage.setItem(e,"1");return}catch{}try{window.sessionStorage.setItem(e,"1");return}catch{}So.add(e)}const Po=new Set;let ln=null,At=null;function To(){At&&At.parentNode&&At.parentNode.removeChild(At),At=null,ln=null}function Zi(e){const t=Mo(e,window.location.pathname),n=Yi(e,{userAgent:navigator.userAgent,isBrave:!!navigator.brave}),r=document.createElement("div");r.setAttribute("role","status"),r.setAttribute("data-cairn-plot-capnotice",e),Object.assign(r.style,{position:"fixed",bottom:"12px",right:"12px",zIndex:"2147483000",maxWidth:"340px",boxSizing:"border-box",padding:"10px 30px 10px 12px",borderRadius:"6px",border:"1px solid var(--color-border, #d0d7de)",background:"rgb(var(--color-bg-elevated-rgb, 246 248 250) / 0.9)",color:"var(--color-fg-muted, #656d76)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",boxShadow:"0 4px 12px rgba(0, 0, 0, 0.18)",font:"12px/1.4 system-ui, sans-serif"});const o=document.createElement("div");o.textContent=Ki(e),Object.assign(o.style,{fontWeight:"600",color:"var(--color-fg, #1f2328)",marginBottom:"4px"});const a=document.createElement("div");a.textContent=n,a.style.marginBottom="4px";const s=document.createElement("a");s.href=Xi,s.target="_blank",s.rel="noopener noreferrer",s.textContent="Learn more",Object.assign(s.style,{color:"var(--color-accent, #0969da)",textDecoration:"none"});const u=document.createElement("button");u.type="button",u.textContent="×",u.setAttribute("aria-label","Dismiss browser capability notice"),u.title="Dismiss",Object.assign(u.style,{position:"absolute",top:"4px",right:"6px",padding:"0 4px",border:"0",background:"transparent",color:"var(--color-fg-subtle, #8b949e)",cursor:"pointer",fontSize:"16px",lineHeight:"1"}),u.addEventListener("click",()=>{qi(t),To()}),r.appendChild(o),r.appendChild(a),r.appendChild(s),r.appendChild(u),document.body.appendChild(r),At=r,ln=e}function Ro(e){if(typeof document>"u"||typeof window>"u"||Po.has(e))return;Po.add(e);const t=Mo(e,window.location.pathname);if(Ao(t))return;const n=()=>{if(!Ao(t)){if(ln!==null)if(_o[e]<_o[ln])To();else return;Zi(e)}};document.body?n():window.addEventListener("DOMContentLoaded",n,{once:!0})}const Qi={data:new Float32Array(0),shape:[0,0],dtype:"<f4"};function ji(e){const{h:t,w:n,c:r}=yo(e.shape);if(e.precision==="f16-bits"){const s=e.data,u=new Uint16Array(n*t*4);for(let i=0;i<n*t;i++){const l=i*r,d=i*4;if(r===1){const x=s[l];u[d]=x,u[d+1]=x,u[d+2]=x,u[d+3]=Zt}else u[d]=s[l],u[d+1]=s[l+1],u[d+2]=s[l+2],u[d+3]=r>=4?s[l+3]:Zt}return{data:u,width:n,height:t,format:"rgba16float"}}const o=e.data,a=new Float32Array(n*t*4);for(let s=0;s<n*t;s++){const u=s*r;let i,l,d,x=1;r===1?i=l=d=Ce(o[u]):r===3?(i=Ce(o[u]),l=Ce(o[u+1]),d=Ce(o[u+2])):(i=Ce(o[u]),l=Ce(o[u+1]),d=Ce(o[u+2]),x=Ce(o[u+3]));const m=s*4;a[m]=i,a[m+1]=l,a[m+2]=d,a[m+3]=x}return{data:a,width:n,height:t,format:"rgba32float"}}function Co(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),a=n*o,s=r*o,u=(t.width-a)/2,i=(t.height-s)/2,l=Math.max(e.zoom,1e-6),d=t.width/(l*a),x=t.height/(l*s),m=-u/a-e.pan.x/(l*a),b=-i/s-e.pan.y/(l*s);return{x:m,y:b,w:d,h:x}}function Do(e,t,n,r){const o=e.w*n,a=e.h*r;return o<=0||a<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/a)}function Ji(e){var dt,F,de;const t=wo(e),n=c.useRef(null),r=c.useRef(null),o=c.useRef(null),a=c.useRef(null),s=c.useRef(null),u=t&&!!((dt=e.hdr)!=null&&dt.deep),i=c.useCallback((O,G)=>{var U,B;(U=a.current)==null||U.setDeepWindow(O,G),(B=s.current)==null||B.call(s)},[]),l=vo(t?e.hdr:Qi,u?i:void 0),d=c.useRef(!1),[x,m]=c.useState(!1),[b,w]=c.useState(!1),[v,M]=c.useState(!1),[h,g]=c.useState(null),[p,E]=c.useState(0),[_,y]=c.useState(0),[C,S]=c.useState({x:0,y:0,w:1,h:1}),A=c.useRef(null),P=c.useRef(null),[T,k]=c.useState(0),R=e.zoom??1,L=e.pan??{x:0,y:0},I=e.onViewportChange,H=e.toolbar??!0,V=t?"none":e.colormap??"none",[z,N,j]=Be(V);c.useEffect(()=>{N(V)},[V,N]);const $=t?"none":z,le=e.tonemap,[ae,ue]=c.useState(null);c.useEffect(()=>{ue(null)},[le]);const W=Er(le),K=ae??W,q=ae!==null&&ae!==W,ne=c.useCallback(()=>ue(null),[]),ge=e.peak,te=()=>ge!=null&&ge>0?ge:yr(le)??Vt,[fe,ve,Me]=Be(te());c.useEffect(()=>{ve(te())},[ge,le]);const ie=e.gamma,[Ae,xe,De]=Be(ie&&ie>0?ie:Mt);c.useEffect(()=>{ie&&ie>0&&xe(ie)},[ie,xe]);const[Ee,Pe]=c.useState(0),[Re,vt]=c.useState(0),Ve=Fn();c.useEffect(()=>{const O=n.current;if(!O)return;let G=!1;return Ut().then(U=>{var Se;if(G)return;const B=((Se=U.probeExtendedToneMapping)==null?void 0:Se.call(U))??!1,Q=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,he=B&&Q&&(t||V==="none");d.current=he,m(he),t&&!he&&Ro(B?"no-hdr-display":"no-hdr-browser"),ja(O,{hdr:he}).then(we=>{if(G){to(we);return}a.current=we,M(!0)}).catch(we=>{G||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",we),w(!0))})}).catch(U=>{G||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",U),w(!0))}),()=>{G=!0,a.current&&(to(a.current),a.current=null)}},[]),c.useEffect(()=>{const O=r.current;if(!O)return;const G=new ResizeObserver(()=>y(U=>U+1));return G.observe(O),()=>G.disconnect()},[]),c.useEffect(()=>{const O=r.current;if(!O)return;const G=new IntersectionObserver(U=>{const B=U[0];if(!B)return;const Q=a.current;Q&&(Q.setVisible(B.isIntersecting),B.isIntersecting?Q.isParked&&(Q.restore(),y(J=>J+1)):Q.park())},{threshold:0});return G.observe(O),()=>G.disconnect()},[]),c.useEffect(()=>{var U;if(!t||!v||u)return;const O=l.hdr;A.current=O;const G=ji(O);(U=a.current)==null||U.setSource(G),g(B=>B&&B.w===G.width&&B.h===G.height?B:{w:G.width,h:G.height}),k(B=>B+1),E(B=>B+1)},[t,v,u,t?l.hdr:null]),c.useEffect(()=>{if(!t||!v||!u)return;const O=e.hdr,G=O.deep;A.current=O;let U=!1;return G.getGpuCsr().then(B=>{var Q;U||((Q=a.current)==null||Q.setDeepSource(B,G.zMin,G.zMax),g(J=>J&&J.w===B.width&&J.h===B.height?J:{w:B.width,h:B.height}),k(J=>J+1),E(J=>J+1))}).catch(B=>{U||console.warn("[cairn] deep GPU CSR upload failed:",B)}),()=>{U=!0}},[t,v,u,t?e.hdr.deep:null]),c.useEffect(()=>{if(t||!v)return;const O=e,G=O.imageUrl,U=z;if(!G){P.current=null,g(null),k(Q=>Q+1);return}let B=!1;return at(G).then(Q=>{var Se,we;if(B||!Q)return;let J=Q;if(U!=="none"){const se=`gpu::${G}::${U}::ev${Ee}::off${Re}`,Ue=On(se);if(Ue)J=Ue;else{const Xe=kn(U);J=Dn(Q,U,Xe,Ee,Re),Ln(se,J)}}P.current=Q;const he={data:J.data,width:J.width,height:J.height,format:"rgba8unorm"};(Se=a.current)==null||Se.setSource(he),g(se=>se&&se.w===J.width&&se.h===J.height?se:{w:J.width,h:J.height}),(we=O.onNaturalSize)==null||we.call(O,J.width,J.height),k(se=>se+1),E(se=>se+1)}),()=>{B=!0}},[t,v,t?null:e.imageUrl,t?null:z,t?0:Ee,t?0:Re]);const me=e.exposure??0,rt=e.offset??0,Ke=!t&&$==="none",Te=c.useCallback(()=>{const O=a.current;if(!O||!v||!h)return;const G=r.current,U=o.current,B=U?U.getBoundingClientRect():G?G.getBoundingClientRect():{width:h.w,height:h.h},Q=Co({zoom:R,pan:L},B,h.w,h.h);S(se=>se.x===Q.x&&se.y===Q.y&&se.w===Q.w&&se.h===Q.h?se:Q),B.width>0&&B.height>0&&O.resize(Math.round(B.width*Ve),Math.round(B.height*Ve));const J=Do(Q,B,h.w,h.h)>=en?"nearest":"linear",he=Q,Se=_r(K,d.current?fe:1,d.current,Ae),we=t||Ke?{exposureEV:me+Ee,offset:rt+Re,operator:Se.operator,gamma:Se.gamma,isScalar:!1,hdrOut:Se.hdrOut,peak:Se.peak,srgbDecode:!t,uv:he,filter:J}:{exposureEV:0,offset:0,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,srgbDecode:!1,uv:he,filter:J};try{O.render(we)||w(!0)}catch(se){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",se),w(!0)}},[v,h,R,L.x,L.y,me,rt,Ee,Re,K,fe,Ae,Ke,t,$,Ve]);s.current=Te,c.useEffect(()=>{Te()},[Te,p,_]);const Fe=c.useCallback((O,G,U)=>{if(t){const se=A.current,Ue=h;if(!se||!Ue||O<0||G<0||O>=Ue.w||G>=Ue.h)return null;const Xe=se.shape.length===2?1:se.shape[2]??1,qe=(G*Ue.w+O)*Xe,Tt=se.data,yt=se.precision==="f16-bits"?ot=>Qt(Tt[ot]??0):ot=>Tt[ot]??0,Et=Xe===1?[yt(qe)]:[yt(qe),yt(qe+1),yt(qe+2)];return gt(Et,"unit",U)}const B=P.current;if(!B||O<0||G<0||O>=B.width||G>=B.height)return null;const Q=(G*B.width+O)*4,J=B.data[Q],he=B.data[Q+1],Se=B.data[Q+2];return gt($!=="none"||J===he&&he===Se?[J]:[J,he,Se],"uint8",U)},[t,h,$]),Ge=e.showAxes??!1,et=t?e.label??"":e.label,tt=e.interpolation??"auto",wt=tt==="auto"?void 0:tt,$e=t?void 0:e.overlay,ke=t?void 0:e.overlaySettings,It=t?!1:e.isDraggable??!1,Pt=t?void 0:e.onDragStart;if(b)return t?f.jsx(Yn,{...e}):f.jsx(Yn,{...e});const ft=$e&&(ke!=null&&ke.enabled)&&h&&((((F=$e.boxes)==null?void 0:F.length)??0)>0||(((de=$e.masks)==null?void 0:de.length)??0)>0)?f.jsx(Gn,{data:$e,settings:ke,naturalWidth:h.w,naturalHeight:h.h}):void 0;return f.jsx(cn,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":v},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:H,paneRef:r,wrapperRef:o,zoom:R,pan:L,onViewportChange:I,naturalDims:h,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:Ge&&h?"16px 4px 4px 28px":0,surface:f.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:wt},"data-gpu-image-canvas":!0}),showAxes:Ge,overlayNode:ft,overlay:{displayElRef:n,sample:Fe,version:T,hasSource:!0,sourceWindow:C},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:Te,leadingMenus:t?[an(K,O=>ue(O))]:Ke?[Lt($,O=>N(O)),an(K,O=>ue(O))]:[Lt($,O=>N(O))],displayAdjust:{exposureEV:Ee,offset:Re,onExposureChange:Pe,onOffsetChange:vt},extraSliders:[...(t||Ke)&&x?[{id:"peak",label:"PK",title:"Peak white (×SDR white) — the HDR ceiling P every operator clips at (Linear/sRGB/Gamma hard-clip at P; Reinhard/ACES roll off toward P). P=1 reproduces the SDR rendition exactly; double-click to type a value, including 'inf' for the raw browser-clipped extended look.",min:mr,max:Ct,step:hr,value:fe,onChange:ve,format:O=>Number.isFinite(O)?`${O.toFixed(1)}×`:"∞"}]:[],...(t||Ke)&&Kt(K)?[{id:"gamma",label:"γ",title:"Display gamma γ for the Gamma transfer — display = clamp(value)^(1/γ), tev-style. Default 2.2 (close to sRGB, not identical). Double-click to type a value.",min:Ht,max:Wt,step:Yt,value:Ae,onChange:xe,format:O=>O.toFixed(1)}]:[]],depthSliders:l.sliders,regionSelect:u?{rect:l.region,queryLive:l.queryRegionWindow,commit:l.commitRegion,remove:l.removeRegion}:void 0,onReset:()=>{j.reset(),ne(),Me.reset(),De.reset(),l.reset()},extraModified:j.isModified||q||Me.isModified||De.isModified||l.isModified,label:et,showLabelChip:!!et,isDraggable:It,onDragStart:Pt})}const un=new Map;function je(e){if(un.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);un.set(e.id,e)}function lt(e){return un.get(e)}function ec(){return Array.from(un.values())}function ko(e,t){return{...e.params??{},...t??{}}}const tc={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},nc={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},rc={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},oc={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},sc={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},ac={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},Oo=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];cc(Oo);const Kn=[1.052156925,1,.91835767],ic=.7;function cc(e){const[t,n,r]=e[0],[o,a,s]=e[1],[u,i,l]=e[2],d=a*l-s*i,x=-(o*l-s*u),m=o*i-a*u,w=1/(t*d+n*x+r*m);return[[d*w,-(n*l-r*i)*w,(n*s-r*a)*w],[x*w,(t*l-r*u)*w,-(t*s-r*o)*w],[m*w,-(t*i-n*u)*w,(t*a-n*o)*w]]}function lc(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const qn=6/29;function Zn(e){return e>qn**3?Math.cbrt(e):e/(3*qn*qn)+4/29}function Lo(e,t,n){const[r,o,a]=lc(Oo,e,t,n),s=Zn(r*Kn[0]),u=Zn(o*Kn[1]),i=Zn(a*Kn[2]),l=116*u-16,d=500*(s-u),x=200*(u-i);return[l,.01*l*d,.01*l*x]}function uc(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function fc(){const e=Lo(0,1,0),t=Lo(0,0,1);return Math.pow(uc(e,t),ic)}const Bo=fc(),dc=.082;function No(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],a=Math.max(...n,...o),s=Math.ceil(3*Math.sqrt(a/(2*Math.PI**2))*e),u=1/e,i=Math.PI**2,l=[0,0,0];for(let d=-s;d<=s;d++)for(let x=-s;x<=s;x++){const m=(x*u)**2+(d*u)**2;for(let b=0;b<3;b++)l[b]+=t[b]*Math.sqrt(Math.PI/n[b])*Math.exp(-i*m/n[b])+r[b]*Math.sqrt(Math.PI/o[b])*Math.exp(-i*m/o[b])}return{r:s,deltaX:u,sums:l}}function Io(e){const t=.5*dc*e,n=Math.ceil(3*t);let r=0,o=0,a=0;for(let s=-n;s<=n;s++)for(let u=-n;u<=n;u++){const i=Math.exp(-(u*u+s*s)/(2*t*t)),l=-u*i,d=(u*u/(t*t)-1)*i;l>0&&(r+=l),d>0?o+=d:a-=d}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:a}}const pc=`
${ze}
${nn}
${bt}
${kt}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_map0: vec4<f32>; // offX, offY, fitFill, 0
@group(0) @binding(8) var<uniform> u_map1: vec4<f32>; // resultW, resultH, 0, 0
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = mapSample(src, px, u_map0.x, u_map0.y, u_map1.x, u_map1.y, u_map0.z);
  return vec4<f32>(flip_rgb2ycxcz(s.rgb), 1.0);
}
`,mc=`
${ze}
${nn}
${bt}
${kt}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_map0: vec4<f32>; // offX, offY, fitFill, 0
@group(0) @binding(8) var<uniform> u_map1: vec4<f32>; // resultW, resultH, 0, 0
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = mapSample(src, px, u_map0.x, u_map0.y, u_map1.x, u_map1.y, u_map0.z);
  return vec4<f32>(flip_linrgb2ycxcz(clamp(s.rgb, vec3<f32>(0.0), vec3<f32>(1.0))), 1.0);
}
`,fn=`
${ze}
${nn}
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
`,Fo=`
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
`;function Je(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function dn(e,t,n){const r=n.sourceMap,o=r?t==="a"?r.offsetA:r.offsetB:{x:0,y:0},a=r!=null&&r.fill?1:0;return[Je(e,[o.x,o.y,a,0]),Je(e+1,[n.width,n.height,0,0])]}function pn(e){return[Je(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),Je(2,[e.sums[2],0,0,0])]}function Go(e){return[Je(4,[Bo,e.sd,e.r,e.edgeNorm]),Je(5,[e.pointPos,e.pointNeg,0,0])]}function Uo(e,t,n,r,o,a=""){const s=No(e),u=Io(e),i=`ycxczA${a}`,l=`ycxczB${a}`,d=`labA${a}`,x=`labB${a}`,m=`flip${a}`;return{passes:[{name:i,shader:t,inputs:[n],output:i,uniforms:()=>dn(1,"a",o)},{name:l,shader:t,inputs:[r],output:l,uniforms:()=>dn(1,"b",o)},{name:d,shader:fn,inputs:[i],output:d,uniforms:()=>pn(s)},{name:x,shader:fn,inputs:[l],output:x,uniforms:()=>pn(s)},{name:m,shader:Fo,inputs:[d,x,i,l],output:m,uniforms:()=>Go(u)}],flipRef:m}}const hc={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=Uo(t,pc,"srcA","srcB",e);return{passes:n,final:r}}},gc={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=Uo(t,mc,"srcA","srcB",e);return{passes:n,final:r}}},zo=`
${ze}
${nn}
${bt}
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
`,xc=`
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
`,bc={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",output:"scalar",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),a=(r-n)/Math.max(o-1,1),s=No(t),u=Io(t),i=[];let l=null;for(let d=0;d<o;d++){const x=n+d*a,m=`_e${d}`,b=`ycxczA${m}`,w=`ycxczB${m}`,v=`labA${m}`,M=`labB${m}`,h=`acc${m}`;i.push({name:b,shader:zo,inputs:["srcA"],output:b,uniforms:()=>[Je(1,[x,0,0,0]),...dn(2,"a",e)]},{name:w,shader:zo,inputs:["srcB"],output:w,uniforms:()=>[Je(1,[x,0,0,0]),...dn(2,"b",e)]},{name:v,shader:fn,inputs:[b],output:v,uniforms:()=>pn(s)},{name:M,shader:fn,inputs:[w],output:M,uniforms:()=>pn(s)}),l===null?i.push({name:h,shader:Fo,inputs:[v,M,b,w],output:h,uniforms:()=>Go(u)}):i.push({name:h,shader:xc,inputs:[v,M,b,w,l],output:h,uniforms:()=>[Je(5,[Bo,u.sd,u.r,u.edgeNorm]),Je(6,[u.pointPos,u.pointNeg,0,0])]}),l=h}return{passes:i,final:l}}},Vo=.01,$o=.03,mn=1,Qn=1.5,ut=5,jn=[.2126,.7152,.0722];function Jn(e){return e<=.04045?e/12.92:Math.pow((e+.055)/1.055,2.4)}function Xo(e,t,n){const r=jn[0]*Jn(e)+jn[1]*Jn(t)+jn[2]*Jn(n);return Math.min(1,Math.max(0,r))}function vc(e,t){const n=2*t+1,r=new Float64Array(n);let o=0;for(let a=-t,s=0;a<=t;a++,s++){const u=Math.exp(-.5*a*a/(e*e));r[s]=u,o+=u}for(let a=0;a<n;a++)r[a]=r[a]/o;return r}function Ho(e,t){if(t===1)return 0;const n=2*t;let r=(e%n+n)%n;return r>=t&&(r=n-1-r),r}const Wo=()=>new Promise(e=>{typeof setTimeout=="function"?setTimeout(e,0):Promise.resolve().then(e)}),er=64;async function Bt(e,t,n,r,o,a){const s=new Float64Array(t*n);for(let i=0;i<n;i++){for(let l=0;l<t;l++){let d=0;for(let x=-o,m=0;x<=o;x++,m++)d+=r[m]*e[i*t+Ho(l+x,t)];s[i*t+l]=d}(i+1)%er===0&&await a()}const u=new Float64Array(t*n);for(let i=0;i<n;i++){for(let l=0;l<t;l++){let d=0;for(let x=-o,m=0;x<=o;x++,m++)d+=r[m]*s[Ho(i+x,n)*t+l];u[i*t+l]=d}(i+1)%er===0&&await a()}return u}async function wc(e,t,n,r,o=Wo){const a=n*r;if(a<=0)return NaN;const s=vc(Qn,ut),u=new Float64Array(a),i=new Float64Array(a),l=new Float64Array(a);for(let g=0;g<a;g++)u[g]=e[g]*e[g],i[g]=t[g]*t[g],l[g]=e[g]*t[g];const d=await Bt(e,n,r,s,ut,o),x=await Bt(t,n,r,s,ut,o),m=await Bt(u,n,r,s,ut,o),b=await Bt(i,n,r,s,ut,o),w=await Bt(l,n,r,s,ut,o),v=(Vo*mn)**2,M=($o*mn)**2;let h=0;for(let g=0;g<a;g++){const p=m[g]-d[g]*d[g],E=b[g]-x[g]*x[g],_=w[g]-d[g]*x[g],y=2*d[g]*x[g]+v,C=2*_+M,S=d[g]*d[g]+x[g]*x[g]+v,A=p+E+M;h+=y*C/(S*A)}return h/a}const Yo=`
${ze}

fn ssim_srgb2linear(c: f32) -> f32 {
  if (c <= 0.04045) { return c / 12.92; }
  return pow((c + 0.055) / 1.055, 2.4);
}
fn ssim_luma(srgb: vec3<f32>) -> f32 {
  let lin = vec3<f32>(ssim_srgb2linear(srgb.r), ssim_srgb2linear(srgb.g), ssim_srgb2linear(srgb.b));
  return clamp(dot(lin, vec3<f32>(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
}

${bt}
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
`,yc=`
${Yo}
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let y = ssim_moment_luma(in);
  return vec4<f32>(y.x, y.y, y.x * y.x, y.y * y.y);
}
`,Ec=`
${Yo}
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let y = ssim_moment_luma(in);
  return vec4<f32>(y.x * y.y, 0.0, 0.0, 0.0);
}
`,Ko=`
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
`,_c=`
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
`;function Nt(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function qo(e){const t=e.sourceMap,n=t?t.offsetA:{x:0,y:0},r=t?t.offsetB:{x:0,y:0},o=t!=null&&t.fill?1:0;return[Nt(2,[n.x,n.y,r.x,r.y]),Nt(3,[e.width,e.height,o,0])]}function Zo(e,t){const n=`${t}H`,r=`${t}V`;return{passes:[{name:n,shader:Ko,inputs:[e],output:n,uniforms:()=>[Nt(1,[1,0,ut,Qn])]},{name:r,shader:Ko,inputs:[n],output:r,uniforms:()=>[Nt(1,[0,1,ut,Qn])]}],out:r}}const Mc={kind:"multipass",id:"ssim",label:"SSIM (1−SSIM)",publicName:"ssim",displayRange:"unit",output:"scalar",buildPasses(e){const t=(Vo*mn)**2,n=($o*mn)**2,r=Zo("momA","statsA"),o=Zo("momB","statsB");return{passes:[{name:"momA",shader:yc,inputs:["srcA","srcB"],output:"momA",uniforms:qo},{name:"momB",shader:Ec,inputs:["srcA","srcB"],output:"momB",uniforms:qo},...r.passes,...o.passes,{name:"ssim",shader:_c,inputs:[r.out,o.out],output:"ssim",uniforms:()=>[Nt(2,[t,n,0,0])]}],final:"ssim"}}};let Qo=!1;function Sc(){Qo||(Qo=!0,je(nc),je(tc),je(rc),je(sc),je(oc),je(ac),je(hc),je(bc),je(gc),je(Mc))}Sc();function jo(){const e=[];for(const n of ec())n.kind==="pointwise"&&e.push({id:n.id,label:n.label});e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"});const t=lt("ssim");return t&&e.push({id:t.id,label:t.label}),e}function Ac(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}function Pc(e,t,n){const r=t*n;if(r<=0)return NaN;let o=0;for(let a=0;a<r;a++)o+=e[a*4]??0;return 1-o/r}function Jo(e){return e==null||Number.isNaN(e)?"—":e.toFixed(4)}const es=new WeakMap;function Tc(e,t,n){let r=es.get(e);r||(r=new Map,es.set(e,r));const o=r.get(t);if(o)return o;const a=n().catch(s=>{throw r.get(t)===a&&r.delete(t),s});return r.set(t,a),a}const ts=new WeakMap;function tr(e,t,n,r){let o=ts.get(e);o||(o=new Map,ts.set(e,o));const a=`${t}::${r}`;let s=o.get(a);return s||(s=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(a,s)),s}function Rc(e){return`
${ze}
${bt}
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
`}const hn="rgba16float";function Cc(e,t,n,r,o,a){var M,h;const s=lt(r);if(!s)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const u=a??Ot({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),i=u.result.w,l=u.result.h,d=u.fit==="fill"?1:0,x=ko(s,o);if(s.kind==="pointwise"){const g=e.createTexture(i,l,hn),p=tr(e,`pw:${s.id}`,Rc(s.source),hn),E=new Float32Array([u.offsetA.x,u.offsetA.y,u.offsetB.x,u.offsetB.y]),_=new Float32Array([i,l,d,0]);let y;try{y=e.createBindGroup(p,[{binding:0,resource:t},{binding:1,resource:n},{binding:2,resource:{uniform:E}},{binding:3,resource:{uniform:_}}]),e.renderFullscreen(g,p,y)}finally{(M=y==null?void 0:y.destroy)==null||M.call(y)}return g}const m={width:i,height:l,params:x,sourceMap:{fill:u.fit==="fill",offsetA:u.offsetA,offsetB:u.offsetB}},b=s.buildPasses(m),w=new Map([["srcA",t],["srcB",n]]),v=[];try{for(const p of b.passes){const E=e.createTexture(i,l,hn);v.push(E),w.set(p.output,E);const _=tr(e,`mp:${s.id}:${p.name}`,p.shader,hn),y=p.inputs.map((S,A)=>{const P=w.get(S);if(!P)throw new Error(`computeDiff: pass "${p.name}" input "${S}" not produced yet`);return{binding:A,resource:P}});p.uniforms&&y.push(...p.uniforms(m));let C;try{C=e.createBindGroup(_,y),e.renderFullscreen(E,_,C)}finally{(h=C==null?void 0:C.destroy)==null||h.call(C)}}const g=w.get(b.final);if(!g)throw new Error(`computeDiff: final ref "${b.final}" not produced`);for(const p of v)p!==g&&p.destroy();return g}catch(g){for(const p of v)p.destroy();throw g}}const Dc=8,kc=256*1024*1024;class Oc{constructor(t=Dc,n=kc){oe(this,"map",new Map);oe(this,"totalBytes",0);oe(this,"maxEntries");oe(this,"maxBytes");this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}accountReadbackBytes(t,n){let r=!1;for(const o of this.map.values())if(o===t){r=!0;break}r&&(t.bytes+=n,this.totalBytes+=n,this.evict())}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const ns=new WeakMap;function rs(e){let t=ns.get(e);return t||(t=new Oc,ns.set(e,t)),t}function Lc(e,t){const n=ko(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function Bc(e,t,n,r,o){const a=lt(n),s=a?Lc(a,r):"",u=o?zn(o):"";return`${e}|${t}|${n}|${s}|${u}`}function os(e,t,n,r,o,a,s,u){const i=lt(r);if(!i)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const l=rs(e),d=u??Ot({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),x=Bc(a,s,r,o,d),m=l.get(x);if(m)return m;const b=Cc(e,t,n,r,o,d),w=d.result.w,v=d.result.h,M={texture:b,width:w,height:v,displayRange:i.displayRange,bytes:w*v*8};return l.set(x,M),M}function Nc(e,t,n){return`${e}|${t}|${n?zn(n):""}`}function Ic(e,t,n,r,o,a){return Tc(e,Nc(r,o,a),()=>Fc(e,t,n,r,o,a))}async function Fc(e,t,n,r,o,a){try{const s=os(e,t,n,"ssim",void 0,r,o,a);return s.ssimMean!==void 0?s.ssimMean:(s.ssimMeanPending||(s.ssimMeanPending=ss(e,s).then(u=>{const i=Pc(u,s.width,s.height);return s.ssimMean=i,i})),await s.ssimMeanPending)}catch{return Gc(e,t,n,a)}}async function Gc(e,t,n,r){const o=r??Ot({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),a=o.result.w,s=o.result.h,u=a*s;if(u<=0)return NaN;const i=await e.readback(t),l=await e.readback(n),d=i instanceof Uint8Array?255:1,x=l instanceof Uint8Array?255:1,m=o.fit==="fill",b=on(i,t.width,t.height,d,o.offsetA,m,a,s),w=on(l,n.width,n.height,x,o.offsetB,m,a,s),v=new Float64Array(u),M=new Float64Array(u),h=[0,0,0],g=[0,0,0];for(let p=0;p<s;p++){for(let E=0;E<a;E++){b(E,p,h),w(E,p,g);const _=p*a+E;v[_]=Xo(h[0],h[1],h[2]),M[_]=Xo(g[0],g[1],g[2])}(p+1)%er===0&&await Wo()}return wc(v,M,a,s)}async function Uc(e,t,n,r,o){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=Zr(e,n,r,o).then(a=>(t.scalars=a,a))),t.scalarsPending)}async function ss(e,t){return t.resultSamples?t.resultSamples:(t.resultSamplesPending||(t.resultSamplesPending=e.readback(t.texture).then(n=>{const r=n instanceof Float32Array?n:Float32Array.from(n);return t.resultSamples=r,rs(e).accountReadbackBytes(t,r.byteLength),r})),t.resultSamplesPending)}const zc=`
${ze}
${bt}
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
`,Vc={unit:0,signed:1,relative:2},$c={linear:0,signed:1,positive:2};function Xc(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function Hc(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function Wc(e,t,n,r,o){var b,w,v;const a=Hc(t),s=tr(e,"diff-display",zc,a),u=Xc(e,o.colormap),i=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),l=new Float32Array([Vc[r],$c[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]),d=new Float32Array([o.exposureEV??0,o.offset??0,0,0]),x=new Float32Array([((b=o.sourceDims)==null?void 0:b.w)??0,((w=o.sourceDims)==null?void 0:w.h)??0,0,0]);let m;try{m=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:u},{binding:2,resource:{uniform:i}},{binding:3,resource:{uniform:l}},{binding:4,resource:{uniform:d}},{binding:5,resource:{uniform:x}}]),e.renderFullscreen(t,s,m)}finally{(v=m==null?void 0:m.destroy)==null||v.call(m),u.destroy()}}const as=.6*.6*2.51,Yc=.6*.03,Kc=0,is=.6*.6*2.43,qc=.6*.59,Zc=.14;function cs(e){const t=(Yc-qc*e)/(as-is*e),n=(Kc-Zc*e)/(as-is*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const Qc=.85,jc=.85,ls=11920928955078125e-23,nr=[.2126,.7152,.0722];function Jc(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function el(e,t,n,r=3,o={}){const a=t*n,s=cs(Qc),u=cs(jc),i=new Float64Array(a);let l=0;for(let g=0;g<a;g++){const[p,E,_]=Jc(e,g,r),y=p*nr[0]+E*nr[1]+_*nr[2];i[g]=y,y>l&&(l=y)}const d=Float64Array.from(i).sort(),x=a>>1,m=a%2===1?d[x]:d[x-1],b=Math.max(m,ls),w=Math.max(l,ls),v=o.startExposure??Math.log2(s/w),M=o.stopExposure??Math.log2(u/b),h=Math.max(2,Math.ceil(M-v));return{startExposure:v,stopExposure:M,numExposures:h}}const tl="absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm pointer-events-none select-none",nl="REF";function us(){return f.jsx("span",{className:tl,children:nl})}function fs({splitPosition:e,onChange:t,onReset:n}){return f.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${e*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:r=>{r.stopPropagation(),n==null||n()},onPointerDown:r=>{r.stopPropagation(),r.preventDefault();const o=r.currentTarget;try{o.setPointerCapture(r.pointerId)}catch{}const s=o.parentElement.getBoundingClientRect(),u=l=>{t==null||t(Math.max(0,Math.min(1,(l.clientX-s.left)/s.width)))},i=()=>{window.removeEventListener("pointermove",u),window.removeEventListener("pointerup",i)};window.addEventListener("pointermove",u),window.addEventListener("pointerup",i)},children:f.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})}const rl={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function ol({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:a,zoom:s,pan:u,onViewportChange:i,processing:l=rl,interpolation:d="auto",label:x="",isDraggable:m=!1,onDragStart:b,overlay:w,overlaySettings:v,pixelValueNotation:M="decimal"}){var ne,ge;const h=c.useRef(null),[g,p]=c.useState(null),[E,_]=c.useState(null),[y,C]=c.useState(M),[S,A]=c.useState(!1),P=c.useRef(null),T=c.useRef(null),k=c.useRef(null),R=c.useRef(null),[L,I]=c.useState(0);c.useEffect(()=>{if(!e){k.current=null,I(fe=>fe+1);return}let te=!1;return at(e).then(fe=>{te||(k.current=fe,I(ve=>ve+1))}),()=>{te=!0}},[e]),c.useEffect(()=>{if(!t){R.current=null,I(fe=>fe+1);return}let te=!1;return at(t).then(fe=>{te||(R.current=fe,I(ve=>ve+1))}),()=>{te=!0}},[t]);const H=te=>(fe,ve,Me)=>{const ie=te.current;if(!ie||fe<0||ve<0||fe>=ie.width||ve>=ie.height)return null;const Ae=(ve*ie.width+fe)*4,xe=ie.data[Ae],De=ie.data[Ae+1],Ee=ie.data[Ae+2];return xe===De&&De===Ee?{lines:[St(xe,"uint8",Me)]}:{lines:[St(xe,"uint8",Me),St(De,"uint8",Me),St(Ee,"uint8",Me)],colors:[tn[0],tn[1],tn[2]]}},V=c.useMemo(()=>H(k),[]),z=c.useMemo(()=>H(R),[]),N=!!w&&!!(v!=null&&v.enabled)&&!!g&&!!e&&((((ne=w.boxes)==null?void 0:ne.length)??0)>0||(((ge=w.masks)==null?void 0:ge.length)??0)>0),{gammaFilterId:j,filterStr:$,gamma:le,offset:ae}=ro(l),ue=`translate(${u.x}px, ${u.y}px) scale(${s})`,W=d==="auto"?void 0:d,{containerProps:K,modifierActive:q}=Nr({containerRef:h,zoom:s,pan:u,onViewportChange:i});return f.jsxs("div",{className:"relative flex flex-col h-full",children:[f.jsx(oo,{id:j,gamma:le,offset:ae}),f.jsxs("div",{ref:h,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...K.style},onPointerDown:K.onPointerDown,onPointerMove:K.onPointerMove,onPointerUp:K.onPointerUp,onPointerCancel:K.onPointerCancel,children:[f.jsxs("div",{className:"relative w-full h-full",children:[f.jsxs("div",{className:"relative w-full h-full",style:{transform:ue,transformOrigin:"0 0"},children:[f.jsx("img",{ref:P,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:$,imageRendering:W,...n==="blend"?{opacity:o}:{}},onLoad:te=>{const fe=te.currentTarget;p({w:fe.naturalWidth,h:fe.naturalHeight})}}),N&&f.jsx(Gn,{data:w,settings:v,naturalWidth:g.w,naturalHeight:g.h})]}),f.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:f.jsx("div",{className:"w-full h-full",style:{transform:ue,transformOrigin:"0 0"},children:f.jsx("img",{ref:T,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:$,imageRendering:W,...n==="blend"?{opacity:1-o}:{}},onLoad:te=>{const fe=te.currentTarget;_({w:fe.naturalWidth,h:fe.naturalHeight})}})})}),n==="split"&&f.jsx(fs,{splitPosition:r,onChange:a,onReset:()=>a==null?void 0:a(.5)})]}),n==="split"?f.jsxs(f.Fragment,{children:[t&&E&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:f.jsx(xt,{imageElRef:T,naturalWidth:E.w,naturalHeight:E.h,zoom:s,pan:u,sample:z,notation:y,version:L})}),e&&g&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:f.jsx(xt,{imageElRef:P,naturalWidth:g.w,naturalHeight:g.h,zoom:s,pan:u,sample:V,notation:y,version:L,onActiveChange:A})})]}):e&&g&&f.jsx(xt,{imageElRef:P,naturalWidth:g.w,naturalHeight:g.h,zoom:s,pan:u,sample:V,notation:y,version:L,onActiveChange:A}),S&&f.jsx(Vr,{notation:y,onChange:C})]}),n==="split"&&f.jsx(us,{}),f.jsx(Vn,{label:x,corner:"bottom-right",isDraggable:m&&!q,grip:!0,onDragStart:b})]})}function sl(){return f.jsx(no,{title:"GPU compare unavailable",body:"Float image sources need the GPU compare (WebGPU), which isn't available in this browser."})}function al({mode:e,kernel:t,kernelOptions:n,onSlide:r,onBlend:o,onKernel:a,onSide:s}){return{id:"compare-mode",title:"Compare / diff mode",menu:{options:[...s?[{id:"side",label:"Side"}]:[],{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...n],value:e==="side"?"side":e==="split"?"slide":e==="blend"?"blend":t,onSelect:l=>{l==="side"?s==null||s():l==="slide"?r():l==="blend"?o():a(l)}}}}function il(e){const t=An(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function cl(e){const{width:t,height:n,channels:r}=e,o=t*n;if(e.precision==="f16-bits"){const i=e.data,l=new Uint16Array(o*4);for(let d=0;d<o;d++){const x=d*r,m=d*4;if(r===1){const b=i[x];l[m]=b,l[m+1]=b,l[m+2]=b,l[m+3]=Zt}else l[m]=i[x],l[m+1]=i[x+1],l[m+2]=i[x+2],l[m+3]=r>=4?i[x+3]:Zt}return{data:l,format:"rgba16float"}}const a=e.data,s=new Float32Array(o*4),u=i=>Number.isFinite(i)?i:0;for(let i=0;i<o;i++){const l=i*r;let d,x,m,b=1;r===1?d=x=m=u(a[l]):r===3?(d=u(a[l]),x=u(a[l+1]),m=u(a[l+2])):(d=u(a[l]),x=u(a[l+1]),m=u(a[l+2]),b=u(a[l+3]));const w=i*4;s[w]=d,s[w+1]=x,s[w+2]=m,s[w+3]=b}return{data:s,format:"rgba32float"}}function ll({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:a,blendAlpha:s,onSplitPositionChange:u,diffSubmode:i,colormap:l="none",align:d="top-left",fit:x="crop",diffKernel:m,onDiffKernelChange:b,onCompareModeChange:w,onRequestSide:v,zoom:M,pan:h,onViewportChange:g,interpolation:p="auto",label:E="",pixelValueNotation:_="decimal",tonemap:y,peak:C,gamma:S,toolbar:A=!0}){var xs;const P=c.useRef(null),T=c.useRef(null),k=c.useRef(null),R=c.useRef(null),L=c.useRef(null),[I,H]=c.useState(!1),[V,z]=c.useState(!1),N=c.useRef(!1),[j,$]=c.useState(!1),[le,ae]=c.useState(null),[ue,W]=c.useState(null),[K,q]=c.useState({a:!1,b:!1}),[ne,ge]=c.useState(0),[te,fe]=c.useState(0),[ve,Me]=c.useState(null),[ie,Ae]=c.useState(null),[xe,De]=c.useState({x:0,y:0,w:1,h:1}),Ee=m??i??"absolute",[Pe,Re,vt]=Be(Ee);c.useEffect(()=>{Re(m??i??"absolute")},[m,i,Re]);const Ve=c.useCallback(D=>{Re(D),b==null||b(D)},[b,Re]);c.useEffect(()=>{const D=P.current;if(D)return D.__cairnDiffKernel={current:Pe,set:Ve},()=>{D&&delete D.__cairnDiffKernel}},[Pe,Ve]);const[me,rt,Ke]=Be(o);c.useEffect(()=>{rt(o)},[o,rt]);const Te=c.useCallback(D=>{rt(D),w==null||w(D)},[w,rt]),[Fe,Ge,et]=Be(l);c.useEffect(()=>{Ge(l)},[l,Ge]);const[tt,wt]=c.useState(null);c.useEffect(()=>{wt(null)},[y]);const $e=Er(y),ke=tt??$e,It=tt!==null&&tt!==$e,Pt=()=>C!=null&&C>0?C:yr(y)??Vt,[ft,dt,F]=Be(Pt()),[de,O,G]=Be(S&&S>0?S:Mt);c.useEffect(()=>{dt(Pt())},[C,y]),c.useEffect(()=>{S&&S>0&&O(S)},[S,O]);const U=c.useCallback(()=>{Te(Ke.default),Ge(et.default),Ve(vt.default),wt(null),F.reset(),G.reset()},[Te,Ge,Ve,Ke.default,et.default,vt.default,F,G]),B=Ke.isModified||et.isModified||vt.isModified||It||F.isModified||G.isModified,[Q,J]=c.useState(0),[he,Se]=c.useState(0),we=c.useMemo(()=>{const Z=[al({mode:me,kernel:Pe,kernelOptions:jo().map(X=>({id:X.id,label:X.label})),onSide:v,onSlide:()=>Te("split"),onBlend:()=>Te("blend"),onKernel:X=>{Te("diff"),Ve(X)}})];return me==="diff"?Z.push(Lt(Fe,X=>Ge(X))):Z.push(an(ke,X=>wt(X))),Z},[me,Pe,Fe,ke,Ve,Te,v]),se=c.useRef(null),Ue=c.useRef(null),Xe=c.useRef(null),qe=c.useRef(null),[Tt,yt]=c.useState(0),Et=c.useRef(null),ot=c.useRef(null),[dl,ds]=c.useState(0),rr=Fn();c.useEffect(()=>{const D=k.current;if(!D)return;let Z=!1;return Ut().then(X=>{var Y;if(!Z)try{if(Qr())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const re=((Y=X.probeExtendedToneMapping)==null?void 0:Y.call(X))??!1,ce=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,be=re&&ce;N.current=be,$(be);const _e=X.createSurface(D,{hdr:be});R.current={device:X,surface:_e,texA:null,texB:null},z(!0)}catch(re){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",re),H(!0)}}).catch(X=>{Z||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",X),H(!0))}),()=>{var Y,re;Z=!0;const X=R.current;X&&((Y=X.texA)==null||Y.destroy(),(re=X.texB)==null||re.destroy(),R.current=null)}},[]),c.useEffect(()=>{const D=P.current;if(!D)return;const Z=new ResizeObserver(()=>fe(X=>X+1));return Z.observe(D),()=>Z.disconnect()},[]),c.useEffect(()=>{if(!V)return;let D=!1;if(!R.current)return;async function X(Y,re){if(re){const be=cl(re);return{width:re.width,height:re.height,imageData:null,make:_e=>{const pe=_e.createTexture(re.width,re.height,be.format);return pe.write(be.data),pe}}}if(!Y)return null;const ce=await at(Y);return ce?{width:ce.width,height:ce.height,imageData:ce,make:be=>{const _e=be.createTexture(ce.width,ce.height,"rgba8unorm");return _e.write(ce.data),_e}}:null}return Promise.all([X(e,n),X(t,r)]).then(([Y,re])=>{var Oe,Ye;if(D||!R.current)return;const ce=R.current;se.current=(Y==null?void 0:Y.imageData)??null,Ue.current=(re==null?void 0:re.imageData)??null,Xe.current=n??null,qe.current=r??null,(Oe=ce.texA)==null||Oe.destroy(),(Ye=ce.texB)==null||Ye.destroy(),ce.texA=null,ce.texB=null;const be=Y??re;if(!be){ae(null),W(null),yt(pt=>pt+1);return}const _e=re??be,pe=Y??be;ce.texA=_e.make(ce.device),ce.texB=pe.make(ce.device),W({a:{w:_e.width,h:_e.height},b:{w:pe.width,h:pe.height}}),q({a:_e.imageData!=null,b:pe.imageData!=null}),ae({w:be.width,h:be.height}),yt(pt=>pt+1),ge(pt=>pt+1)}),()=>{D=!0}},[V,e,t,n,r]);const gn=n!=null||r!=null,He=c.useMemo(()=>Ac(Pe,gn),[Pe,gn]),Ft=c.useMemo(()=>{if(!gn)return null;const D=r??n;if(!D)return null;const Z=D.precision==="f16-bits"?Rr(D.data):D.data;return el(Z,D.width,D.height,D.channels)},[gn,r,n]),ps=c.useMemo(()=>{var D;return Ws(((D=lt(He))==null?void 0:D.displayRange)??"unit",Fe==="none"?null:Fe)},[He,Fe]),ms=c.useMemo(()=>Fe!=="none"?il(Fe):void 0,[Fe]),We=c.useMemo(()=>ue?Ot(ue.a,ue.b,d,x,"b"):null,[ue,d,x]),pl=c.useMemo(()=>We?zn(We):"none",[We]),xn=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",bn=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",Ie=c.useMemo(()=>le?me==="diff"&&We?We.result:le:null,[me,We,le]),or=c.useCallback(()=>{const D=R.current;if(!V||!D||!D.surface||!D.texA||!D.texB||!le)return;const Z=Ie??le,X=P.current,Y=X?X.getBoundingClientRect():{width:Z.w,height:Z.h},re=Co({zoom:M,pan:h},Y,Z.w,Z.h);De(pe=>pe.x===re.x&&pe.y===re.y&&pe.w===re.w&&pe.h===re.h?pe:re);const ce=k.current;if(Y.width>0&&Y.height>0&&ce&&D.surface){const pe=Math.max(1,Math.round(Y.width*rr)),Oe=Math.max(1,Math.round(Y.height*rr));(ce.width!==pe||ce.height!==Oe)&&(ce.width=pe,ce.height=Oe,D.surface.configure(pe,Oe))}const be=Do(re,Y,Z.w,Z.h)>=en?"nearest":"linear",_e=re;try{if(me==="diff"){const pe=lt(He)?He:"absolute",Oe=pe==="hdr-flip"&&Ft?{ppd:67,startExposure:Ft.startExposure,stopExposure:Ft.stopExposure,numExposures:Ft.numExposures}:void 0,Ye=os(D.device,D.texA,D.texB,pe,Oe,xn,bn,We??void 0);L.current=Ye,Wc(D.device,D.surface,Ye.texture,Ye.displayRange,{uv:_e,cmapMode:ps,colormap:ms,filter:be,exposureEV:Q,offset:he})}else{const pe=_r(ke,N.current?ft:1,N.current,de),Oe={exposureEV:Q,offset:he,operator:pe.operator,gamma:pe.gamma,isScalar:!1,hdrOut:pe.hdrOut,peak:pe.peak,srgbDecodeA:K.a,srgbDecodeB:K.b,uv:_e,filter:be,mode:me,split:a,alpha:s};Ya(D.device,D.surface,D.texA,D.texB,Oe)}}catch(pe){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",pe),H(!0)}},[V,le,Ie,We,M,h.x,h.y,me,a,s,Q,he,ke,ft,de,K,Pe,He,Ft,ps,ms,e,t,n,r,xn,bn,rr]);c.useEffect(()=>{or()},[or,ne,te]);const Rt=t!=null||r!=null;c.useEffect(()=>{const D=R.current;if(!V||!D||!D.texA||!D.texB||!Rt){Me(null);return}let Z=!1;const X=D.texA,Y=D.texB,re=L.current,ce=me==="diff"?We??void 0:void 0;return(me==="diff"&&re?Uc(D.device,re,X,Y,ce):Zr(D.device,X,Y,ce)).then(_e=>{Z||Me(_e)}),()=>{Z=!0}},[V,ne,Rt,me,Pe,We]),c.useEffect(()=>{const D=R.current;if(!V||!D||!D.texA||!D.texB||!Rt){Ae(null);return}let Z=!1;Ae(null);const X=me==="diff"?We??void 0:void 0;return Ic(D.device,D.texA,D.texB,xn,bn,X).then(Y=>{Z||Ae(Y)}).catch(()=>{Z||Ae(null)}),()=>{Z=!0}},[V,ne,Rt,me,pl,xn,bn]),c.useEffect(()=>{if(me!=="diff"){Et.current=null,ot.current=null;return}const D=R.current,Z=L.current;if(!V||!D||!Z)return;let X=!1;return Et.current=null,ot.current=null,ds(Y=>Y+1),ss(D.device,Z).then(Y=>{X||(Et.current=Y,ot.current={w:Z.width,h:Z.height},ds(re=>re+1))}).catch(()=>{}),()=>{X=!0}},[V,me,He,ne,We]);const hs=(D,Z)=>(X,Y,re)=>{const ce=Z.current;if(ce){const{data:pt,width:bs,height:xl,channels:vs}=ce;if(X<0||Y<0||X>=bs||Y>=xl)return null;const wn=(Y*bs+X)*vs,yn=ce.precision==="f16-bits"?ir=>Qt(pt[ir]??0):ir=>pt[ir]??0,bl=vs===1?[yn(wn)]:[yn(wn),yn(wn+1),yn(wn+2)];return gt(bl,"unit",re)}const be=D.current;if(!be||X<0||Y<0||X>=be.width||Y>=be.height)return null;const _e=(Y*be.width+X)*4,pe=be.data[_e],Oe=be.data[_e+1],Ye=be.data[_e+2];return gt(pe===Oe&&Oe===Ye?[pe]:[pe,Oe,Ye],"uint8",re)},vn=c.useMemo(()=>hs(se,Xe),[]),sr=c.useMemo(()=>hs(Ue,qe),[]),ar=c.useMemo(()=>(D,Z,X)=>{var Ye;const Y=Et.current,re=ot.current;if(!Y||!re)return null;const{w:ce,h:be}=re;if(D<0||Z<0||D>=ce||Z>=be)return null;const _e=(Z*ce+D)*4,Oe=(((Ye=lt(He))==null?void 0:Ye.output)??"per-channel")==="scalar"?[Y[_e]??0]:[Y[_e]??0,Y[_e+1]??0,Y[_e+2]??0];return gt(Oe,"unit",X)},[He]);c.useEffect(()=>{const D=P.current;if(D)return D.__cairnCompareProbe={sampleDiff:(Z,X,Y="decimal")=>ar(Z,X,Y),sampleFg:(Z,X,Y="decimal")=>vn(Z,X,Y),sampleRef:(Z,X,Y="decimal")=>sr(Z,X,Y),get diffSamples(){return Et.current},get dims(){return Ie},get primaryDims(){return le},get diffResultDims(){return ot.current},get align(){return d},get fit(){return x},get resolvedKernelId(){return He},get compareMode(){return me},get ssimScalar(){return ie},get ssimText(){return Jo(ie)},get effectiveTonemap(){return ke},get hdrEngaged(){return j}},()=>{D&&delete D.__cairnCompareProbe}},[ar,vn,sr,le,Ie,d,x,He,me,ie,ke,j]);const ml=p==="auto"?void 0:p;if(I)return n!=null||r!=null?f.jsx(sl,{}):me==="diff"?f.jsx(Yn,{toolbar:A,imageUrl:e,baselineUrl:t,diffMode:((xs=lt(He))==null?void 0:xs.kind)==="pointwise"?He:"absolute",interpolation:p,colormap:Fe,showAxes:!1,zoom:M,pan:h,onViewportChange:g,label:E,pixelValueNotation:_}):f.jsx(ol,{imageUrl:e,baselineUrl:t,mode:me,splitPosition:a,blendAlpha:s,onSplitPositionChange:u,zoom:M,pan:h,onViewportChange:g,interpolation:p,label:E,pixelValueNotation:_});const hl=f.jsxs(f.Fragment,{children:[f.jsx("canvas",{ref:k,className:"w-full h-full block",style:{imageRendering:ml},"data-gpu-compare-canvas":!0}),me==="split"&&f.jsx(fs,{splitPosition:a,onChange:u,onReset:()=>u==null?void 0:u(.5)})]}),gs=!!E,gl=gs?"bottom-7":"bottom-1";return f.jsx(cn,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":V},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:A,paneRef:P,wrapperRef:T,zoom:M,pan:h,onViewportChange:g,naturalDims:Ie,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:hl,showAxes:!1,notationSeed:_,onReset:U,extraModified:B,exportCanvasRef:k,requestRender:or,leadingMenus:we,displayAdjust:{exposureEV:Q,offset:he,onExposureChange:J,onOffsetChange:Se},extraSliders:[...j&&me!=="diff"?[{id:"peak",label:"PK",title:"Peak white (×SDR white) — the HDR ceiling P every operator clips at (Linear/sRGB/Gamma hard-clip at P; Reinhard/ACES roll off toward P). P=1 reproduces the SDR rendition exactly; double-click to type a value, including 'inf' for the raw browser-clipped extended look.",min:mr,max:Ct,step:hr,value:ft,onChange:dt,format:D=>Number.isFinite(D)?`${D.toFixed(1)}×`:"∞"}]:[],...me!=="diff"&&Kt(ke)?[{id:"gamma",label:"γ",title:"Display gamma γ for the Gamma transfer — display = clamp(value)^(1/γ), tev-style. Default 2.2 (close to sRGB, not identical). Double-click to type a value.",min:Ht,max:Wt,step:Yt,value:de,onChange:O,format:D=>D.toFixed(1)}]:[]],label:"",showLabelChip:!1,overlay:{render:({notation:D,setOverlayActive:Z})=>me==="split"?f.jsxs(f.Fragment,{children:[Rt&&Ie&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-a)*100}% 0 0)`},children:f.jsx(xt,{imageElRef:k,naturalWidth:Ie.w,naturalHeight:Ie.h,zoom:M,pan:h,sourceWindow:xe,sample:sr,notation:D,version:Tt})}),Rt&&Ie&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${a*100}%)`},children:f.jsx(xt,{imageElRef:k,naturalWidth:Ie.w,naturalHeight:Ie.h,zoom:M,pan:h,sourceWindow:xe,sample:vn,notation:D,version:Tt,onActiveChange:Z})})]}):Ie&&f.jsx(xt,{imageElRef:k,naturalWidth:Ie.w,naturalHeight:Ie.h,zoom:M,pan:h,sourceWindow:xe,sample:me==="diff"?ar:vn,notation:D,version:me==="diff"?dl:Tt,onActiveChange:Z})},extraChips:f.jsxs(f.Fragment,{children:[me==="split"&&f.jsx(us,{}),gs?f.jsx(Vn,{label:E,corner:"bottom-right"}):null,ve&&f.jsxs("span",{className:`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${gl}`,"data-gpu-compare-metrics":!0,children:["MSE ",ve.mse.toExponential(2)," · PSNR ",Number.isFinite(ve.psnr)?ve.psnr.toFixed(1):"∞"," dB · MAE"," ",ve.mae.toExponential(2)," · SSIM ",Jo(ie)]})]})})}const ul="cairn-plot:gpu-image-ready";async function fl(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await Ut(),window.__cairnPlotGpuImagePane=Ji,window.__cairnPlotGpuComparePane=ll,window.__cairnPlotDiffMenuModes=jo(),window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(ul))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e),Ro("no-webgpu")}}}fl()})(__cairnPlotJsxRuntime,__cairnPlotReact);
