var Xa=Object.defineProperty;var Wa=(f,a,tt)=>a in f?Xa(f,a,{enumerable:!0,configurable:!0,writable:!0,value:tt}):f[a]=tt;var ce=(f,a,tt)=>Wa(f,typeof a!="symbol"?a+"":a,tt);(function(f,a){"use strict";const tt=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function Sn(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:tt}),{hdr:!1,format:n}}function fo(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:tt}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:tt}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return Sn(e,t)}}}const po=`
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
`,ho=`
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
`;function $t(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Tn(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function mo(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const go={texture:0,sampler:1,uniform:2};function Xt(e,t){return e*3+go[t]}const xo={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function bo(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),i=r[2]!==void 0,s=r[3].trim();if(i){const l=xo[s];if(l===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${s}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:l})}else s==="sampler"||s==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class Pn{constructor(t,n,r,o){ce(this,"width");ce(this,"height");ce(this,"format");ce(this,"gpuTexture");ce(this,"device");ce(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:$t(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*Tn(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class An{constructor(t){ce(this,"_s");ce(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class vo{constructor(t,n,r,o,i){ce(this,"_p");ce(this,"gpuPipeline");ce(this,"bindings");ce(this,"bindGroupLayout");ce(this,"variants");ce(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=i,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function wo(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class yo{constructor(t){ce(this,"_c");ce(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class Eo{constructor(t,n,r,o,i){ce(this,"width");ce(this,"height");ce(this,"paramsBuffer");ce(this,"bindGroup");ce(this,"buffers");ce(this,"destroyed",!1);this.width=t,this.height=n,this.buffers=r,this.paramsBuffer=o,this.bindGroup=i}destroy(){if(!this.destroyed){for(const t of this.buffers)t.destroy();this.paramsBuffer.destroy(),this.destroyed=!0}}}class _o{constructor(t,n){ce(this,"_b");ce(this,"gpuBindGroup");ce(this,"ownedBuffers");ce(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class Mo{constructor(t,n,r,o){ce(this,"canvas");ce(this,"hdr");ce(this,"format");ce(this,"context");ce(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function wt(e){return"canvas"in e}async function So(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function i(p){return wt(p)?p.getCurrentTextureView():p.gpuTexture.createView()}function s(p){if(wt(p))return{width:p.canvas.width,height:p.canvas.height};const g=p;return{width:g.width,height:g.height}}let l=!1,c=null;function u(){var g,w;if(c!==null)return c;let p=!1;try{if(typeof document<"u"){const M=document.createElement("canvas");M.width=1,M.height=1;const y=M.getContext("webgpu");if(y)try{y.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:GPUTextureUsage.RENDER_ATTACHMENT});const k=(g=y.getConfiguration)==null?void 0:g.call(y);p=((w=k==null?void 0:k.toneMapping)==null?void 0:w.mode)==="extended"}catch{p=!1}finally{try{y.unconfigure()}catch{}}}}catch{p=!1}return c=p,p}const h=256;let b=null,d=null;function v(){if(!b||!d){const p=t.createShaderModule({code:po});d=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const g=t.createPipelineLayout({bindGroupLayouts:[d]});b=t.createComputePipeline({layout:g,compute:{module:p,entryPoint:"cs_main"}})}return{pipeline:b,layout:d}}let E=null,m=null;function _(){if(!E||!m){const p=t.createShaderModule({code:ho});m=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});const g=t.createPipelineLayout({bindGroupLayouts:[m]});E=t.createRenderPipeline({layout:g,vertex:{module:p,entryPoint:"vs_main"},fragment:{module:p,entryPoint:"fs_main",targets:[{format:"rgba16float"}]},primitive:{topology:"triangle-list"}})}return{pipeline:E,layout:m}}return{backend:"webgpu",capabilities:n,probeExtendedToneMapping:u,createTexture(p,g,w){return new Pn(t,p,g,w)},createSampler(p){const g=(p==null?void 0:p.filter)==="linear"?"linear":"nearest",w=t.createSampler({magFilter:g,minFilter:g,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new An(w)},createRenderPipeline(p){const g=t.createShaderModule({code:p.shaderWGSL}),w=bo(p.shaderWGSL),M=$t(p.targetFormat),y=wo(t,w),k=t.createPipelineLayout({bindGroupLayouts:[y]}),S=P=>t.createRenderPipeline({layout:k,vertex:{module:g,entryPoint:"vs_main"},fragment:{module:g,entryPoint:"fs_main",targets:[{format:P}]},primitive:{topology:"triangle-list"}}),T=S(M);return new vo(T,w,y,M,S)},createComputePipeline(p){const g=t.createShaderModule({code:p.shaderWGSL}),w=t.createComputePipeline({layout:"auto",compute:{module:g,entryPoint:"cs_main"}});return new yo(w)},createBindGroup(p,g){const w=p,M=new Map,y=[];for(const[S,T]of w.bindings)if(T.kind==="uniform"){const P=t.createBuffer({size:T.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});y.push(P),M.set(S,{binding:S,resource:{buffer:P}})}else T.kind==="sampler"&&M.set(S,{binding:S,resource:o()});for(const S of g){const T=S.resource;if(T instanceof Pn){const P=Xt(S.binding,"texture");w.bindings.has(P)&&M.set(P,{binding:P,resource:T.gpuTexture.createView()})}else if(T instanceof An){const P=Xt(S.binding,"sampler");w.bindings.has(P)&&M.set(P,{binding:P,resource:T.gpuSampler})}else{const P=Xt(S.binding,"uniform"),D=w.bindings.get(P);if(D&&D.kind==="uniform"){const R=T.uniform,A=t.createBuffer({size:Math.max(D.sizeBytes,R.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(A,0,R.buffer,R.byteOffset,R.byteLength),y.push(A),M.set(P,{binding:P,resource:{buffer:A}})}}}const k=t.createBindGroup({layout:w.bindGroupLayout,entries:Array.from(M.values())});return new _o(k,y)},createSurface(p,g){const w=p.getContext("webgpu");if(!w)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const M=g.hdr&&n.hdr,y=()=>M?fo(w,t):Sn(w,t),k=y();return new Mo(p,w,k,y)},renderFullscreen(p,g,w){const M=g,y=w,k=i(p),{width:S,height:T}=s(p),P=wt(p)?p.format:$t(p.format),D=M.pipelineFor(P),R=t.createCommandEncoder(),A=R.beginRenderPass({colorAttachments:[{view:k,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});A.setPipeline(D),A.setBindGroup(0,y.gpuBindGroup),A.setViewport(0,0,S,T,0,1),A.draw(3),A.end(),t.queue.submit([R.finish()])},createDeepSampleBuffers(p){const{layout:g}=_(),w=P=>{const D=t.createBuffer({size:P.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});return t.queue.writeBuffer(D,0,P.buffer,P.byteOffset,P.byteLength),D},M=w(p.offsets),y=w(p.colors),k=w(p.zs),S=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),T=t.createBindGroup({layout:g,entries:[{binding:0,resource:{buffer:M}},{binding:1,resource:{buffer:y}},{binding:2,resource:{buffer:k}},{binding:3,resource:{buffer:S}}]});return new Eo(p.width,p.height,[M,y,k],S,T)},compositeDeep(p,g,w,M){const y=p,k=g,{pipeline:S}=_();t.queue.writeBuffer(y.paramsBuffer,0,new Float32Array([y.width,y.height,M,w]));const T=t.createCommandEncoder(),P=T.beginRenderPass({colorAttachments:[{view:k.gpuTexture.createView(),loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});P.setPipeline(S),P.setBindGroup(0,y.bindGroup),P.setViewport(0,0,k.width,k.height,0,1),P.draw(3),P.end(),t.queue.submit([T.finish()])},async readback(p){const g=wt(p),{width:w,height:M}=s(p),y=g?p.hdr?"rgba16float":"rgba8unorm":p.format,k=g&&p.format==="bgra8unorm",S=g?p.getCurrentGPUTexture():p.gpuTexture,T=Tn(y),P=w*T,D=256,R=Math.ceil(P/D)*D,A=R*M,V=t.createBuffer({size:A,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),L=t.createCommandEncoder();L.copyTextureToBuffer({texture:S},{buffer:V,bytesPerRow:R,rowsPerImage:M},{width:w,height:M,depthOrArrayLayers:1}),t.queue.submit([L.finish()]),await V.mapAsync(GPUMapMode.READ);const B=new Uint8Array(V.getMappedRange()),F=new Uint8Array(P*M);for(let O=0;O<M;O++){const J=O*R,N=O*P;F.set(B.subarray(J,J+P),N)}if(V.unmap(),V.destroy(),y==="rgba8unorm"){if(k)for(let O=0;O<F.length;O+=4){const J=F[O],N=F[O+2];F[O]=N,F[O+2]=J}return F}if(y==="rgba16float"){const O=new Uint16Array(F.buffer,F.byteOffset,F.byteLength/2),J=new Float32Array(O.length);for(let N=0;N<O.length;N++)J[N]=mo(O[N]);return J}return new Float32Array(F.buffer,F.byteOffset,F.byteLength/4)},async reduceDiffSumSquaredAbs(p,g,w,M){const y=p,k=g,S=Math.max(0,w*M),T=Math.max(1,Math.ceil(S/h)),{pipeline:P,layout:D}=v(),R=T*2*4,A=t.createBuffer({size:R,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),V=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(V,0,new Uint32Array([Math.max(1,w),Math.max(1,M),S,0]));const L=t.createBindGroup({layout:D,entries:[{binding:0,resource:y.gpuTexture.createView()},{binding:1,resource:k.gpuTexture.createView()},{binding:2,resource:{buffer:A}},{binding:3,resource:{buffer:V}}]}),B=t.createBuffer({size:R,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),F=t.createCommandEncoder(),O=F.beginComputePass();O.setPipeline(P),O.setBindGroup(0,L),O.dispatchWorkgroups(T),O.end(),F.copyBufferToBuffer(A,0,B,0,R),t.queue.submit([F.finish()]),await B.mapAsync(GPUMapMode.READ);const N=new Float32Array(B.getMappedRange()).slice();B.unmap(),B.destroy(),A.destroy(),V.destroy();let ue=0,q=0;for(let ee=0;ee<T;ee++)ue+=N[ee*2],q+=N[ee*2+1];return{sumSq:ue,sumAbs:q}},destroy(){l||(t.destroy(),l=!0)},isContextLost(){return!1}}}let Wt=null;async function To(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return So()}function yt(){return Wt||(Wt=To()),Wt}function Po(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function Ao(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),i=Math.floor(o),s=Math.min(i+1,e.length-1),l=o-i,[c,u,h]=Po(e[i],e[s],l);t[n*3]=Math.round(c),t[n*3+1]=Math.round(u),t[n*3+2]=Math.round(h)}return t}const Rn={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},Ro=new Set(["red-green","red-blue"]),Cn=new Map;function Ht(e){let t=Cn.get(e);if(!t){const n=Rn[e]??Rn.viridis;t=Ao(n),Cn.set(e,t)}return t}const Ke=e=>e<0?0:e>1?1:e,Yt=e=>{const t=e<0?0:e;return t/(1+t)},Kt=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return Ke(n/r)},Et=4,Co=1,ko=16,Do=.5,kn={linear:([e,t,n])=>[Ke(e),Ke(t),Ke(n)],srgb:([e,t,n])=>[Ke(e),Ke(t),Ke(n)],reinhard:([e,t,n])=>[Yt(e),Yt(t),Yt(n)],aces:([e,t,n])=>[Kt(e),Kt(t),Kt(n)],extended:([e,t,n])=>[e,t,n]},Dn="srgb",Lo=["linear","srgb","reinhard","aces"],Bo=["extended","extended-reinhard","extended-aces"],Oo=["extended-reinhard","extended-aces"];function Ln(e){return!!e&&Bo.includes(e)}function Io(e){return!!e&&Oo.includes(e)}const Bn={extended:"linear","extended-reinhard":"reinhard","extended-aces":"aces"};function No(e){return e&&kn[e]||kn[Dn]}function qt(e){return e&&Bn[e]?Bn[e]:e&&Lo.includes(e)?e:Dn}function Fo(e,t){return t?Ln(e)?e:"extended":qt(e)}function _t(e,t,n){return e*2**t+n}function Uo(e){const t=Ke(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function Zt(e,t){return typeof t=="number"&&t>0?Ke(Math.pow(Ke(e),1/t)):Uo(e)}function jt(e,t,n="linear",r=0,o=0){const i=Ht(t),s=new ImageData(e.width,e.height),l=e.data,c=s.data,u=r!==0||o!==0;for(let h=0;h<l.length;h+=4){let b=(l[h]+l[h+1]+l[h+2])/3;u&&(b=Math.max(0,Math.min(255,_t(b/255,r,o)*255)));let d;n==="positive"?d=Math.round(128+b/255*127):d=Math.round(b),d=Math.max(0,Math.min(255,d)),c[h]=i[d*3],c[h+1]=i[d*3+1],c[h+2]=i[d*3+2],c[h+3]=l[h+3]}return s}function Go(e,t){return e==="signed"||e==="relative"?"signed":Qt(t)}function Qt(e){return Ro.has(e??"")?"positive":"linear"}function On(e){const t=new Map;return{get(n){return t.get(n)},set(n,r){if(t.size>=e){const o=t.keys().next().value;o!==void 0&&t.delete(o)}t.set(n,r)}}}const In=On(50);function Jt(e){return In.get(e)}function en(e,t){In.set(e,t)}const Nn=On(100);function zo(e){return Nn.get(e)}function Vo(e,t){Nn.set(e,t)}function $o(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),i=new ImageData(r,o);for(let s=0;s<o;s++)for(let l=0;l<r;l++){const c=(s*e.width+l)*4,u=(s*t.width+l)*4,h=(s*r+l)*4;for(let b=0;b<3;b++){const d=e.data[c+b],v=t.data[u+b],E=d-v,m=Math.abs(E),_=Math.max(d,1);let x;switch(n){case"signed":x=(E+255)/2;break;case"absolute":x=m;break;case"squared":x=E*E/255;break;case"relative_signed":x=(E/_+1)*127.5;break;case"relative_absolute":x=m/_*255;break;case"relative_squared":x=E*E/(_*_)*255;break}i.data[h+b]=Math.min(255,Math.max(0,Math.round(x)))}i.data[h+3]=255}return i}async function it(e){const t=zo(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const i=o.getContext("2d");if(!i){n(null);return}i.drawImage(r,0,0);const s=i.getImageData(0,0,o.width,o.height);Vo(e,s),n(s)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const Xo={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},Wo={linear:0,signed:1,positive:2},Ho=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,Yo=`#version 300 es
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
}`;let at=null,Q=null,Ne=null,Mt=null;function Ko(){if(Q)return Q;try{if(typeof OffscreenCanvas<"u"?at=new OffscreenCanvas(1,1):at=document.createElement("canvas"),Q=at.getContext("webgl2",{preserveDrawingBuffer:!0}),!Q)return console.warn("[cairn] WebGL 2 not available"),null;const e=Q.createShader(Q.VERTEX_SHADER);if(Q.shaderSource(e,Ho),Q.compileShader(e),!Q.getShaderParameter(e,Q.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",Q.getShaderInfoLog(e)),null;const t=Q.createShader(Q.FRAGMENT_SHADER);if(Q.shaderSource(t,Yo),Q.compileShader(t),!Q.getShaderParameter(t,Q.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",Q.getShaderInfoLog(t)),null;if(Ne=Q.createProgram(),Q.attachShader(Ne,e),Q.attachShader(Ne,t),Q.linkProgram(Ne),!Q.getProgramParameter(Ne,Q.LINK_STATUS))return console.error("[cairn] WebGL program link:",Q.getProgramInfoLog(Ne)),null;Mt=Q.createVertexArray(),Q.bindVertexArray(Mt);const n=Q.createBuffer();Q.bindBuffer(Q.ARRAY_BUFFER,n),Q.bufferData(Q.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),Q.STATIC_DRAW);const r=Q.getAttribLocation(Ne,"a_pos");return Q.enableVertexAttribArray(r),Q.vertexAttribPointer(r,2,Q.FLOAT,!1,0,0),Q.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),Q}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function Fn(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function qo(e,t,n){const r=new Uint8Array(1024);for(let i=0;i<256;i++)r[i*4]=t[i*3],r[i*4+1]=t[i*3+1],r[i*4+2]=t[i*3+2],r[i*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function Zo(e,t,n,r){const o=Ko();if(!o||!Ne||!Mt||!at)return null;const i=Math.min(e.width,t.width),s=Math.min(e.height,t.height);at.width=i,at.height=s,o.viewport(0,0,i,s);const l=Fn(o,e,0),c=Fn(o,t,1);let u=null;n.colormap?u=qo(o,n.colormap,2):(u=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,u),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(Ne),o.uniform1i(o.getUniformLocation(Ne,"u_baseline"),0),o.uniform1i(o.getUniformLocation(Ne,"u_other"),1),o.uniform1i(o.getUniformLocation(Ne,"u_lut"),2),o.uniform1i(o.getUniformLocation(Ne,"u_diff_mode"),Xo[n.diffMode]),o.uniform1i(o.getUniformLocation(Ne,"u_cmap_mode"),Wo[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(Ne,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(Mt),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=i,r.height=s;const h=r.getContext("2d");return h&&(h.save(),h.scale(1,-1),h.drawImage(at,0,0,i,s,0,-s,i,s),h.restore()),o.deleteTexture(l),o.deleteTexture(c),o.deleteTexture(u),{width:i,height:s}}const jo="cairn:render-mode";function Qo(){try{const e=localStorage.getItem(jo);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const St=15360;function Tt(e){const t=e&32768?-1:1,n=e>>10&31,r=e&1023;return n===0?r===0?t*0:t*r*2**-24:n===31?r===0?t*(1/0):NaN:t*2**(n-15)*(1+r/1024)}const Un=globalThis.Float16Array;function Gn(e,t=e.length){if(Un){const r=new Un(e.buffer,e.byteOffset,t);return Float32Array.from(r)}const n=new Float32Array(t);for(let r=0;r<t;r++)n[r]=Tt(e[r]);return n}const qe=new Uint32Array(512),Ze=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(qe[e]=0,qe[e|256]=32768,Ze[e]=24,Ze[e|256]=24):t<-14?(qe[e]=1024>>-t-14,qe[e|256]=1024>>-t-14|32768,Ze[e]=-t-1,Ze[e|256]=-t-1):t<=15?(qe[e]=t+15<<10,qe[e|256]=t+15<<10|32768,Ze[e]=13,Ze[e|256]=13):t<128?(qe[e]=31744,qe[e|256]=64512,Ze[e]=24,Ze[e|256]=24):(qe[e]=31744,qe[e|256]=64512,Ze[e]=13,Ze[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var bt=Uint8Array,zn=Uint16Array,Jo=Int32Array,es=new bt([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),ts=new bt([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),Vn=function(e,t){for(var n=new zn(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new Jo(n[30]),r=1;r<30;++r)for(var i=n[r];i<n[r+1];++i)o[i]=i-n[r]<<5|r;return{b:n,r:o}},$n=Vn(es,2),ns=$n.b,rs=$n.r;ns[28]=258,rs[258]=28,Vn(ts,0);for(var os=new zn(32768),ye=0;ye<32768;++ye){var nt=(ye&43690)>>1|(ye&21845)<<1;nt=(nt&52428)>>2|(nt&13107)<<2,nt=(nt&61680)>>4|(nt&3855)<<4,os[ye]=((nt&65280)>>8|(nt&255)<<8)>>1}for(var Pt=new bt(288),ye=0;ye<144;++ye)Pt[ye]=8;for(var ye=144;ye<256;++ye)Pt[ye]=9;for(var ye=256;ye<280;++ye)Pt[ye]=7;for(var ye=280;ye<288;++ye)Pt[ye]=8;for(var ss=new bt(32),ye=0;ye<32;++ye)ss[ye]=5;var is=new bt(0),as=typeof TextDecoder<"u"&&new TextDecoder,cs=0;try{as.decode(is,{stream:!0}),cs=1}catch{}const Xn=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function tn(e){const t=Xn.length;return Xn[(e%t+t)%t]}function ls(e){const n=a.useRef(null),[r,o]=a.useState({w:0,h:0}),i=a.useRef(null),s=a.useRef(null),l=a.useRef(null),c=a.useCallback((u,h)=>{o(b=>b.w===u&&b.h===h?b:{w:u,h})},[]);return a.useLayoutEffect(()=>{const u=n.current;if(!u||u===l.current)return;const h=u.getBoundingClientRect();(h.width>0||h.height>0)&&(l.current=u,c(h.width,h.height))}),a.useEffect(()=>{var b;const u=n.current;if(u===s.current||((b=i.current)==null||b.disconnect(),i.current=null,s.current=u,!u))return;const h=new ResizeObserver(d=>{for(const v of d)c(v.contentRect.width,v.contentRect.height)});i.current=h,h.observe(u)}),a.useEffect(()=>()=>{var u;return(u=i.current)==null?void 0:u.disconnect()},[]),{ref:n,size:r}}function us(){const[e,t]=a.useState(!1);return a.useEffect(()=>{const n=i=>{(i.key==="Alt"||i.key==="Control"||i.key==="Meta")&&t(!0)},r=i=>{(i.key==="Alt"||i.key==="Control"||i.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const fs=.001;function ds(e,t=fs){return Math.exp(-e*t)}function Wn(e,t){return Math.hypot(e.x-t.x,e.y-t.y)}function Hn(e,t){return{x:(e.x+t.x)/2,y:(e.y+t.y)/2}}function ps(e,t,n,r,o,i,s){const l=t>0&&r>0?r/t:1,c=Math.max(i,Math.min(s,e.zoom*l)),u=(n.x-e.pan.x)/e.zoom,h=(n.y-e.pan.y)/e.zoom;return{zoom:c,pan:{x:o.x-u*c,y:o.y-h*c}}}const hs=.25,nn=64;function rn(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return nn;const o=Math.min(n/e,r/t);return o<=0?nn:Math.max(Math.max(n,r)/o,8)}function Yn(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:i=hs,maxZoom:s=nn,naturalWidth:l,naturalHeight:c}=e,u=us(),h=a.useRef(u);h.current=u;const b=a.useRef({zoom:n,pan:r});b.current={zoom:n,pan:r};const d=a.useRef(o);d.current=o,a.useEffect(()=>{const S=t.current;if(!S||!o)return;const T=P=>{var N;if(!P.ctrlKey&&!h.current)return;P.preventDefault(),P.stopPropagation();const D=ds(P.deltaY),R=b.current,A=S.getBoundingClientRect(),V=l&&c?rn(l,c,A.width,A.height):s,L=Math.max(i,Math.min(V,R.zoom*D));if(R.zoom===L)return;const B=P.clientX-A.left,F=P.clientY-A.top,O=B-(B-R.pan.x)/R.zoom*L,J=F-(F-R.pan.y)/R.zoom*L;(N=d.current)==null||N.call(d,{zoom:L,pan:{x:O,y:J}})};return S.addEventListener("wheel",T,{passive:!1}),()=>S.removeEventListener("wheel",T)},[t,!!o,i,s,l,c]);const v=a.useRef(new Map),E=a.useRef(null),m=a.useRef(null),_=a.useCallback((S,T,P)=>{const D=S.getBoundingClientRect();return{x:T-D.left,y:P-D.top}},[]),x=a.useCallback(S=>{if(!l||!c)return s;const T=S.getBoundingClientRect();return rn(l,c,T.width,T.height)},[l,c,s]),p=a.useCallback((S,T)=>{const P=v.current,D=P.get(S),R=P.get(T);!D||!R||(E.current=null,m.current={idA:S,idB:T,startDist:Wn(D,R),startMid:Hn(D,R),startZoom:b.current.zoom,startPan:{...b.current.pan}})},[]),g=a.useCallback(S=>{const T=v.current.get(S);T&&(E.current={pointerId:S,startX:T.x,startY:T.y,panX:b.current.pan.x,panY:b.current.pan.y})},[]),w=a.useCallback(S=>{if(!d.current)return;const T=S.pointerType==="touch";if(!T&&!h.current)return;const P=S.currentTarget;if(P.setPointerCapture(S.pointerId),v.current.set(S.pointerId,_(P,S.clientX,S.clientY)),T&&v.current.size>=2){const D=[...v.current.keys()];p(D[D.length-2],D[D.length-1]);return}g(S.pointerId)},[_,p,g]),M=a.useCallback(S=>{var A,V;const T=S.currentTarget,P=v.current.get(S.pointerId);if(P){const L=_(T,S.clientX,S.clientY);P.x=L.x,P.y=L.y}const D=m.current;if(D){const L=v.current.get(D.idA),B=v.current.get(D.idB);if(!L||!B)return;const F=ps({zoom:D.startZoom,pan:D.startPan},D.startDist,D.startMid,Wn(L,B),Hn(L,B),i,x(T));(A=d.current)==null||A.call(d,F);return}const R=E.current;!R||R.pointerId!==S.pointerId||!P||(V=d.current)==null||V.call(d,{zoom:b.current.zoom,pan:{x:R.panX+(P.x-R.startX),y:R.panY+(P.y-R.startY)}})},[_,i,x]),y=a.useCallback(S=>{var P;try{S.currentTarget.releasePointerCapture(S.pointerId)}catch{}v.current.delete(S.pointerId);const T=m.current;if(T&&(S.pointerId===T.idA||S.pointerId===T.idB)){m.current=null;const D=[...v.current.keys()];D.length===1&&g(D[0]);return}((P=E.current)==null?void 0:P.pointerId)===S.pointerId&&(E.current=null)},[g]);return{containerProps:{onPointerDown:w,onPointerMove:M,onPointerUp:y,onPointerCancel:y,style:{cursor:u&&!!o?"move":void 0,touchAction:o?"none":void 0}},modifierActive:u}}function on(){const[e,t]=a.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return a.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),i())};function i(){if(n)return;const s=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${s}dppx)`),r.addEventListener("change",o,{once:!0})}return i(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function ct(e){const t=a.useRef(e),[n,r]=a.useState(e),o=a.useCallback(()=>r(t.current),[]);return[n,r,{reset:o,isModified:!Object.is(n,t.current),default:t.current}]}function ms(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function Kn(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function sn({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:i}=ls(),s=a.useRef(null),l=a.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),c=a.useMemo(()=>{const m=i.w,_=i.h;if(m<=0||_<=0||n<=0||r<=0)return null;const x=Math.min(m/n,_/r),p=n*x,g=r*x;return{left:(m-p)/2,top:(_-g)/2,width:p,height:g}},[i.w,i.h,n,r]),u=e.masks,h=t.showMasks&&!!u&&u.length>0,b=a.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(a.useEffect(()=>{if(!h||!u)return;const m=s.current;if(!m)return;(m.width!==n||m.height!==r)&&(m.width=n,m.height=r);const _=m.getContext("2d");if(!_)return;_.clearRect(0,0,m.width,m.height);let x=!1;const p=_.createImageData(n,r),g=p.data;let w=u.length,M=!1;const y=()=>{x||M&&_.putImageData(p,0,0)},k=document.createElement("canvas");k.width=n,k.height=r;const S=k.getContext("2d",{willReadFrequently:!0});for(const T of u){const P=new Image;P.onload=()=>{if(!x){if(S){S.clearRect(0,0,n,r),S.drawImage(P,0,0,n,r);const D=S.getImageData(0,0,n,r).data;for(let R=0;R<n*r;R++){const A=D[R*4];if(A===0||l.has(A))continue;const[V,L,B]=ms(tn(A));g[R*4]=V,g[R*4+1]=L,g[R*4+2]=B,g[R*4+3]=255,M=!0}}w-=1,w===0&&y()}},P.onerror=()=>{w-=1,w===0&&y()},P.src=`data:image/png;base64,${T.png_b64}`}return()=>{x=!0}},[h,u,n,r,b]),!c)return f.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const d=e.boxes??[],v=t.showBoxes&&d.length>0,E=e.class_labels??{};return f.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[h&&f.jsx("canvas",{ref:s,className:"absolute",style:{left:c.left,top:c.top,width:c.width,height:c.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),v&&f.jsx("svg",{className:"absolute",style:{left:c.left,top:c.top,width:c.width,height:c.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:d.map((m,_)=>{if(!Kn(m,t,l))return null;const x=m.domain==="pixel"?1:n,p=m.domain==="pixel"?1:r,g=m.position.minX*x,w=m.position.minY*p,M=(m.position.maxX-m.position.minX)*x,y=(m.position.maxY-m.position.minY)*p;return f.jsx("rect",{x:g,y:w,width:M,height:y,fill:"none",stroke:tn(m.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},_)})}),v&&f.jsx("div",{className:"absolute",style:{left:c.left,top:c.top,width:c.width,height:c.height},children:d.map((m,_)=>{if(!Kn(m,t,l))return null;const x=m.domain==="pixel"?1/n:1,p=m.domain==="pixel"?1/r:1,g=m.position.minX*x*100,w=m.position.minY*p*100,M=m.label??E[String(m.class_id)]??`#${m.class_id}`,y=m.score!=null?` ${(m.score*100).toFixed(0)}%`:"";return!M&&!y?null:f.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${g}%`,top:`${w}%`,transform:"translateY(-100%)",backgroundColor:tn(m.class_id)},children:f.jsxs("span",{className:"mono",children:[M,y]})},_)})})]})}const an=30,At=["#ff5a5a","#39d353","#5b9bff"];function cn(e){if(!Number.isFinite(e))return"0";const t=Math.abs(e);return t!==0&&(t<.001||t>=1e4)?e.toExponential(1):String(Number(e.toPrecision(3)))}function ft(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):cn(e/255):cn(n==="int"?e*255:e)}function lt(e,t,n,r){return e.length===1?{lines:[ft(e[0],t,n)],luminance:r}:{lines:e.map(o=>ft(o,t,n)),luminance:r,colors:e.map((o,i)=>At[i]??null)}}const gs={x:0,y:0,w:1,h:1};function ut({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:i,notation:s="decimal",version:l=0,onActiveChange:c,sourceWindow:u=gs}){const h=a.useRef(null),b=a.useRef(!1),d=on(),v=a.useRef(c);v.current=c;const E=a.useCallback(_=>{var x;_!==b.current&&(b.current=_,(x=v.current)==null||x.call(v,_))},[]),m=a.useCallback(()=>{var Ce;const _=h.current,x=e.current;if(!_)return;const p=window.devicePixelRatio||1,g=_.clientWidth,w=_.clientHeight;if(g===0||w===0)return;_.width!==Math.round(g*p)&&(_.width=Math.round(g*p)),_.height!==Math.round(w*p)&&(_.height=Math.round(w*p));const M=_.getContext("2d");if(!M)return;if(M.setTransform(p,0,0,p,0,0),M.clearRect(0,0,g,w),!x||t<=0||n<=0){E(!1);return}const y=x.getBoundingClientRect(),k=_.getBoundingClientRect();if(y.width===0||y.height===0){E(!1);return}const S=u.x*t,T=u.y*n,P=u.w*t,D=u.h*n;if(P<=0||D<=0){E(!1);return}const R=Math.min(y.width/P,y.height/D);if(R<an){E(!1);return}const A=P*R,V=D*R,L=y.left+(y.width-A)/2-k.left,B=y.top+(y.height-V)/2-k.top,F=Math.max(Math.floor(S),Math.floor(S+(0-L)/R)),O=Math.min(Math.ceil(S+P),Math.ceil(S+(g-L)/R)),J=Math.max(Math.floor(T),Math.floor(T+(0-B)/R)),N=Math.min(Math.ceil(T+D),Math.ceil(T+(w-B)/R));if(O<=F||N<=J){E(!1);return}E(!0);const ue=L+(0-S)*R,q=B+(0-T)*R,ee=L+(t-S)*R,fe=B+(n-T)*R;M.save(),M.beginPath(),M.rect(ue,q,ee-ue,fe-q),M.clip(),M.textAlign="center",M.textBaseline="middle",M.lineJoin="round";const Z=R*.14,te=R-Z*2;for(let de=J;de<N;de++)for(let pe=F;pe<O;pe++){if(pe<0||de<0||pe>=t||de>=n)continue;const re=i(pe,de,s);if(!re||re.lines.length===0)continue;const oe=re.lines.length;let $=1;for(const ke of re.lines)ke.length>$&&($=ke.length);const he=te/(oe*1.15),Se=te/($*.62)||he,le=Math.min(he,Se,24);if(le<6)continue;const Ee=L+(pe-S+.5)*R,Pe=B+(de-T+.5)*R,De=le*1.15,be=re.luminance<=.55,Be=be?"#ffffff":"#000000";M.font=`${le}px ui-monospace, SFMono-Regular, Menlo, monospace`,M.lineWidth=Math.max(1.4,le*.16),M.strokeStyle=be?"rgba(0,0,0,0.85)":"rgba(255,255,255,0.9)";let Te=Pe-oe*De/2+De/2;for(let ke=0;ke<re.lines.length;ke++){const U=re.lines[ke];M.strokeText(U,Ee,Te),M.fillStyle=((Ce=re.colors)==null?void 0:Ce[ke])??Be,M.fillText(U,Ee,Te),Te+=De}}M.restore()},[e,t,n,i,s,E,u]);return a.useEffect(()=>{m()},[m,r,o.x,o.y,l,s,u,d]),a.useEffect(()=>{const _=h.current;if(!_)return;const x=new ResizeObserver(()=>m());return x.observe(_),()=>x.disconnect()},[m]),f.jsx("canvas",{ref:h,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function qn({notation:e,onChange:t,className:n=""}){return f.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const xs=`
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
`,dt=`
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
`,bs=`
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
`,Ct=`
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
`;function Zn(e){return`
${$e}
${dt}
${bs}

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
`}const vs=Zn("select(colorB, colorA, uv.x < split)"),ws=Zn("mix(colorA, colorB, alpha)");function ys(e){switch(e){case"center":return{v:"center",h:"center"};case"top-right":return{v:"top",h:"right"};case"bottom-left":return{v:"bottom",h:"left"};case"bottom-right":return{v:"bottom",h:"right"};case"top-left":default:return{v:"top",h:"left"}}}function jn(e,t,n){const{v:r,h:o}=ys(n),i=e.w-t.w,s=e.h-t.h,l=o==="left"?0:o==="right"?i:Math.floor(i/2),c=r==="top"?0:r==="bottom"?s:Math.floor(s/2);return{x:l,y:c}}function kt(e,t,n,r,o="b"){if(r==="fill"){const s=o==="a"?{w:e.w,h:e.h}:{w:t.w,h:t.h};return{fit:r,result:s,offsetA:{x:0,y:0},offsetB:{x:0,y:0}}}const i={w:Math.min(e.w,t.w),h:Math.min(e.h,t.h)};return{fit:r,result:i,offsetA:jn(e,i,n),offsetB:jn(t,i,n)}}function Es(e){return`${e.fit}:${e.result.w}x${e.result.h}:${e.offsetA.x},${e.offsetA.y}:${e.offsetB.x},${e.offsetB.y}`}const ln={linear:0,srgb:1,reinhard:2,aces:3,extended:4,"extended-reinhard":5,"extended-aces":6},Qn=new WeakMap;function _s(e,t){let n=Qn.get(e);n||(n=new Map,Qn.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:xs,targetFormat:t}),n.set(t,r)),r}function Jn(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function er(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function Ms(e,t,n,r){var _;const o=Jn(t),i=_s(e,o),s=er(e,r.isScalar?r.colormap:void 0),l=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,c=ln[r.operator]??ln.srgb,u=new Float32Array([r.exposureEV,c,l,r.isScalar?1:0]),h=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),b=new Float32Array([r.hdrOut?1:0]),d=new Float32Array([r.filter==="nearest"?0:1]),v=new Float32Array([r.offset??0]),E=new Float32Array([r.peak??Et]);let m;try{m=e.createBindGroup(i,[{binding:0,resource:n},{binding:1,resource:s},{binding:2,resource:{uniform:u}},{binding:3,resource:{uniform:h}},{binding:4,resource:{uniform:b}},{binding:5,resource:{uniform:d}},{binding:6,resource:{uniform:v}},{binding:7,resource:{uniform:E}}]),e.renderFullscreen(t,i,m)}finally{(_=m==null?void 0:m.destroy)==null||_.call(m),s.destroy()}}const tr=new WeakMap;function Ss(e,t,n){let r=tr.get(e);r||(r=new Map,tr.set(e,r));const o=`${t}:${n}`;let i=r.get(o);return i||(i=e.createRenderPipeline({shaderWGSL:t==="split"?vs:ws,targetFormat:n}),r.set(o,i)),i}function Ts(e,t,n,r,o){var m;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const i=Jn(t),s=Ss(e,o.mode,i),l=er(e,void 0),c=o.gamma,u=ln[o.operator],h=new Float32Array([o.exposureEV,u,c,0]),b=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),d=new Float32Array([o.split,o.alpha,0,o.filter==="nearest"?0:1]),v=new Float32Array([o.offset??0,0,0,0]);let E;try{E=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:l},{binding:3,resource:{uniform:h}},{binding:4,resource:{uniform:b}},{binding:5,resource:{uniform:d}},{binding:6,resource:{uniform:v}}]),e.renderFullscreen(t,s,E)}finally{(m=E==null?void 0:E.destroy)==null||m.call(E),l.destroy()}}function nr(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,i=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:i,mae:o}}async function rr(e,t,n,r){const o=r??kt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),i=o.result.w,s=o.result.h,l=i*s*3;if(l<=0)return{mse:0,psnr:1/0,mae:0};if(o.fit==="crop"&&o.offsetA.x===0&&o.offsetA.y===0&&o.offsetB.x===0&&o.offsetB.y===0&&e.reduceDiffSumSquaredAbs){const{sumSq:g,sumAbs:w}=await e.reduceDiffSumSquaredAbs(t,n,i,s);return nr(g,w,l)}const u=await e.readback(t),h=await e.readback(n),b=u instanceof Uint8Array?255:1,d=h instanceof Uint8Array?255:1,v=or(u,t.width,t.height,b,o.offsetA,o.fit==="fill",i,s),E=or(h,n.width,n.height,d,o.offsetB,o.fit==="fill",i,s);let m=0,_=0;const x=[0,0,0],p=[0,0,0];for(let g=0;g<s;g++)for(let w=0;w<i;w++){v(w,g,x),E(w,g,p);for(let M=0;M<3;M++){const y=x[M]-p[M];m+=y*y,_+=Math.abs(y)}}return nr(m,_,l)}function or(e,t,n,r,o,i,s,l){const c=(b,d,v)=>e[(d*t+b)*4+v]??0;if(!i)return(b,d,v)=>{const E=Math.min(Math.max(b+o.x,0),t-1),m=Math.min(Math.max(d+o.y,0),n-1);v[0]=c(E,m,0)/r,v[1]=c(E,m,1)/r,v[2]=c(E,m,2)/r};const u=t-1,h=n-1;return(b,d,v)=>{const E=(b+.5)/s,m=(d+.5)/l,_=E*t-.5,x=m*n-.5,p=Math.floor(_),g=Math.floor(x),w=_-p,M=x-g,y=Math.min(Math.max(p,0),u),k=Math.min(Math.max(p+1,0),u),S=Math.min(Math.max(g,0),h),T=Math.min(Math.max(g+1,0),h);for(let P=0;P<3;P++){const D=c(y,S,P),R=c(k,S,P),A=c(y,T,P),V=c(k,T,P),L=D+(R-D)*w,B=A+(V-A)*w;v[P]=(L+(B-L)*M)/r}}}function sr(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const Ps=12,rt=[];function ir(e){const t=rt.indexOf(e);t!==-1&&rt.splice(t,1),rt.push(e)}function As(e){const t=rt.indexOf(e);t!==-1&&rt.splice(t,1)}function Dt(e){e.parked||(As(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),e.surface=null,e.parked=!0)}function ar(e){for(;rt.length>Ps;){const t=rt.find(n=>n!==e&&!n.visible)??rt.find(n=>n!==e);if(!t)break;Dt(t)}}function cr(e){var o,i,s,l;if(e.disposed)return;if(sr())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){ir(e),ar(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||((i=e.deep)==null?void 0:i.width)||1,r=e.backingHeight||((s=e.source)==null?void 0:s.height)||((l=e.deep)==null?void 0:l.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.deep){const c=t.createTexture(e.deep.width,e.deep.height,"rgba16float");e.srcTexture=c,e.deepBuffers=t.createDeepSampleBuffers(e.deep),t.compositeDeep(e.deepBuffers,c,e.deepZNear,e.deepZFar)}else if(e.source){const c=t.createTexture(e.source.width,e.source.height,e.source.format);c.write(e.source.data),e.srcTexture=c}e.parked=!1,ir(e),ar(e)}function Rs(e,t){if(e.disposed||!e.source&&!e.deep)return!0;try{return cr(e),!e.surface||!e.srcTexture?!1:(Ms(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,Dt(e),!1}}function Cs(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,e.deep=null,e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},setDeepSource(t,n,r){if(!e.disposed&&(e.deep=t,e.deepZNear=n,e.deepZFar=r,e.source=null,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy(),e.deepBuffers&&e.deepBuffers.destroy();const o=e.device.createTexture(t.width,t.height,"rgba16float");e.srcTexture=o,e.deepBuffers=e.device.createDeepSampleBuffers(t),e.device.compositeDeep(e.deepBuffers,o,n,r)}},setDeepWindow(t,n){e.disposed||(e.deepZNear=t,e.deepZFar=n,!e.parked&&e.deepBuffers&&e.srcTexture&&e.device.compositeDeep(e.deepBuffers,e.srcTexture,t,n))},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return Rs(e,t)},park(){e.disposed||Dt(e)},restore(){e.disposed||!e.source&&!e.deep||cr(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(Dt(e),e.source=null,e.deep=null,e.disposed=!0)}}}async function ks(e,t){const n=await yt(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,deep:null,deepZNear:-1/0,deepZFar:1/0,deepBuffers:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return Cs(r)}function lr(e){e.dispose()}function Ds(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:i}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...i?["invert(1)"]:[]].join(" ")}function ur(e){const n=`cairn-gamma-${a.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:i,exposure:s,offset:l,flipSign:c}=e,u=a.useMemo(()=>Ds(e,n),[n,r,o,s,c]);return{gammaFilterId:n,filterStr:u,gamma:i,offset:l}}function fr({id:e,gamma:t,offset:n}){return f.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:f.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:f.jsxs("feComponentTransfer",{children:[f.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),f.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),f.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}const Ls={x:0,y:0,w:1,h:1};function un(e){const t=e.sourceWindow??Ls,n=t.x*e.naturalWidth,r=t.y*e.naturalHeight,o=t.w*e.naturalWidth,i=t.h*e.naturalHeight,s=Math.min(e.box.width/o,e.box.height/i),l=o*s,c=i*s;return{scale:s,imgLeft:e.box.left+(e.box.width-l)/2,imgTop:e.box.top+(e.box.height-c)/2,srcOriginX:n,srcOriginY:r}}function Bs(e){return un(e).scale}function dr(e,t,n){const r=un(n);return{x:r.srcOriginX+(e-r.imgLeft)/r.scale,y:r.srcOriginY+(t-r.imgTop)/r.scale}}function pr(e,t,n){const r=un(n);return{x:r.imgLeft+(e-r.srcOriginX)*r.scale,y:r.imgTop+(t-r.srcOriginY)*r.scale}}function Os(e,t){const n=pr(e.x0,e.y0,t),r=pr(e.x1+1,e.y1+1,t);return{left:n.x,top:n.y,width:r.x-n.x,height:r.y-n.y}}const Lt=(e,t,n)=>Math.max(t,Math.min(n,Math.floor(e)));function Is(e,t,n,r,o){const i=dr(e,t,o),s=dr(n,r,o),l=o.naturalWidth-1,c=o.naturalHeight-1,u=Math.min(i.x,s.x),h=Math.max(i.x,s.x),b=Math.min(i.y,s.y),d=Math.max(i.y,s.y);return h<0||u>l||d<0||b>c?null:{x0:Lt(u,0,l),y0:Lt(b,0,c),x1:Lt(h,0,l),y1:Lt(d,0,c)}}const Ns=["nw","n","ne","e","se","s","sw","w"],pt=(e,t,n)=>e<t?t:e>n?n:e;function Fs(e,t,n,r,o,i=1){const s=o.w-1,l=o.h-1,c=Math.round(n),u=Math.round(r);if(t==="move"){const p=e.x1-e.x0,g=e.y1-e.y0,w=pt(e.x0+c,0,s-p),M=pt(e.y0+u,0,l-g);return{x0:w,y0:M,x1:w+p,y1:M+g}}let{x0:h,y0:b,x1:d,y1:v}=e;const E=t==="nw"||t==="w"||t==="sw",m=t==="ne"||t==="e"||t==="se",_=t==="nw"||t==="n"||t==="ne",x=t==="sw"||t==="s"||t==="se";return E&&(h=pt(h+c,0,d-(i-1))),m&&(d=pt(d+c,h+(i-1),s)),_&&(b=pt(b+u,0,v-(i-1))),x&&(v=pt(v+u,b+(i-1),l)),{x0:h,y0:b,x1:d,y1:v}}function hr(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function Us({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=hr(e),i=hr(t),s=[];for(let p=0;p<=e;p+=o)s.push(p);const l=[];for(let p=0;p<=t;p+=i)l.push(p);const c=1/n,u=8*c,h=-12*c,b=-2*c,d=r==null?void 0:r.current;let v=0,E=0,m=0,_=0;if(d){const p=d.clientWidth,g=d.clientHeight,w=p/e,M=g/t,y=Math.min(w,M);m=e*y,_=t*y,v=(p-m)/2,E=(g-_)/2}const x=d&&m>0;return f.jsxs(f.Fragment,{children:[f.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:x?E:0,transform:`translateY(${h}px)`,fontSize:u},children:s.map(p=>f.jsx("span",{className:"mono",style:{position:"absolute",left:x?v+p/e*m:`${p/e*100}%`,transform:"translateX(-50%)"},children:p},p))}),f.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:x?v:0,transform:`translateX(${b}px)`,fontSize:u},children:l.map(p=>f.jsx("span",{className:"mono",style:{position:"absolute",top:x?E+p/t*_:`${p/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*c}px`},children:p},p))})]})}function Gs({label:e,isDraggable:t,onDragStart:n}){return f.jsxs("span",{className:`absolute bottom-1 left-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${t?" cairn-drag-grip":""}`,draggable:t,onDragStart:n,style:{cursor:t?"grab":void 0},children:[t&&f.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const zs=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function mr(e,t){const n=getComputedStyle(e),r=zs.map(c=>`${c}:${n.getPropertyValue(c)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const i=e.children,s=t.children,l=Math.min(i.length,s.length);for(let c=0;c<l;c++)mr(i[c],s[c])}function fn(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function dn(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function pn(e,t,n,r,o){const i=document.createElement("canvas");i.width=Math.max(1,Math.round(e*n)),i.height=Math.max(1,Math.round(t*n));const s=i.getContext("2d");if(!s)throw new Error("plot-to-png: 2D canvas context unavailable");return s.scale(n,n),r&&(s.fillStyle=r,s.fillRect(0,0,e,t)),o(s),await new Promise((l,c)=>i.toBlob(u=>u?l(u):c(new Error("plot-to-png: toBlob returned null")),"image/png"))}function Vs(e,t,n){const r=e.cloneNode(!0);mr(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),i="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((s,l)=>{const c=new Image;c.onload=()=>s(c),c.onerror=()=>l(new Error("plot-to-png: SVG rasterization failed")),c.src=i})}async function gr(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,i=(t==null?void 0:t.background)??fn(e);return pn(r,o,dn(t),i,s=>s.drawImage(e,0,0,r,o))}async function $s(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,i=(t==null?void 0:t.background)??fn(e);try{return await pn(r,o,dn(t),i,s=>s.drawImage(e,0,0,r,o))}catch(s){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${s instanceof Error?s.message:String(s)})`)}}function Xs(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const i=o.getBoundingClientRect(),s=i.width*i.height;s>r&&(r=s,n=o)}return n}async function Ws(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),i=o.width||300,s=o.height||150,l=(t==null?void 0:t.background)??fn(e);if(n){const u=n.getBoundingClientRect(),h=await Vs(n,u.width||i,u.height||s);return pn(i,s,dn(t),l,b=>{for(const d of r){const v=d.getBoundingClientRect();b.drawImage(d,v.left-o.left,v.top-o.top,v.width,v.height)}b.drawImage(h,u.left-o.left,u.top-o.top,u.width,u.height)})}if(r.length)return gr(r[0],t);const c=Xs(e);if(c)return $s(c,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function Hs(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const Ys=8;function Ks(e,t,n,r=Ys){return!(t>0)||!(e>0)?n:e<t+r}function xr(e,t){return Math.max(0,e.findIndex(n=>n.id===t))}function qs(e){const t=e.trim();if(t==="")return null;const n=t.replace(/−/g,"-").replace(",","."),r=Number(n);return Number.isFinite(r)?r:null}function Zs(e,t){const n=qs(e);return n===null?t:n}function js(e){return String(e)}const Qs={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},Js={boxZoom:f.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:f.jsxs(f.Fragment,{children:[f.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),f.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),f.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),f.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 2v20M2 12h20"}),f.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),f.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),f.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:f.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:f.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),f.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:f.jsx("path",{d:"M6 9l6 6 6-6"}),ellipsis:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"5",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),f.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),f.jsx("circle",{cx:"19",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"})]}),sun:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"12",cy:"12",r:"4"}),f.jsx("path",{d:"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"})]}),plusminus:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M4 7h6M7 4v6"}),f.jsx("path",{d:"M14 17h6"}),f.jsx("path",{d:"M6 20l12-16"})]}),layers:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 3l9 5-9 5-9-5 9-5z"}),f.jsx("path",{d:"M3 13l9 5 9-5"})]})};function Je({name:e}){return f.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:Js[e]??null})}function br({icon:e,label:t,title:n,active:r,disabled:o,onClick:i}){return f.jsx("button",{type:"button",disabled:o,onClick:s=>{s.stopPropagation(),!o&&i()},onPointerDown:s=>s.stopPropagation(),onDoubleClick:s=>s.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?f.jsx("span",{"aria-hidden":"true",children:t}):f.jsx(Je,{name:e??""})})}function vr(){return f.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function ei({icon:e,title:t,menu:n}){var _;const{options:r,value:o,onSelect:i}=n,[s,l]=a.useState(!1),[c,u]=a.useState(0),h=a.useRef(null),b=xr(r,o),d=e?void 0:((_=r[b])==null?void 0:_.label)??"",v=a.useCallback(()=>{l(x=>{const p=!x;return p&&u(b),p})},[b]),E=a.useCallback(x=>{i(x),l(!1)},[i]);a.useEffect(()=>{if(!s)return;const x=g=>{h.current&&!h.current.contains(g.target)&&l(!1)},p=g=>{g.key==="Escape"&&(g.stopPropagation(),l(!1))};return document.addEventListener("pointerdown",x,!0),document.addEventListener("keydown",p,!0),()=>{document.removeEventListener("pointerdown",x,!0),document.removeEventListener("keydown",p,!0)}},[s]);const m=x=>{if(!s){(x.key==="ArrowDown"||x.key==="Enter"||x.key===" ")&&(x.preventDefault(),u(b),l(!0));return}if(x.key==="ArrowDown")x.preventDefault(),u(p=>(p+1)%r.length);else if(x.key==="ArrowUp")x.preventDefault(),u(p=>(p-1+r.length)%r.length);else if(x.key==="Enter"||x.key===" "){x.preventDefault();const p=r[c];p&&E(p.id)}};return f.jsxs("div",{ref:h,className:"relative inline-flex",onPointerDown:x=>x.stopPropagation(),children:[f.jsxs("button",{type:"button",onClick:x=>{x.stopPropagation(),v()},onDoubleClick:x=>x.stopPropagation(),onKeyDown:m,"aria-haspopup":"listbox","aria-expanded":s,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",d?"px-1.5 text-[10px] font-mono":"px-1 text-xs",s?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[d?f.jsx("span",{"aria-hidden":"true",children:d}):f.jsx(Je,{name:e??""}),f.jsx(Je,{name:"caret"})]}),s&&f.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((x,p)=>{const g=x.id===o,w=p===c;return f.jsx("li",{role:"option","aria-selected":g,children:f.jsx("button",{type:"button",onClick:M=>{M.stopPropagation(),E(x.id)},onPointerEnter:()=>u(p),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",w?"bg-bg-hover":"",g?"text-accent font-medium":"text-fg"].join(" "),children:x.label})},x.id)})})]})}const ti=e=>e.format?e.format(e.value):String(e.value);function wr({spec:e}){const[t,n]=a.useState(!1),[r,o]=a.useState(""),i=a.useRef(null),s=a.useCallback(()=>{o(js(e.value)),n(!0)},[e.value]);a.useEffect(()=>{t&&i.current&&(i.current.focus(),i.current.select())},[t]);const l=a.useCallback(()=>{n(u=>(u&&e.onChange(Zs(r,e.value)),!1))},[r,e]),c=a.useCallback(()=>n(!1),[]);return f.jsxs("label",{className:"inline-flex items-center gap-1 text-fg-muted",title:e.title,onPointerDown:u=>u.stopPropagation(),onDoubleClick:u=>{u.stopPropagation(),t||s()},children:[e.icon?f.jsx("span",{"aria-hidden":"true",className:"inline-flex",children:f.jsx(Je,{name:e.icon})}):f.jsx("span",{"aria-hidden":"true",className:"text-[9px] font-mono",children:e.label}),t?f.jsx("input",{ref:i,type:"text",inputMode:"decimal","aria-label":`${e.title} (numeric entry)`,value:r,onChange:u=>o(u.target.value),onPointerDown:u=>u.stopPropagation(),onDoubleClick:u=>u.stopPropagation(),onKeyDown:u=>{u.stopPropagation(),u.key==="Enter"?(u.preventDefault(),l()):u.key==="Escape"&&(u.preventDefault(),c())},onBlur:l,className:"cairn-plot-toolbar-slider-entry h-3.5 w-[6.5rem] rounded border border-border bg-bg px-1 text-[9px] font-mono tabular-nums text-fg outline-none focus:border-accent"}):f.jsxs(f.Fragment,{children:[f.jsx("input",{type:"range","aria-label":e.title,min:e.min,max:e.max,step:e.step,value:e.value,onChange:u=>e.onChange(Number(u.target.value)),onPointerDown:u=>u.stopPropagation(),className:"cairn-plot-toolbar-slider h-1 w-16 cursor-pointer accent-accent"}),f.jsx("span",{"aria-hidden":"true",className:"w-8 text-right text-[9px] font-mono tabular-nums",children:ti(e)})]})]})}function ni({icon:e,title:t,menu:n,onClose:r}){var b;const{options:o,value:i,onSelect:s}=n,[l,c]=a.useState(!1),u=xr(o,i),h=((b=o[u])==null?void 0:b.label)??"";return f.jsxs("div",{children:[f.jsxs("button",{type:"button","aria-haspopup":"menu","aria-expanded":l,"aria-label":t,onClick:d=>{d.stopPropagation(),c(v=>!v)},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",l?"text-accent":"text-fg hover:bg-bg-hover"].join(" "),children:[e?f.jsx(Je,{name:e}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{className:"flex-1",children:t}),f.jsx("span",{className:"font-mono text-[10px] text-fg-muted",children:h}),f.jsx("span",{className:l?"rotate-180 transition-transform":"transition-transform",children:f.jsx(Je,{name:"caret"})})]}),l&&o.map(d=>{const v=d.id===i;return f.jsxs("button",{type:"button",role:"menuitemradio","aria-checked":v,"data-menu-option":"",onClick:E=>{E.stopPropagation(),s(d.id),r()},className:["flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-[11px]",v?"text-accent font-medium bg-bg-hover/40":"text-fg hover:bg-bg-hover"].join(" "),children:[f.jsx("span",{"aria-hidden":"true",className:"w-3 text-center text-accent",children:v?"✓":""}),f.jsx("span",{children:d.label})]},d.id)})]})}function ri({actions:e,leading:t,sliders:n}){const[r,o]=a.useState(!1),i=a.useRef(null);return a.useEffect(()=>{if(!r)return;const s=c=>{i.current&&!i.current.contains(c.target)&&o(!1)},l=c=>{c.key==="Escape"&&(c.stopPropagation(),o(!1))};return document.addEventListener("pointerdown",s,!0),document.addEventListener("keydown",l,!0),()=>{document.removeEventListener("pointerdown",s,!0),document.removeEventListener("keydown",l,!0)}},[r]),f.jsxs("div",{ref:i,className:"relative inline-flex",onPointerDown:s=>s.stopPropagation(),children:[f.jsx("button",{type:"button",onClick:s=>{s.stopPropagation(),o(l=>!l)},onDoubleClick:s=>s.stopPropagation(),"aria-haspopup":"menu","aria-expanded":r,"aria-label":"More controls",title:"More controls",className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded text-xs",r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:f.jsx(Je,{name:"ellipsis"})}),r&&f.jsxs("div",{role:"menu",className:["absolute right-0 top-full z-40 mt-1 min-w-[10rem] max-h-80 overflow-auto","rounded border border-border bg-bg-elevated py-1 shadow-md"].join(" "),children:[t.map(s=>s.menu?f.jsx(ni,{icon:s.icon,title:s.title,menu:s.menu,onClose:()=>o(!1)},s.id):f.jsxs("button",{type:"button",disabled:s.disabled,onClick:l=>{var c;l.stopPropagation(),!s.disabled&&((c=s.onClick)==null||c.call(s),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?f.jsx(Je,{name:s.icon}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{children:s.label??s.title})]},s.id)),t.length>0&&e.length>0&&f.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),e.map(s=>f.jsxs("button",{type:"button",role:"menuitem",disabled:s.disabled,onClick:l=>{l.stopPropagation(),!s.disabled&&(s.onClick(),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?f.jsx(Je,{name:s.icon}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{children:s.title})]},s.id)),n.length>0&&(e.length>0||t.length>0)&&f.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),n.map(s=>f.jsx("div",{className:"px-2 py-1",children:f.jsx(wr,{spec:s})},s.id))]})]})}function oi({controller:e,config:t}){var D,R;const n=a.useRef(null),[r,o]=a.useState(!1),i=a.useRef(r);i.current=r;const s=a.useRef(0),l=`${((D=t==null?void 0:t.leadingButtons)==null?void 0:D.length)??0}:${((R=t==null?void 0:t.sliders)==null?void 0:R.length)??0}:${(t==null?void 0:t.visibility)??"hover"}`;if(a.useEffect(()=>{const A=n.current,V=A==null?void 0:A.parentElement;if(!V)return;const L=()=>{const J=V.clientWidth;if(!i.current&&n.current){const N=n.current.scrollWidth;N>0&&(s.current=N)}o(Ks(J,s.current,i.current))};let B=0;const F=()=>{B||(B=requestAnimationFrame(()=>{B=0,L()}))},O=new ResizeObserver(F);return O.observe(V),L(),()=>{O.disconnect(),B&&cancelAnimationFrame(B)}},[l]),(t==null?void 0:t.enabled)===!1)return null;const c=e.capabilities,u=t==null?void 0:t.buttons,h=(A,V)=>V&&(u==null?void 0:u[A])!==!1,b=A=>()=>e.setDragMode(A),d=()=>{e.toPNG({filename:"plot"}).then(A=>Hs(A,"plot.png")).catch(()=>{})},v=[];h("zoom",c.zoom)&&v.push({id:"zoom",icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:b("zoom")}),h("pan",c.pan)&&v.push({id:"pan",icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:b("pan")}),h("select",c.select)&&v.push({id:"select",icon:"select",title:"Box select",active:e.dragMode==="select",onClick:b("select")}),h("lasso",c.lasso)&&v.push({id:"lasso",icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:b("lasso")});const E=[];h("zoomIn",c.zoom)&&E.push({id:"zoomIn",icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),h("zoomOut",c.zoom)&&E.push({id:"zoomOut",icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()});const m=[];h("autoscale",c.autoscale)&&m.push({id:"autoscale",icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),h("reset",c.reset)&&m.push({id:"reset",icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()});const _=[];h("screenshot",c.screenshot)&&_.push({id:"screenshot",icon:"camera",title:"Download plot as PNG",onClick:d});const x=[v,E,m,_].filter(A=>A.length>0),p=x.flat(),g=(t==null?void 0:t.leadingButtons)??[],w=(t==null?void 0:t.sliders)??[];if(!g.length&&p.length===0&&w.length===0)return null;const M=(t==null?void 0:t.position)??"top-right",y=(t==null?void 0:t.visibility)==="always",k=M==="top-right"||M==="bottom-right",T=["cairn-plot-toolbar z-30 rounded border border-border bg-bg-elevated/90 shadow-sm backdrop-blur-sm transition-opacity",y?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),P={position:"absolute",pointerEvents:"auto",...Qs[M]};return r?f.jsx("div",{ref:n,style:P,className:`${T} inline-flex px-0.5 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:f.jsx(ri,{actions:p,leading:g,sliders:w})}):f.jsxs("div",{ref:n,style:P,className:`${T} flex flex-col gap-0.5 px-1 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:[f.jsxs("div",{className:`flex items-center gap-0.5 ${k?"justify-end":"justify-start"}`,children:[g.length>0&&f.jsxs(f.Fragment,{children:[g.map(A=>A.menu?f.jsx(ei,{icon:A.icon,title:A.title,menu:A.menu},A.id):f.jsx(br,{icon:A.icon,label:A.label,title:A.title,active:A.active,disabled:A.disabled,onClick:A.onClick??(()=>{})},A.id)),x.length>0&&f.jsx(vr,{})]}),x.map((A,V)=>f.jsxs("span",{className:"inline-flex items-center gap-0.5",children:[V>0&&f.jsx(vr,{}),A.map(L=>f.jsx(br,{icon:L.icon,title:L.title,active:L.active,disabled:L.disabled,onClick:L.onClick},L.id))]},A[0].id))]}),w.length>0&&f.jsx("div",{className:`flex items-center gap-2 ${k?"justify-end":"justify-start"}`,children:w.map(A=>f.jsx(wr,{spec:A},A.id))})]})}const si={zoom:1,pan:{x:0,y:0}},yr=1.3,ii=.25,ai=64,ci={buttons:{zoom:!1}};function li(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const ui=[{id:"none",label:"None"},{id:"viridis",label:"Viridis"},{id:"plasma",label:"Plasma"},{id:"magma",label:"Magma"},{id:"red-green",label:"Red–Green"},{id:"red-blue",label:"Red–Blue"}];function hn(e,t){return{id:"colormap",title:"Colormap",menu:{options:ui,value:e,onSelect:t}}}const Er=[{id:"linear",label:"Linear"},{id:"srgb",label:"sRGB"},{id:"reinhard",label:"Reinhard"},{id:"aces",label:"ACES"}],fi=[{id:"extended",label:"Extended · Linear"},{id:"extended-reinhard",label:"Extended · Reinhard"},{id:"extended-aces",label:"Extended · ACES"}];function _r(e,t,n){return{id:"tonemap",title:"Tone-mapping operator",menu:{options:n?[...Er,...fi]:Er,value:e,onSelect:t}}}function di({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:i,naturalHeight:s,minZoom:l=ii,maxZoom:c=ai,requestRender:u,onReset:h,extraModified:b=!1}){const d=a.useCallback(y=>{var B;if(!o)return;const k=(B=e.current)==null?void 0:B.getBoundingClientRect(),S=(k==null?void 0:k.width)??0,T=(k==null?void 0:k.height)??0,P=i&&s&&S>0&&T>0?rn(i,s,S,T):c,D=Math.max(l,Math.min(P,n*y));if(D===n)return;const R=S/2,A=T/2,V=R-(R-r.x)/n*D,L=A-(A-r.y)/n*D;o({zoom:D,pan:{x:V,y:L}})},[o,e,i,s,c,l,n,r.x,r.y]),v=a.useCallback(()=>d(yr),[d]),E=a.useCallback(()=>d(1/yr),[d]),m=a.useCallback(()=>{o==null||o(si),h==null||h()},[o,h]),_=a.useCallback(y=>{const k={scale:y==null?void 0:y.scale,filename:y==null?void 0:y.filename};u==null||u();const S=t==null?void 0:t.current;if(S)return gr(S,k);const T=e.current;return T?Ws(T,k):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,u]),x=a.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),p=n!==1||r.x!==0||r.y!==0||b,g=a.useCallback(y=>{},[]),w=a.useCallback(y=>{},[]),M=a.useCallback(()=>{},[]);return a.useMemo(()=>({capabilities:x,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:p,setDragMode:g,setHoverMode:w,toggleSpikelines:M,zoomIn:v,zoomOut:E,autoscale:m,reset:m,toPNG:_}),[x,p,g,w,M,v,E,m,_])}const pi={zoom:1,pan:{x:0,y:0}};function Bt({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:i,pan:s,onViewportChange:l,naturalDims:c,checkerboard:u,wrapperClassName:h,wrapperStyle:b,viewportPadding:d,header:v,surface:E,showAxes:m,overlayNode:_,overlay:x,notationSeed:p,exportCanvasRef:g,requestRender:w,leadingMenus:M,displayAdjust:y,depthSliders:k,extraSliders:S,regionSelect:T,onReset:P,extraModified:D,label:R,showLabelChip:A,isDraggable:V=!1,onDragStart:L,extraChips:B}){const[F,O]=a.useState(p),[J,N]=a.useState(!1),[ue,q]=a.useState(!1),[ee,fe]=a.useState(null),Z="render"in x?null:x,te=!!T&&!!Z,Ce=a.useCallback(async(be,Be,Te,ke)=>{if(!T)return;const U=await T.commit(be,Be,Te,ke);U.ok||(fe(U.message??"no samples in region"),setTimeout(()=>fe(null),1800))},[T]),{containerProps:de}=Yn({containerRef:r,zoom:i,pan:s,onViewportChange:l,naturalWidth:c==null?void 0:c.w,naturalHeight:c==null?void 0:c.h}),pe=a.useCallback(()=>{y==null||y.onExposureChange(0),y==null||y.onOffsetChange(0),P==null||P()},[y,P]),re=a.useCallback(()=>{l==null||l(pi),pe()},[l,pe]),oe=di({rootRef:r,canvasRef:g,zoom:i,pan:s,onViewportChange:l,naturalWidth:c==null?void 0:c.w,naturalHeight:c==null?void 0:c.h,requestRender:w,onReset:pe,extraModified:((y==null?void 0:y.exposureEV)??0)!==0||((y==null?void 0:y.offset)??0)!==0||!!D}),$=a.useMemo(()=>{const be=[];if(k&&be.push(...k),!y)return S&&be.push(...S),be.length?be:void 0;const Be=(Te,ke)=>`${Te>=0?"+":"−"}${Math.abs(Te).toFixed(ke)}`;return be.push({id:"exposure",icon:"sun",label:"EV",title:"Exposure (EV stops) — color × 2^EV. Double-click to type a value (may exceed the slider range).",min:-8,max:8,step:.1,value:y.exposureEV,onChange:y.onExposureChange,format:Te=>Be(Te,1)},{id:"offset",icon:"plusminus",label:"OFF",title:"Offset — added after exposure (before tonemap). Double-click to type a value (may exceed the slider range).",min:-1,max:1,step:.01,value:y.offset,onChange:y.onOffsetChange,format:Te=>Be(Te,2)}),S&&be.push(...S),be},[y,k,S]),he=a.useMemo(()=>te?{id:"region-depth",icon:"select",title:"Select depth from region — drag a rectangle to set the Z window to the samples it covers (Esc to cancel)",active:ue,onClick:()=>q(be=>!be)}:null,[te,ue]),Se=a.useMemo(()=>({...ci,leadingButtons:[...M??[],...he?[he]:[],...J?[li(F,O)]:[]],sliders:$}),[J,F,M,he,$]),le=" cairn-checkerboard",Ee="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(u==="pane"?le:""),Pe=h+(u==="wrapper"?le:""),De="render"in x?x.render({notation:F,setOverlayActive:N}):x.hasSource&&c?f.jsx(ut,{imageElRef:x.displayElRef,naturalWidth:c.w,naturalHeight:c.h,zoom:i,pan:s,sourceWindow:x.sourceWindow,sample:x.sample,notation:F,version:x.version,onActiveChange:N}):null;return f.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[v,n&&f.jsx(oi,{controller:oe,config:Se}),f.jsxs("div",{ref:r,className:Ee,style:{padding:d,...de.style},onPointerDown:de.onPointerDown,onPointerMove:de.onPointerMove,onPointerUp:de.onPointerUp,onPointerCancel:de.onPointerCancel,onDoubleClick:re,...t,children:[f.jsxs("div",{ref:o,className:Pe,style:b,children:[E,m&&c&&f.jsx(Us,{naturalWidth:c.w,naturalHeight:c.h,zoom:i,containerRef:o}),_]}),De,!n&&J&&f.jsx(qn,{notation:F,onChange:O}),ue&&Z&&c&&f.jsx(hi,{imageElRef:Z.displayElRef,naturalDims:c,sourceWindow:Z.sourceWindow,onSelect:(be,Be,Te,ke)=>{q(!1),Ce(be,Be,Te,ke)},onExit:()=>q(!1)}),!ue&&(T==null?void 0:T.rect)&&Z&&c&&f.jsx(gi,{rect:T.rect,imageElRef:Z.displayElRef,naturalDims:c,sourceWindow:Z.sourceWindow,zoom:i,pan:s,onCommit:Ce,onRemove:()=>T.remove()}),ee&&f.jsx("div",{className:"absolute top-2 left-1/2 -translate-x-1/2 z-30 rounded bg-black/70 px-2 py-1 text-xs text-white pointer-events-none",children:ee})]}),A&&f.jsx(Gs,{label:R,isDraggable:V,onDragStart:L}),B]})}function hi({imageElRef:e,naturalDims:t,sourceWindow:n,onSelect:r,onExit:o}){var E;const i=a.useRef(null),s=a.useRef(null),[l,c]=a.useState(null);a.useEffect(()=>{const m=_=>{_.key==="Escape"&&o()};return window.addEventListener("keydown",m),()=>window.removeEventListener("keydown",m)},[o]);const u=a.useCallback(m=>{var _,x;(x=(_=m.target).setPointerCapture)==null||x.call(_,m.pointerId),s.current={x:m.clientX,y:m.clientY},c({x0:m.clientX,y0:m.clientY,x1:m.clientX,y1:m.clientY})},[]),h=a.useCallback(m=>{const _=s.current;_&&c({x0:_.x,y0:_.y,x1:m.clientX,y1:m.clientY})},[]),b=a.useCallback(m=>{const _=s.current;s.current=null,c(null);const x=e.current;if(!_||!x){o();return}if(Math.abs(m.clientX-_.x)<3&&Math.abs(m.clientY-_.y)<3){o();return}const p=x.getBoundingClientRect(),g=Is(_.x,_.y,m.clientX,m.clientY,{box:p,naturalWidth:t.w,naturalHeight:t.h,sourceWindow:n});if(!g){o();return}r(g.x0,g.y0,g.x1,g.y1)},[e,t,n,r,o]),d=(E=i.current)==null?void 0:E.getBoundingClientRect(),v=l&&d?{left:Math.min(l.x0,l.x1)-d.left,top:Math.min(l.y0,l.y1)-d.top,width:Math.abs(l.x1-l.x0),height:Math.abs(l.y1-l.y0)}:null;return f.jsx("div",{ref:i,className:"absolute inset-0 z-20",style:{cursor:"crosshair",touchAction:"none"},onPointerDown:u,onPointerMove:h,onPointerUp:b,children:v&&f.jsx("div",{className:"absolute border-2 border-dashed border-sky-400 bg-sky-400/15 pointer-events-none",style:v})})}const mi={nw:{cursor:"nwse-resize",fx:0,fy:0},n:{cursor:"ns-resize",fx:.5,fy:0},ne:{cursor:"nesw-resize",fx:1,fy:0},e:{cursor:"ew-resize",fx:1,fy:.5},se:{cursor:"nwse-resize",fx:1,fy:1},s:{cursor:"ns-resize",fx:.5,fy:1},sw:{cursor:"nesw-resize",fx:0,fy:1},w:{cursor:"ew-resize",fx:0,fy:.5}};function gi({rect:e,imageElRef:t,naturalDims:n,sourceWindow:r,zoom:o,pan:i,onCommit:s,onRemove:l}){const c=a.useRef(null),[u,h]=a.useState(null),b=a.useRef(null),[d,v]=a.useState(null),E=u??e;a.useLayoutEffect(()=>{const p=()=>{const M=t.current,y=c.current;if(!M||!y)return;const k=M.getBoundingClientRect(),S=y.getBoundingClientRect(),T=Os(E,{box:k,naturalWidth:n.w,naturalHeight:n.h,sourceWindow:r});v({left:T.left-S.left,top:T.top-S.top,width:T.width,height:T.height})};p();const g=t.current;if(!g||typeof ResizeObserver>"u")return;const w=new ResizeObserver(p);return w.observe(g),()=>w.disconnect()},[E,n.w,n.h,r,o,i.x,i.y]);const m=a.useCallback(p=>g=>{var w,M;g.stopPropagation(),(M=(w=g.target).setPointerCapture)==null||M.call(w,g.pointerId),b.current={handle:p,sx:g.clientX,sy:g.clientY,start:E},h(E)},[E]),_=a.useCallback(p=>{const g=b.current,w=t.current;if(!g||!w)return;const M=Bs({box:w.getBoundingClientRect(),naturalWidth:n.w,naturalHeight:n.h,sourceWindow:r}),y=(p.clientX-g.sx)/(M||1),k=(p.clientY-g.sy)/(M||1);h(Fs(g.start,g.handle,y,k,{w:n.w,h:n.h},1))},[t,n.w,n.h,r]),x=a.useCallback(()=>{const p=b.current;b.current=null;const g=u;h(null),p&&g&&s(g.x0,g.y0,g.x1,g.y1)},[u,s]);return d?f.jsxs("div",{ref:c,className:"absolute inset-0 z-20 pointer-events-none",style:{touchAction:"none"},children:[f.jsx("div",{className:"absolute border-2 border-sky-400 bg-sky-400/10 pointer-events-auto",style:{...d,cursor:"move",touchAction:"none"},onPointerDown:m("move"),onPointerMove:_,onPointerUp:x}),Ns.map(p=>{const g=mi[p];return f.jsx("div",{className:"absolute pointer-events-auto flex items-center justify-center",style:{left:d.left+g.fx*d.width-12,top:d.top+g.fy*d.height-12,width:24,height:24,cursor:g.cursor,touchAction:"none"},onPointerDown:m(p),onPointerMove:_,onPointerUp:x,children:f.jsx("div",{className:"w-2.5 h-2.5 rounded-sm bg-sky-400 border border-white/80"})},p)}),f.jsx("button",{type:"button","aria-label":"Remove depth region",title:"Remove region (reset the depth window)",className:"absolute pointer-events-auto flex items-center justify-center rounded-full text-white",style:{left:d.left+d.width-8,top:d.top-32,width:40,height:40},onPointerDown:p=>p.stopPropagation(),onClick:l,children:f.jsx("span",{className:"flex items-center justify-center w-5 h-5 rounded-full bg-slate-800/90 border border-white/70 text-[11px] leading-none",children:"×"})})]}):f.jsx("div",{ref:c,className:"absolute inset-0 z-20 pointer-events-none"})}const Mr={inFlight:!1,pending:null};function xi(e,t){return e.inFlight?{state:{inFlight:!0,pending:t},launch:null}:{state:{inFlight:!0,pending:null},launch:t}}function bi(e){return e.pending!=null?{state:{inFlight:!0,pending:null},launch:e.pending}:{state:Mr,launch:null}}const vi=1e3,wi=typeof requestAnimationFrame=="function"?e=>requestAnimationFrame(()=>e()):e=>setTimeout(e,0),Sr=typeof cancelAnimationFrame=="function"?cancelAnimationFrame:e=>clearTimeout(e);function Tr(e,t){const n=e.deep,r=(n==null?void 0:n.zMin)??0,o=(n==null?void 0:n.zMax)??0,i=t!=null,[s,l,c]=ct(r),[u,h,b]=ct(o),[d,v]=a.useState(null),[E,m]=a.useState(null),_=a.useRef(n);_.current=n;const x=a.useRef(r);x.current=r;const p=a.useRef(o);p.current=o;const g=a.useRef(s);g.current=s;const w=a.useRef(u);w.current=u;const M=a.useRef({near:s,far:u,ver:0}),y=a.useRef(0),k=a.useRef(!0),S=a.useRef(Mr),T=a.useRef(null),P=a.useCallback(N=>l(Math.min(N,w.current)),[l]),D=a.useCallback(N=>h(Math.max(N,g.current)),[h]),R=a.useCallback(()=>{const N=_.current;if(!N)return;const{near:ue,far:q,ver:ee}=M.current,fe=()=>{const Z=bi(S.current);S.current=Z.state,Z.launch!=null&&R()};N.flatten(ue,q).then(Z=>{M.current.ver===ee&&!k.current&&(T.current!=null&&Sr(T.current),T.current=wi(()=>{T.current=null,v(Z)})),fe()}).catch(fe)},[]),A=a.useCallback(()=>{const N=xi(S.current,1);S.current=N.state,N.launch!=null&&R()},[R]);a.useEffect(()=>()=>{T.current!=null&&Sr(T.current),n==null||n.dispose()},[n]),a.useEffect(()=>{if(!n)return;const N=s<=r&&u>=o;if(k.current=N,y.current+=1,M.current={near:s,far:u,ver:y.current},i){t(s,u);return}if(N){v(null);return}A()},[n,s,u,r,o,A,i,t]);const V=a.useMemo(()=>n&&!i&&d!=null?{...e,data:d}:e,[e,n,i,d]),L=n!=null&&r>0&&o/r>vi,B=a.useMemo(()=>{if(!n||!(o>r))return;const N=q=>Math.abs(q)>=1e3||Math.abs(q)<.01&&q!==0?q.toExponential(2):q.toFixed(3),ue=(q,ee,fe,Z,te)=>{if(L){const Ce=Math.log10(r),de=Math.log10(o);return{id:q,icon:"layers",label:ee,title:`${fe} (log scale). Double-click to type a Z.`,min:Ce,max:de,step:(de-Ce)/200,value:Math.log10(Math.max(r,Math.min(Z,o))),onChange:pe=>te(10**pe),format:pe=>N(10**pe)}}return{id:q,icon:"layers",label:ee,title:`${fe}. Double-click to type a Z.`,min:r,max:o,step:(o-r)/200,value:Z,onChange:te,format:N}};return[ue("depth-near","ZN","Depth window NEAR — composite only samples with Z ≥ this",s,P),ue("depth-far","ZF","Depth window FAR — composite only samples with Z ≤ this",u,D)]},[n,r,o,s,u,L,P,D]),F=a.useCallback(async(N,ue,q,ee)=>{const fe=_.current;if(!fe)return{ok:!1,message:"no deep source"};let Z;try{Z=await fe.zRangeInRect(N,ue,q,ee)}catch{return{ok:!1,message:"region query failed"}}if(Z.count===0)return{ok:!1,message:"no samples in region"};const te=p.current-x.current,Ce=Math.max(Math.abs(te)*1e-4,1e-4);return l(Z.zMin-Ce),h(Z.zMax+Ce),m({x0:N,y0:ue,x1:q,y1:ee}),{ok:!0}},[l,h]),O=a.useCallback(()=>{m(null),c.reset(),b.reset(),v(null)},[c,b]),J=a.useCallback(()=>{c.reset(),b.reset(),m(null),v(null)},[c,b]);return{hdr:V,sliders:B,hasDeep:n!=null,region:E,commitRegion:F,removeRegion:O,reset:J,isModified:c.isModified||b.isModified}}function Pr(e){return"hdr"in e&&e.hdr!=null}function Ar(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function Oe(e){return Number.isFinite(e)?e:0}const yi={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Ei(e,t,n,r,o=0){const{h:i,w:s,c:l}=Ar(e.shape),c=e.precision==="f16-bits"?Gn(e.data):e.data,u=No(t),h=new Uint8ClampedArray(s*i*4);for(let b=0;b<s*i;b++){const d=b*l;let v,E,m,_=1;l===1?v=E=m=Oe(c[d]):l===3?(v=Oe(c[d]),E=Oe(c[d+1]),m=Oe(c[d+2])):(v=Oe(c[d]),E=Oe(c[d+1]),m=Oe(c[d+2]),_=Oe(c[d+3]));const x=[_t(v,n,o),_t(E,n,o),_t(m,n,o)],[p,g,w]=u(x),M=b*4;h[M]=255*Zt(p,r),h[M+1]=255*Zt(g,r),h[M+2]=255*Zt(w,r),h[M+3]=255*(_<0?0:_>1?1:_)}return new ImageData(h,s,i)}function _i(e){var Te,ke;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:i="auto",colormap:s="none",showAxes:l=!1,processing:c=yi,zoom:u=1,pan:h={x:0,y:0},onViewportChange:b,onNaturalSize:d,label:v,isDraggable:E=!1,onDragStart:m,overlay:_,overlaySettings:x,pixelValueNotation:p="decimal",toolbar:g=!0}=e,[w,M,y]=ct(s);a.useEffect(()=>{M(s)},[s,M]);const k=a.useRef(null),S=a.useRef(null),T=a.useRef(null),P=a.useRef(null),D=a.useRef(null),R=a.useRef(null),A=a.useRef(null),[V,L]=a.useState(0),B=a.useCallback(()=>L(U=>U+1),[]),F=a.useMemo(()=>({get current(){const U=D.current;return U instanceof HTMLCanvasElement?U:null}}),[]),O=a.useCallback(U=>{k.current=U,U&&(D.current=U)},[]),J=a.useCallback(U=>{S.current=U,U&&(D.current=U)},[]),N=a.useCallback(U=>{U&&(D.current=U)},[]),[ue,q]=a.useState(!1),[ee,fe]=a.useState(!1),[Z,te]=a.useState(null),{flipSign:Ce}=c,{gammaFilterId:de,filterStr:pe,gamma:re,offset:oe}=ur(c),$=!r&&o!=="none"&&n!=null&&t!=null,he=o!=="none"&&n!=null,Se=w!=="none"&&!$&&!(r&&he)&&t!=null;a.useEffect(()=>{if(!Se||!t){fe(!1);return}let U=!1;fe(!1);const me=`${t}::${w}`,Ae=Jt(me);if(Ae){const ie=S.current;if(ie){ie.width=Ae.width,ie.height=Ae.height;const xe=ie.getContext("2d");xe&&xe.putImageData(Ae,0,0),A.current=Ae,B(),te({w:Ae.width,h:Ae.height}),d==null||d(Ae.width,Ae.height),fe(!0)}return}const ve=new Image;return ve.onload=()=>{if(U)return;const ie=document.createElement("canvas");ie.width=ve.naturalWidth,ie.height=ve.naturalHeight;const xe=ie.getContext("2d");if(!xe)return;xe.drawImage(ve,0,0);const Fe=xe.getImageData(0,0,ie.width,ie.height),Ve=Qt(w),_e=jt(Fe,w,Ve);en(me,_e);const Le=S.current;if(!Le||U)return;Le.width=_e.width,Le.height=_e.height;const Me=Le.getContext("2d");Me&&Me.putImageData(_e,0,0),A.current=_e,B(),te({w:_e.width,h:_e.height}),d==null||d(_e.width,_e.height),fe(!0)},ve.src=t,()=>{U=!0}},[Se,t,w]);const le=a.useCallback((U,me)=>{te(Ae=>Ae&&Ae.w===U&&Ae.h===me?Ae:{w:U,h:me}),d==null||d(U,me)},[]);a.useEffect(()=>{if(!t){R.current=null,A.current=null,B();return}let U=!1;return it(t).then(me=>{U||(R.current=me,w==="none"&&(A.current=me),B())}),()=>{U=!0}},[t,w,B]);const Ee=a.useCallback((U,me,Ae)=>{const ve=R.current;if(!ve||U<0||me<0||U>=ve.width||me>=ve.height)return null;const ie=(me*ve.width+U)*4,xe=ve.data[ie],Fe=ve.data[ie+1],Ve=ve.data[ie+2],_e=A.current;let Le=xe,Me=Fe,z=Ve;if(_e&&_e.width===ve.width&&_e.height===ve.height){const I=(me*_e.width+U)*4;Le=_e.data[I],Me=_e.data[I+1],z=_e.data[I+2]}const X=(.299*Le+.587*Me+.114*z)/255;return lt(w!=="none"||xe===Fe&&Fe===Ve?[xe]:[xe,Fe,Ve],"uint8",Ae,X)},[w]);a.useEffect(()=>{if(!$){q(!1);return}let U=!1;const me=Qo(),Ae=me==="gpu"||me==="auto",ve=`${n}::${t}::${o}::${w}`;if(me!=="gpu"){const ie=Jt(ve);if(ie){const xe=k.current;if(xe){(xe.width!==ie.width||xe.height!==ie.height)&&(xe.width=ie.width,xe.height=ie.height);const Fe=xe.getContext("2d");Fe&&Fe.putImageData(ie,0,0),le(ie.width,ie.height),q(!0)}return}}return(async()=>{const[ie,xe]=await Promise.all([it(n),it(t)]);if(U||!ie||!xe)return;const Ve=o.includes("signed")?"signed":"positive",_e=w!=="none"?Ht(w):null,Le={diffMode:o,colormap:_e,cmapMode:Ve};if(Ae)try{const j=k.current;if(j){const I=Zo(ie,xe,Le,j);if(I){if(U)return;le(I.width,I.height),q(!0);return}}}catch(j){console.warn("[cairn] WebGL 2 diff error:",j)}if(me==="gpu"){console.error("[cairn] WebGL 2 unavailable — set render mode to 'Auto' or 'CPU'");return}let Me=$o(ie,xe,o);w!=="none"&&(Me=jt(Me,w,Ve)),en(ve,Me);const z=k.current;if(!z||U)return;(z.width!==Me.width||z.height!==Me.height)&&(z.width=Me.width,z.height=Me.height);const X=z.getContext("2d");X&&X.putImageData(Me,0,0),le(Me.width,Me.height),q(!0)})(),()=>{U=!0}},[n,t,o,$,w,d]);const Pe=i==="auto"?void 0:i,De=Ce?{filter:"invert(1)"}:{},be=_&&(x!=null&&x.enabled)&&Z&&t&&((((Te=_.boxes)==null?void 0:Te.length)??0)>0||(((ke=_.masks)==null?void 0:ke.length)??0)>0)?f.jsx(sn,{data:_,settings:x,naturalWidth:Z.w,naturalHeight:Z.h}):void 0,Be=t?$?f.jsxs(f.Fragment,{children:[!ue&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),f.jsx("canvas",{ref:O,className:"w-full h-full object-contain block",style:{display:ue?"block":"none",imageRendering:Pe,...De}})]}):Se?f.jsxs(f.Fragment,{children:[!ee&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),f.jsx("canvas",{ref:J,className:"w-full h-full object-contain block",style:{display:ee?"block":"none",imageRendering:Pe,...De}})]}):f.jsx("img",{ref:N,src:t,alt:v,className:"w-full h-full object-contain block",draggable:!1,style:{filter:pe,imageRendering:Pe},onLoad:U=>{const me=U.currentTarget;te({w:me.naturalWidth,h:me.naturalHeight}),d==null||d(me.naturalWidth,me.naturalHeight)}}):f.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return f.jsx(Bt,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:g,paneRef:T,wrapperRef:P,zoom:u,pan:h,onViewportChange:b,naturalDims:Z,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${h.x}px, ${h.y}px) scale(${u})`,transformOrigin:"0 0"},viewportPadding:l&&Z?"16px 4px 4px 28px":"4px",header:f.jsx(fr,{id:de,gamma:re,offset:oe}),surface:Be,showAxes:l,overlayNode:be,overlay:{displayElRef:D,sample:Ee,version:V,hasSource:!!t},notationSeed:p,exportCanvasRef:F,leadingMenus:[hn(w,U=>M(U))],onReset:y.reset,extraModified:y.isModified,label:v,showLabelChip:!0,isDraggable:E,onDragStart:m})}function Mi(e){const{tonemap:t="srgb",exposure:n=0,gamma:r,showAxes:o=!1,label:i="",interpolation:s="auto",zoom:l=1,pan:c={x:0,y:0},onViewportChange:u,pixelValueNotation:h="decimal",toolbar:b=!0}=e,d=Tr(e.hdr),v=d.hdr,[E,m,_]=ct(qt(t));a.useEffect(()=>{m(qt(t))},[t,m]);const x=a.useRef(null),p=a.useRef(null),g=a.useRef(null),[w,M]=a.useState(null),y=a.useRef(null),[k,S]=a.useState(0),[T,P]=a.useState(0),[D,R]=a.useState(0);a.useEffect(()=>{const L=x.current;if(!L)return;let B;try{B=Ei(v,E,n+T,r,D)}catch(O){console.error("[cairn] HDR tone-map error:",O);return}(L.width!==B.width||L.height!==B.height)&&(L.width=B.width,L.height=B.height);const F=L.getContext("2d");F&&(F.putImageData(B,0,0),y.current=B,S(O=>O+1),M(O=>O&&O.w===B.width&&O.h===B.height?O:{w:B.width,h:B.height}))},[v,E,n,r,T,D]);const A=a.useCallback((L,B,F)=>{const O=w;if(!O||L<0||B<0||L>=O.w||B>=O.h)return null;const J=v.shape.length===2?1:v.shape[2]??1,N=(B*O.w+L)*J,ue=v.data,q=v.precision==="f16-bits"?te=>Tt(ue[te]??0):te=>ue[te]??0,ee=y.current;let fe=.5;if(ee&&ee.width===O.w&&ee.height===O.h){const te=(B*O.w+L)*4;fe=(.299*ee.data[te]+.587*ee.data[te+1]+.114*ee.data[te+2])/255}const Z=J===1?[q(N)]:[q(N),q(N+1),q(N+2)];return lt(Z,"unit",F,fe)},[v,w]),V=s==="auto"?void 0:s;return f.jsx(Bt,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:b,paneRef:p,wrapperRef:g,zoom:l,pan:c,onViewportChange:u,naturalDims:w,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${c.x}px, ${c.y}px) scale(${l})`,transformOrigin:"0 0"},viewportPadding:o&&w?"16px 4px 4px 28px":"4px",surface:f.jsx("canvas",{ref:x,className:"w-full h-full object-contain block",style:{imageRendering:V}}),showAxes:o,overlay:{displayElRef:x,sample:A,version:k,hasSource:!0},notationSeed:h,exportCanvasRef:x,leadingMenus:[_r(E,L=>m(L),!1)],displayAdjust:{exposureEV:T,offset:D,onExposureChange:P,onOffsetChange:R},depthSliders:d.sliders,regionSelect:d.hasDeep?{rect:d.region,commit:d.commitRegion,remove:d.removeRegion}:void 0,onReset:()=>{d.reset(),_.reset()},extraModified:d.isModified||_.isModified,label:i,showLabelChip:!!i})}function mn(e){return Pr(e)?f.jsx(Mi,{...e}):f.jsx(_i,{...e})}const Rr={"no-webgpu":0,"no-hdr-browser":1,"no-hdr-display":2},Si="https://github.com/doeringchristian/cairn-plot/blob/main/docs/browser-support.md";function Ti(e,t=!1){const n=e||"";return t?"brave":/firefox/i.test(n)?"firefox":/safari/i.test(n)&&!/chrome|chromium|crios|android/i.test(n)?"safari":/linux/i.test(n)&&/chrome|chromium/i.test(n)?"chromium-linux":"chromium"}function Pi(e){const t=e||"";return/mac os x|macintosh/i.test(t)?"macos":/windows/i.test(t)?"windows":"other"}function Ai(e,t){if(e==="no-hdr-display")switch(Pi(t.userAgent)){case"macos":return"macOS: EDR engages automatically on HDR-capable displays — confirm your display supports HDR.";case"windows":return"Windows: turn on Settings → System → Display → Use HDR.";default:return"Enable HDR in your display and OS settings."}const n=Ti(t.userAgent,t.isBrave);if(e==="no-hdr-browser")switch(n){case"firefox":return"Firefox has no extended-tone-mapping canvas path at all — true HDR output is impossible until Firefox implements it (fundamental browser limitation).";case"safari":return"Safari's WebGPU HDR canvas tone-mapping is still maturing — update to the latest Safari 26+.";default:return"Chrome/Edge 129+ is required for HDR canvas output (toneMapping: extended) — update your browser."}switch(n){case"firefox":return"Firefox: about:config → dom.webgpu.enabled (HDR output is not available in Firefox at all — browser limitation).";case"safari":return"Safari: Develop → Feature Flags → WebGPU (Safari 26+ has it by default).";case"brave":return"Brave: check Shields fingerprint blocking + brave://flags.";case"chromium-linux":return"Chromium on Linux: enable chrome://flags/#enable-unsafe-webgpu.";case"chromium":default:return"Chrome/Edge: enable chrome://flags/#enable-unsafe-webgpu and hardware acceleration."}}function Ri(e){switch(e){case"no-webgpu":return"GPU renderer unavailable → CPU fallback active; FLIP kernels + HDR compare disabled.";case"no-hdr-browser":return"True HDR output is unsupported by this browser — a fundamental browser limitation, not a cairn-plot bug → HDR images tone-mapped to SDR.";case"no-hdr-display":return"Your display/OS is not in HDR mode → HDR images tone-mapped to SDR."}}function Cr(e,t){return`cairn-plot:capnotice:${e}:${t}`}const kr=new Set;function Dr(e){try{if(window.localStorage.getItem(e)==="1")return!0}catch{}try{if(window.sessionStorage.getItem(e)==="1")return!0}catch{}return kr.has(e)}function Ci(e){try{window.localStorage.setItem(e,"1");return}catch{}try{window.sessionStorage.setItem(e,"1");return}catch{}kr.add(e)}const Lr=new Set;let Ot=null,ht=null;function Br(){ht&&ht.parentNode&&ht.parentNode.removeChild(ht),ht=null,Ot=null}function ki(e){const t=Cr(e,window.location.pathname),n=Ai(e,{userAgent:navigator.userAgent,isBrave:!!navigator.brave}),r=document.createElement("div");r.setAttribute("role","status"),r.setAttribute("data-cairn-plot-capnotice",e),Object.assign(r.style,{position:"fixed",bottom:"12px",right:"12px",zIndex:"2147483000",maxWidth:"340px",boxSizing:"border-box",padding:"10px 30px 10px 12px",borderRadius:"6px",border:"1px solid var(--color-border, #d0d7de)",background:"rgb(var(--color-bg-elevated-rgb, 246 248 250) / 0.9)",color:"var(--color-fg-muted, #656d76)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",boxShadow:"0 4px 12px rgba(0, 0, 0, 0.18)",font:"12px/1.4 system-ui, sans-serif"});const o=document.createElement("div");o.textContent=Ri(e),Object.assign(o.style,{fontWeight:"600",color:"var(--color-fg, #1f2328)",marginBottom:"4px"});const i=document.createElement("div");i.textContent=n,i.style.marginBottom="4px";const s=document.createElement("a");s.href=Si,s.target="_blank",s.rel="noopener noreferrer",s.textContent="Learn more",Object.assign(s.style,{color:"var(--color-accent, #0969da)",textDecoration:"none"});const l=document.createElement("button");l.type="button",l.textContent="×",l.setAttribute("aria-label","Dismiss browser capability notice"),l.title="Dismiss",Object.assign(l.style,{position:"absolute",top:"4px",right:"6px",padding:"0 4px",border:"0",background:"transparent",color:"var(--color-fg-subtle, #8b949e)",cursor:"pointer",fontSize:"16px",lineHeight:"1"}),l.addEventListener("click",()=>{Ci(t),Br()}),r.appendChild(o),r.appendChild(i),r.appendChild(s),r.appendChild(l),document.body.appendChild(r),ht=r,Ot=e}function Or(e){if(typeof document>"u"||typeof window>"u"||Lr.has(e))return;Lr.add(e);const t=Cr(e,window.location.pathname);if(Dr(t))return;const n=()=>{if(!Dr(t)){if(Ot!==null)if(Rr[e]<Rr[Ot])Br();else return;ki(e)}};document.body?n():window.addEventListener("DOMContentLoaded",n,{once:!0})}const Di={data:new Float32Array(0),shape:[0,0],dtype:"<f4"};function Li(e){const{h:t,w:n,c:r}=Ar(e.shape);if(e.precision==="f16-bits"){const s=e.data,l=new Uint16Array(n*t*4);for(let c=0;c<n*t;c++){const u=c*r,h=c*4;if(r===1){const b=s[u];l[h]=b,l[h+1]=b,l[h+2]=b,l[h+3]=St}else l[h]=s[u],l[h+1]=s[u+1],l[h+2]=s[u+2],l[h+3]=r>=4?s[u+3]:St}return{data:l,width:n,height:t,format:"rgba16float"}}const o=e.data,i=new Float32Array(n*t*4);for(let s=0;s<n*t;s++){const l=s*r;let c,u,h,b=1;r===1?c=u=h=Oe(o[l]):r===3?(c=Oe(o[l]),u=Oe(o[l+1]),h=Oe(o[l+2])):(c=Oe(o[l]),u=Oe(o[l+1]),h=Oe(o[l+2]),b=Oe(o[l+3]));const d=s*4;i[d]=c,i[d+1]=u,i[d+2]=h,i[d+3]=b}return{data:i,width:n,height:t,format:"rgba32float"}}function Ir(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),i=n*o,s=r*o,l=(t.width-i)/2,c=(t.height-s)/2,u=Math.max(e.zoom,1e-6),h=t.width/(u*i),b=t.height/(u*s),d=-l/i-e.pan.x/(u*i),v=-c/s-e.pan.y/(u*s);return{x:d,y:v,w:h,h:b}}function Nr(e,t,n,r){const o=e.w*n,i=e.h*r;return o<=0||i<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/i)}function Bi(e){var _e,Le,Me;const t=Pr(e),n=a.useRef(null),r=a.useRef(null),o=a.useRef(null),i=a.useRef(null),s=a.useRef(null),l=t&&!!((_e=e.hdr)!=null&&_e.deep),c=a.useCallback((z,X)=>{var j,I;(j=i.current)==null||j.setDeepWindow(z,X),(I=s.current)==null||I.call(s)},[]),u=Tr(t?e.hdr:Di,l?c:void 0),h=a.useRef(!1),[b,d]=a.useState(!1),[v,E]=a.useState(!1),[m,_]=a.useState(!1),[x,p]=a.useState(null),[g,w]=a.useState(0),[M,y]=a.useState(0),[k,S]=a.useState({x:0,y:0,w:1,h:1}),T=a.useRef(null),P=a.useRef(null),[D,R]=a.useState(0),A=e.zoom??1,V=e.pan??{x:0,y:0},L=e.onViewportChange,B=t?"none":e.colormap??"none",[F,O]=a.useState(B);a.useEffect(()=>{O(B)},[B]);const J=t?"none":F,N=a.useRef(B),ue=a.useCallback(()=>{O(N.current)},[]),q=t?e.tonemap:void 0,[ee,fe]=a.useState(null);a.useEffect(()=>{fe(null)},[q]);const Z=Fo(q,b),te=ee??Z,Ce=ee!==null&&ee!==Z,de=a.useCallback(()=>fe(null),[]),[pe,re]=a.useState(Et),oe=pe!==Et,$=a.useCallback(()=>re(Et),[]),[he,Se]=a.useState(0),[le,Ee]=a.useState(0),Pe=on();a.useEffect(()=>{const z=n.current;if(!z)return;let X=!1;return yt().then(j=>{var Ue;if(X)return;const I=((Ue=j.probeExtendedToneMapping)==null?void 0:Ue.call(j))??!1,Y=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,K=I&&Y&&t;h.current=K,d(K),t&&!K&&Or(I?"no-hdr-display":"no-hdr-browser"),ks(z,{hdr:K}).then(Ie=>{if(X){lr(Ie);return}i.current=Ie,_(!0)}).catch(Ie=>{X||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",Ie),E(!0))})}).catch(j=>{X||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",j),E(!0))}),()=>{X=!0,i.current&&(lr(i.current),i.current=null)}},[]),a.useEffect(()=>{const z=r.current;if(!z)return;const X=new ResizeObserver(()=>y(j=>j+1));return X.observe(z),()=>X.disconnect()},[]),a.useEffect(()=>{const z=r.current;if(!z)return;const X=new IntersectionObserver(j=>{const I=j[0];if(!I)return;const Y=i.current;Y&&(Y.setVisible(I.isIntersecting),I.isIntersecting?Y.isParked&&(Y.restore(),y(K=>K+1)):Y.park())},{threshold:0});return X.observe(z),()=>X.disconnect()},[]),a.useEffect(()=>{var j;if(!t||!m||l)return;const z=u.hdr;T.current=z;const X=Li(z);(j=i.current)==null||j.setSource(X),p(I=>I&&I.w===X.width&&I.h===X.height?I:{w:X.width,h:X.height}),R(I=>I+1),w(I=>I+1)},[t,m,l,t?u.hdr:null]),a.useEffect(()=>{if(!t||!m||!l)return;const z=e.hdr,X=z.deep;T.current=z;let j=!1;return X.getGpuCsr().then(I=>{var Y;j||((Y=i.current)==null||Y.setDeepSource(I,X.zMin,X.zMax),p(K=>K&&K.w===I.width&&K.h===I.height?K:{w:I.width,h:I.height}),R(K=>K+1),w(K=>K+1))}).catch(I=>{j||console.warn("[cairn] deep GPU CSR upload failed:",I)}),()=>{j=!0}},[t,m,l,t?e.hdr.deep:null]),a.useEffect(()=>{if(t||!m)return;const z=e,X=z.imageUrl,j=F;if(!X){P.current=null,p(null),R(Y=>Y+1);return}let I=!1;return it(X).then(Y=>{var Ie,Ge;if(I||!Y)return;let K=Y;if(j!=="none"){const se=`gpu::${X}::${j}::ev${he}::off${le}`,Xe=Jt(se);if(Xe)K=Xe;else{const He=Qt(j);K=jt(Y,j,He,he,le),en(se,K)}}P.current=Y;const Ue={data:K.data,width:K.width,height:K.height,format:"rgba8unorm"};(Ie=i.current)==null||Ie.setSource(Ue),p(se=>se&&se.w===K.width&&se.h===K.height?se:{w:K.width,h:K.height}),(Ge=z.onNaturalSize)==null||Ge.call(z,K.width,K.height),R(se=>se+1),w(se=>se+1)}),()=>{I=!0}},[t,m,t?null:e.imageUrl,t?null:F,t?0:he,t?0:le]);const De=t?e.exposure??0:0,be=t?e.gamma:void 0,Be=a.useCallback(()=>{const z=i.current;if(!z||!m||!x)return;const X=r.current,j=o.current,I=j?j.getBoundingClientRect():X?X.getBoundingClientRect():{width:x.w,height:x.h},Y=Ir({zoom:A,pan:V},I,x.w,x.h);S(se=>se.x===Y.x&&se.y===Y.y&&se.w===Y.w&&se.h===Y.h?se:Y),I.width>0&&I.height>0&&z.resize(Math.round(I.width*Pe),Math.round(I.height*Pe));const K=Nr(Y,I,x.w,x.h)>=an?"nearest":"linear",Ue=Y,Ie=h.current&&Ln(te),Ge=t?{exposureEV:De+he,offset:le,operator:te,gamma:be,isScalar:!1,hdrOut:Ie,peak:pe,uv:Ue,filter:K}:{exposureEV:J!=="none"?0:he,offset:J!=="none"?0:le,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:Ue,filter:K};try{z.render(Ge)||E(!0)}catch(se){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",se),E(!0)}},[m,x,A,V.x,V.y,De,he,le,te,pe,be,t,J,Pe]);s.current=Be,a.useEffect(()=>{Be()},[Be,g,M]);const Te=a.useCallback((z,X,j)=>{if(t){const Xe=T.current,He=x;if(!Xe||!He||z<0||X<0||z>=He.w||X>=He.h)return null;const vt=Xe.shape.length===2?1:Xe.shape[2]??1,et=(X*He.w+z)*vt,mt=Xe.data,st=Xe.precision==="f16-bits"?gt=>Tt(mt[gt]??0):gt=>mt[gt]??0,En=.5,_n=vt===1?[st(et)]:[st(et),st(et+1),st(et+2)];return lt(_n,"unit",j,En)}const I=P.current;if(!I||z<0||X<0||z>=I.width||X>=I.height)return null;const Y=(X*I.width+z)*4,K=I.data[Y],Ue=I.data[Y+1],Ie=I.data[Y+2],Ge=(.299*K+.587*Ue+.114*Ie)/255;return lt(J!=="none"||K===Ue&&Ue===Ie?[K]:[K,Ue,Ie],"uint8",j,Ge)},[t,x,J]),ke=e.showAxes??!1,U=t?e.label??"":e.label,me=e.interpolation??"auto",Ae=me==="auto"?void 0:me,ve=t?void 0:e.overlay,ie=t?void 0:e.overlaySettings,xe=t?!1:e.isDraggable??!1,Fe=t?void 0:e.onDragStart;if(v)return t?f.jsx(mn,{...e}):f.jsx(mn,{...e});const Ve=ve&&(ie!=null&&ie.enabled)&&x&&((((Le=ve.boxes)==null?void 0:Le.length)??0)>0||(((Me=ve.masks)==null?void 0:Me.length)??0)>0)?f.jsx(sn,{data:ve,settings:ie,naturalWidth:x.w,naturalHeight:x.h}):void 0;return f.jsx(Bt,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":m},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:r,wrapperRef:o,zoom:A,pan:V,onViewportChange:L,naturalDims:x,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:ke&&x?"16px 4px 4px 28px":0,surface:f.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:Ae},"data-gpu-image-canvas":!0}),showAxes:ke,overlayNode:Ve,overlay:{displayElRef:n,sample:Te,version:D,hasSource:!0,sourceWindow:k},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:Be,leadingMenus:t?[_r(te,z=>fe(z),b)]:[hn(J,z=>O(z))],displayAdjust:{exposureEV:he,offset:le,onExposureChange:Se,onOffsetChange:Ee},extraSliders:t&&Io(te)?[{id:"peak",label:"PK",title:"Peak white (×SDR white) — HDR roll-off shoulder for the extended Reinhard/ACES operators. Double-click to type a value.",min:Co,max:ko,step:Do,value:pe,onChange:re,format:z=>`${z.toFixed(1)}×`}]:void 0,depthSliders:u.sliders,regionSelect:l?{rect:u.region,commit:u.commitRegion,remove:u.removeRegion}:void 0,onReset:()=>{ue(),de(),$(),u.reset()},extraModified:F!==N.current||Ce||oe||u.isModified,label:U,showLabelChip:!!U,isDraggable:xe,onDragStart:Fe})}const It=new Map;function je(e){if(It.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);It.set(e.id,e)}function ot(e){return It.get(e)}function Oi(){return Array.from(It.values())}function Fr(e,t){return{...e.params??{},...t??{}}}const Ii={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},Ni={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},Fi={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},Ui={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},Gi={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},zi={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},Ur=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];$i(Ur);const gn=[1.052156925,1,.91835767],Vi=.7;function $i(e){const[t,n,r]=e[0],[o,i,s]=e[1],[l,c,u]=e[2],h=i*u-s*c,b=-(o*u-s*l),d=o*c-i*l,E=1/(t*h+n*b+r*d);return[[h*E,-(n*u-r*c)*E,(n*s-r*i)*E],[b*E,(t*u-r*l)*E,-(t*s-r*o)*E],[d*E,-(t*c-n*l)*E,(t*i-n*o)*E]]}function Xi(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const xn=6/29;function bn(e){return e>xn**3?Math.cbrt(e):e/(3*xn*xn)+4/29}function Gr(e,t,n){const[r,o,i]=Xi(Ur,e,t,n),s=bn(r*gn[0]),l=bn(o*gn[1]),c=bn(i*gn[2]),u=116*l-16,h=500*(s-l),b=200*(l-c);return[u,.01*u*h,.01*u*b]}function Wi(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function Hi(){const e=Gr(0,1,0),t=Gr(0,0,1);return Math.pow(Wi(e,t),Vi)}const zr=Hi(),Yi=.082;function Vr(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],i=Math.max(...n,...o),s=Math.ceil(3*Math.sqrt(i/(2*Math.PI**2))*e),l=1/e,c=Math.PI**2,u=[0,0,0];for(let h=-s;h<=s;h++)for(let b=-s;b<=s;b++){const d=(b*l)**2+(h*l)**2;for(let v=0;v<3;v++)u[v]+=t[v]*Math.sqrt(Math.PI/n[v])*Math.exp(-c*d/n[v])+r[v]*Math.sqrt(Math.PI/o[v])*Math.exp(-c*d/o[v])}return{r:s,deltaX:l,sums:u}}function $r(e){const t=.5*Yi*e,n=Math.ceil(3*t);let r=0,o=0,i=0;for(let s=-n;s<=n;s++)for(let l=-n;l<=n;l++){const c=Math.exp(-(l*l+s*s)/(2*t*t)),u=-l*c,h=(l*l/(t*t)-1)*c;u>0&&(r+=u),h>0?o+=h:i-=h}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:i}}const Ki=`
${$e}
${Ct}
${dt}
${Rt}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_map0: vec4<f32>; // offX, offY, fitFill, 0
@group(0) @binding(8) var<uniform> u_map1: vec4<f32>; // resultW, resultH, 0, 0
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = mapSample(src, px, u_map0.x, u_map0.y, u_map1.x, u_map1.y, u_map0.z);
  return vec4<f32>(flip_rgb2ycxcz(s.rgb), 1.0);
}
`,qi=`
${$e}
${Ct}
${dt}
${Rt}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_map0: vec4<f32>; // offX, offY, fitFill, 0
@group(0) @binding(8) var<uniform> u_map1: vec4<f32>; // resultW, resultH, 0, 0
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = mapSample(src, px, u_map0.x, u_map0.y, u_map1.x, u_map1.y, u_map0.z);
  return vec4<f32>(flip_linrgb2ycxcz(clamp(s.rgb, vec3<f32>(0.0), vec3<f32>(1.0))), 1.0);
}
`,Nt=`
${$e}
${Ct}
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
`,Xr=`
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
`;function Qe(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function Ft(e,t,n){const r=n.sourceMap,o=r?t==="a"?r.offsetA:r.offsetB:{x:0,y:0},i=r!=null&&r.fill?1:0;return[Qe(e,[o.x,o.y,i,0]),Qe(e+1,[n.width,n.height,0,0])]}function Ut(e){return[Qe(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),Qe(2,[e.sums[2],0,0,0])]}function Wr(e){return[Qe(4,[zr,e.sd,e.r,e.edgeNorm]),Qe(5,[e.pointPos,e.pointNeg,0,0])]}function Hr(e,t,n,r,o,i=""){const s=Vr(e),l=$r(e),c=`ycxczA${i}`,u=`ycxczB${i}`,h=`labA${i}`,b=`labB${i}`,d=`flip${i}`;return{passes:[{name:c,shader:t,inputs:[n],output:c,uniforms:()=>Ft(1,"a",o)},{name:u,shader:t,inputs:[r],output:u,uniforms:()=>Ft(1,"b",o)},{name:h,shader:Nt,inputs:[c],output:h,uniforms:()=>Ut(s)},{name:b,shader:Nt,inputs:[u],output:b,uniforms:()=>Ut(s)},{name:d,shader:Xr,inputs:[h,b,c,u],output:d,uniforms:()=>Wr(l)}],flipRef:d}}const Zi={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=Hr(t,Ki,"srcA","srcB",e);return{passes:n,final:r}}},ji={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=Hr(t,qi,"srcA","srcB",e);return{passes:n,final:r}}},Yr=`
${$e}
${Ct}
${dt}
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
`,Qi=`
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
`,Ji={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",output:"scalar",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),i=(r-n)/Math.max(o-1,1),s=Vr(t),l=$r(t),c=[];let u=null;for(let h=0;h<o;h++){const b=n+h*i,d=`_e${h}`,v=`ycxczA${d}`,E=`ycxczB${d}`,m=`labA${d}`,_=`labB${d}`,x=`acc${d}`;c.push({name:v,shader:Yr,inputs:["srcA"],output:v,uniforms:()=>[Qe(1,[b,0,0,0]),...Ft(2,"a",e)]},{name:E,shader:Yr,inputs:["srcB"],output:E,uniforms:()=>[Qe(1,[b,0,0,0]),...Ft(2,"b",e)]},{name:m,shader:Nt,inputs:[v],output:m,uniforms:()=>Ut(s)},{name:_,shader:Nt,inputs:[E],output:_,uniforms:()=>Ut(s)}),u===null?c.push({name:x,shader:Xr,inputs:[m,_,v,E],output:x,uniforms:()=>Wr(l)}):c.push({name:x,shader:Qi,inputs:[m,_,v,E,u],output:x,uniforms:()=>[Qe(5,[zr,l.sd,l.r,l.edgeNorm]),Qe(6,[l.pointPos,l.pointNeg,0,0])]}),u=x}return{passes:c,final:u}}},ea=.01,ta=.03,Kr=1,qr=1.5,Zr=5,jr=`
fn ssim_srgb2linear(c: f32) -> f32 {
  if (c <= 0.04045) { return c / 12.92; }
  return pow((c + 0.055) / 1.055, 2.4);
}
fn ssim_luma(srgb: vec3<f32>) -> f32 {
  let lin = vec3<f32>(ssim_srgb2linear(srgb.r), ssim_srgb2linear(srgb.g), ssim_srgb2linear(srgb.b));
  return clamp(dot(lin, vec3<f32>(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
}
`,na=`
${$e}
${jr}
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
`,ra=`
${$e}
${jr}
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
`,Qr=`
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
`,oa=`
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
`;function vn(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function Jr(e,t){const n=`${t}H`,r=`${t}V`;return{passes:[{name:n,shader:Qr,inputs:[e],output:n,uniforms:()=>[vn(1,[1,0,Zr,qr])]},{name:r,shader:Qr,inputs:[n],output:r,uniforms:()=>[vn(1,[0,1,Zr,qr])]}],out:r}}const sa={kind:"multipass",id:"ssim",label:"SSIM (1−SSIM)",publicName:"ssim",displayRange:"unit",output:"scalar",buildPasses(e){const t=(ea*Kr)**2,n=(ta*Kr)**2,r=Jr("momA","statsA"),o=Jr("momB","statsB");return{passes:[{name:"momA",shader:na,inputs:["srcA","srcB"],output:"momA"},{name:"momB",shader:ra,inputs:["srcA","srcB"],output:"momB"},...r.passes,...o.passes,{name:"ssim",shader:oa,inputs:[r.out,o.out],output:"ssim",uniforms:()=>[vn(2,[t,n,0,0])]}],final:"ssim"}}};let eo=!1;function ia(){eo||(eo=!0,je(Ni),je(Ii),je(Fi),je(Gi),je(Ui),je(zi),je(Zi),je(Ji),je(ji),je(sa))}ia();function to(){const e=[];for(const n of Oi())n.kind==="pointwise"&&e.push({id:n.id,label:n.label});e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"});const t=ot("ssim");return t&&e.push({id:t.id,label:t.label}),e}function aa(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}const no=new WeakMap;function wn(e,t,n,r){let o=no.get(e);o||(o=new Map,no.set(e,o));const i=`${t}::${r}`;let s=o.get(i);return s||(s=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(i,s)),s}function ca(e){return`
${$e}
${dt}
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
`}const Gt="rgba16float";function la(e,t,n,r,o,i){var _,x;const s=ot(r);if(!s)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const l=i??kt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),c=l.result.w,u=l.result.h,h=l.fit==="fill"?1:0,b=Fr(s,o);if(s.kind==="pointwise"){const p=e.createTexture(c,u,Gt),g=wn(e,`pw:${s.id}`,ca(s.source),Gt),w=new Float32Array([l.offsetA.x,l.offsetA.y,l.offsetB.x,l.offsetB.y]),M=new Float32Array([c,u,h,0]);let y;try{y=e.createBindGroup(g,[{binding:0,resource:t},{binding:1,resource:n},{binding:2,resource:{uniform:w}},{binding:3,resource:{uniform:M}}]),e.renderFullscreen(p,g,y)}finally{(_=y==null?void 0:y.destroy)==null||_.call(y)}return p}const d={width:c,height:u,params:b,sourceMap:{fill:l.fit==="fill",offsetA:l.offsetA,offsetB:l.offsetB}},v=s.buildPasses(d),E=new Map([["srcA",t],["srcB",n]]),m=[];try{for(const g of v.passes){const w=e.createTexture(c,u,Gt);m.push(w),E.set(g.output,w);const M=wn(e,`mp:${s.id}:${g.name}`,g.shader,Gt),y=g.inputs.map((S,T)=>{const P=E.get(S);if(!P)throw new Error(`computeDiff: pass "${g.name}" input "${S}" not produced yet`);return{binding:T,resource:P}});g.uniforms&&y.push(...g.uniforms(d));let k;try{k=e.createBindGroup(M,y),e.renderFullscreen(w,M,k)}finally{(x=k==null?void 0:k.destroy)==null||x.call(k)}}const p=E.get(v.final);if(!p)throw new Error(`computeDiff: final ref "${v.final}" not produced`);for(const g of m)g!==p&&g.destroy();return p}catch(p){for(const g of m)g.destroy();throw p}}const ua=8,fa=256*1024*1024;class da{constructor(t=ua,n=fa){ce(this,"map",new Map);ce(this,"totalBytes",0);this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}accountReadbackBytes(t,n){let r=!1;for(const o of this.map.values())if(o===t){r=!0;break}r&&(t.bytes+=n,this.totalBytes+=n,this.evict())}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const ro=new WeakMap;function oo(e){let t=ro.get(e);return t||(t=new da,ro.set(e,t)),t}function pa(e,t){const n=Fr(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function ha(e,t,n,r,o){const i=ot(n),s=i?pa(i,r):"",l=o?Es(o):"";return`${e}|${t}|${n}|${s}|${l}`}function ma(e,t,n,r,o,i,s,l){const c=ot(r);if(!c)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const u=oo(e),h=l??kt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),b=ha(i,s,r,o,h),d=u.get(b);if(d)return d;const v=la(e,t,n,r,o,h),E=h.result.w,m=h.result.h,_={texture:v,width:E,height:m,displayRange:c.displayRange,bytes:E*m*8};return u.set(b,_),_}async function ga(e,t,n,r,o){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=rr(e,n,r,o).then(i=>(t.scalars=i,i))),t.scalarsPending)}async function xa(e,t){return t.resultSamples?t.resultSamples:(t.resultSamplesPending||(t.resultSamplesPending=e.readback(t.texture).then(n=>{const r=n instanceof Float32Array?n:Float32Array.from(n);return t.resultSamples=r,oo(e).accountReadbackBytes(t,r.byteLength),r})),t.resultSamplesPending)}const ba=`
${$e}
${dt}
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
`,va={unit:0,signed:1,relative:2},wa={linear:0,signed:1,positive:2};function ya(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function Ea(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function _a(e,t,n,r,o){var v,E,m;const i=Ea(t),s=wn(e,"diff-display",ba,i),l=ya(e,o.colormap),c=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),u=new Float32Array([va[r],wa[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]),h=new Float32Array([o.exposureEV??0,o.offset??0,0,0]),b=new Float32Array([((v=o.sourceDims)==null?void 0:v.w)??0,((E=o.sourceDims)==null?void 0:E.h)??0,0,0]);let d;try{d=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:l},{binding:2,resource:{uniform:c}},{binding:3,resource:{uniform:u}},{binding:4,resource:{uniform:h}},{binding:5,resource:{uniform:b}}]),e.renderFullscreen(t,s,d)}finally{(m=d==null?void 0:d.destroy)==null||m.call(d),l.destroy()}}const so=.6*.6*2.51,Ma=.6*.03,Sa=0,io=.6*.6*2.43,Ta=.6*.59,Pa=.14;function ao(e){const t=(Ma-Ta*e)/(so-io*e),n=(Sa-Pa*e)/(so-io*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const Aa=.85,Ra=.85,co=11920928955078125e-23,yn=[.2126,.7152,.0722];function Ca(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function ka(e,t,n,r=3,o={}){const i=t*n,s=ao(Aa),l=ao(Ra),c=new Float64Array(i);let u=0;for(let p=0;p<i;p++){const[g,w,M]=Ca(e,p,r),y=g*yn[0]+w*yn[1]+M*yn[2];c[p]=y,y>u&&(u=y)}const h=Float64Array.from(c).sort(),b=i>>1,d=i%2===1?h[b]:h[b-1],v=Math.max(d,co),E=Math.max(u,co),m=o.startExposure??Math.log2(s/E),_=o.stopExposure??Math.log2(l/v),x=Math.max(2,Math.ceil(_-m));return{startExposure:m,stopExposure:_,numExposures:x}}const Da={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function La({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:i,zoom:s,pan:l,onViewportChange:c,processing:u=Da,interpolation:h="auto",label:b="",isDraggable:d=!1,onDragStart:v,overlay:E,overlaySettings:m,pixelValueNotation:_="decimal"}){var de,pe;const x=a.useRef(null),[p,g]=a.useState(null),[w,M]=a.useState(null),[y,k]=a.useState(_),[S,T]=a.useState(!1),P=a.useRef(null),D=a.useRef(null),R=a.useRef(null),A=a.useRef(null),[V,L]=a.useState(0);a.useEffect(()=>{if(!e){R.current=null,L(oe=>oe+1);return}let re=!1;return it(e).then(oe=>{re||(R.current=oe,L($=>$+1))}),()=>{re=!0}},[e]),a.useEffect(()=>{if(!t){A.current=null,L(oe=>oe+1);return}let re=!1;return it(t).then(oe=>{re||(A.current=oe,L($=>$+1))}),()=>{re=!0}},[t]);const B=re=>(oe,$,he)=>{const Se=re.current;if(!Se||oe<0||$<0||oe>=Se.width||$>=Se.height)return null;const le=($*Se.width+oe)*4,Ee=Se.data[le],Pe=Se.data[le+1],De=Se.data[le+2],be=(.299*Ee+.587*Pe+.114*De)/255;return Ee===Pe&&Pe===De?{lines:[ft(Ee,"uint8",he)],luminance:be}:{lines:[ft(Ee,"uint8",he),ft(Pe,"uint8",he),ft(De,"uint8",he)],luminance:be,colors:[At[0],At[1],At[2]]}},F=a.useMemo(()=>B(R),[]),O=a.useMemo(()=>B(A),[]),J=!!E&&!!(m!=null&&m.enabled)&&!!p&&!!e&&((((de=E.boxes)==null?void 0:de.length)??0)>0||(((pe=E.masks)==null?void 0:pe.length)??0)>0),{gammaFilterId:N,filterStr:ue,gamma:q,offset:ee}=ur(u),fe=`translate(${l.x}px, ${l.y}px) scale(${s})`,Z=h==="auto"?void 0:h,{containerProps:te,modifierActive:Ce}=Yn({containerRef:x,zoom:s,pan:l,onViewportChange:c});return f.jsxs("div",{className:"relative flex flex-col h-full",children:[f.jsx(fr,{id:N,gamma:q,offset:ee}),f.jsxs("div",{ref:x,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...te.style},onPointerDown:te.onPointerDown,onPointerMove:te.onPointerMove,onPointerUp:te.onPointerUp,onPointerCancel:te.onPointerCancel,children:[f.jsxs("div",{className:"relative w-full h-full",children:[f.jsxs("div",{className:"relative w-full h-full",style:{transform:fe,transformOrigin:"0 0"},children:[f.jsx("img",{ref:P,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:ue,imageRendering:Z,...n==="blend"?{opacity:o}:{}},onLoad:re=>{const oe=re.currentTarget;g({w:oe.naturalWidth,h:oe.naturalHeight})}}),J&&f.jsx(sn,{data:E,settings:m,naturalWidth:p.w,naturalHeight:p.h})]}),f.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:f.jsx("div",{className:"w-full h-full",style:{transform:fe,transformOrigin:"0 0"},children:f.jsx("img",{ref:D,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:ue,imageRendering:Z,...n==="blend"?{opacity:1-o}:{}},onLoad:re=>{const oe=re.currentTarget;M({w:oe.naturalWidth,h:oe.naturalHeight})}})})}),n==="split"&&f.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${r*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:()=>i==null?void 0:i(.5),onPointerDown:re=>{re.stopPropagation(),re.preventDefault();const oe=re.currentTarget;try{oe.setPointerCapture(re.pointerId)}catch{}const he=oe.parentElement.getBoundingClientRect(),Se=Ee=>{i==null||i(Math.max(0,Math.min(1,(Ee.clientX-he.left)/he.width)))},le=()=>{window.removeEventListener("pointermove",Se),window.removeEventListener("pointerup",le)};window.addEventListener("pointermove",Se),window.addEventListener("pointerup",le)},children:f.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})]}),n==="split"?f.jsxs(f.Fragment,{children:[t&&w&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:f.jsx(ut,{imageElRef:D,naturalWidth:w.w,naturalHeight:w.h,zoom:s,pan:l,sample:O,notation:y,version:V})}),e&&p&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:f.jsx(ut,{imageElRef:P,naturalWidth:p.w,naturalHeight:p.h,zoom:s,pan:l,sample:F,notation:y,version:V,onActiveChange:T})})]}):e&&p&&f.jsx(ut,{imageElRef:P,naturalWidth:p.w,naturalHeight:p.h,zoom:s,pan:l,sample:F,notation:y,version:V,onActiveChange:T}),S&&f.jsx(qn,{notation:y,onChange:k})]}),n==="split"&&f.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),f.jsxs("span",{className:`absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${d&&!Ce?" cairn-drag-grip":""}`,draggable:d&&!Ce,onDragStart:v,style:{cursor:d&&!Ce?"grab":void 0},children:[f.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50"}),b]})]})}function Ba(){return f.jsx("div",{className:"card p-4 text-sm text-red-400 h-full flex items-center justify-center text-center",children:"Plot error: float URL sources need the GPU compare (WebGPU) — unavailable here"})}function Oa({mode:e,kernel:t,kernelOptions:n,onSlide:r,onBlend:o,onKernel:i,onSide:s}){return{id:"compare-mode",title:"Compare / diff mode",menu:{options:[...s?[{id:"side",label:"Side"}]:[],{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...n],value:e==="side"?"side":e==="split"?"slide":e==="blend"?"blend":t,onSelect:u=>{u==="side"?s==null||s():u==="slide"?r():u==="blend"?o():i(u)}}}}function Ia(e){const t=Ht(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function Na(e){const{width:t,height:n,channels:r}=e,o=t*n;if(e.precision==="f16-bits"){const c=e.data,u=new Uint16Array(o*4);for(let h=0;h<o;h++){const b=h*r,d=h*4;if(r===1){const v=c[b];u[d]=v,u[d+1]=v,u[d+2]=v,u[d+3]=St}else u[d]=c[b],u[d+1]=c[b+1],u[d+2]=c[b+2],u[d+3]=r>=4?c[b+3]:St}return{data:u,format:"rgba16float"}}const i=e.data,s=new Float32Array(o*4),l=c=>Number.isFinite(c)?c:0;for(let c=0;c<o;c++){const u=c*r;let h,b,d,v=1;r===1?h=b=d=l(i[u]):r===3?(h=l(i[u]),b=l(i[u+1]),d=l(i[u+2])):(h=l(i[u]),b=l(i[u+1]),d=l(i[u+2]),v=l(i[u+3]));const E=c*4;s[E]=h,s[E+1]=b,s[E+2]=d,s[E+3]=v}return{data:s,format:"rgba32float"}}function Fa({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:i,blendAlpha:s,onSplitPositionChange:l,diffSubmode:c,colormap:u="none",align:h="top-left",fit:b="crop",diffKernel:d,onDiffKernelChange:v,onCompareModeChange:E,onRequestSide:m,zoom:_,pan:x,onViewportChange:p,interpolation:g="auto",label:w="",pixelValueNotation:M="decimal"}){var gt;const y=a.useRef(null),k=a.useRef(null),S=a.useRef(null),T=a.useRef(null),P=a.useRef(null),[D,R]=a.useState(!1),[A,V]=a.useState(!1),[L,B]=a.useState(null),[F,O]=a.useState(null),[J,N]=a.useState(0),[ue,q]=a.useState(0),[ee,fe]=a.useState(null),[Z,te]=a.useState({x:0,y:0,w:1,h:1}),Ce=d??c??"absolute",[de,pe,re]=ct(Ce);a.useEffect(()=>{pe(d??c??"absolute")},[d,c,pe]);const oe=a.useCallback(C=>{pe(C),v==null||v(C)},[v,pe]);a.useEffect(()=>{const C=y.current;if(C)return C.__cairnDiffKernel={current:de,set:oe},()=>{C&&delete C.__cairnDiffKernel}},[de,oe]);const[$,he,Se]=ct(o);a.useEffect(()=>{he(o)},[o,he]);const le=a.useCallback(C=>{he(C),E==null||E(C)},[E,he]),[Ee,Pe,De]=ct(u);a.useEffect(()=>{Pe(u)},[u,Pe]);const be=a.useCallback(()=>{le(Se.default),Pe(De.default),oe(re.default)},[le,Pe,oe,Se.default,De.default,re.default]),Be=Se.isModified||De.isModified||re.isModified,[Te,ke]=a.useState(0),[U,me]=a.useState(0),Ae=a.useMemo(()=>{const W=[Oa({mode:$,kernel:de,kernelOptions:to().map(H=>({id:H.id,label:H.label})),onSide:m,onSlide:()=>le("split"),onBlend:()=>le("blend"),onKernel:H=>{le("diff"),oe(H)}})];return $==="diff"&&W.push(hn(Ee,H=>Pe(H))),W},[$,de,Ee,oe,le,m]),ve=a.useRef(null),ie=a.useRef(null),xe=a.useRef(null),Fe=a.useRef(null),[Ve,_e]=a.useState(0),Le=a.useRef(null),Me=a.useRef(null),[z,X]=a.useState(0),j=on();a.useEffect(()=>{const C=S.current;if(!C)return;let W=!1;return yt().then(H=>{if(!W)try{if(sr())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const G=H.createSurface(C,{hdr:!1});T.current={device:H,surface:G,texA:null,texB:null},V(!0)}catch(G){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",G),R(!0)}}).catch(H=>{W||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",H),R(!0))}),()=>{var G,ne;W=!0;const H=T.current;H&&((G=H.texA)==null||G.destroy(),(ne=H.texB)==null||ne.destroy(),T.current=null)}},[]),a.useEffect(()=>{const C=y.current;if(!C)return;const W=new ResizeObserver(()=>q(H=>H+1));return W.observe(C),()=>W.disconnect()},[]),a.useEffect(()=>{if(!A)return;let C=!1;if(!T.current)return;async function H(G,ne){if(ne){const we=Na(ne);return{width:ne.width,height:ne.height,imageData:null,make:Re=>{const ge=Re.createTexture(ne.width,ne.height,we.format);return ge.write(we.data),ge}}}if(!G)return null;const ae=await it(G);return ae?{width:ae.width,height:ae.height,imageData:ae,make:we=>{const Re=we.createTexture(ae.width,ae.height,"rgba8unorm");return Re.write(ae.data),Re}}:null}return Promise.all([H(e,n),H(t,r)]).then(([G,ne])=>{var ze,Ye;if(C||!T.current)return;const ae=T.current;ve.current=(G==null?void 0:G.imageData)??null,ie.current=(ne==null?void 0:ne.imageData)??null,xe.current=n??null,Fe.current=r??null,(ze=ae.texA)==null||ze.destroy(),(Ye=ae.texB)==null||Ye.destroy(),ae.texA=null,ae.texB=null;const we=G??ne;if(!we){B(null),O(null),_e(We=>We+1);return}const Re=ne??we,ge=G??we;ae.texA=Re.make(ae.device),ae.texB=ge.make(ae.device),O({a:{w:Re.width,h:Re.height},b:{w:ge.width,h:ge.height}}),B({w:we.width,h:we.height}),_e(We=>We+1),N(We=>We+1)}),()=>{C=!0}},[A,e,t,n,r]);const I=n!=null||r!=null,Y=a.useMemo(()=>aa(de,I),[de,I]),K=a.useMemo(()=>{if(!I)return null;const C=r??n;if(!C)return null;const W=C.precision==="f16-bits"?Gn(C.data):C.data;return ka(W,C.width,C.height,C.channels)},[I,r,n]),Ue=a.useMemo(()=>{var C;return Go(((C=ot(Y))==null?void 0:C.displayRange)??"unit",Ee==="none"?null:Ee)},[Y,Ee]),Ie=a.useMemo(()=>Ee!=="none"?Ia(Ee):void 0,[Ee]),Ge=a.useMemo(()=>F?kt(F.a,F.b,h,b,"b"):null,[F,h,b]),se=a.useMemo(()=>L?$==="diff"&&Ge?Ge.result:L:null,[$,Ge,L]),Xe=a.useCallback(()=>{const C=T.current;if(!A||!C||!C.surface||!C.texA||!C.texB||!L)return;const W=se??L,H=y.current,G=H?H.getBoundingClientRect():{width:W.w,height:W.h},ne=Ir({zoom:_,pan:x},G,W.w,W.h);te(ge=>ge.x===ne.x&&ge.y===ne.y&&ge.w===ne.w&&ge.h===ne.h?ge:ne);const ae=S.current;if(G.width>0&&G.height>0&&ae&&C.surface){const ge=Math.max(1,Math.round(G.width*j)),ze=Math.max(1,Math.round(G.height*j));(ae.width!==ge||ae.height!==ze)&&(ae.width=ge,ae.height=ze,C.surface.configure(ge,ze))}const we=Nr(ne,G,W.w,W.h)>=an?"nearest":"linear",Re=ne;try{if($==="diff"){const ge=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",ze=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",Ye=ot(Y)?Y:"absolute",We=Ye==="hdr-flip"&&K?{ppd:67,startExposure:K.startExposure,stopExposure:K.stopExposure,numExposures:K.numExposures}:void 0,xt=ma(C.device,C.texA,C.texB,Ye,We,ge,ze,Ge??void 0);P.current=xt,_a(C.device,C.surface,xt.texture,xt.displayRange,{uv:Re,cmapMode:Ue,colormap:Ie,filter:we,exposureEV:Te,offset:U})}else{const ge={exposureEV:Te,offset:U,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:Re,filter:we,mode:$,split:i,alpha:s};Ts(C.device,C.surface,C.texA,C.texB,ge)}}catch(ge){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",ge),R(!0)}},[A,L,se,Ge,_,x.x,x.y,$,i,s,Te,U,de,Y,K,Ue,Ie,e,t,n,r,j]);a.useEffect(()=>{Xe()},[Xe,J,ue]);const He=t!=null||r!=null;a.useEffect(()=>{const C=T.current;if(!A||!C||!C.texA||!C.texB||!He){fe(null);return}let W=!1;const H=C.texA,G=C.texB,ne=P.current,ae=$==="diff"?Ge??void 0:void 0;return($==="diff"&&ne?ga(C.device,ne,H,G,ae):rr(C.device,H,G,ae)).then(Re=>{W||fe(Re)}),()=>{W=!0}},[A,J,He,$,de,Ge]),a.useEffect(()=>{if($!=="diff"){Le.current=null,Me.current=null;return}const C=T.current,W=P.current;if(!A||!C||!W)return;let H=!1;return Le.current=null,Me.current=null,X(G=>G+1),xa(C.device,W).then(G=>{H||(Le.current=G,Me.current={w:W.width,h:W.height},X(ne=>ne+1))}).catch(()=>{}),()=>{H=!0}},[A,$,Y,J,Ge]);const vt=(C,W)=>(H,G,ne)=>{const ae=W.current;if(ae){const{data:xt,width:lo,height:za,channels:uo}=ae;if(H<0||G<0||H>=lo||G>=za)return null;const zt=(G*lo+H)*uo,Vt=ae.precision==="f16-bits"?Mn=>Tt(xt[Mn]??0):Mn=>xt[Mn]??0,Va=.5,$a=uo===1?[Vt(zt)]:[Vt(zt),Vt(zt+1),Vt(zt+2)];return lt($a,"unit",ne,Va)}const we=C.current;if(!we||H<0||G<0||H>=we.width||G>=we.height)return null;const Re=(G*we.width+H)*4,ge=we.data[Re],ze=we.data[Re+1],Ye=we.data[Re+2],We=(.299*ge+.587*ze+.114*Ye)/255;return lt(ge===ze&&ze===Ye?[ge]:[ge,ze,Ye],"uint8",ne,We)},et=a.useMemo(()=>vt(ve,xe),[]),mt=a.useMemo(()=>vt(ie,Fe),[]),st=a.useMemo(()=>(C,W,H)=>{var We;const G=Le.current,ne=Me.current;if(!G||!ne)return null;const{w:ae,h:we}=ne;if(C<0||W<0||C>=ae||W>=we)return null;const Re=(W*ae+C)*4,ge=((We=ot(Y))==null?void 0:We.output)??"per-channel",ze=.5,Ye=ge==="scalar"?[G[Re]??0]:[G[Re]??0,G[Re+1]??0,G[Re+2]??0];return lt(Ye,"unit",H,ze)},[Y]);a.useEffect(()=>{const C=y.current;if(C)return C.__cairnCompareProbe={sampleDiff:(W,H,G="decimal")=>st(W,H,G),sampleFg:(W,H,G="decimal")=>et(W,H,G),sampleRef:(W,H,G="decimal")=>mt(W,H,G),get diffSamples(){return Le.current},get dims(){return se},get primaryDims(){return L},get diffResultDims(){return Me.current},get align(){return h},get fit(){return b},get resolvedKernelId(){return Y},get compareMode(){return $}},()=>{C&&delete C.__cairnCompareProbe}},[st,et,mt,L,se,h,b,Y,$]);const En=g==="auto"?void 0:g;if(D)return n!=null||r!=null?f.jsx(Ba,{}):$==="diff"?f.jsx(mn,{imageUrl:e,baselineUrl:t,diffMode:((gt=ot(Y))==null?void 0:gt.kind)==="pointwise"?Y:"absolute",interpolation:g,colormap:Ee,showAxes:!1,zoom:_,pan:x,onViewportChange:p,label:w,pixelValueNotation:M}):f.jsx(La,{imageUrl:e,baselineUrl:t,mode:$,splitPosition:i,blendAlpha:s,onSplitPositionChange:l,zoom:_,pan:x,onViewportChange:p,interpolation:g,label:w,pixelValueNotation:M});const _n=f.jsxs(f.Fragment,{children:[f.jsx("canvas",{ref:S,className:"w-full h-full block",style:{imageRendering:En},"data-gpu-compare-canvas":!0}),$==="split"&&f.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${i*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:C=>{C.stopPropagation(),l==null||l(.5)},onPointerDown:C=>{C.stopPropagation(),C.preventDefault();const W=C.currentTarget;try{W.setPointerCapture(C.pointerId)}catch{}const G=W.parentElement.getBoundingClientRect(),ne=we=>{l==null||l(Math.max(0,Math.min(1,(we.clientX-G.left)/G.width)))},ae=()=>{window.removeEventListener("pointermove",ne),window.removeEventListener("pointerup",ae)};window.addEventListener("pointermove",ne),window.addEventListener("pointerup",ae)},children:f.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})]});return f.jsx(Bt,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":A},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:y,wrapperRef:k,zoom:_,pan:x,onViewportChange:p,naturalDims:se,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:_n,showAxes:!1,notationSeed:M,onReset:be,extraModified:Be,exportCanvasRef:S,requestRender:Xe,leadingMenus:Ae,displayAdjust:{exposureEV:Te,offset:U,onExposureChange:ke,onOffsetChange:me},label:"",showLabelChip:!1,overlay:{render:({notation:C,setOverlayActive:W})=>$==="split"?f.jsxs(f.Fragment,{children:[He&&se&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-i)*100}% 0 0)`},children:f.jsx(ut,{imageElRef:S,naturalWidth:se.w,naturalHeight:se.h,zoom:_,pan:x,sourceWindow:Z,sample:mt,notation:C,version:Ve})}),He&&se&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${i*100}%)`},children:f.jsx(ut,{imageElRef:S,naturalWidth:se.w,naturalHeight:se.h,zoom:_,pan:x,sourceWindow:Z,sample:et,notation:C,version:Ve,onActiveChange:W})})]}):se&&f.jsx(ut,{imageElRef:S,naturalWidth:se.w,naturalHeight:se.h,zoom:_,pan:x,sourceWindow:Z,sample:$==="diff"?st:et,notation:C,version:$==="diff"?z:Ve,onActiveChange:W})},extraChips:f.jsxs(f.Fragment,{children:[$==="split"&&f.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),w?f.jsx("span",{className:"absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm",children:w}):null,ee&&f.jsxs("span",{className:`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${w?"bottom-7":"bottom-1"}`,"data-gpu-compare-metrics":!0,children:["MSE ",ee.mse.toExponential(2)," · PSNR ",Number.isFinite(ee.psnr)?ee.psnr.toFixed(1):"∞"," dB · MAE"," ",ee.mae.toExponential(2)]})]})})}const Ua="cairn-plot:gpu-image-ready";async function Ga(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await yt(),window.__cairnPlotGpuImagePane=Bi,window.__cairnPlotGpuComparePane=Fa,window.__cairnPlotDiffMenuModes=to(),window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(Ua))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e),Or("no-webgpu")}}}Ga()})(__cairnPlotJsxRuntime,__cairnPlotReact);
