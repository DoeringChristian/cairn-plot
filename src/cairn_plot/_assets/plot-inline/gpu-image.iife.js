var Oi=Object.defineProperty;var Ii=(f,i,tt)=>i in f?Oi(f,i,{enumerable:!0,configurable:!0,writable:!0,value:tt}):f[i]=tt;var ie=(f,i,tt)=>Ii(f,typeof i!="symbol"?i+"":i,tt);(function(f,i){"use strict";const tt=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function _n(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:tt}),{hdr:!1,format:n}}function co(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:tt}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:tt}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return _n(e,t)}}}const lo=`
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
`,uo=`
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
`;function Vt(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Mn(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function fo(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const po={texture:0,sampler:1,uniform:2};function $t(e,t){return e*3+po[t]}const ho={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function mo(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),a=r[2]!==void 0,s=r[3].trim();if(a){const c=ho[s];if(c===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${s}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:c})}else s==="sampler"||s==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class Sn{constructor(t,n,r,o){ie(this,"width");ie(this,"height");ie(this,"format");ie(this,"gpuTexture");ie(this,"device");ie(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:Vt(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*Mn(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class Tn{constructor(t){ie(this,"_s");ie(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class go{constructor(t,n,r,o,a){ie(this,"_p");ie(this,"gpuPipeline");ie(this,"bindings");ie(this,"bindGroupLayout");ie(this,"variants");ie(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=a,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function xo(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class bo{constructor(t){ie(this,"_c");ie(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class vo{constructor(t,n,r,o,a){ie(this,"width");ie(this,"height");ie(this,"paramsBuffer");ie(this,"bindGroup");ie(this,"buffers");ie(this,"destroyed",!1);this.width=t,this.height=n,this.buffers=r,this.paramsBuffer=o,this.bindGroup=a}destroy(){if(!this.destroyed){for(const t of this.buffers)t.destroy();this.paramsBuffer.destroy(),this.destroyed=!0}}}class wo{constructor(t,n){ie(this,"_b");ie(this,"gpuBindGroup");ie(this,"ownedBuffers");ie(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class yo{constructor(t,n,r,o){ie(this,"canvas");ie(this,"hdr");ie(this,"format");ie(this,"context");ie(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function vt(e){return"canvas"in e}async function Eo(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function a(h){return vt(h)?h.getCurrentTextureView():h.gpuTexture.createView()}function s(h){if(vt(h))return{width:h.canvas.width,height:h.canvas.height};const w=h;return{width:w.width,height:w.height}}let c=!1,l=null;function u(){var w,E;if(l!==null)return l;let h=!1;try{if(typeof document<"u"){const T=document.createElement("canvas");T.width=1,T.height=1;const v=T.getContext("webgpu");if(v)try{v.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:GPUTextureUsage.RENDER_ATTACHMENT});const D=(w=v.getConfiguration)==null?void 0:w.call(v);h=((E=D==null?void 0:D.toneMapping)==null?void 0:E.mode)==="extended"}catch{h=!1}finally{try{v.unconfigure()}catch{}}}}catch{h=!1}return l=h,h}const p=256;let x=null,d=null;function b(){if(!x||!d){const h=t.createShaderModule({code:lo});d=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const w=t.createPipelineLayout({bindGroupLayouts:[d]});x=t.createComputePipeline({layout:w,compute:{module:h,entryPoint:"cs_main"}})}return{pipeline:x,layout:d}}let y=null,m=null;function _(){if(!y||!m){const h=t.createShaderModule({code:uo});m=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});const w=t.createPipelineLayout({bindGroupLayouts:[m]});y=t.createRenderPipeline({layout:w,vertex:{module:h,entryPoint:"vs_main"},fragment:{module:h,entryPoint:"fs_main",targets:[{format:"rgba16float"}]},primitive:{topology:"triangle-list"}})}return{pipeline:y,layout:m}}return{backend:"webgpu",capabilities:n,probeExtendedToneMapping:u,createTexture(h,w,E){return new Sn(t,h,w,E)},createSampler(h){const w=(h==null?void 0:h.filter)==="linear"?"linear":"nearest",E=t.createSampler({magFilter:w,minFilter:w,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new Tn(E)},createRenderPipeline(h){const w=t.createShaderModule({code:h.shaderWGSL}),E=mo(h.shaderWGSL),T=Vt(h.targetFormat),v=xo(t,E),D=t.createPipelineLayout({bindGroupLayouts:[v]}),M=S=>t.createRenderPipeline({layout:D,vertex:{module:w,entryPoint:"vs_main"},fragment:{module:w,entryPoint:"fs_main",targets:[{format:S}]},primitive:{topology:"triangle-list"}}),P=M(T);return new go(P,E,v,T,M)},createComputePipeline(h){const w=t.createShaderModule({code:h.shaderWGSL}),E=t.createComputePipeline({layout:"auto",compute:{module:w,entryPoint:"cs_main"}});return new bo(E)},createBindGroup(h,w){const E=h,T=new Map,v=[];for(const[M,P]of E.bindings)if(P.kind==="uniform"){const S=t.createBuffer({size:P.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});v.push(S),T.set(M,{binding:M,resource:{buffer:S}})}else P.kind==="sampler"&&T.set(M,{binding:M,resource:o()});for(const M of w){const P=M.resource;if(P instanceof Sn){const S=$t(M.binding,"texture");E.bindings.has(S)&&T.set(S,{binding:S,resource:P.gpuTexture.createView()})}else if(P instanceof Tn){const S=$t(M.binding,"sampler");E.bindings.has(S)&&T.set(S,{binding:S,resource:P.gpuSampler})}else{const S=$t(M.binding,"uniform"),k=E.bindings.get(S);if(k&&k.kind==="uniform"){const C=P.uniform,A=t.createBuffer({size:Math.max(k.sizeBytes,C.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(A,0,C.buffer,C.byteOffset,C.byteLength),v.push(A),T.set(S,{binding:S,resource:{buffer:A}})}}}const D=t.createBindGroup({layout:E.bindGroupLayout,entries:Array.from(T.values())});return new wo(D,v)},createSurface(h,w){const E=h.getContext("webgpu");if(!E)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const T=w.hdr&&n.hdr,v=()=>T?co(E,t):_n(E,t),D=v();return new yo(h,E,D,v)},renderFullscreen(h,w,E){const T=w,v=E,D=a(h),{width:M,height:P}=s(h),S=vt(h)?h.format:Vt(h.format),k=T.pipelineFor(S),C=t.createCommandEncoder(),A=C.beginRenderPass({colorAttachments:[{view:D,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});A.setPipeline(k),A.setBindGroup(0,v.gpuBindGroup),A.setViewport(0,0,M,P,0,1),A.draw(3),A.end(),t.queue.submit([C.finish()])},createDeepSampleBuffers(h){const{layout:w}=_(),E=S=>{const k=t.createBuffer({size:S.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});return t.queue.writeBuffer(k,0,S.buffer,S.byteOffset,S.byteLength),k},T=E(h.offsets),v=E(h.colors),D=E(h.zs),M=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),P=t.createBindGroup({layout:w,entries:[{binding:0,resource:{buffer:T}},{binding:1,resource:{buffer:v}},{binding:2,resource:{buffer:D}},{binding:3,resource:{buffer:M}}]});return new vo(h.width,h.height,[T,v,D],M,P)},compositeDeep(h,w,E,T){const v=h,D=w,{pipeline:M}=_();t.queue.writeBuffer(v.paramsBuffer,0,new Float32Array([v.width,v.height,T,E]));const P=t.createCommandEncoder(),S=P.beginRenderPass({colorAttachments:[{view:D.gpuTexture.createView(),loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});S.setPipeline(M),S.setBindGroup(0,v.bindGroup),S.setViewport(0,0,D.width,D.height,0,1),S.draw(3),S.end(),t.queue.submit([P.finish()])},async readback(h){const w=vt(h),{width:E,height:T}=s(h),v=w?h.hdr?"rgba16float":"rgba8unorm":h.format,D=w&&h.format==="bgra8unorm",M=w?h.getCurrentGPUTexture():h.gpuTexture,P=Mn(v),S=E*P,k=256,C=Math.ceil(S/k)*k,A=C*T,V=t.createBuffer({size:A,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),L=t.createCommandEncoder();L.copyTextureToBuffer({texture:M},{buffer:V,bytesPerRow:C,rowsPerImage:T},{width:E,height:T,depthOrArrayLayers:1}),t.queue.submit([L.finish()]),await V.mapAsync(GPUMapMode.READ);const B=new Uint8Array(V.getMappedRange()),O=new Uint8Array(S*T);for(let I=0;I<T;I++){const G=I*C,Y=I*S;O.set(B.subarray(G,G+S),Y)}if(V.unmap(),V.destroy(),v==="rgba8unorm"){if(D)for(let I=0;I<O.length;I+=4){const G=O[I],Y=O[I+2];O[I]=Y,O[I+2]=G}return O}if(v==="rgba16float"){const I=new Uint16Array(O.buffer,O.byteOffset,O.byteLength/2),G=new Float32Array(I.length);for(let Y=0;Y<I.length;Y++)G[Y]=fo(I[Y]);return G}return new Float32Array(O.buffer,O.byteOffset,O.byteLength/4)},async reduceDiffSumSquaredAbs(h,w,E,T){const v=h,D=w,M=Math.max(0,E*T),P=Math.max(1,Math.ceil(M/p)),{pipeline:S,layout:k}=b(),C=P*2*4,A=t.createBuffer({size:C,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),V=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(V,0,new Uint32Array([Math.max(1,E),Math.max(1,T),M,0]));const L=t.createBindGroup({layout:k,entries:[{binding:0,resource:v.gpuTexture.createView()},{binding:1,resource:D.gpuTexture.createView()},{binding:2,resource:{buffer:A}},{binding:3,resource:{buffer:V}}]}),B=t.createBuffer({size:C,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),O=t.createCommandEncoder(),I=O.beginComputePass();I.setPipeline(S),I.setBindGroup(0,L),I.dispatchWorkgroups(P),I.end(),O.copyBufferToBuffer(A,0,B,0,C),t.queue.submit([O.finish()]),await B.mapAsync(GPUMapMode.READ);const Y=new Float32Array(B.getMappedRange()).slice();B.unmap(),B.destroy(),A.destroy(),V.destroy();let le=0,j=0;for(let ee=0;ee<P;ee++)le+=Y[ee*2],j+=Y[ee*2+1];return{sumSq:le,sumAbs:j}},destroy(){c||(t.destroy(),c=!0)},isContextLost(){return!1}}}let Xt=null;async function _o(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return Eo()}function wt(){return Xt||(Xt=_o()),Xt}function Mo(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function So(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),a=Math.floor(o),s=Math.min(a+1,e.length-1),c=o-a,[l,u,p]=Mo(e[a],e[s],c);t[n*3]=Math.round(l),t[n*3+1]=Math.round(u),t[n*3+2]=Math.round(p)}return t}const Pn={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},To=new Set(["red-green","red-blue"]),An=new Map;function Wt(e){let t=An.get(e);if(!t){const n=Pn[e]??Pn.viridis;t=So(n),An.set(e,t)}return t}const Ke=e=>e<0?0:e>1?1:e,Ht=e=>{const t=e<0?0:e;return t/(1+t)},Yt=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return Ke(n/r)},yt=4,Po=1,Ao=16,Co=.5,Cn={linear:([e,t,n])=>[Ke(e),Ke(t),Ke(n)],srgb:([e,t,n])=>[Ke(e),Ke(t),Ke(n)],reinhard:([e,t,n])=>[Ht(e),Ht(t),Ht(n)],aces:([e,t,n])=>[Yt(e),Yt(t),Yt(n)],extended:([e,t,n])=>[e,t,n]},Rn="srgb",Ro=["linear","srgb","reinhard","aces"],Do=["extended","extended-reinhard","extended-aces"],ko=["extended-reinhard","extended-aces"];function Dn(e){return!!e&&Do.includes(e)}function Lo(e){return!!e&&ko.includes(e)}const kn={extended:"linear","extended-reinhard":"reinhard","extended-aces":"aces"};function Bo(e){return e&&Cn[e]||Cn[Rn]}function Kt(e){return e&&kn[e]?kn[e]:e&&Ro.includes(e)?e:Rn}function Oo(e,t){return t?Dn(e)?e:"extended":Kt(e)}function Et(e,t,n){return e*2**t+n}function Io(e){const t=Ke(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function qt(e,t){return typeof t=="number"&&t>0?Ke(Math.pow(Ke(e),1/t)):Io(e)}function Zt(e,t,n="linear",r=0,o=0){const a=Wt(t),s=new ImageData(e.width,e.height),c=e.data,l=s.data,u=r!==0||o!==0;for(let p=0;p<c.length;p+=4){let x=(c[p]+c[p+1]+c[p+2])/3;u&&(x=Math.max(0,Math.min(255,Et(x/255,r,o)*255)));let d;n==="positive"?d=Math.round(128+x/255*127):d=Math.round(x),d=Math.max(0,Math.min(255,d)),l[p]=a[d*3],l[p+1]=a[d*3+1],l[p+2]=a[d*3+2],l[p+3]=c[p+3]}return s}function No(e,t){return e==="signed"||e==="relative"?"signed":Qt(t)}function Qt(e){return To.has(e??"")?"positive":"linear"}function Ln(e){const t=new Map;return{get(n){return t.get(n)},set(n,r){if(t.size>=e){const o=t.keys().next().value;o!==void 0&&t.delete(o)}t.set(n,r)}}}const Bn=Ln(50);function jt(e){return Bn.get(e)}function Jt(e,t){Bn.set(e,t)}const On=Ln(100);function Fo(e){return On.get(e)}function Uo(e,t){On.set(e,t)}function Go(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),a=new ImageData(r,o);for(let s=0;s<o;s++)for(let c=0;c<r;c++){const l=(s*e.width+c)*4,u=(s*t.width+c)*4,p=(s*r+c)*4;for(let x=0;x<3;x++){const d=e.data[l+x],b=t.data[u+x],y=d-b,m=Math.abs(y),_=Math.max(d,1);let g;switch(n){case"signed":g=(y+255)/2;break;case"absolute":g=m;break;case"squared":g=y*y/255;break;case"relative_signed":g=(y/_+1)*127.5;break;case"relative_absolute":g=m/_*255;break;case"relative_squared":g=y*y/(_*_)*255;break}a.data[p+x]=Math.min(255,Math.max(0,Math.round(g)))}a.data[p+3]=255}return a}async function at(e){const t=Fo(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const a=o.getContext("2d");if(!a){n(null);return}a.drawImage(r,0,0);const s=a.getImageData(0,0,o.width,o.height);Uo(e,s),n(s)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const zo={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},Vo={linear:0,signed:1,positive:2},$o=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,Xo=`#version 300 es
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
}`;let it=null,Q=null,Oe=null,_t=null;function Wo(){if(Q)return Q;try{if(typeof OffscreenCanvas<"u"?it=new OffscreenCanvas(1,1):it=document.createElement("canvas"),Q=it.getContext("webgl2",{preserveDrawingBuffer:!0}),!Q)return console.warn("[cairn] WebGL 2 not available"),null;const e=Q.createShader(Q.VERTEX_SHADER);if(Q.shaderSource(e,$o),Q.compileShader(e),!Q.getShaderParameter(e,Q.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",Q.getShaderInfoLog(e)),null;const t=Q.createShader(Q.FRAGMENT_SHADER);if(Q.shaderSource(t,Xo),Q.compileShader(t),!Q.getShaderParameter(t,Q.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",Q.getShaderInfoLog(t)),null;if(Oe=Q.createProgram(),Q.attachShader(Oe,e),Q.attachShader(Oe,t),Q.linkProgram(Oe),!Q.getProgramParameter(Oe,Q.LINK_STATUS))return console.error("[cairn] WebGL program link:",Q.getProgramInfoLog(Oe)),null;_t=Q.createVertexArray(),Q.bindVertexArray(_t);const n=Q.createBuffer();Q.bindBuffer(Q.ARRAY_BUFFER,n),Q.bufferData(Q.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),Q.STATIC_DRAW);const r=Q.getAttribLocation(Oe,"a_pos");return Q.enableVertexAttribArray(r),Q.vertexAttribPointer(r,2,Q.FLOAT,!1,0,0),Q.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),Q}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function In(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function Ho(e,t,n){const r=new Uint8Array(1024);for(let a=0;a<256;a++)r[a*4]=t[a*3],r[a*4+1]=t[a*3+1],r[a*4+2]=t[a*3+2],r[a*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function Yo(e,t,n,r){const o=Wo();if(!o||!Oe||!_t||!it)return null;const a=Math.min(e.width,t.width),s=Math.min(e.height,t.height);it.width=a,it.height=s,o.viewport(0,0,a,s);const c=In(o,e,0),l=In(o,t,1);let u=null;n.colormap?u=Ho(o,n.colormap,2):(u=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,u),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(Oe),o.uniform1i(o.getUniformLocation(Oe,"u_baseline"),0),o.uniform1i(o.getUniformLocation(Oe,"u_other"),1),o.uniform1i(o.getUniformLocation(Oe,"u_lut"),2),o.uniform1i(o.getUniformLocation(Oe,"u_diff_mode"),zo[n.diffMode]),o.uniform1i(o.getUniformLocation(Oe,"u_cmap_mode"),Vo[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(Oe,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(_t),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=a,r.height=s;const p=r.getContext("2d");return p&&(p.save(),p.scale(1,-1),p.drawImage(it,0,0,a,s,0,-s,a,s),p.restore()),o.deleteTexture(c),o.deleteTexture(l),o.deleteTexture(u),{width:a,height:s}}const Ko="cairn:render-mode";function qo(){try{const e=localStorage.getItem(Ko);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const Mt=15360;function St(e){const t=e&32768?-1:1,n=e>>10&31,r=e&1023;return n===0?r===0?t*0:t*r*2**-24:n===31?r===0?t*(1/0):NaN:t*2**(n-15)*(1+r/1024)}const Nn=globalThis.Float16Array;function Fn(e,t=e.length){if(Nn){const r=new Nn(e.buffer,e.byteOffset,t);return Float32Array.from(r)}const n=new Float32Array(t);for(let r=0;r<t;r++)n[r]=St(e[r]);return n}const qe=new Uint32Array(512),Ze=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(qe[e]=0,qe[e|256]=32768,Ze[e]=24,Ze[e|256]=24):t<-14?(qe[e]=1024>>-t-14,qe[e|256]=1024>>-t-14|32768,Ze[e]=-t-1,Ze[e|256]=-t-1):t<=15?(qe[e]=t+15<<10,qe[e|256]=t+15<<10|32768,Ze[e]=13,Ze[e|256]=13):t<128?(qe[e]=31744,qe[e|256]=64512,Ze[e]=24,Ze[e|256]=24):(qe[e]=31744,qe[e|256]=64512,Ze[e]=13,Ze[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var xt=Uint8Array,Un=Uint16Array,Zo=Int32Array,Qo=new xt([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),jo=new xt([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),Gn=function(e,t){for(var n=new Un(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new Zo(n[30]),r=1;r<30;++r)for(var a=n[r];a<n[r+1];++a)o[a]=a-n[r]<<5|r;return{b:n,r:o}},zn=Gn(Qo,2),Jo=zn.b,es=zn.r;Jo[28]=258,es[258]=28,Gn(jo,0);for(var ts=new Un(32768),ve=0;ve<32768;++ve){var nt=(ve&43690)>>1|(ve&21845)<<1;nt=(nt&52428)>>2|(nt&13107)<<2,nt=(nt&61680)>>4|(nt&3855)<<4,ts[ve]=((nt&65280)>>8|(nt&255)<<8)>>1}for(var Tt=new xt(288),ve=0;ve<144;++ve)Tt[ve]=8;for(var ve=144;ve<256;++ve)Tt[ve]=9;for(var ve=256;ve<280;++ve)Tt[ve]=7;for(var ve=280;ve<288;++ve)Tt[ve]=8;for(var ns=new xt(32),ve=0;ve<32;++ve)ns[ve]=5;var rs=new xt(0),os=typeof TextDecoder<"u"&&new TextDecoder,ss=0;try{os.decode(rs,{stream:!0}),ss=1}catch{}const Vn=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function en(e){const t=Vn.length;return Vn[(e%t+t)%t]}function as(e){const n=i.useRef(null),[r,o]=i.useState({w:0,h:0}),a=i.useRef(null),s=i.useRef(null),c=i.useRef(null),l=i.useCallback((u,p)=>{o(x=>x.w===u&&x.h===p?x:{w:u,h:p})},[]);return i.useLayoutEffect(()=>{const u=n.current;if(!u||u===c.current)return;const p=u.getBoundingClientRect();(p.width>0||p.height>0)&&(c.current=u,l(p.width,p.height))}),i.useEffect(()=>{var x;const u=n.current;if(u===s.current||((x=a.current)==null||x.disconnect(),a.current=null,s.current=u,!u))return;const p=new ResizeObserver(d=>{for(const b of d)l(b.contentRect.width,b.contentRect.height)});a.current=p,p.observe(u)}),i.useEffect(()=>()=>{var u;return(u=a.current)==null?void 0:u.disconnect()},[]),{ref:n,size:r}}function is(){const[e,t]=i.useState(!1);return i.useEffect(()=>{const n=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!0)},r=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const cs=.001;function ls(e,t=cs){return Math.exp(-e*t)}function $n(e,t){return Math.hypot(e.x-t.x,e.y-t.y)}function Xn(e,t){return{x:(e.x+t.x)/2,y:(e.y+t.y)/2}}function us(e,t,n,r,o,a,s){const c=t>0&&r>0?r/t:1,l=Math.max(a,Math.min(s,e.zoom*c)),u=(n.x-e.pan.x)/e.zoom,p=(n.y-e.pan.y)/e.zoom;return{zoom:l,pan:{x:o.x-u*l,y:o.y-p*l}}}const fs=.25,tn=64;function nn(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return tn;const o=Math.min(n/e,r/t);return o<=0?tn:Math.max(Math.max(n,r)/o,8)}function Wn(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:a=fs,maxZoom:s=tn,naturalWidth:c,naturalHeight:l}=e,u=is(),p=i.useRef(u);p.current=u;const x=i.useRef({zoom:n,pan:r});x.current={zoom:n,pan:r};const d=i.useRef(o);d.current=o,i.useEffect(()=>{const M=t.current;if(!M||!o)return;const P=S=>{var Y;if(!S.ctrlKey&&!p.current)return;S.preventDefault(),S.stopPropagation();const k=ls(S.deltaY),C=x.current,A=M.getBoundingClientRect(),V=c&&l?nn(c,l,A.width,A.height):s,L=Math.max(a,Math.min(V,C.zoom*k));if(C.zoom===L)return;const B=S.clientX-A.left,O=S.clientY-A.top,I=B-(B-C.pan.x)/C.zoom*L,G=O-(O-C.pan.y)/C.zoom*L;(Y=d.current)==null||Y.call(d,{zoom:L,pan:{x:I,y:G}})};return M.addEventListener("wheel",P,{passive:!1}),()=>M.removeEventListener("wheel",P)},[t,!!o,a,s,c,l]);const b=i.useRef(new Map),y=i.useRef(null),m=i.useRef(null),_=i.useCallback((M,P,S)=>{const k=M.getBoundingClientRect();return{x:P-k.left,y:S-k.top}},[]),g=i.useCallback(M=>{if(!c||!l)return s;const P=M.getBoundingClientRect();return nn(c,l,P.width,P.height)},[c,l,s]),h=i.useCallback((M,P)=>{const S=b.current,k=S.get(M),C=S.get(P);!k||!C||(y.current=null,m.current={idA:M,idB:P,startDist:$n(k,C),startMid:Xn(k,C),startZoom:x.current.zoom,startPan:{...x.current.pan}})},[]),w=i.useCallback(M=>{const P=b.current.get(M);P&&(y.current={pointerId:M,startX:P.x,startY:P.y,panX:x.current.pan.x,panY:x.current.pan.y})},[]),E=i.useCallback(M=>{if(!d.current)return;const P=M.pointerType==="touch";if(!P&&!p.current)return;const S=M.currentTarget;if(S.setPointerCapture(M.pointerId),b.current.set(M.pointerId,_(S,M.clientX,M.clientY)),P&&b.current.size>=2){const k=[...b.current.keys()];h(k[k.length-2],k[k.length-1]);return}w(M.pointerId)},[_,h,w]),T=i.useCallback(M=>{var A,V;const P=M.currentTarget,S=b.current.get(M.pointerId);if(S){const L=_(P,M.clientX,M.clientY);S.x=L.x,S.y=L.y}const k=m.current;if(k){const L=b.current.get(k.idA),B=b.current.get(k.idB);if(!L||!B)return;const O=us({zoom:k.startZoom,pan:k.startPan},k.startDist,k.startMid,$n(L,B),Xn(L,B),a,g(P));(A=d.current)==null||A.call(d,O);return}const C=y.current;!C||C.pointerId!==M.pointerId||!S||(V=d.current)==null||V.call(d,{zoom:x.current.zoom,pan:{x:C.panX+(S.x-C.startX),y:C.panY+(S.y-C.startY)}})},[_,a,g]),v=i.useCallback(M=>{var S;try{M.currentTarget.releasePointerCapture(M.pointerId)}catch{}b.current.delete(M.pointerId);const P=m.current;if(P&&(M.pointerId===P.idA||M.pointerId===P.idB)){m.current=null;const k=[...b.current.keys()];k.length===1&&w(k[0]);return}((S=y.current)==null?void 0:S.pointerId)===M.pointerId&&(y.current=null)},[w]);return{containerProps:{onPointerDown:E,onPointerMove:T,onPointerUp:v,onPointerCancel:v,style:{cursor:u&&!!o?"move":void 0,touchAction:o?"none":void 0}},modifierActive:u}}function rn(){const[e,t]=i.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return i.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),a())};function a(){if(n)return;const s=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${s}dppx)`),r.addEventListener("change",o,{once:!0})}return a(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function ct(e){const t=i.useRef(e),[n,r]=i.useState(e),o=i.useCallback(()=>r(t.current),[]);return[n,r,{reset:o,isModified:!Object.is(n,t.current),default:t.current}]}function ds(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function Hn(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function on({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:a}=as(),s=i.useRef(null),c=i.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),l=i.useMemo(()=>{const m=a.w,_=a.h;if(m<=0||_<=0||n<=0||r<=0)return null;const g=Math.min(m/n,_/r),h=n*g,w=r*g;return{left:(m-h)/2,top:(_-w)/2,width:h,height:w}},[a.w,a.h,n,r]),u=e.masks,p=t.showMasks&&!!u&&u.length>0,x=i.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(i.useEffect(()=>{if(!p||!u)return;const m=s.current;if(!m)return;(m.width!==n||m.height!==r)&&(m.width=n,m.height=r);const _=m.getContext("2d");if(!_)return;_.clearRect(0,0,m.width,m.height);let g=!1;const h=_.createImageData(n,r),w=h.data;let E=u.length,T=!1;const v=()=>{g||T&&_.putImageData(h,0,0)},D=document.createElement("canvas");D.width=n,D.height=r;const M=D.getContext("2d",{willReadFrequently:!0});for(const P of u){const S=new Image;S.onload=()=>{if(!g){if(M){M.clearRect(0,0,n,r),M.drawImage(S,0,0,n,r);const k=M.getImageData(0,0,n,r).data;for(let C=0;C<n*r;C++){const A=k[C*4];if(A===0||c.has(A))continue;const[V,L,B]=ds(en(A));w[C*4]=V,w[C*4+1]=L,w[C*4+2]=B,w[C*4+3]=255,T=!0}}E-=1,E===0&&v()}},S.onerror=()=>{E-=1,E===0&&v()},S.src=`data:image/png;base64,${P.png_b64}`}return()=>{g=!0}},[p,u,n,r,x]),!l)return f.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const d=e.boxes??[],b=t.showBoxes&&d.length>0,y=e.class_labels??{};return f.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[p&&f.jsx("canvas",{ref:s,className:"absolute",style:{left:l.left,top:l.top,width:l.width,height:l.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),b&&f.jsx("svg",{className:"absolute",style:{left:l.left,top:l.top,width:l.width,height:l.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:d.map((m,_)=>{if(!Hn(m,t,c))return null;const g=m.domain==="pixel"?1:n,h=m.domain==="pixel"?1:r,w=m.position.minX*g,E=m.position.minY*h,T=(m.position.maxX-m.position.minX)*g,v=(m.position.maxY-m.position.minY)*h;return f.jsx("rect",{x:w,y:E,width:T,height:v,fill:"none",stroke:en(m.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},_)})}),b&&f.jsx("div",{className:"absolute",style:{left:l.left,top:l.top,width:l.width,height:l.height},children:d.map((m,_)=>{if(!Hn(m,t,c))return null;const g=m.domain==="pixel"?1/n:1,h=m.domain==="pixel"?1/r:1,w=m.position.minX*g*100,E=m.position.minY*h*100,T=m.label??y[String(m.class_id)]??`#${m.class_id}`,v=m.score!=null?` ${(m.score*100).toFixed(0)}%`:"";return!T&&!v?null:f.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${w}%`,top:`${E}%`,transform:"translateY(-100%)",backgroundColor:en(m.class_id)},children:f.jsxs("span",{className:"mono",children:[T,v]})},_)})})]})}const sn=30,Pt=["#ff5a5a","#39d353","#5b9bff"];function an(e){if(!Number.isFinite(e))return"0";const t=Math.abs(e);return t!==0&&(t<.001||t>=1e4)?e.toExponential(1):String(Number(e.toPrecision(3)))}function ft(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):an(e/255):an(n==="int"?e*255:e)}function lt(e,t,n,r){return e.length===1?{lines:[ft(e[0],t,n)],luminance:r}:{lines:e.map(o=>ft(o,t,n)),luminance:r,colors:e.map((o,a)=>Pt[a]??null)}}const ps={x:0,y:0,w:1,h:1};function ut({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:a,notation:s="decimal",version:c=0,onActiveChange:l,sourceWindow:u=ps}){const p=i.useRef(null),x=i.useRef(!1),d=rn(),b=i.useRef(l);b.current=l;const y=i.useCallback(_=>{var g;_!==x.current&&(x.current=_,(g=b.current)==null||g.call(b,_))},[]),m=i.useCallback(()=>{var ze;const _=p.current,g=e.current;if(!_)return;const h=window.devicePixelRatio||1,w=_.clientWidth,E=_.clientHeight;if(w===0||E===0)return;_.width!==Math.round(w*h)&&(_.width=Math.round(w*h)),_.height!==Math.round(E*h)&&(_.height=Math.round(E*h));const T=_.getContext("2d");if(!T)return;if(T.setTransform(h,0,0,h,0,0),T.clearRect(0,0,w,E),!g||t<=0||n<=0){y(!1);return}const v=g.getBoundingClientRect(),D=_.getBoundingClientRect();if(v.width===0||v.height===0){y(!1);return}const M=u.x*t,P=u.y*n,S=u.w*t,k=u.h*n;if(S<=0||k<=0){y(!1);return}const C=Math.min(v.width/S,v.height/k);if(C<sn){y(!1);return}const A=S*C,V=k*C,L=v.left+(v.width-A)/2-D.left,B=v.top+(v.height-V)/2-D.top,O=Math.max(Math.floor(M),Math.floor(M+(0-L)/C)),I=Math.min(Math.ceil(M+S),Math.ceil(M+(w-L)/C)),G=Math.max(Math.floor(P),Math.floor(P+(0-B)/C)),Y=Math.min(Math.ceil(P+k),Math.ceil(P+(E-B)/C));if(I<=O||Y<=G){y(!1);return}y(!0);const le=L+(0-M)*C,j=B+(0-P)*C,ee=L+(t-M)*C,pe=B+(n-P)*C;T.save(),T.beginPath(),T.rect(le,j,ee-le,pe-j),T.clip(),T.textAlign="center",T.textBaseline="middle",T.lineJoin="round";const me=C*.14,te=C-me*2;for(let he=G;he<Y;he++)for(let we=O;we<I;we++){if(we<0||he<0||we>=t||he>=n)continue;const ne=a(we,he,s);if(!ne||ne.lines.length===0)continue;const re=ne.lines.length;let $=1;for(const De of ne.lines)De.length>$&&($=De.length);const ue=te/(re*1.15),Me=te/($*.62)||ue,ce=Math.min(ue,Me,24);if(ce<6)continue;const ye=L+(we-M+.5)*C,Te=B+(he-P+.5)*C,Re=ce*1.15,Se=ne.luminance<=.55,Ie=Se?"#ffffff":"#000000";T.font=`${ce}px ui-monospace, SFMono-Regular, Menlo, monospace`,T.lineWidth=Math.max(1.4,ce*.16),T.strokeStyle=Se?"rgba(0,0,0,0.85)":"rgba(255,255,255,0.9)";let Pe=Te-re*Re/2+Re/2;for(let De=0;De<ne.lines.length;De++){const F=ne.lines[De];T.strokeText(F,ye,Pe),T.fillStyle=((ze=ne.colors)==null?void 0:ze[De])??Ie,T.fillText(F,ye,Pe),Pe+=Re}}T.restore()},[e,t,n,a,s,y,u]);return i.useEffect(()=>{m()},[m,r,o.x,o.y,c,s,u,d]),i.useEffect(()=>{const _=p.current;if(!_)return;const g=new ResizeObserver(()=>m());return g.observe(_),()=>g.disconnect()},[m]),f.jsx("canvas",{ref:p,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function Yn({notation:e,onChange:t,className:n=""}){return f.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const hs=`
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
`,ms=`
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
`;function Kn(e){return`
${$e}
${dt}
${ms}

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
`}const gs=Kn("select(colorB, colorA, uv.x < split)"),xs=Kn("mix(colorA, colorB, alpha)");function bs(e){switch(e){case"center":return{v:"center",h:"center"};case"top-right":return{v:"top",h:"right"};case"bottom-left":return{v:"bottom",h:"left"};case"bottom-right":return{v:"bottom",h:"right"};case"top-left":default:return{v:"top",h:"left"}}}function qn(e,t,n){const{v:r,h:o}=bs(n),a=e.w-t.w,s=e.h-t.h,c=o==="left"?0:o==="right"?a:Math.floor(a/2),l=r==="top"?0:r==="bottom"?s:Math.floor(s/2);return{x:c,y:l}}function Rt(e,t,n,r,o="b"){if(r==="fill"){const s=o==="a"?{w:e.w,h:e.h}:{w:t.w,h:t.h};return{fit:r,result:s,offsetA:{x:0,y:0},offsetB:{x:0,y:0}}}const a={w:Math.min(e.w,t.w),h:Math.min(e.h,t.h)};return{fit:r,result:a,offsetA:qn(e,a,n),offsetB:qn(t,a,n)}}function vs(e){return`${e.fit}:${e.result.w}x${e.result.h}:${e.offsetA.x},${e.offsetA.y}:${e.offsetB.x},${e.offsetB.y}`}const cn={linear:0,srgb:1,reinhard:2,aces:3,extended:4,"extended-reinhard":5,"extended-aces":6},Zn=new WeakMap;function ws(e,t){let n=Zn.get(e);n||(n=new Map,Zn.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:hs,targetFormat:t}),n.set(t,r)),r}function Qn(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function jn(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function ys(e,t,n,r){var _;const o=Qn(t),a=ws(e,o),s=jn(e,r.isScalar?r.colormap:void 0),c=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,l=cn[r.operator]??cn.srgb,u=new Float32Array([r.exposureEV,l,c,r.isScalar?1:0]),p=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),x=new Float32Array([r.hdrOut?1:0]),d=new Float32Array([r.filter==="nearest"?0:1]),b=new Float32Array([r.offset??0]),y=new Float32Array([r.peak??yt]);let m;try{m=e.createBindGroup(a,[{binding:0,resource:n},{binding:1,resource:s},{binding:2,resource:{uniform:u}},{binding:3,resource:{uniform:p}},{binding:4,resource:{uniform:x}},{binding:5,resource:{uniform:d}},{binding:6,resource:{uniform:b}},{binding:7,resource:{uniform:y}}]),e.renderFullscreen(t,a,m)}finally{(_=m==null?void 0:m.destroy)==null||_.call(m),s.destroy()}}const Jn=new WeakMap;function Es(e,t,n){let r=Jn.get(e);r||(r=new Map,Jn.set(e,r));const o=`${t}:${n}`;let a=r.get(o);return a||(a=e.createRenderPipeline({shaderWGSL:t==="split"?gs:xs,targetFormat:n}),r.set(o,a)),a}function _s(e,t,n,r,o){var m;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const a=Qn(t),s=Es(e,o.mode,a),c=jn(e,void 0),l=o.gamma,u=cn[o.operator],p=new Float32Array([o.exposureEV,u,l,0]),x=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),d=new Float32Array([o.split,o.alpha,0,o.filter==="nearest"?0:1]),b=new Float32Array([o.offset??0,0,0,0]);let y;try{y=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:c},{binding:3,resource:{uniform:p}},{binding:4,resource:{uniform:x}},{binding:5,resource:{uniform:d}},{binding:6,resource:{uniform:b}}]),e.renderFullscreen(t,s,y)}finally{(m=y==null?void 0:y.destroy)==null||m.call(y),c.destroy()}}function er(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,a=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:a,mae:o}}async function tr(e,t,n,r){const o=r??Rt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),a=o.result.w,s=o.result.h,c=a*s*3;if(c<=0)return{mse:0,psnr:1/0,mae:0};if(o.fit==="crop"&&o.offsetA.x===0&&o.offsetA.y===0&&o.offsetB.x===0&&o.offsetB.y===0&&e.reduceDiffSumSquaredAbs){const{sumSq:w,sumAbs:E}=await e.reduceDiffSumSquaredAbs(t,n,a,s);return er(w,E,c)}const u=await e.readback(t),p=await e.readback(n),x=u instanceof Uint8Array?255:1,d=p instanceof Uint8Array?255:1,b=nr(u,t.width,t.height,x,o.offsetA,o.fit==="fill",a,s),y=nr(p,n.width,n.height,d,o.offsetB,o.fit==="fill",a,s);let m=0,_=0;const g=[0,0,0],h=[0,0,0];for(let w=0;w<s;w++)for(let E=0;E<a;E++){b(E,w,g),y(E,w,h);for(let T=0;T<3;T++){const v=g[T]-h[T];m+=v*v,_+=Math.abs(v)}}return er(m,_,c)}function nr(e,t,n,r,o,a,s,c){const l=(x,d,b)=>e[(d*t+x)*4+b]??0;if(!a)return(x,d,b)=>{const y=Math.min(Math.max(x+o.x,0),t-1),m=Math.min(Math.max(d+o.y,0),n-1);b[0]=l(y,m,0)/r,b[1]=l(y,m,1)/r,b[2]=l(y,m,2)/r};const u=t-1,p=n-1;return(x,d,b)=>{const y=(x+.5)/s,m=(d+.5)/c,_=y*t-.5,g=m*n-.5,h=Math.floor(_),w=Math.floor(g),E=_-h,T=g-w,v=Math.min(Math.max(h,0),u),D=Math.min(Math.max(h+1,0),u),M=Math.min(Math.max(w,0),p),P=Math.min(Math.max(w+1,0),p);for(let S=0;S<3;S++){const k=l(v,M,S),C=l(D,M,S),A=l(v,P,S),V=l(D,P,S),L=k+(C-k)*E,B=A+(V-A)*E;b[S]=(L+(B-L)*T)/r}}}function rr(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const Ms=12,rt=[];function or(e){const t=rt.indexOf(e);t!==-1&&rt.splice(t,1),rt.push(e)}function Ss(e){const t=rt.indexOf(e);t!==-1&&rt.splice(t,1)}function Dt(e){e.parked||(Ss(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),e.surface=null,e.parked=!0)}function sr(e){for(;rt.length>Ms;){const t=rt.find(n=>n!==e&&!n.visible)??rt.find(n=>n!==e);if(!t)break;Dt(t)}}function ar(e){var o,a,s,c;if(e.disposed)return;if(rr())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){or(e),sr(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||((a=e.deep)==null?void 0:a.width)||1,r=e.backingHeight||((s=e.source)==null?void 0:s.height)||((c=e.deep)==null?void 0:c.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.deep){const l=t.createTexture(e.deep.width,e.deep.height,"rgba16float");e.srcTexture=l,e.deepBuffers=t.createDeepSampleBuffers(e.deep),t.compositeDeep(e.deepBuffers,l,e.deepZNear,e.deepZFar)}else if(e.source){const l=t.createTexture(e.source.width,e.source.height,e.source.format);l.write(e.source.data),e.srcTexture=l}e.parked=!1,or(e),sr(e)}function Ts(e,t){if(e.disposed||!e.source&&!e.deep)return!0;try{return ar(e),!e.surface||!e.srcTexture?!1:(ys(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,Dt(e),!1}}function Ps(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,e.deep=null,e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},setDeepSource(t,n,r){if(!e.disposed&&(e.deep=t,e.deepZNear=n,e.deepZFar=r,e.source=null,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy(),e.deepBuffers&&e.deepBuffers.destroy();const o=e.device.createTexture(t.width,t.height,"rgba16float");e.srcTexture=o,e.deepBuffers=e.device.createDeepSampleBuffers(t),e.device.compositeDeep(e.deepBuffers,o,n,r)}},setDeepWindow(t,n){e.disposed||(e.deepZNear=t,e.deepZFar=n,!e.parked&&e.deepBuffers&&e.srcTexture&&e.device.compositeDeep(e.deepBuffers,e.srcTexture,t,n))},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return Ts(e,t)},park(){e.disposed||Dt(e)},restore(){e.disposed||!e.source&&!e.deep||ar(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(Dt(e),e.source=null,e.deep=null,e.disposed=!0)}}}async function As(e,t){const n=await wt(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,deep:null,deepZNear:-1/0,deepZFar:1/0,deepBuffers:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return Ps(r)}function ir(e){e.dispose()}function Cs(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:a}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...a?["invert(1)"]:[]].join(" ")}function cr(e){const n=`cairn-gamma-${i.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:a,exposure:s,offset:c,flipSign:l}=e,u=i.useMemo(()=>Cs(e,n),[n,r,o,s,l]);return{gammaFilterId:n,filterStr:u,gamma:a,offset:c}}function lr({id:e,gamma:t,offset:n}){return f.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:f.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:f.jsxs("feComponentTransfer",{children:[f.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),f.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),f.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}const Rs={x:0,y:0,w:1,h:1};function ur(e,t,n){const r=n.sourceWindow??Rs,o=r.x*n.naturalWidth,a=r.y*n.naturalHeight,s=r.w*n.naturalWidth,c=r.h*n.naturalHeight,l=Math.min(n.box.width/s,n.box.height/c),u=s*l,p=c*l,x=n.box.left+(n.box.width-u)/2,d=n.box.top+(n.box.height-p)/2;return{x:o+(e-x)/l,y:a+(t-d)/l}}const kt=(e,t,n)=>Math.max(t,Math.min(n,Math.floor(e)));function Ds(e,t,n,r,o){const a=ur(e,t,o),s=ur(n,r,o),c=o.naturalWidth-1,l=o.naturalHeight-1,u=Math.min(a.x,s.x),p=Math.max(a.x,s.x),x=Math.min(a.y,s.y),d=Math.max(a.y,s.y);return p<0||u>c||d<0||x>l?null:{x0:kt(u,0,c),y0:kt(x,0,l),x1:kt(p,0,c),y1:kt(d,0,l)}}function fr(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function ks({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=fr(e),a=fr(t),s=[];for(let h=0;h<=e;h+=o)s.push(h);const c=[];for(let h=0;h<=t;h+=a)c.push(h);const l=1/n,u=8*l,p=-12*l,x=-2*l,d=r==null?void 0:r.current;let b=0,y=0,m=0,_=0;if(d){const h=d.clientWidth,w=d.clientHeight,E=h/e,T=w/t,v=Math.min(E,T);m=e*v,_=t*v,b=(h-m)/2,y=(w-_)/2}const g=d&&m>0;return f.jsxs(f.Fragment,{children:[f.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:g?y:0,transform:`translateY(${p}px)`,fontSize:u},children:s.map(h=>f.jsx("span",{className:"mono",style:{position:"absolute",left:g?b+h/e*m:`${h/e*100}%`,transform:"translateX(-50%)"},children:h},h))}),f.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:g?b:0,transform:`translateX(${x}px)`,fontSize:u},children:c.map(h=>f.jsx("span",{className:"mono",style:{position:"absolute",top:g?y+h/t*_:`${h/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*l}px`},children:h},h))})]})}function Ls({label:e,isDraggable:t,onDragStart:n}){return f.jsxs("span",{className:`absolute bottom-1 left-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${t?" cairn-drag-grip":""}`,draggable:t,onDragStart:n,style:{cursor:t?"grab":void 0},children:[t&&f.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const Bs=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function dr(e,t){const n=getComputedStyle(e),r=Bs.map(l=>`${l}:${n.getPropertyValue(l)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const a=e.children,s=t.children,c=Math.min(a.length,s.length);for(let l=0;l<c;l++)dr(a[l],s[l])}function ln(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function un(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function fn(e,t,n,r,o){const a=document.createElement("canvas");a.width=Math.max(1,Math.round(e*n)),a.height=Math.max(1,Math.round(t*n));const s=a.getContext("2d");if(!s)throw new Error("plot-to-png: 2D canvas context unavailable");return s.scale(n,n),r&&(s.fillStyle=r,s.fillRect(0,0,e,t)),o(s),await new Promise((c,l)=>a.toBlob(u=>u?c(u):l(new Error("plot-to-png: toBlob returned null")),"image/png"))}function Os(e,t,n){const r=e.cloneNode(!0);dr(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),a="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((s,c)=>{const l=new Image;l.onload=()=>s(l),l.onerror=()=>c(new Error("plot-to-png: SVG rasterization failed")),l.src=a})}async function pr(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,a=(t==null?void 0:t.background)??ln(e);return fn(r,o,un(t),a,s=>s.drawImage(e,0,0,r,o))}async function Is(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,a=(t==null?void 0:t.background)??ln(e);try{return await fn(r,o,un(t),a,s=>s.drawImage(e,0,0,r,o))}catch(s){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${s instanceof Error?s.message:String(s)})`)}}function Ns(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const a=o.getBoundingClientRect(),s=a.width*a.height;s>r&&(r=s,n=o)}return n}async function Fs(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),a=o.width||300,s=o.height||150,c=(t==null?void 0:t.background)??ln(e);if(n){const u=n.getBoundingClientRect(),p=await Os(n,u.width||a,u.height||s);return fn(a,s,un(t),c,x=>{for(const d of r){const b=d.getBoundingClientRect();x.drawImage(d,b.left-o.left,b.top-o.top,b.width,b.height)}x.drawImage(p,u.left-o.left,u.top-o.top,u.width,u.height)})}if(r.length)return pr(r[0],t);const l=Ns(e);if(l)return Is(l,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function Us(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const Gs=8;function zs(e,t,n,r=Gs){return!(t>0)||!(e>0)?n:e<t+r}function hr(e,t){return Math.max(0,e.findIndex(n=>n.id===t))}function Vs(e){const t=e.trim();if(t==="")return null;const n=t.replace(/−/g,"-").replace(",","."),r=Number(n);return Number.isFinite(r)?r:null}function $s(e,t){const n=Vs(e);return n===null?t:n}function Xs(e){return String(e)}const Ws={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},Hs={boxZoom:f.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:f.jsxs(f.Fragment,{children:[f.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),f.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),f.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),f.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 2v20M2 12h20"}),f.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),f.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),f.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:f.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:f.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),f.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:f.jsx("path",{d:"M6 9l6 6 6-6"}),ellipsis:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"5",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),f.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),f.jsx("circle",{cx:"19",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"})]}),sun:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"12",cy:"12",r:"4"}),f.jsx("path",{d:"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"})]}),plusminus:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M4 7h6M7 4v6"}),f.jsx("path",{d:"M14 17h6"}),f.jsx("path",{d:"M6 20l12-16"})]}),layers:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 3l9 5-9 5-9-5 9-5z"}),f.jsx("path",{d:"M3 13l9 5 9-5"})]})};function Je({name:e}){return f.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:Hs[e]??null})}function mr({icon:e,label:t,title:n,active:r,disabled:o,onClick:a}){return f.jsx("button",{type:"button",disabled:o,onClick:s=>{s.stopPropagation(),!o&&a()},onPointerDown:s=>s.stopPropagation(),onDoubleClick:s=>s.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?f.jsx("span",{"aria-hidden":"true",children:t}):f.jsx(Je,{name:e??""})})}function gr(){return f.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function Ys({icon:e,title:t,menu:n}){var _;const{options:r,value:o,onSelect:a}=n,[s,c]=i.useState(!1),[l,u]=i.useState(0),p=i.useRef(null),x=hr(r,o),d=e?void 0:((_=r[x])==null?void 0:_.label)??"",b=i.useCallback(()=>{c(g=>{const h=!g;return h&&u(x),h})},[x]),y=i.useCallback(g=>{a(g),c(!1)},[a]);i.useEffect(()=>{if(!s)return;const g=w=>{p.current&&!p.current.contains(w.target)&&c(!1)},h=w=>{w.key==="Escape"&&(w.stopPropagation(),c(!1))};return document.addEventListener("pointerdown",g,!0),document.addEventListener("keydown",h,!0),()=>{document.removeEventListener("pointerdown",g,!0),document.removeEventListener("keydown",h,!0)}},[s]);const m=g=>{if(!s){(g.key==="ArrowDown"||g.key==="Enter"||g.key===" ")&&(g.preventDefault(),u(x),c(!0));return}if(g.key==="ArrowDown")g.preventDefault(),u(h=>(h+1)%r.length);else if(g.key==="ArrowUp")g.preventDefault(),u(h=>(h-1+r.length)%r.length);else if(g.key==="Enter"||g.key===" "){g.preventDefault();const h=r[l];h&&y(h.id)}};return f.jsxs("div",{ref:p,className:"relative inline-flex",onPointerDown:g=>g.stopPropagation(),children:[f.jsxs("button",{type:"button",onClick:g=>{g.stopPropagation(),b()},onDoubleClick:g=>g.stopPropagation(),onKeyDown:m,"aria-haspopup":"listbox","aria-expanded":s,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",d?"px-1.5 text-[10px] font-mono":"px-1 text-xs",s?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[d?f.jsx("span",{"aria-hidden":"true",children:d}):f.jsx(Je,{name:e??""}),f.jsx(Je,{name:"caret"})]}),s&&f.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((g,h)=>{const w=g.id===o,E=h===l;return f.jsx("li",{role:"option","aria-selected":w,children:f.jsx("button",{type:"button",onClick:T=>{T.stopPropagation(),y(g.id)},onPointerEnter:()=>u(h),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",E?"bg-bg-hover":"",w?"text-accent font-medium":"text-fg"].join(" "),children:g.label})},g.id)})})]})}const Ks=e=>e.format?e.format(e.value):String(e.value);function xr({spec:e}){const[t,n]=i.useState(!1),[r,o]=i.useState(""),a=i.useRef(null),s=i.useCallback(()=>{o(Xs(e.value)),n(!0)},[e.value]);i.useEffect(()=>{t&&a.current&&(a.current.focus(),a.current.select())},[t]);const c=i.useCallback(()=>{n(u=>(u&&e.onChange($s(r,e.value)),!1))},[r,e]),l=i.useCallback(()=>n(!1),[]);return f.jsxs("label",{className:"inline-flex items-center gap-1 text-fg-muted",title:e.title,onPointerDown:u=>u.stopPropagation(),onDoubleClick:u=>{u.stopPropagation(),t||s()},children:[e.icon?f.jsx("span",{"aria-hidden":"true",className:"inline-flex",children:f.jsx(Je,{name:e.icon})}):f.jsx("span",{"aria-hidden":"true",className:"text-[9px] font-mono",children:e.label}),t?f.jsx("input",{ref:a,type:"text",inputMode:"decimal","aria-label":`${e.title} (numeric entry)`,value:r,onChange:u=>o(u.target.value),onPointerDown:u=>u.stopPropagation(),onDoubleClick:u=>u.stopPropagation(),onKeyDown:u=>{u.stopPropagation(),u.key==="Enter"?(u.preventDefault(),c()):u.key==="Escape"&&(u.preventDefault(),l())},onBlur:c,className:"cairn-plot-toolbar-slider-entry h-3.5 w-[6.5rem] rounded border border-border bg-bg px-1 text-[9px] font-mono tabular-nums text-fg outline-none focus:border-accent"}):f.jsxs(f.Fragment,{children:[f.jsx("input",{type:"range","aria-label":e.title,min:e.min,max:e.max,step:e.step,value:e.value,onChange:u=>e.onChange(Number(u.target.value)),onPointerDown:u=>u.stopPropagation(),className:"cairn-plot-toolbar-slider h-1 w-16 cursor-pointer accent-accent"}),f.jsx("span",{"aria-hidden":"true",className:"w-8 text-right text-[9px] font-mono tabular-nums",children:Ks(e)})]})]})}function qs({icon:e,title:t,menu:n,onClose:r}){var x;const{options:o,value:a,onSelect:s}=n,[c,l]=i.useState(!1),u=hr(o,a),p=((x=o[u])==null?void 0:x.label)??"";return f.jsxs("div",{children:[f.jsxs("button",{type:"button","aria-haspopup":"menu","aria-expanded":c,"aria-label":t,onClick:d=>{d.stopPropagation(),l(b=>!b)},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",c?"text-accent":"text-fg hover:bg-bg-hover"].join(" "),children:[e?f.jsx(Je,{name:e}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{className:"flex-1",children:t}),f.jsx("span",{className:"font-mono text-[10px] text-fg-muted",children:p}),f.jsx("span",{className:c?"rotate-180 transition-transform":"transition-transform",children:f.jsx(Je,{name:"caret"})})]}),c&&o.map(d=>{const b=d.id===a;return f.jsxs("button",{type:"button",role:"menuitemradio","aria-checked":b,"data-menu-option":"",onClick:y=>{y.stopPropagation(),s(d.id),r()},className:["flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-[11px]",b?"text-accent font-medium bg-bg-hover/40":"text-fg hover:bg-bg-hover"].join(" "),children:[f.jsx("span",{"aria-hidden":"true",className:"w-3 text-center text-accent",children:b?"✓":""}),f.jsx("span",{children:d.label})]},d.id)})]})}function Zs({actions:e,leading:t,sliders:n}){const[r,o]=i.useState(!1),a=i.useRef(null);return i.useEffect(()=>{if(!r)return;const s=l=>{a.current&&!a.current.contains(l.target)&&o(!1)},c=l=>{l.key==="Escape"&&(l.stopPropagation(),o(!1))};return document.addEventListener("pointerdown",s,!0),document.addEventListener("keydown",c,!0),()=>{document.removeEventListener("pointerdown",s,!0),document.removeEventListener("keydown",c,!0)}},[r]),f.jsxs("div",{ref:a,className:"relative inline-flex",onPointerDown:s=>s.stopPropagation(),children:[f.jsx("button",{type:"button",onClick:s=>{s.stopPropagation(),o(c=>!c)},onDoubleClick:s=>s.stopPropagation(),"aria-haspopup":"menu","aria-expanded":r,"aria-label":"More controls",title:"More controls",className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded text-xs",r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:f.jsx(Je,{name:"ellipsis"})}),r&&f.jsxs("div",{role:"menu",className:["absolute right-0 top-full z-40 mt-1 min-w-[10rem] max-h-80 overflow-auto","rounded border border-border bg-bg-elevated py-1 shadow-md"].join(" "),children:[t.map(s=>s.menu?f.jsx(qs,{icon:s.icon,title:s.title,menu:s.menu,onClose:()=>o(!1)},s.id):f.jsxs("button",{type:"button",disabled:s.disabled,onClick:c=>{var l;c.stopPropagation(),!s.disabled&&((l=s.onClick)==null||l.call(s),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?f.jsx(Je,{name:s.icon}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{children:s.label??s.title})]},s.id)),t.length>0&&e.length>0&&f.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),e.map(s=>f.jsxs("button",{type:"button",role:"menuitem",disabled:s.disabled,onClick:c=>{c.stopPropagation(),!s.disabled&&(s.onClick(),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?f.jsx(Je,{name:s.icon}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{children:s.title})]},s.id)),n.length>0&&(e.length>0||t.length>0)&&f.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),n.map(s=>f.jsx("div",{className:"px-2 py-1",children:f.jsx(xr,{spec:s})},s.id))]})]})}function Qs({controller:e,config:t}){var k,C;const n=i.useRef(null),[r,o]=i.useState(!1),a=i.useRef(r);a.current=r;const s=i.useRef(0),c=`${((k=t==null?void 0:t.leadingButtons)==null?void 0:k.length)??0}:${((C=t==null?void 0:t.sliders)==null?void 0:C.length)??0}:${(t==null?void 0:t.visibility)??"hover"}`;if(i.useEffect(()=>{const A=n.current,V=A==null?void 0:A.parentElement;if(!V)return;const L=()=>{const G=V.clientWidth;if(!a.current&&n.current){const Y=n.current.scrollWidth;Y>0&&(s.current=Y)}o(zs(G,s.current,a.current))};let B=0;const O=()=>{B||(B=requestAnimationFrame(()=>{B=0,L()}))},I=new ResizeObserver(O);return I.observe(V),L(),()=>{I.disconnect(),B&&cancelAnimationFrame(B)}},[c]),(t==null?void 0:t.enabled)===!1)return null;const l=e.capabilities,u=t==null?void 0:t.buttons,p=(A,V)=>V&&(u==null?void 0:u[A])!==!1,x=A=>()=>e.setDragMode(A),d=()=>{e.toPNG({filename:"plot"}).then(A=>Us(A,"plot.png")).catch(()=>{})},b=[];p("zoom",l.zoom)&&b.push({id:"zoom",icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:x("zoom")}),p("pan",l.pan)&&b.push({id:"pan",icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:x("pan")}),p("select",l.select)&&b.push({id:"select",icon:"select",title:"Box select",active:e.dragMode==="select",onClick:x("select")}),p("lasso",l.lasso)&&b.push({id:"lasso",icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:x("lasso")});const y=[];p("zoomIn",l.zoom)&&y.push({id:"zoomIn",icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),p("zoomOut",l.zoom)&&y.push({id:"zoomOut",icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()});const m=[];p("autoscale",l.autoscale)&&m.push({id:"autoscale",icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),p("reset",l.reset)&&m.push({id:"reset",icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()});const _=[];p("screenshot",l.screenshot)&&_.push({id:"screenshot",icon:"camera",title:"Download plot as PNG",onClick:d});const g=[b,y,m,_].filter(A=>A.length>0),h=g.flat(),w=(t==null?void 0:t.leadingButtons)??[],E=(t==null?void 0:t.sliders)??[];if(!w.length&&h.length===0&&E.length===0)return null;const T=(t==null?void 0:t.position)??"top-right",v=(t==null?void 0:t.visibility)==="always",D=T==="top-right"||T==="bottom-right",P=["cairn-plot-toolbar z-30 rounded border border-border bg-bg-elevated/90 shadow-sm backdrop-blur-sm transition-opacity",v?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),S={position:"absolute",pointerEvents:"auto",...Ws[T]};return r?f.jsx("div",{ref:n,style:S,className:`${P} inline-flex px-0.5 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:f.jsx(Zs,{actions:h,leading:w,sliders:E})}):f.jsxs("div",{ref:n,style:S,className:`${P} flex flex-col gap-0.5 px-1 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:[f.jsxs("div",{className:`flex items-center gap-0.5 ${D?"justify-end":"justify-start"}`,children:[w.length>0&&f.jsxs(f.Fragment,{children:[w.map(A=>A.menu?f.jsx(Ys,{icon:A.icon,title:A.title,menu:A.menu},A.id):f.jsx(mr,{icon:A.icon,label:A.label,title:A.title,active:A.active,disabled:A.disabled,onClick:A.onClick??(()=>{})},A.id)),g.length>0&&f.jsx(gr,{})]}),g.map((A,V)=>f.jsxs("span",{className:"inline-flex items-center gap-0.5",children:[V>0&&f.jsx(gr,{}),A.map(L=>f.jsx(mr,{icon:L.icon,title:L.title,active:L.active,disabled:L.disabled,onClick:L.onClick},L.id))]},A[0].id))]}),E.length>0&&f.jsx("div",{className:`flex items-center gap-2 ${D?"justify-end":"justify-start"}`,children:E.map(A=>f.jsx(xr,{spec:A},A.id))})]})}const js={zoom:1,pan:{x:0,y:0}},br=1.3,Js=.25,ea=64,ta={buttons:{zoom:!1}};function na(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const ra=[{id:"none",label:"None"},{id:"viridis",label:"Viridis"},{id:"plasma",label:"Plasma"},{id:"magma",label:"Magma"},{id:"red-green",label:"Red–Green"},{id:"red-blue",label:"Red–Blue"}];function dn(e,t){return{id:"colormap",title:"Colormap",menu:{options:ra,value:e,onSelect:t}}}const vr=[{id:"linear",label:"Linear"},{id:"srgb",label:"sRGB"},{id:"reinhard",label:"Reinhard"},{id:"aces",label:"ACES"}],oa=[{id:"extended",label:"Extended · Linear"},{id:"extended-reinhard",label:"Extended · Reinhard"},{id:"extended-aces",label:"Extended · ACES"}];function wr(e,t,n){return{id:"tonemap",title:"Tone-mapping operator",menu:{options:n?[...vr,...oa]:vr,value:e,onSelect:t}}}function sa({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:a,naturalHeight:s,minZoom:c=Js,maxZoom:l=ea,requestRender:u,onReset:p,extraModified:x=!1}){const d=i.useCallback(v=>{var B;if(!o)return;const D=(B=e.current)==null?void 0:B.getBoundingClientRect(),M=(D==null?void 0:D.width)??0,P=(D==null?void 0:D.height)??0,S=a&&s&&M>0&&P>0?nn(a,s,M,P):l,k=Math.max(c,Math.min(S,n*v));if(k===n)return;const C=M/2,A=P/2,V=C-(C-r.x)/n*k,L=A-(A-r.y)/n*k;o({zoom:k,pan:{x:V,y:L}})},[o,e,a,s,l,c,n,r.x,r.y]),b=i.useCallback(()=>d(br),[d]),y=i.useCallback(()=>d(1/br),[d]),m=i.useCallback(()=>{o==null||o(js),p==null||p()},[o,p]),_=i.useCallback(v=>{const D={scale:v==null?void 0:v.scale,filename:v==null?void 0:v.filename};u==null||u();const M=t==null?void 0:t.current;if(M)return pr(M,D);const P=e.current;return P?Fs(P,D):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,u]),g=i.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),h=n!==1||r.x!==0||r.y!==0||x,w=i.useCallback(v=>{},[]),E=i.useCallback(v=>{},[]),T=i.useCallback(()=>{},[]);return i.useMemo(()=>({capabilities:g,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:h,setDragMode:w,setHoverMode:E,toggleSpikelines:T,zoomIn:b,zoomOut:y,autoscale:m,reset:m,toPNG:_}),[g,h,w,E,T,b,y,m,_])}const aa={zoom:1,pan:{x:0,y:0}};function Lt({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:a,pan:s,onViewportChange:c,naturalDims:l,checkerboard:u,wrapperClassName:p,wrapperStyle:x,viewportPadding:d,header:b,surface:y,showAxes:m,overlayNode:_,overlay:g,notationSeed:h,exportCanvasRef:w,requestRender:E,leadingMenus:T,displayAdjust:v,depthSliders:D,extraSliders:M,onRegionSelect:P,onReset:S,extraModified:k,label:C,showLabelChip:A,isDraggable:V=!1,onDragStart:L,extraChips:B}){const[O,I]=i.useState(h),[G,Y]=i.useState(!1),[le,j]=i.useState(!1),[ee,pe]=i.useState(null),me="render"in g?null:g,te=!!P&&!!me,ze=i.useCallback(async(Se,Ie,Pe,De)=>{if(j(!1),!P)return;const F=await P(Se,Ie,Pe,De);F.ok||(pe(F.message??"no samples in region"),setTimeout(()=>pe(null),1800))},[P]),{containerProps:he}=Wn({containerRef:r,zoom:a,pan:s,onViewportChange:c,naturalWidth:l==null?void 0:l.w,naturalHeight:l==null?void 0:l.h}),we=i.useCallback(()=>{v==null||v.onExposureChange(0),v==null||v.onOffsetChange(0),S==null||S()},[v,S]),ne=i.useCallback(()=>{c==null||c(aa),we()},[c,we]),re=sa({rootRef:r,canvasRef:w,zoom:a,pan:s,onViewportChange:c,naturalWidth:l==null?void 0:l.w,naturalHeight:l==null?void 0:l.h,requestRender:E,onReset:we,extraModified:((v==null?void 0:v.exposureEV)??0)!==0||((v==null?void 0:v.offset)??0)!==0||!!k}),$=i.useMemo(()=>{const Se=[];if(D&&Se.push(...D),!v)return M&&Se.push(...M),Se.length?Se:void 0;const Ie=(Pe,De)=>`${Pe>=0?"+":"−"}${Math.abs(Pe).toFixed(De)}`;return Se.push({id:"exposure",icon:"sun",label:"EV",title:"Exposure (EV stops) — color × 2^EV. Double-click to type a value (may exceed the slider range).",min:-8,max:8,step:.1,value:v.exposureEV,onChange:v.onExposureChange,format:Pe=>Ie(Pe,1)},{id:"offset",icon:"plusminus",label:"OFF",title:"Offset — added after exposure (before tonemap). Double-click to type a value (may exceed the slider range).",min:-1,max:1,step:.01,value:v.offset,onChange:v.onOffsetChange,format:Pe=>Ie(Pe,2)}),M&&Se.push(...M),Se},[v,D,M]),ue=i.useMemo(()=>te?{id:"region-depth",icon:"select",title:"Select depth from region — drag a rectangle to set the Z window to the samples it covers (Esc to cancel)",active:le,onClick:()=>j(Se=>!Se)}:null,[te,le]),Me=i.useMemo(()=>({...ta,leadingButtons:[...T??[],...ue?[ue]:[],...G?[na(O,I)]:[]],sliders:$}),[G,O,T,ue,$]),ce=" cairn-checkerboard",ye="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(u==="pane"?ce:""),Te=p+(u==="wrapper"?ce:""),Re="render"in g?g.render({notation:O,setOverlayActive:Y}):g.hasSource&&l?f.jsx(ut,{imageElRef:g.displayElRef,naturalWidth:l.w,naturalHeight:l.h,zoom:a,pan:s,sourceWindow:g.sourceWindow,sample:g.sample,notation:O,version:g.version,onActiveChange:Y}):null;return f.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[b,n&&f.jsx(Qs,{controller:re,config:Me}),f.jsxs("div",{ref:r,className:ye,style:{padding:d,...he.style},onPointerDown:he.onPointerDown,onPointerMove:he.onPointerMove,onPointerUp:he.onPointerUp,onPointerCancel:he.onPointerCancel,onDoubleClick:ne,...t,children:[f.jsxs("div",{ref:o,className:Te,style:x,children:[y,m&&l&&f.jsx(ks,{naturalWidth:l.w,naturalHeight:l.h,zoom:a,containerRef:o}),_]}),Re,!n&&G&&f.jsx(Yn,{notation:O,onChange:I}),le&&me&&l&&f.jsx(ia,{imageElRef:me.displayElRef,naturalDims:l,sourceWindow:me.sourceWindow,onSelect:ze,onExit:()=>j(!1)}),ee&&f.jsx("div",{className:"absolute top-2 left-1/2 -translate-x-1/2 z-30 rounded bg-black/70 px-2 py-1 text-xs text-white pointer-events-none",children:ee})]}),A&&f.jsx(Ls,{label:C,isDraggable:V,onDragStart:L}),B]})}function ia({imageElRef:e,naturalDims:t,sourceWindow:n,onSelect:r,onExit:o}){var y;const a=i.useRef(null),s=i.useRef(null),[c,l]=i.useState(null);i.useEffect(()=>{const m=_=>{_.key==="Escape"&&o()};return window.addEventListener("keydown",m),()=>window.removeEventListener("keydown",m)},[o]);const u=i.useCallback(m=>{var _,g;(g=(_=m.target).setPointerCapture)==null||g.call(_,m.pointerId),s.current={x:m.clientX,y:m.clientY},l({x0:m.clientX,y0:m.clientY,x1:m.clientX,y1:m.clientY})},[]),p=i.useCallback(m=>{const _=s.current;_&&l({x0:_.x,y0:_.y,x1:m.clientX,y1:m.clientY})},[]),x=i.useCallback(m=>{const _=s.current;s.current=null,l(null);const g=e.current;if(!_||!g){o();return}if(Math.abs(m.clientX-_.x)<3&&Math.abs(m.clientY-_.y)<3){o();return}const h=g.getBoundingClientRect(),w=Ds(_.x,_.y,m.clientX,m.clientY,{box:h,naturalWidth:t.w,naturalHeight:t.h,sourceWindow:n});if(!w){o();return}r(w.x0,w.y0,w.x1,w.y1)},[e,t,n,r,o]),d=(y=a.current)==null?void 0:y.getBoundingClientRect(),b=c&&d?{left:Math.min(c.x0,c.x1)-d.left,top:Math.min(c.y0,c.y1)-d.top,width:Math.abs(c.x1-c.x0),height:Math.abs(c.y1-c.y0)}:null;return f.jsx("div",{ref:a,className:"absolute inset-0 z-20",style:{cursor:"crosshair",touchAction:"none"},onPointerDown:u,onPointerMove:p,onPointerUp:x,children:b&&f.jsx("div",{className:"absolute border-2 border-dashed border-sky-400 bg-sky-400/15 pointer-events-none",style:b})})}const yr={inFlight:!1,pending:null};function ca(e,t){return e.inFlight?{state:{inFlight:!0,pending:t},launch:null}:{state:{inFlight:!0,pending:null},launch:t}}function la(e){return e.pending!=null?{state:{inFlight:!0,pending:null},launch:e.pending}:{state:yr,launch:null}}const ua=1e3,fa=typeof requestAnimationFrame=="function"?e=>requestAnimationFrame(()=>e()):e=>setTimeout(e,0),Er=typeof cancelAnimationFrame=="function"?cancelAnimationFrame:e=>clearTimeout(e);function _r(e,t){const n=e.deep,r=(n==null?void 0:n.zMin)??0,o=(n==null?void 0:n.zMax)??0,a=t!=null,[s,c,l]=ct(r),[u,p,x]=ct(o),[d,b]=i.useState(null),y=i.useRef(n);y.current=n;const m=i.useRef(r);m.current=r;const _=i.useRef(o);_.current=o;const g=i.useRef(s);g.current=s;const h=i.useRef(u);h.current=u;const w=i.useRef({near:s,far:u,ver:0}),E=i.useRef(0),T=i.useRef(!0),v=i.useRef(yr),D=i.useRef(null),M=i.useCallback(O=>c(Math.min(O,h.current)),[c]),P=i.useCallback(O=>p(Math.max(O,g.current)),[p]),S=i.useCallback(()=>{const O=y.current;if(!O)return;const{near:I,far:G,ver:Y}=w.current,le=()=>{const j=la(v.current);v.current=j.state,j.launch!=null&&S()};O.flatten(I,G).then(j=>{w.current.ver===Y&&!T.current&&(D.current!=null&&Er(D.current),D.current=fa(()=>{D.current=null,b(j)})),le()}).catch(le)},[]),k=i.useCallback(()=>{const O=ca(v.current,1);v.current=O.state,O.launch!=null&&S()},[S]);i.useEffect(()=>()=>{D.current!=null&&Er(D.current),n==null||n.dispose()},[n]),i.useEffect(()=>{if(!n)return;const O=s<=r&&u>=o;if(T.current=O,E.current+=1,w.current={near:s,far:u,ver:E.current},a){t(s,u);return}if(O){b(null);return}k()},[n,s,u,r,o,k,a,t]);const C=i.useMemo(()=>n&&!a&&d!=null?{...e,data:d}:e,[e,n,a,d]),A=n!=null&&r>0&&o/r>ua,V=i.useMemo(()=>{if(!n||!(o>r))return;const O=G=>Math.abs(G)>=1e3||Math.abs(G)<.01&&G!==0?G.toExponential(2):G.toFixed(3),I=(G,Y,le,j,ee)=>{if(A){const pe=Math.log10(r),me=Math.log10(o);return{id:G,icon:"layers",label:Y,title:`${le} (log scale). Double-click to type a Z.`,min:pe,max:me,step:(me-pe)/200,value:Math.log10(Math.max(r,Math.min(j,o))),onChange:te=>ee(10**te),format:te=>O(10**te)}}return{id:G,icon:"layers",label:Y,title:`${le}. Double-click to type a Z.`,min:r,max:o,step:(o-r)/200,value:j,onChange:ee,format:O}};return[I("depth-near","ZN","Depth window NEAR — composite only samples with Z ≥ this",s,M),I("depth-far","ZF","Depth window FAR — composite only samples with Z ≤ this",u,P)]},[n,r,o,s,u,A,M,P]),L=i.useCallback(async(O,I,G,Y)=>{const le=y.current;if(!le)return{ok:!1,message:"no deep source"};let j;try{j=await le.zRangeInRect(O,I,G,Y)}catch{return{ok:!1,message:"region query failed"}}if(j.count===0)return{ok:!1,message:"no samples in region"};const ee=_.current-m.current,pe=Math.max(Math.abs(ee)*1e-4,1e-4);return c(j.zMin-pe),p(j.zMax+pe),{ok:!0}},[c,p]),B=i.useCallback(()=>{l.reset(),x.reset(),b(null)},[l,x]);return{hdr:C,sliders:V,hasDeep:n!=null,selectRegion:L,reset:B,isModified:l.isModified||x.isModified}}function Mr(e){return"hdr"in e&&e.hdr!=null}function Sr(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function Le(e){return Number.isFinite(e)?e:0}const da={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function pa(e,t,n,r,o=0){const{h:a,w:s,c}=Sr(e.shape),l=e.precision==="f16-bits"?Fn(e.data):e.data,u=Bo(t),p=new Uint8ClampedArray(s*a*4);for(let x=0;x<s*a;x++){const d=x*c;let b,y,m,_=1;c===1?b=y=m=Le(l[d]):c===3?(b=Le(l[d]),y=Le(l[d+1]),m=Le(l[d+2])):(b=Le(l[d]),y=Le(l[d+1]),m=Le(l[d+2]),_=Le(l[d+3]));const g=[Et(b,n,o),Et(y,n,o),Et(m,n,o)],[h,w,E]=u(g),T=x*4;p[T]=255*qt(h,r),p[T+1]=255*qt(w,r),p[T+2]=255*qt(E,r),p[T+3]=255*(_<0?0:_>1?1:_)}return new ImageData(p,s,a)}function ha(e){var Pe,De;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:a="auto",colormap:s="none",showAxes:c=!1,processing:l=da,zoom:u=1,pan:p={x:0,y:0},onViewportChange:x,onNaturalSize:d,label:b,isDraggable:y=!1,onDragStart:m,overlay:_,overlaySettings:g,pixelValueNotation:h="decimal",toolbar:w=!0}=e,[E,T,v]=ct(s);i.useEffect(()=>{T(s)},[s,T]);const D=i.useRef(null),M=i.useRef(null),P=i.useRef(null),S=i.useRef(null),k=i.useRef(null),C=i.useRef(null),A=i.useRef(null),[V,L]=i.useState(0),B=i.useCallback(()=>L(F=>F+1),[]),O=i.useMemo(()=>({get current(){const F=k.current;return F instanceof HTMLCanvasElement?F:null}}),[]),I=i.useCallback(F=>{D.current=F,F&&(k.current=F)},[]),G=i.useCallback(F=>{M.current=F,F&&(k.current=F)},[]),Y=i.useCallback(F=>{F&&(k.current=F)},[]),[le,j]=i.useState(!1),[ee,pe]=i.useState(!1),[me,te]=i.useState(null),{flipSign:ze}=l,{gammaFilterId:he,filterStr:we,gamma:ne,offset:re}=cr(l),$=!r&&o!=="none"&&n!=null&&t!=null,ue=o!=="none"&&n!=null,Me=E!=="none"&&!$&&!(r&&ue)&&t!=null;i.useEffect(()=>{if(!Me||!t){pe(!1);return}let F=!1;pe(!1);const fe=`${t}::${E}`,Ae=jt(fe);if(Ae){const se=M.current;if(se){se.width=Ae.width,se.height=Ae.height;const ge=se.getContext("2d");ge&&ge.putImageData(Ae,0,0),A.current=Ae,B(),te({w:Ae.width,h:Ae.height}),d==null||d(Ae.width,Ae.height),pe(!0)}return}const xe=new Image;return xe.onload=()=>{if(F)return;const se=document.createElement("canvas");se.width=xe.naturalWidth,se.height=xe.naturalHeight;const ge=se.getContext("2d");if(!ge)return;ge.drawImage(xe,0,0);const Ne=ge.getImageData(0,0,se.width,se.height),Ve=Qt(E),Ee=Zt(Ne,E,Ve);Jt(fe,Ee);const ke=M.current;if(!ke||F)return;ke.width=Ee.width,ke.height=Ee.height;const _e=ke.getContext("2d");_e&&_e.putImageData(Ee,0,0),A.current=Ee,B(),te({w:Ee.width,h:Ee.height}),d==null||d(Ee.width,Ee.height),pe(!0)},xe.src=t,()=>{F=!0}},[Me,t,E]);const ce=i.useCallback((F,fe)=>{te(Ae=>Ae&&Ae.w===F&&Ae.h===fe?Ae:{w:F,h:fe}),d==null||d(F,fe)},[]);i.useEffect(()=>{if(!t){C.current=null,A.current=null,B();return}let F=!1;return at(t).then(fe=>{F||(C.current=fe,E==="none"&&(A.current=fe),B())}),()=>{F=!0}},[t,E,B]);const ye=i.useCallback((F,fe,Ae)=>{const xe=C.current;if(!xe||F<0||fe<0||F>=xe.width||fe>=xe.height)return null;const se=(fe*xe.width+F)*4,ge=xe.data[se],Ne=xe.data[se+1],Ve=xe.data[se+2],Ee=A.current;let ke=ge,_e=Ne,z=Ve;if(Ee&&Ee.width===xe.width&&Ee.height===xe.height){const N=(fe*Ee.width+F)*4;ke=Ee.data[N],_e=Ee.data[N+1],z=Ee.data[N+2]}const X=(.299*ke+.587*_e+.114*z)/255;return lt(E!=="none"||ge===Ne&&Ne===Ve?[ge]:[ge,Ne,Ve],"uint8",Ae,X)},[E]);i.useEffect(()=>{if(!$){j(!1);return}let F=!1;const fe=qo(),Ae=fe==="gpu"||fe==="auto",xe=`${n}::${t}::${o}::${E}`;if(fe!=="gpu"){const se=jt(xe);if(se){const ge=D.current;if(ge){(ge.width!==se.width||ge.height!==se.height)&&(ge.width=se.width,ge.height=se.height);const Ne=ge.getContext("2d");Ne&&Ne.putImageData(se,0,0),ce(se.width,se.height),j(!0)}return}}return(async()=>{const[se,ge]=await Promise.all([at(n),at(t)]);if(F||!se||!ge)return;const Ve=o.includes("signed")?"signed":"positive",Ee=E!=="none"?Wt(E):null,ke={diffMode:o,colormap:Ee,cmapMode:Ve};if(Ae)try{const Z=D.current;if(Z){const N=Yo(se,ge,ke,Z);if(N){if(F)return;ce(N.width,N.height),j(!0);return}}}catch(Z){console.warn("[cairn] WebGL 2 diff error:",Z)}if(fe==="gpu"){console.error("[cairn] WebGL 2 unavailable — set render mode to 'Auto' or 'CPU'");return}let _e=Go(se,ge,o);E!=="none"&&(_e=Zt(_e,E,Ve)),Jt(xe,_e);const z=D.current;if(!z||F)return;(z.width!==_e.width||z.height!==_e.height)&&(z.width=_e.width,z.height=_e.height);const X=z.getContext("2d");X&&X.putImageData(_e,0,0),ce(_e.width,_e.height),j(!0)})(),()=>{F=!0}},[n,t,o,$,E,d]);const Te=a==="auto"?void 0:a,Re=ze?{filter:"invert(1)"}:{},Se=_&&(g!=null&&g.enabled)&&me&&t&&((((Pe=_.boxes)==null?void 0:Pe.length)??0)>0||(((De=_.masks)==null?void 0:De.length)??0)>0)?f.jsx(on,{data:_,settings:g,naturalWidth:me.w,naturalHeight:me.h}):void 0,Ie=t?$?f.jsxs(f.Fragment,{children:[!le&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),f.jsx("canvas",{ref:I,className:"w-full h-full object-contain block",style:{display:le?"block":"none",imageRendering:Te,...Re}})]}):Me?f.jsxs(f.Fragment,{children:[!ee&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),f.jsx("canvas",{ref:G,className:"w-full h-full object-contain block",style:{display:ee?"block":"none",imageRendering:Te,...Re}})]}):f.jsx("img",{ref:Y,src:t,alt:b,className:"w-full h-full object-contain block",draggable:!1,style:{filter:we,imageRendering:Te},onLoad:F=>{const fe=F.currentTarget;te({w:fe.naturalWidth,h:fe.naturalHeight}),d==null||d(fe.naturalWidth,fe.naturalHeight)}}):f.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return f.jsx(Lt,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:w,paneRef:P,wrapperRef:S,zoom:u,pan:p,onViewportChange:x,naturalDims:me,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${p.x}px, ${p.y}px) scale(${u})`,transformOrigin:"0 0"},viewportPadding:c&&me?"16px 4px 4px 28px":"4px",header:f.jsx(lr,{id:he,gamma:ne,offset:re}),surface:Ie,showAxes:c,overlayNode:Se,overlay:{displayElRef:k,sample:ye,version:V,hasSource:!!t},notationSeed:h,exportCanvasRef:O,leadingMenus:[dn(E,F=>T(F))],onReset:v.reset,extraModified:v.isModified,label:b,showLabelChip:!0,isDraggable:y,onDragStart:m})}function ma(e){const{tonemap:t="srgb",exposure:n=0,gamma:r,showAxes:o=!1,label:a="",interpolation:s="auto",zoom:c=1,pan:l={x:0,y:0},onViewportChange:u,pixelValueNotation:p="decimal",toolbar:x=!0}=e,d=_r(e.hdr),b=d.hdr,[y,m,_]=ct(Kt(t));i.useEffect(()=>{m(Kt(t))},[t,m]);const g=i.useRef(null),h=i.useRef(null),w=i.useRef(null),[E,T]=i.useState(null),v=i.useRef(null),[D,M]=i.useState(0),[P,S]=i.useState(0),[k,C]=i.useState(0);i.useEffect(()=>{const L=g.current;if(!L)return;let B;try{B=pa(b,y,n+P,r,k)}catch(I){console.error("[cairn] HDR tone-map error:",I);return}(L.width!==B.width||L.height!==B.height)&&(L.width=B.width,L.height=B.height);const O=L.getContext("2d");O&&(O.putImageData(B,0,0),v.current=B,M(I=>I+1),T(I=>I&&I.w===B.width&&I.h===B.height?I:{w:B.width,h:B.height}))},[b,y,n,r,P,k]);const A=i.useCallback((L,B,O)=>{const I=E;if(!I||L<0||B<0||L>=I.w||B>=I.h)return null;const G=b.shape.length===2?1:b.shape[2]??1,Y=(B*I.w+L)*G,le=b.data,j=b.precision==="f16-bits"?te=>St(le[te]??0):te=>le[te]??0,ee=v.current;let pe=.5;if(ee&&ee.width===I.w&&ee.height===I.h){const te=(B*I.w+L)*4;pe=(.299*ee.data[te]+.587*ee.data[te+1]+.114*ee.data[te+2])/255}const me=G===1?[j(Y)]:[j(Y),j(Y+1),j(Y+2)];return lt(me,"unit",O,pe)},[b,E]),V=s==="auto"?void 0:s;return f.jsx(Lt,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:x,paneRef:h,wrapperRef:w,zoom:c,pan:l,onViewportChange:u,naturalDims:E,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${l.x}px, ${l.y}px) scale(${c})`,transformOrigin:"0 0"},viewportPadding:o&&E?"16px 4px 4px 28px":"4px",surface:f.jsx("canvas",{ref:g,className:"w-full h-full object-contain block",style:{imageRendering:V}}),showAxes:o,overlay:{displayElRef:g,sample:A,version:D,hasSource:!0},notationSeed:p,exportCanvasRef:g,leadingMenus:[wr(y,L=>m(L),!1)],displayAdjust:{exposureEV:P,offset:k,onExposureChange:S,onOffsetChange:C},depthSliders:d.sliders,onRegionSelect:d.hasDeep?d.selectRegion:void 0,onReset:()=>{d.reset(),_.reset()},extraModified:d.isModified||_.isModified,label:a,showLabelChip:!!a})}function pn(e){return Mr(e)?f.jsx(ma,{...e}):f.jsx(ha,{...e})}const Tr={"no-webgpu":0,"no-hdr-browser":1,"no-hdr-display":2},ga="https://github.com/doeringchristian/cairn-plot/blob/main/docs/browser-support.md";function xa(e,t=!1){const n=e||"";return t?"brave":/firefox/i.test(n)?"firefox":/safari/i.test(n)&&!/chrome|chromium|crios|android/i.test(n)?"safari":/linux/i.test(n)&&/chrome|chromium/i.test(n)?"chromium-linux":"chromium"}function ba(e){const t=e||"";return/mac os x|macintosh/i.test(t)?"macos":/windows/i.test(t)?"windows":"other"}function va(e,t){if(e==="no-hdr-display")switch(ba(t.userAgent)){case"macos":return"macOS: EDR engages automatically on HDR-capable displays — confirm your display supports HDR.";case"windows":return"Windows: turn on Settings → System → Display → Use HDR.";default:return"Enable HDR in your display and OS settings."}const n=xa(t.userAgent,t.isBrave);if(e==="no-hdr-browser")switch(n){case"firefox":return"Firefox has no extended-tone-mapping canvas path at all — true HDR output is impossible until Firefox implements it (fundamental browser limitation).";case"safari":return"Safari's WebGPU HDR canvas tone-mapping is still maturing — update to the latest Safari 26+.";default:return"Chrome/Edge 129+ is required for HDR canvas output (toneMapping: extended) — update your browser."}switch(n){case"firefox":return"Firefox: about:config → dom.webgpu.enabled (HDR output is not available in Firefox at all — browser limitation).";case"safari":return"Safari: Develop → Feature Flags → WebGPU (Safari 26+ has it by default).";case"brave":return"Brave: check Shields fingerprint blocking + brave://flags.";case"chromium-linux":return"Chromium on Linux: enable chrome://flags/#enable-unsafe-webgpu.";case"chromium":default:return"Chrome/Edge: enable chrome://flags/#enable-unsafe-webgpu and hardware acceleration."}}function wa(e){switch(e){case"no-webgpu":return"GPU renderer unavailable → CPU fallback active; FLIP kernels + HDR compare disabled.";case"no-hdr-browser":return"True HDR output is unsupported by this browser — a fundamental browser limitation, not a cairn-plot bug → HDR images tone-mapped to SDR.";case"no-hdr-display":return"Your display/OS is not in HDR mode → HDR images tone-mapped to SDR."}}function Pr(e,t){return`cairn-plot:capnotice:${e}:${t}`}const Ar=new Set;function Cr(e){try{if(window.localStorage.getItem(e)==="1")return!0}catch{}try{if(window.sessionStorage.getItem(e)==="1")return!0}catch{}return Ar.has(e)}function ya(e){try{window.localStorage.setItem(e,"1");return}catch{}try{window.sessionStorage.setItem(e,"1");return}catch{}Ar.add(e)}const Rr=new Set;let Bt=null,pt=null;function Dr(){pt&&pt.parentNode&&pt.parentNode.removeChild(pt),pt=null,Bt=null}function Ea(e){const t=Pr(e,window.location.pathname),n=va(e,{userAgent:navigator.userAgent,isBrave:!!navigator.brave}),r=document.createElement("div");r.setAttribute("role","status"),r.setAttribute("data-cairn-plot-capnotice",e),Object.assign(r.style,{position:"fixed",bottom:"12px",right:"12px",zIndex:"2147483000",maxWidth:"340px",boxSizing:"border-box",padding:"10px 30px 10px 12px",borderRadius:"6px",border:"1px solid var(--color-border, #d0d7de)",background:"rgb(var(--color-bg-elevated-rgb, 246 248 250) / 0.9)",color:"var(--color-fg-muted, #656d76)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",boxShadow:"0 4px 12px rgba(0, 0, 0, 0.18)",font:"12px/1.4 system-ui, sans-serif"});const o=document.createElement("div");o.textContent=wa(e),Object.assign(o.style,{fontWeight:"600",color:"var(--color-fg, #1f2328)",marginBottom:"4px"});const a=document.createElement("div");a.textContent=n,a.style.marginBottom="4px";const s=document.createElement("a");s.href=ga,s.target="_blank",s.rel="noopener noreferrer",s.textContent="Learn more",Object.assign(s.style,{color:"var(--color-accent, #0969da)",textDecoration:"none"});const c=document.createElement("button");c.type="button",c.textContent="×",c.setAttribute("aria-label","Dismiss browser capability notice"),c.title="Dismiss",Object.assign(c.style,{position:"absolute",top:"4px",right:"6px",padding:"0 4px",border:"0",background:"transparent",color:"var(--color-fg-subtle, #8b949e)",cursor:"pointer",fontSize:"16px",lineHeight:"1"}),c.addEventListener("click",()=>{ya(t),Dr()}),r.appendChild(o),r.appendChild(a),r.appendChild(s),r.appendChild(c),document.body.appendChild(r),pt=r,Bt=e}function kr(e){if(typeof document>"u"||typeof window>"u"||Rr.has(e))return;Rr.add(e);const t=Pr(e,window.location.pathname);if(Cr(t))return;const n=()=>{if(!Cr(t)){if(Bt!==null)if(Tr[e]<Tr[Bt])Dr();else return;Ea(e)}};document.body?n():window.addEventListener("DOMContentLoaded",n,{once:!0})}const _a={data:new Float32Array(0),shape:[0,0],dtype:"<f4"};function Ma(e){const{h:t,w:n,c:r}=Sr(e.shape);if(e.precision==="f16-bits"){const s=e.data,c=new Uint16Array(n*t*4);for(let l=0;l<n*t;l++){const u=l*r,p=l*4;if(r===1){const x=s[u];c[p]=x,c[p+1]=x,c[p+2]=x,c[p+3]=Mt}else c[p]=s[u],c[p+1]=s[u+1],c[p+2]=s[u+2],c[p+3]=r>=4?s[u+3]:Mt}return{data:c,width:n,height:t,format:"rgba16float"}}const o=e.data,a=new Float32Array(n*t*4);for(let s=0;s<n*t;s++){const c=s*r;let l,u,p,x=1;r===1?l=u=p=Le(o[c]):r===3?(l=Le(o[c]),u=Le(o[c+1]),p=Le(o[c+2])):(l=Le(o[c]),u=Le(o[c+1]),p=Le(o[c+2]),x=Le(o[c+3]));const d=s*4;a[d]=l,a[d+1]=u,a[d+2]=p,a[d+3]=x}return{data:a,width:n,height:t,format:"rgba32float"}}function Lr(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),a=n*o,s=r*o,c=(t.width-a)/2,l=(t.height-s)/2,u=Math.max(e.zoom,1e-6),p=t.width/(u*a),x=t.height/(u*s),d=-c/a-e.pan.x/(u*a),b=-l/s-e.pan.y/(u*s);return{x:d,y:b,w:p,h:x}}function Br(e,t,n,r){const o=e.w*n,a=e.h*r;return o<=0||a<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/a)}function Sa(e){var Ee,ke,_e;const t=Mr(e),n=i.useRef(null),r=i.useRef(null),o=i.useRef(null),a=i.useRef(null),s=i.useRef(null),c=t&&!!((Ee=e.hdr)!=null&&Ee.deep),l=i.useCallback((z,X)=>{var Z,N;(Z=a.current)==null||Z.setDeepWindow(z,X),(N=s.current)==null||N.call(s)},[]),u=_r(t?e.hdr:_a,c?l:void 0),p=i.useRef(!1),[x,d]=i.useState(!1),[b,y]=i.useState(!1),[m,_]=i.useState(!1),[g,h]=i.useState(null),[w,E]=i.useState(0),[T,v]=i.useState(0),[D,M]=i.useState({x:0,y:0,w:1,h:1}),P=i.useRef(null),S=i.useRef(null),[k,C]=i.useState(0),A=e.zoom??1,V=e.pan??{x:0,y:0},L=e.onViewportChange,B=t?"none":e.colormap??"none",[O,I]=i.useState(B);i.useEffect(()=>{I(B)},[B]);const G=t?"none":O,Y=i.useRef(B),le=i.useCallback(()=>{I(Y.current)},[]),j=t?e.tonemap:void 0,[ee,pe]=i.useState(null);i.useEffect(()=>{pe(null)},[j]);const me=Oo(j,x),te=ee??me,ze=ee!==null&&ee!==me,he=i.useCallback(()=>pe(null),[]),[we,ne]=i.useState(yt),re=we!==yt,$=i.useCallback(()=>ne(yt),[]),[ue,Me]=i.useState(0),[ce,ye]=i.useState(0),Te=rn();i.useEffect(()=>{const z=n.current;if(!z)return;let X=!1;return wt().then(Z=>{var Fe;if(X)return;const N=((Fe=Z.probeExtendedToneMapping)==null?void 0:Fe.call(Z))??!1,K=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,q=N&&K&&t;p.current=q,d(q),t&&!q&&kr(N?"no-hdr-display":"no-hdr-browser"),As(z,{hdr:q}).then(Be=>{if(X){ir(Be);return}a.current=Be,_(!0)}).catch(Be=>{X||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",Be),y(!0))})}).catch(Z=>{X||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",Z),y(!0))}),()=>{X=!0,a.current&&(ir(a.current),a.current=null)}},[]),i.useEffect(()=>{const z=r.current;if(!z)return;const X=new ResizeObserver(()=>v(Z=>Z+1));return X.observe(z),()=>X.disconnect()},[]),i.useEffect(()=>{const z=r.current;if(!z)return;const X=new IntersectionObserver(Z=>{const N=Z[0];if(!N)return;const K=a.current;K&&(K.setVisible(N.isIntersecting),N.isIntersecting?K.isParked&&(K.restore(),v(q=>q+1)):K.park())},{threshold:0});return X.observe(z),()=>X.disconnect()},[]),i.useEffect(()=>{var Z;if(!t||!m||c)return;const z=u.hdr;P.current=z;const X=Ma(z);(Z=a.current)==null||Z.setSource(X),h(N=>N&&N.w===X.width&&N.h===X.height?N:{w:X.width,h:X.height}),C(N=>N+1),E(N=>N+1)},[t,m,c,t?u.hdr:null]),i.useEffect(()=>{if(!t||!m||!c)return;const z=e.hdr,X=z.deep;P.current=z;let Z=!1;return X.getGpuCsr().then(N=>{var K;Z||((K=a.current)==null||K.setDeepSource(N,X.zMin,X.zMax),h(q=>q&&q.w===N.width&&q.h===N.height?q:{w:N.width,h:N.height}),C(q=>q+1),E(q=>q+1))}).catch(N=>{Z||console.warn("[cairn] deep GPU CSR upload failed:",N)}),()=>{Z=!0}},[t,m,c,t?e.hdr.deep:null]),i.useEffect(()=>{if(t||!m)return;const z=e,X=z.imageUrl,Z=O;if(!X){S.current=null,h(null),C(K=>K+1);return}let N=!1;return at(X).then(K=>{var Be,Ue;if(N||!K)return;let q=K;if(Z!=="none"){const oe=`gpu::${X}::${Z}::ev${ue}::off${ce}`,Xe=jt(oe);if(Xe)q=Xe;else{const He=Qt(Z);q=Zt(K,Z,He,ue,ce),Jt(oe,q)}}S.current=K;const Fe={data:q.data,width:q.width,height:q.height,format:"rgba8unorm"};(Be=a.current)==null||Be.setSource(Fe),h(oe=>oe&&oe.w===q.width&&oe.h===q.height?oe:{w:q.width,h:q.height}),(Ue=z.onNaturalSize)==null||Ue.call(z,q.width,q.height),C(oe=>oe+1),E(oe=>oe+1)}),()=>{N=!0}},[t,m,t?null:e.imageUrl,t?null:O,t?0:ue,t?0:ce]);const Re=t?e.exposure??0:0,Se=t?e.gamma:void 0,Ie=i.useCallback(()=>{const z=a.current;if(!z||!m||!g)return;const X=r.current,Z=o.current,N=Z?Z.getBoundingClientRect():X?X.getBoundingClientRect():{width:g.w,height:g.h},K=Lr({zoom:A,pan:V},N,g.w,g.h);M(oe=>oe.x===K.x&&oe.y===K.y&&oe.w===K.w&&oe.h===K.h?oe:K),N.width>0&&N.height>0&&z.resize(Math.round(N.width*Te),Math.round(N.height*Te));const q=Br(K,N,g.w,g.h)>=sn?"nearest":"linear",Fe=K,Be=p.current&&Dn(te),Ue=t?{exposureEV:Re+ue,offset:ce,operator:te,gamma:Se,isScalar:!1,hdrOut:Be,peak:we,uv:Fe,filter:q}:{exposureEV:G!=="none"?0:ue,offset:G!=="none"?0:ce,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:Fe,filter:q};try{z.render(Ue)||y(!0)}catch(oe){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",oe),y(!0)}},[m,g,A,V.x,V.y,Re,ue,ce,te,we,Se,t,G,Te]);s.current=Ie,i.useEffect(()=>{Ie()},[Ie,w,T]);const Pe=i.useCallback((z,X,Z)=>{if(t){const Xe=P.current,He=g;if(!Xe||!He||z<0||X<0||z>=He.w||X>=He.h)return null;const bt=Xe.shape.length===2?1:Xe.shape[2]??1,et=(X*He.w+z)*bt,ht=Xe.data,st=Xe.precision==="f16-bits"?mt=>St(ht[mt]??0):mt=>ht[mt]??0,wn=.5,yn=bt===1?[st(et)]:[st(et),st(et+1),st(et+2)];return lt(yn,"unit",Z,wn)}const N=S.current;if(!N||z<0||X<0||z>=N.width||X>=N.height)return null;const K=(X*N.width+z)*4,q=N.data[K],Fe=N.data[K+1],Be=N.data[K+2],Ue=(.299*q+.587*Fe+.114*Be)/255;return lt(G!=="none"||q===Fe&&Fe===Be?[q]:[q,Fe,Be],"uint8",Z,Ue)},[t,g,G]),De=e.showAxes??!1,F=t?e.label??"":e.label,fe=e.interpolation??"auto",Ae=fe==="auto"?void 0:fe,xe=t?void 0:e.overlay,se=t?void 0:e.overlaySettings,ge=t?!1:e.isDraggable??!1,Ne=t?void 0:e.onDragStart;if(b)return t?f.jsx(pn,{...e}):f.jsx(pn,{...e});const Ve=xe&&(se!=null&&se.enabled)&&g&&((((ke=xe.boxes)==null?void 0:ke.length)??0)>0||(((_e=xe.masks)==null?void 0:_e.length)??0)>0)?f.jsx(on,{data:xe,settings:se,naturalWidth:g.w,naturalHeight:g.h}):void 0;return f.jsx(Lt,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":m},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:r,wrapperRef:o,zoom:A,pan:V,onViewportChange:L,naturalDims:g,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:De&&g?"16px 4px 4px 28px":0,surface:f.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:Ae},"data-gpu-image-canvas":!0}),showAxes:De,overlayNode:Ve,overlay:{displayElRef:n,sample:Pe,version:k,hasSource:!0,sourceWindow:D},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:Ie,leadingMenus:t?[wr(te,z=>pe(z),x)]:[dn(G,z=>I(z))],displayAdjust:{exposureEV:ue,offset:ce,onExposureChange:Me,onOffsetChange:ye},extraSliders:t&&Lo(te)?[{id:"peak",label:"PK",title:"Peak white (×SDR white) — HDR roll-off shoulder for the extended Reinhard/ACES operators. Double-click to type a value.",min:Po,max:Ao,step:Co,value:we,onChange:ne,format:z=>`${z.toFixed(1)}×`}]:void 0,depthSliders:u.sliders,onRegionSelect:c?u.selectRegion:void 0,onReset:()=>{le(),he(),$(),u.reset()},extraModified:O!==Y.current||ze||re||u.isModified,label:F,showLabelChip:!!F,isDraggable:ge,onDragStart:Ne})}const Ot=new Map;function Qe(e){if(Ot.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);Ot.set(e.id,e)}function ot(e){return Ot.get(e)}function Ta(){return Array.from(Ot.values())}function Or(e,t){return{...e.params??{},...t??{}}}const Pa={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},Aa={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},Ca={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},Ra={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},Da={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},ka={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},Ir=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];Ba(Ir);const hn=[1.052156925,1,.91835767],La=.7;function Ba(e){const[t,n,r]=e[0],[o,a,s]=e[1],[c,l,u]=e[2],p=a*u-s*l,x=-(o*u-s*c),d=o*l-a*c,y=1/(t*p+n*x+r*d);return[[p*y,-(n*u-r*l)*y,(n*s-r*a)*y],[x*y,(t*u-r*c)*y,-(t*s-r*o)*y],[d*y,-(t*l-n*c)*y,(t*a-n*o)*y]]}function Oa(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const mn=6/29;function gn(e){return e>mn**3?Math.cbrt(e):e/(3*mn*mn)+4/29}function Nr(e,t,n){const[r,o,a]=Oa(Ir,e,t,n),s=gn(r*hn[0]),c=gn(o*hn[1]),l=gn(a*hn[2]),u=116*c-16,p=500*(s-c),x=200*(c-l);return[u,.01*u*p,.01*u*x]}function Ia(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function Na(){const e=Nr(0,1,0),t=Nr(0,0,1);return Math.pow(Ia(e,t),La)}const Fr=Na(),Fa=.082;function Ur(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],a=Math.max(...n,...o),s=Math.ceil(3*Math.sqrt(a/(2*Math.PI**2))*e),c=1/e,l=Math.PI**2,u=[0,0,0];for(let p=-s;p<=s;p++)for(let x=-s;x<=s;x++){const d=(x*c)**2+(p*c)**2;for(let b=0;b<3;b++)u[b]+=t[b]*Math.sqrt(Math.PI/n[b])*Math.exp(-l*d/n[b])+r[b]*Math.sqrt(Math.PI/o[b])*Math.exp(-l*d/o[b])}return{r:s,deltaX:c,sums:u}}function Gr(e){const t=.5*Fa*e,n=Math.ceil(3*t);let r=0,o=0,a=0;for(let s=-n;s<=n;s++)for(let c=-n;c<=n;c++){const l=Math.exp(-(c*c+s*s)/(2*t*t)),u=-c*l,p=(c*c/(t*t)-1)*l;u>0&&(r+=u),p>0?o+=p:a-=p}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:a}}const Ua=`
${$e}
${Ct}
${dt}
${At}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_map0: vec4<f32>; // offX, offY, fitFill, 0
@group(0) @binding(8) var<uniform> u_map1: vec4<f32>; // resultW, resultH, 0, 0
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = mapSample(src, px, u_map0.x, u_map0.y, u_map1.x, u_map1.y, u_map0.z);
  return vec4<f32>(flip_rgb2ycxcz(s.rgb), 1.0);
}
`,Ga=`
${$e}
${Ct}
${dt}
${At}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_map0: vec4<f32>; // offX, offY, fitFill, 0
@group(0) @binding(8) var<uniform> u_map1: vec4<f32>; // resultW, resultH, 0, 0
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = mapSample(src, px, u_map0.x, u_map0.y, u_map1.x, u_map1.y, u_map0.z);
  return vec4<f32>(flip_linrgb2ycxcz(clamp(s.rgb, vec3<f32>(0.0), vec3<f32>(1.0))), 1.0);
}
`,It=`
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
`,zr=`
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
`;function je(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function Nt(e,t,n){const r=n.sourceMap,o=r?t==="a"?r.offsetA:r.offsetB:{x:0,y:0},a=r!=null&&r.fill?1:0;return[je(e,[o.x,o.y,a,0]),je(e+1,[n.width,n.height,0,0])]}function Ft(e){return[je(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),je(2,[e.sums[2],0,0,0])]}function Vr(e){return[je(4,[Fr,e.sd,e.r,e.edgeNorm]),je(5,[e.pointPos,e.pointNeg,0,0])]}function $r(e,t,n,r,o,a=""){const s=Ur(e),c=Gr(e),l=`ycxczA${a}`,u=`ycxczB${a}`,p=`labA${a}`,x=`labB${a}`,d=`flip${a}`;return{passes:[{name:l,shader:t,inputs:[n],output:l,uniforms:()=>Nt(1,"a",o)},{name:u,shader:t,inputs:[r],output:u,uniforms:()=>Nt(1,"b",o)},{name:p,shader:It,inputs:[l],output:p,uniforms:()=>Ft(s)},{name:x,shader:It,inputs:[u],output:x,uniforms:()=>Ft(s)},{name:d,shader:zr,inputs:[p,x,l,u],output:d,uniforms:()=>Vr(c)}],flipRef:d}}const za={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=$r(t,Ua,"srcA","srcB",e);return{passes:n,final:r}}},Va={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=$r(t,Ga,"srcA","srcB",e);return{passes:n,final:r}}},Xr=`
${$e}
${Ct}
${dt}
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
`,$a=`
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
`,Xa={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",output:"scalar",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),a=(r-n)/Math.max(o-1,1),s=Ur(t),c=Gr(t),l=[];let u=null;for(let p=0;p<o;p++){const x=n+p*a,d=`_e${p}`,b=`ycxczA${d}`,y=`ycxczB${d}`,m=`labA${d}`,_=`labB${d}`,g=`acc${d}`;l.push({name:b,shader:Xr,inputs:["srcA"],output:b,uniforms:()=>[je(1,[x,0,0,0]),...Nt(2,"a",e)]},{name:y,shader:Xr,inputs:["srcB"],output:y,uniforms:()=>[je(1,[x,0,0,0]),...Nt(2,"b",e)]},{name:m,shader:It,inputs:[b],output:m,uniforms:()=>Ft(s)},{name:_,shader:It,inputs:[y],output:_,uniforms:()=>Ft(s)}),u===null?l.push({name:g,shader:zr,inputs:[m,_,b,y],output:g,uniforms:()=>Vr(c)}):l.push({name:g,shader:$a,inputs:[m,_,b,y,u],output:g,uniforms:()=>[je(5,[Fr,c.sd,c.r,c.edgeNorm]),je(6,[c.pointPos,c.pointNeg,0,0])]}),u=g}return{passes:l,final:u}}},Wa=.01,Ha=.03,Wr=1,Hr=1.5,Yr=5,Kr=`
fn ssim_srgb2linear(c: f32) -> f32 {
  if (c <= 0.04045) { return c / 12.92; }
  return pow((c + 0.055) / 1.055, 2.4);
}
fn ssim_luma(srgb: vec3<f32>) -> f32 {
  let lin = vec3<f32>(ssim_srgb2linear(srgb.r), ssim_srgb2linear(srgb.g), ssim_srgb2linear(srgb.b));
  return clamp(dot(lin, vec3<f32>(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
}
`,Ya=`
${$e}
${Kr}
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
`,Ka=`
${$e}
${Kr}
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
`,qr=`
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
`,qa=`
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
`;function xn(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function Zr(e,t){const n=`${t}H`,r=`${t}V`;return{passes:[{name:n,shader:qr,inputs:[e],output:n,uniforms:()=>[xn(1,[1,0,Yr,Hr])]},{name:r,shader:qr,inputs:[n],output:r,uniforms:()=>[xn(1,[0,1,Yr,Hr])]}],out:r}}const Za={kind:"multipass",id:"ssim",label:"SSIM (1−SSIM)",publicName:"ssim",displayRange:"unit",output:"scalar",buildPasses(e){const t=(Wa*Wr)**2,n=(Ha*Wr)**2,r=Zr("momA","statsA"),o=Zr("momB","statsB");return{passes:[{name:"momA",shader:Ya,inputs:["srcA","srcB"],output:"momA"},{name:"momB",shader:Ka,inputs:["srcA","srcB"],output:"momB"},...r.passes,...o.passes,{name:"ssim",shader:qa,inputs:[r.out,o.out],output:"ssim",uniforms:()=>[xn(2,[t,n,0,0])]}],final:"ssim"}}};let Qr=!1;function Qa(){Qr||(Qr=!0,Qe(Aa),Qe(Pa),Qe(Ca),Qe(Da),Qe(Ra),Qe(ka),Qe(za),Qe(Xa),Qe(Va),Qe(Za))}Qa();function jr(){const e=[];for(const n of Ta())n.kind==="pointwise"&&e.push({id:n.id,label:n.label});e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"});const t=ot("ssim");return t&&e.push({id:t.id,label:t.label}),e}function ja(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}const Jr=new WeakMap;function bn(e,t,n,r){let o=Jr.get(e);o||(o=new Map,Jr.set(e,o));const a=`${t}::${r}`;let s=o.get(a);return s||(s=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(a,s)),s}function Ja(e){return`
${$e}
${dt}
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
`}const Ut="rgba16float";function ei(e,t,n,r,o,a){var _,g;const s=ot(r);if(!s)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const c=a??Rt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),l=c.result.w,u=c.result.h,p=c.fit==="fill"?1:0,x=Or(s,o);if(s.kind==="pointwise"){const h=e.createTexture(l,u,Ut),w=bn(e,`pw:${s.id}`,Ja(s.source),Ut),E=new Float32Array([c.offsetA.x,c.offsetA.y,c.offsetB.x,c.offsetB.y]),T=new Float32Array([l,u,p,0]);let v;try{v=e.createBindGroup(w,[{binding:0,resource:t},{binding:1,resource:n},{binding:2,resource:{uniform:E}},{binding:3,resource:{uniform:T}}]),e.renderFullscreen(h,w,v)}finally{(_=v==null?void 0:v.destroy)==null||_.call(v)}return h}const d={width:l,height:u,params:x,sourceMap:{fill:c.fit==="fill",offsetA:c.offsetA,offsetB:c.offsetB}},b=s.buildPasses(d),y=new Map([["srcA",t],["srcB",n]]),m=[];try{for(const w of b.passes){const E=e.createTexture(l,u,Ut);m.push(E),y.set(w.output,E);const T=bn(e,`mp:${s.id}:${w.name}`,w.shader,Ut),v=w.inputs.map((M,P)=>{const S=y.get(M);if(!S)throw new Error(`computeDiff: pass "${w.name}" input "${M}" not produced yet`);return{binding:P,resource:S}});w.uniforms&&v.push(...w.uniforms(d));let D;try{D=e.createBindGroup(T,v),e.renderFullscreen(E,T,D)}finally{(g=D==null?void 0:D.destroy)==null||g.call(D)}}const h=y.get(b.final);if(!h)throw new Error(`computeDiff: final ref "${b.final}" not produced`);for(const w of m)w!==h&&w.destroy();return h}catch(h){for(const w of m)w.destroy();throw h}}const ti=8,ni=256*1024*1024;class ri{constructor(t=ti,n=ni){ie(this,"map",new Map);ie(this,"totalBytes",0);this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}accountReadbackBytes(t,n){let r=!1;for(const o of this.map.values())if(o===t){r=!0;break}r&&(t.bytes+=n,this.totalBytes+=n,this.evict())}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const eo=new WeakMap;function to(e){let t=eo.get(e);return t||(t=new ri,eo.set(e,t)),t}function oi(e,t){const n=Or(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function si(e,t,n,r,o){const a=ot(n),s=a?oi(a,r):"",c=o?vs(o):"";return`${e}|${t}|${n}|${s}|${c}`}function ai(e,t,n,r,o,a,s,c){const l=ot(r);if(!l)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const u=to(e),p=c??Rt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),x=si(a,s,r,o,p),d=u.get(x);if(d)return d;const b=ei(e,t,n,r,o,p),y=p.result.w,m=p.result.h,_={texture:b,width:y,height:m,displayRange:l.displayRange,bytes:y*m*8};return u.set(x,_),_}async function ii(e,t,n,r,o){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=tr(e,n,r,o).then(a=>(t.scalars=a,a))),t.scalarsPending)}async function ci(e,t){return t.resultSamples?t.resultSamples:(t.resultSamplesPending||(t.resultSamplesPending=e.readback(t.texture).then(n=>{const r=n instanceof Float32Array?n:Float32Array.from(n);return t.resultSamples=r,to(e).accountReadbackBytes(t,r.byteLength),r})),t.resultSamplesPending)}const li=`
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
`,ui={unit:0,signed:1,relative:2},fi={linear:0,signed:1,positive:2};function di(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function pi(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function hi(e,t,n,r,o){var b,y,m;const a=pi(t),s=bn(e,"diff-display",li,a),c=di(e,o.colormap),l=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),u=new Float32Array([ui[r],fi[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]),p=new Float32Array([o.exposureEV??0,o.offset??0,0,0]),x=new Float32Array([((b=o.sourceDims)==null?void 0:b.w)??0,((y=o.sourceDims)==null?void 0:y.h)??0,0,0]);let d;try{d=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:c},{binding:2,resource:{uniform:l}},{binding:3,resource:{uniform:u}},{binding:4,resource:{uniform:p}},{binding:5,resource:{uniform:x}}]),e.renderFullscreen(t,s,d)}finally{(m=d==null?void 0:d.destroy)==null||m.call(d),c.destroy()}}const no=.6*.6*2.51,mi=.6*.03,gi=0,ro=.6*.6*2.43,xi=.6*.59,bi=.14;function oo(e){const t=(mi-xi*e)/(no-ro*e),n=(gi-bi*e)/(no-ro*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const vi=.85,wi=.85,so=11920928955078125e-23,vn=[.2126,.7152,.0722];function yi(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function Ei(e,t,n,r=3,o={}){const a=t*n,s=oo(vi),c=oo(wi),l=new Float64Array(a);let u=0;for(let h=0;h<a;h++){const[w,E,T]=yi(e,h,r),v=w*vn[0]+E*vn[1]+T*vn[2];l[h]=v,v>u&&(u=v)}const p=Float64Array.from(l).sort(),x=a>>1,d=a%2===1?p[x]:p[x-1],b=Math.max(d,so),y=Math.max(u,so),m=o.startExposure??Math.log2(s/y),_=o.stopExposure??Math.log2(c/b),g=Math.max(2,Math.ceil(_-m));return{startExposure:m,stopExposure:_,numExposures:g}}const _i={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Mi({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:a,zoom:s,pan:c,onViewportChange:l,processing:u=_i,interpolation:p="auto",label:x="",isDraggable:d=!1,onDragStart:b,overlay:y,overlaySettings:m,pixelValueNotation:_="decimal"}){var he,we;const g=i.useRef(null),[h,w]=i.useState(null),[E,T]=i.useState(null),[v,D]=i.useState(_),[M,P]=i.useState(!1),S=i.useRef(null),k=i.useRef(null),C=i.useRef(null),A=i.useRef(null),[V,L]=i.useState(0);i.useEffect(()=>{if(!e){C.current=null,L(re=>re+1);return}let ne=!1;return at(e).then(re=>{ne||(C.current=re,L($=>$+1))}),()=>{ne=!0}},[e]),i.useEffect(()=>{if(!t){A.current=null,L(re=>re+1);return}let ne=!1;return at(t).then(re=>{ne||(A.current=re,L($=>$+1))}),()=>{ne=!0}},[t]);const B=ne=>(re,$,ue)=>{const Me=ne.current;if(!Me||re<0||$<0||re>=Me.width||$>=Me.height)return null;const ce=($*Me.width+re)*4,ye=Me.data[ce],Te=Me.data[ce+1],Re=Me.data[ce+2],Se=(.299*ye+.587*Te+.114*Re)/255;return ye===Te&&Te===Re?{lines:[ft(ye,"uint8",ue)],luminance:Se}:{lines:[ft(ye,"uint8",ue),ft(Te,"uint8",ue),ft(Re,"uint8",ue)],luminance:Se,colors:[Pt[0],Pt[1],Pt[2]]}},O=i.useMemo(()=>B(C),[]),I=i.useMemo(()=>B(A),[]),G=!!y&&!!(m!=null&&m.enabled)&&!!h&&!!e&&((((he=y.boxes)==null?void 0:he.length)??0)>0||(((we=y.masks)==null?void 0:we.length)??0)>0),{gammaFilterId:Y,filterStr:le,gamma:j,offset:ee}=cr(u),pe=`translate(${c.x}px, ${c.y}px) scale(${s})`,me=p==="auto"?void 0:p,{containerProps:te,modifierActive:ze}=Wn({containerRef:g,zoom:s,pan:c,onViewportChange:l});return f.jsxs("div",{className:"relative flex flex-col h-full",children:[f.jsx(lr,{id:Y,gamma:j,offset:ee}),f.jsxs("div",{ref:g,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...te.style},onPointerDown:te.onPointerDown,onPointerMove:te.onPointerMove,onPointerUp:te.onPointerUp,onPointerCancel:te.onPointerCancel,children:[f.jsxs("div",{className:"relative w-full h-full",children:[f.jsxs("div",{className:"relative w-full h-full",style:{transform:pe,transformOrigin:"0 0"},children:[f.jsx("img",{ref:S,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:le,imageRendering:me,...n==="blend"?{opacity:o}:{}},onLoad:ne=>{const re=ne.currentTarget;w({w:re.naturalWidth,h:re.naturalHeight})}}),G&&f.jsx(on,{data:y,settings:m,naturalWidth:h.w,naturalHeight:h.h})]}),f.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:f.jsx("div",{className:"w-full h-full",style:{transform:pe,transformOrigin:"0 0"},children:f.jsx("img",{ref:k,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:le,imageRendering:me,...n==="blend"?{opacity:1-o}:{}},onLoad:ne=>{const re=ne.currentTarget;T({w:re.naturalWidth,h:re.naturalHeight})}})})}),n==="split"&&f.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${r*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:()=>a==null?void 0:a(.5),onPointerDown:ne=>{ne.stopPropagation(),ne.preventDefault();const re=ne.currentTarget;try{re.setPointerCapture(ne.pointerId)}catch{}const ue=re.parentElement.getBoundingClientRect(),Me=ye=>{a==null||a(Math.max(0,Math.min(1,(ye.clientX-ue.left)/ue.width)))},ce=()=>{window.removeEventListener("pointermove",Me),window.removeEventListener("pointerup",ce)};window.addEventListener("pointermove",Me),window.addEventListener("pointerup",ce)},children:f.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})]}),n==="split"?f.jsxs(f.Fragment,{children:[t&&E&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:f.jsx(ut,{imageElRef:k,naturalWidth:E.w,naturalHeight:E.h,zoom:s,pan:c,sample:I,notation:v,version:V})}),e&&h&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:f.jsx(ut,{imageElRef:S,naturalWidth:h.w,naturalHeight:h.h,zoom:s,pan:c,sample:O,notation:v,version:V,onActiveChange:P})})]}):e&&h&&f.jsx(ut,{imageElRef:S,naturalWidth:h.w,naturalHeight:h.h,zoom:s,pan:c,sample:O,notation:v,version:V,onActiveChange:P}),M&&f.jsx(Yn,{notation:v,onChange:D})]}),n==="split"&&f.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),f.jsxs("span",{className:`absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${d&&!ze?" cairn-drag-grip":""}`,draggable:d&&!ze,onDragStart:b,style:{cursor:d&&!ze?"grab":void 0},children:[f.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50"}),x]})]})}function Si(){return f.jsx("div",{className:"card p-4 text-sm text-red-400 h-full flex items-center justify-center text-center",children:"Plot error: float URL sources need the GPU compare (WebGPU) — unavailable here"})}function Ti({mode:e,kernel:t,kernelOptions:n,onSlide:r,onBlend:o,onKernel:a,onSide:s}){return{id:"compare-mode",title:"Compare / diff mode",menu:{options:[...s?[{id:"side",label:"Side"}]:[],{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...n],value:e==="side"?"side":e==="split"?"slide":e==="blend"?"blend":t,onSelect:u=>{u==="side"?s==null||s():u==="slide"?r():u==="blend"?o():a(u)}}}}function Pi(e){const t=Wt(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function Ai(e){const{width:t,height:n,channels:r}=e,o=t*n;if(e.precision==="f16-bits"){const l=e.data,u=new Uint16Array(o*4);for(let p=0;p<o;p++){const x=p*r,d=p*4;if(r===1){const b=l[x];u[d]=b,u[d+1]=b,u[d+2]=b,u[d+3]=Mt}else u[d]=l[x],u[d+1]=l[x+1],u[d+2]=l[x+2],u[d+3]=r>=4?l[x+3]:Mt}return{data:u,format:"rgba16float"}}const a=e.data,s=new Float32Array(o*4),c=l=>Number.isFinite(l)?l:0;for(let l=0;l<o;l++){const u=l*r;let p,x,d,b=1;r===1?p=x=d=c(a[u]):r===3?(p=c(a[u]),x=c(a[u+1]),d=c(a[u+2])):(p=c(a[u]),x=c(a[u+1]),d=c(a[u+2]),b=c(a[u+3]));const y=l*4;s[y]=p,s[y+1]=x,s[y+2]=d,s[y+3]=b}return{data:s,format:"rgba32float"}}function Ci({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:a,blendAlpha:s,onSplitPositionChange:c,diffSubmode:l,colormap:u="none",align:p="top-left",fit:x="crop",diffKernel:d,onDiffKernelChange:b,onCompareModeChange:y,onRequestSide:m,zoom:_,pan:g,onViewportChange:h,interpolation:w="auto",label:E="",pixelValueNotation:T="decimal"}){var mt;const v=i.useRef(null),D=i.useRef(null),M=i.useRef(null),P=i.useRef(null),S=i.useRef(null),[k,C]=i.useState(!1),[A,V]=i.useState(!1),[L,B]=i.useState(null),[O,I]=i.useState(null),[G,Y]=i.useState(0),[le,j]=i.useState(0),[ee,pe]=i.useState(null),[me,te]=i.useState({x:0,y:0,w:1,h:1}),ze=d??l??"absolute",[he,we,ne]=ct(ze);i.useEffect(()=>{we(d??l??"absolute")},[d,l,we]);const re=i.useCallback(R=>{we(R),b==null||b(R)},[b,we]);i.useEffect(()=>{const R=v.current;if(R)return R.__cairnDiffKernel={current:he,set:re},()=>{R&&delete R.__cairnDiffKernel}},[he,re]);const[$,ue,Me]=ct(o);i.useEffect(()=>{ue(o)},[o,ue]);const ce=i.useCallback(R=>{ue(R),y==null||y(R)},[y,ue]),[ye,Te,Re]=ct(u);i.useEffect(()=>{Te(u)},[u,Te]);const Se=i.useCallback(()=>{ce(Me.default),Te(Re.default),re(ne.default)},[ce,Te,re,Me.default,Re.default,ne.default]),Ie=Me.isModified||Re.isModified||ne.isModified,[Pe,De]=i.useState(0),[F,fe]=i.useState(0),Ae=i.useMemo(()=>{const W=[Ti({mode:$,kernel:he,kernelOptions:jr().map(H=>({id:H.id,label:H.label})),onSide:m,onSlide:()=>ce("split"),onBlend:()=>ce("blend"),onKernel:H=>{ce("diff"),re(H)}})];return $==="diff"&&W.push(dn(ye,H=>Te(H))),W},[$,he,ye,re,ce,m]),xe=i.useRef(null),se=i.useRef(null),ge=i.useRef(null),Ne=i.useRef(null),[Ve,Ee]=i.useState(0),ke=i.useRef(null),_e=i.useRef(null),[z,X]=i.useState(0),Z=rn();i.useEffect(()=>{const R=M.current;if(!R)return;let W=!1;return wt().then(H=>{if(!W)try{if(rr())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const U=H.createSurface(R,{hdr:!1});P.current={device:H,surface:U,texA:null,texB:null},V(!0)}catch(U){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",U),C(!0)}}).catch(H=>{W||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",H),C(!0))}),()=>{var U,J;W=!0;const H=P.current;H&&((U=H.texA)==null||U.destroy(),(J=H.texB)==null||J.destroy(),P.current=null)}},[]),i.useEffect(()=>{const R=v.current;if(!R)return;const W=new ResizeObserver(()=>j(H=>H+1));return W.observe(R),()=>W.disconnect()},[]),i.useEffect(()=>{if(!A)return;let R=!1;if(!P.current)return;async function H(U,J){if(J){const be=Ai(J);return{width:J.width,height:J.height,imageData:null,make:Ce=>{const de=Ce.createTexture(J.width,J.height,be.format);return de.write(be.data),de}}}if(!U)return null;const ae=await at(U);return ae?{width:ae.width,height:ae.height,imageData:ae,make:be=>{const Ce=be.createTexture(ae.width,ae.height,"rgba8unorm");return Ce.write(ae.data),Ce}}:null}return Promise.all([H(e,n),H(t,r)]).then(([U,J])=>{var Ge,Ye;if(R||!P.current)return;const ae=P.current;xe.current=(U==null?void 0:U.imageData)??null,se.current=(J==null?void 0:J.imageData)??null,ge.current=n??null,Ne.current=r??null,(Ge=ae.texA)==null||Ge.destroy(),(Ye=ae.texB)==null||Ye.destroy(),ae.texA=null,ae.texB=null;const be=U??J;if(!be){B(null),I(null),Ee(We=>We+1);return}const Ce=J??be,de=U??be;ae.texA=Ce.make(ae.device),ae.texB=de.make(ae.device),I({a:{w:Ce.width,h:Ce.height},b:{w:de.width,h:de.height}}),B({w:be.width,h:be.height}),Ee(We=>We+1),Y(We=>We+1)}),()=>{R=!0}},[A,e,t,n,r]);const N=n!=null||r!=null,K=i.useMemo(()=>ja(he,N),[he,N]),q=i.useMemo(()=>{if(!N)return null;const R=r??n;if(!R)return null;const W=R.precision==="f16-bits"?Fn(R.data):R.data;return Ei(W,R.width,R.height,R.channels)},[N,r,n]),Fe=i.useMemo(()=>{var R;return No(((R=ot(K))==null?void 0:R.displayRange)??"unit",ye==="none"?null:ye)},[K,ye]),Be=i.useMemo(()=>ye!=="none"?Pi(ye):void 0,[ye]),Ue=i.useMemo(()=>O?Rt(O.a,O.b,p,x,"b"):null,[O,p,x]),oe=i.useMemo(()=>L?$==="diff"&&Ue?Ue.result:L:null,[$,Ue,L]),Xe=i.useCallback(()=>{const R=P.current;if(!A||!R||!R.surface||!R.texA||!R.texB||!L)return;const W=oe??L,H=v.current,U=H?H.getBoundingClientRect():{width:W.w,height:W.h},J=Lr({zoom:_,pan:g},U,W.w,W.h);te(de=>de.x===J.x&&de.y===J.y&&de.w===J.w&&de.h===J.h?de:J);const ae=M.current;if(U.width>0&&U.height>0&&ae&&R.surface){const de=Math.max(1,Math.round(U.width*Z)),Ge=Math.max(1,Math.round(U.height*Z));(ae.width!==de||ae.height!==Ge)&&(ae.width=de,ae.height=Ge,R.surface.configure(de,Ge))}const be=Br(J,U,W.w,W.h)>=sn?"nearest":"linear",Ce=J;try{if($==="diff"){const de=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",Ge=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",Ye=ot(K)?K:"absolute",We=Ye==="hdr-flip"&&q?{ppd:67,startExposure:q.startExposure,stopExposure:q.stopExposure,numExposures:q.numExposures}:void 0,gt=ai(R.device,R.texA,R.texB,Ye,We,de,Ge,Ue??void 0);S.current=gt,hi(R.device,R.surface,gt.texture,gt.displayRange,{uv:Ce,cmapMode:Fe,colormap:Be,filter:be,exposureEV:Pe,offset:F})}else{const de={exposureEV:Pe,offset:F,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:Ce,filter:be,mode:$,split:a,alpha:s};_s(R.device,R.surface,R.texA,R.texB,de)}}catch(de){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",de),C(!0)}},[A,L,oe,Ue,_,g.x,g.y,$,a,s,Pe,F,he,K,q,Fe,Be,e,t,n,r,Z]);i.useEffect(()=>{Xe()},[Xe,G,le]);const He=t!=null||r!=null;i.useEffect(()=>{const R=P.current;if(!A||!R||!R.texA||!R.texB||!He){pe(null);return}let W=!1;const H=R.texA,U=R.texB,J=S.current,ae=$==="diff"?Ue??void 0:void 0;return($==="diff"&&J?ii(R.device,J,H,U,ae):tr(R.device,H,U,ae)).then(Ce=>{W||pe(Ce)}),()=>{W=!0}},[A,G,He,$,he,Ue]),i.useEffect(()=>{if($!=="diff"){ke.current=null,_e.current=null;return}const R=P.current,W=S.current;if(!A||!R||!W)return;let H=!1;return ke.current=null,_e.current=null,X(U=>U+1),ci(R.device,W).then(U=>{H||(ke.current=U,_e.current={w:W.width,h:W.height},X(J=>J+1))}).catch(()=>{}),()=>{H=!0}},[A,$,K,G,Ue]);const bt=(R,W)=>(H,U,J)=>{const ae=W.current;if(ae){const{data:gt,width:ao,height:ki,channels:io}=ae;if(H<0||U<0||H>=ao||U>=ki)return null;const Gt=(U*ao+H)*io,zt=ae.precision==="f16-bits"?En=>St(gt[En]??0):En=>gt[En]??0,Li=.5,Bi=io===1?[zt(Gt)]:[zt(Gt),zt(Gt+1),zt(Gt+2)];return lt(Bi,"unit",J,Li)}const be=R.current;if(!be||H<0||U<0||H>=be.width||U>=be.height)return null;const Ce=(U*be.width+H)*4,de=be.data[Ce],Ge=be.data[Ce+1],Ye=be.data[Ce+2],We=(.299*de+.587*Ge+.114*Ye)/255;return lt(de===Ge&&Ge===Ye?[de]:[de,Ge,Ye],"uint8",J,We)},et=i.useMemo(()=>bt(xe,ge),[]),ht=i.useMemo(()=>bt(se,Ne),[]),st=i.useMemo(()=>(R,W,H)=>{var We;const U=ke.current,J=_e.current;if(!U||!J)return null;const{w:ae,h:be}=J;if(R<0||W<0||R>=ae||W>=be)return null;const Ce=(W*ae+R)*4,de=((We=ot(K))==null?void 0:We.output)??"per-channel",Ge=.5,Ye=de==="scalar"?[U[Ce]??0]:[U[Ce]??0,U[Ce+1]??0,U[Ce+2]??0];return lt(Ye,"unit",H,Ge)},[K]);i.useEffect(()=>{const R=v.current;if(R)return R.__cairnCompareProbe={sampleDiff:(W,H,U="decimal")=>st(W,H,U),sampleFg:(W,H,U="decimal")=>et(W,H,U),sampleRef:(W,H,U="decimal")=>ht(W,H,U),get diffSamples(){return ke.current},get dims(){return oe},get primaryDims(){return L},get diffResultDims(){return _e.current},get align(){return p},get fit(){return x},get resolvedKernelId(){return K},get compareMode(){return $}},()=>{R&&delete R.__cairnCompareProbe}},[st,et,ht,L,oe,p,x,K,$]);const wn=w==="auto"?void 0:w;if(k)return n!=null||r!=null?f.jsx(Si,{}):$==="diff"?f.jsx(pn,{imageUrl:e,baselineUrl:t,diffMode:((mt=ot(K))==null?void 0:mt.kind)==="pointwise"?K:"absolute",interpolation:w,colormap:ye,showAxes:!1,zoom:_,pan:g,onViewportChange:h,label:E,pixelValueNotation:T}):f.jsx(Mi,{imageUrl:e,baselineUrl:t,mode:$,splitPosition:a,blendAlpha:s,onSplitPositionChange:c,zoom:_,pan:g,onViewportChange:h,interpolation:w,label:E,pixelValueNotation:T});const yn=f.jsxs(f.Fragment,{children:[f.jsx("canvas",{ref:M,className:"w-full h-full block",style:{imageRendering:wn},"data-gpu-compare-canvas":!0}),$==="split"&&f.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${a*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:R=>{R.stopPropagation(),c==null||c(.5)},onPointerDown:R=>{R.stopPropagation(),R.preventDefault();const W=R.currentTarget;try{W.setPointerCapture(R.pointerId)}catch{}const U=W.parentElement.getBoundingClientRect(),J=be=>{c==null||c(Math.max(0,Math.min(1,(be.clientX-U.left)/U.width)))},ae=()=>{window.removeEventListener("pointermove",J),window.removeEventListener("pointerup",ae)};window.addEventListener("pointermove",J),window.addEventListener("pointerup",ae)},children:f.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})]});return f.jsx(Lt,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":A},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:v,wrapperRef:D,zoom:_,pan:g,onViewportChange:h,naturalDims:oe,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:yn,showAxes:!1,notationSeed:T,onReset:Se,extraModified:Ie,exportCanvasRef:M,requestRender:Xe,leadingMenus:Ae,displayAdjust:{exposureEV:Pe,offset:F,onExposureChange:De,onOffsetChange:fe},label:"",showLabelChip:!1,overlay:{render:({notation:R,setOverlayActive:W})=>$==="split"?f.jsxs(f.Fragment,{children:[He&&oe&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-a)*100}% 0 0)`},children:f.jsx(ut,{imageElRef:M,naturalWidth:oe.w,naturalHeight:oe.h,zoom:_,pan:g,sourceWindow:me,sample:ht,notation:R,version:Ve})}),He&&oe&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${a*100}%)`},children:f.jsx(ut,{imageElRef:M,naturalWidth:oe.w,naturalHeight:oe.h,zoom:_,pan:g,sourceWindow:me,sample:et,notation:R,version:Ve,onActiveChange:W})})]}):oe&&f.jsx(ut,{imageElRef:M,naturalWidth:oe.w,naturalHeight:oe.h,zoom:_,pan:g,sourceWindow:me,sample:$==="diff"?st:et,notation:R,version:$==="diff"?z:Ve,onActiveChange:W})},extraChips:f.jsxs(f.Fragment,{children:[$==="split"&&f.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),E?f.jsx("span",{className:"absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm",children:E}):null,ee&&f.jsxs("span",{className:`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${E?"bottom-7":"bottom-1"}`,"data-gpu-compare-metrics":!0,children:["MSE ",ee.mse.toExponential(2)," · PSNR ",Number.isFinite(ee.psnr)?ee.psnr.toFixed(1):"∞"," dB · MAE"," ",ee.mae.toExponential(2)]})]})})}const Ri="cairn-plot:gpu-image-ready";async function Di(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await wt(),window.__cairnPlotGpuImagePane=Sa,window.__cairnPlotGpuComparePane=Ci,window.__cairnPlotDiffMenuModes=jr(),window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(Ri))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e),kr("no-webgpu")}}}Di()})(__cairnPlotJsxRuntime,__cairnPlotReact);
