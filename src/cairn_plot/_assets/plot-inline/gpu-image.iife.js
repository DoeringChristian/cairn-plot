var Lc=Object.defineProperty;var Bc=(f,c,rt)=>c in f?Lc(f,c,{enumerable:!0,configurable:!0,writable:!0,value:rt}):f[c]=rt;var se=(f,c,rt)=>Bc(f,typeof c!="symbol"?c+"":c,rt);(function(f,c){"use strict";const rt=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function Nn(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:rt}),{hdr:!1,format:n}}function Xo(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:rt}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:rt}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return Nn(e,t)}}}const Wo=`
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
`,Ho=`
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
`;class Yo extends Error{constructor(n){super(n);se(this,"deviceLost",!0);this.name="DeviceLostError"}}async function Fn(e,t){try{await e.mapAsync(GPUMapMode.READ)}catch(n){if((n instanceof Error?n.name:"")==="AbortError"){const o=t.info;throw new Yo("webgpu readback: buffer map aborted — device lost or destroyed mid-readback"+(o?` (reason=${String(o.reason)}${o.message?`: ${o.message}`:""})`:"")+`: ${n instanceof Error?n.message:String(n)}`)}throw n instanceof Error?n:new Error(String(n))}}function qt(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Un(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Ko(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const qo={texture:0,sampler:1,uniform:2};function Zt(e,t){return e*3+qo[t]}const Zo={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function jo(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),s=r[2]!==void 0,i=r[3].trim();if(s){const u=Zo[i];if(u===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${i}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:u})}else i==="sampler"||i==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class Gn{constructor(t,n,r,o){se(this,"width");se(this,"height");se(this,"format");se(this,"gpuTexture");se(this,"device");se(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:qt(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*Un(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class zn{constructor(t){se(this,"_s");se(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class Qo{constructor(t,n,r,o,s){se(this,"_p");se(this,"gpuPipeline");se(this,"bindings");se(this,"bindGroupLayout");se(this,"variants");se(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=s,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function Jo(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class es{constructor(t){se(this,"_c");se(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class ts{constructor(t,n,r,o,s){se(this,"width");se(this,"height");se(this,"paramsBuffer");se(this,"bindGroup");se(this,"buffers");se(this,"destroyed",!1);this.width=t,this.height=n,this.buffers=r,this.paramsBuffer=o,this.bindGroup=s}destroy(){if(!this.destroyed){for(const t of this.buffers)t.destroy();this.paramsBuffer.destroy(),this.destroyed=!0}}}class ns{constructor(t,n){se(this,"_b");se(this,"gpuBindGroup");se(this,"ownedBuffers");se(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class rs{constructor(t,n,r,o){se(this,"canvas");se(this,"hdr");se(this,"format");se(this,"context");se(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function St(e){return"canvas"in e}async function os(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function s(h){return St(h)?h.getCurrentTextureView():h.gpuTexture.createView()}function i(h){if(St(h))return{width:h.canvas.width,height:h.canvas.height};const b=h;return{width:b.width,height:b.height}}let u=!1;const a={};t.lost.then(h=>{a.info=h},()=>{});let l=null;function d(){var b,y;if(l!==null)return l;let h=!1;try{if(typeof document<"u"){const E=document.createElement("canvas");E.width=1,E.height=1;const R=E.getContext("webgpu");if(R)try{R.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:GPUTextureUsage.RENDER_ATTACHMENT});const P=(b=R.getConfiguration)==null?void 0:b.call(R);h=((y=P==null?void 0:P.toneMapping)==null?void 0:y.mode)==="extended"}catch{h=!1}finally{try{R.unconfigure()}catch{}}}}catch{h=!1}return l=h,h}const x=256;let p=null,v=null;function _(){if(!p||!v){const h=t.createShaderModule({code:Wo});v=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const b=t.createPipelineLayout({bindGroupLayouts:[v]});p=t.createComputePipeline({layout:b,compute:{module:h,entryPoint:"cs_main"}})}return{pipeline:p,layout:v}}let w=null,M=null;function m(){if(!w||!M){const h=t.createShaderModule({code:Ho});M=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});const b=t.createPipelineLayout({bindGroupLayouts:[M]});w=t.createRenderPipeline({layout:b,vertex:{module:h,entryPoint:"vs_main"},fragment:{module:h,entryPoint:"fs_main",targets:[{format:"rgba16float"}]},primitive:{topology:"triangle-list"}})}return{pipeline:w,layout:M}}return{backend:"webgpu",capabilities:n,probeExtendedToneMapping:d,createTexture(h,b,y){return new Gn(t,h,b,y)},createSampler(h){const b=(h==null?void 0:h.filter)==="linear"?"linear":"nearest",y=t.createSampler({magFilter:b,minFilter:b,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new zn(y)},createRenderPipeline(h){const b=t.createShaderModule({code:h.shaderWGSL}),y=jo(h.shaderWGSL),E=qt(h.targetFormat),R=Jo(t,y),P=t.createPipelineLayout({bindGroupLayouts:[R]}),S=A=>t.createRenderPipeline({layout:P,vertex:{module:b,entryPoint:"vs_main"},fragment:{module:b,entryPoint:"fs_main",targets:[{format:A}]},primitive:{topology:"triangle-list"}}),T=S(E);return new Qo(T,y,R,E,S)},createComputePipeline(h){const b=t.createShaderModule({code:h.shaderWGSL}),y=t.createComputePipeline({layout:"auto",compute:{module:b,entryPoint:"cs_main"}});return new es(y)},createBindGroup(h,b){const y=h,E=new Map,R=[];for(const[S,T]of y.bindings)if(T.kind==="uniform"){const A=t.createBuffer({size:T.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});R.push(A),E.set(S,{binding:S,resource:{buffer:A}})}else T.kind==="sampler"&&E.set(S,{binding:S,resource:o()});for(const S of b){const T=S.resource;if(T instanceof Gn){const A=Zt(S.binding,"texture");y.bindings.has(A)&&E.set(A,{binding:A,resource:T.gpuTexture.createView()})}else if(T instanceof zn){const A=Zt(S.binding,"sampler");y.bindings.has(A)&&E.set(A,{binding:A,resource:T.gpuSampler})}else{const A=Zt(S.binding,"uniform"),L=y.bindings.get(A);if(L&&L.kind==="uniform"){const C=T.uniform,B=t.createBuffer({size:Math.max(L.sizeBytes,C.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(B,0,C.buffer,C.byteOffset,C.byteLength),R.push(B),E.set(A,{binding:A,resource:{buffer:B}})}}}const P=t.createBindGroup({layout:y.bindGroupLayout,entries:Array.from(E.values())});return new ns(P,R)},createSurface(h,b){const y=h.getContext("webgpu");if(!y)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const E=b.hdr&&n.hdr,R=()=>E?Xo(y,t):Nn(y,t),P=R();return new rs(h,y,P,R)},renderFullscreen(h,b,y){const E=b,R=y,P=s(h),{width:S,height:T}=i(h),A=St(h)?h.format:qt(h.format),L=E.pipelineFor(A),C=t.createCommandEncoder(),B=C.beginRenderPass({colorAttachments:[{view:P,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});B.setPipeline(L),B.setBindGroup(0,R.gpuBindGroup),B.setViewport(0,0,S,T,0,1),B.draw(3),B.end(),t.queue.submit([C.finish()])},createDeepSampleBuffers(h){const{layout:b}=m(),y=A=>{const L=t.createBuffer({size:A.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});return t.queue.writeBuffer(L,0,A.buffer,A.byteOffset,A.byteLength),L},E=y(h.offsets),R=y(h.colors),P=y(h.zs),S=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),T=t.createBindGroup({layout:b,entries:[{binding:0,resource:{buffer:E}},{binding:1,resource:{buffer:R}},{binding:2,resource:{buffer:P}},{binding:3,resource:{buffer:S}}]});return new ts(h.width,h.height,[E,R,P],S,T)},compositeDeep(h,b,y,E){const R=h,P=b,{pipeline:S}=m();t.queue.writeBuffer(R.paramsBuffer,0,new Float32Array([R.width,R.height,E,y]));const T=t.createCommandEncoder(),A=T.beginRenderPass({colorAttachments:[{view:P.gpuTexture.createView(),loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});A.setPipeline(S),A.setBindGroup(0,R.bindGroup),A.setViewport(0,0,P.width,P.height,0,1),A.draw(3),A.end(),t.queue.submit([T.finish()])},async readback(h){const b=St(h),{width:y,height:E}=i(h),R=b?h.hdr?"rgba16float":"rgba8unorm":h.format,P=b&&h.format==="bgra8unorm",S=b?h.getCurrentGPUTexture():h.gpuTexture,T=Un(R),A=y*T,L=256,C=Math.ceil(A/L)*L,B=C*E,k=t.createBuffer({size:B,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),O=t.createCommandEncoder();O.copyTextureToBuffer({texture:S},{buffer:k,bytesPerRow:C,rowsPerImage:E},{width:y,height:E,depthOrArrayLayers:1}),t.queue.submit([O.finish()]);try{await Fn(k,a)}catch(U){try{k.destroy()}catch{}throw U}const Y=new Uint8Array(k.getMappedRange()),F=new Uint8Array(A*E);for(let U=0;U<E;U++){const Q=U*C,oe=U*A;F.set(Y.subarray(Q,Q+A),oe)}if(k.unmap(),k.destroy(),R==="rgba8unorm"){if(P)for(let U=0;U<F.length;U+=4){const Q=F[U],oe=F[U+2];F[U]=oe,F[U+2]=Q}return F}if(R==="rgba16float"){const U=new Uint16Array(F.buffer,F.byteOffset,F.byteLength/2),Q=new Float32Array(U.length);for(let oe=0;oe<U.length;oe++)Q[oe]=Ko(U[oe]);return Q}return new Float32Array(F.buffer,F.byteOffset,F.byteLength/4)},async reduceDiffSumSquaredAbs(h,b,y,E){const R=h,P=b,S=Math.max(0,y*E),T=Math.max(1,Math.ceil(S/x)),{pipeline:A,layout:L}=_(),C=T*2*4,B=t.createBuffer({size:C,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),k=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(k,0,new Uint32Array([Math.max(1,y),Math.max(1,E),S,0]));const O=t.createBindGroup({layout:L,entries:[{binding:0,resource:R.gpuTexture.createView()},{binding:1,resource:P.gpuTexture.createView()},{binding:2,resource:{buffer:B}},{binding:3,resource:{buffer:k}}]}),Y=t.createBuffer({size:C,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),F=t.createCommandEncoder(),U=F.beginComputePass();U.setPipeline(A),U.setBindGroup(0,O),U.dispatchWorkgroups(T),U.end(),F.copyBufferToBuffer(B,0,Y,0,C),t.queue.submit([F.finish()]);try{await Fn(Y,a)}catch(ge){for(const G of[Y,B,k])try{G.destroy()}catch{}throw ge}const oe=new Float32Array(Y.getMappedRange()).slice();Y.unmap(),Y.destroy(),B.destroy(),k.destroy();let he=0,ie=0;for(let ge=0;ge<T;ge++)he+=oe[ge*2],ie+=oe[ge*2+1];return{sumSq:he,sumAbs:ie}},destroy(){u||(t.destroy(),u=!0)},isContextLost(){return!1}}}let jt=null;async function ss(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return os()}function Pt(){return jt||(jt=ss()),jt}function is(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function as(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),s=Math.floor(o),i=Math.min(s+1,e.length-1),u=o-s,[a,l,d]=is(e[s],e[i],u);t[n*3]=Math.round(a),t[n*3+1]=Math.round(l),t[n*3+2]=Math.round(d)}return t}const Qt={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},cs=Object.keys(Qt),ls={viridis:"Viridis",plasma:"Plasma",magma:"Magma","red-green":"Red–Green","red-blue":"Red–Blue"},us=cs.map(e=>({id:e,label:ls[e]})),fs=new Set(["red-green","red-blue"]),$n=new Map;function Jt(e){let t=$n.get(e);if(!t){const n=Qt[e]??Qt.viridis;t=as(n),$n.set(e,t)}return t}function ct(e,t,n){return e<t?t:e>n?n:e}function Xe(e){return e<0?0:e>1?1:e}function Tt(e,t,n){return ct(Math.floor(e),t,n)}const en=e=>{const t=e<0?0:e;return t/(1+t)},tn=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return Xe(n/r)},Vn=4,ds=1,ps=16,hs=.5,Xn={linear:([e,t,n])=>[Xe(e),Xe(t),Xe(n)],srgb:([e,t,n])=>[Xe(e),Xe(t),Xe(n)],reinhard:([e,t,n])=>[en(e),en(t),en(n)],aces:([e,t,n])=>[tn(e),tn(t),tn(n)],extended:([e,t,n])=>[e,t,n]},Wn="srgb",Hn=["linear","srgb","reinhard","aces"],Yn=["extended","extended-clamp","extended-reinhard","extended-aces"],ms=["extended-clamp","extended-reinhard","extended-aces"];function Kn(e){return!!e&&Yn.includes(e)}function gs(e){return!!e&&ms.includes(e)}const qn={extended:"linear","extended-clamp":"linear","extended-reinhard":"reinhard","extended-aces":"aces"};function xs(e){return e&&Xn[e]||Xn[Wn]}function nn(e){return e&&qn[e]?qn[e]:e&&Hn.includes(e)?e:Wn}function bs(e,t){return t?Kn(e)?e:"extended":nn(e)}function At(e,t,n){return e*2**t+n}function vs(e){const t=Xe(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function rn(e,t){return typeof t=="number"&&t>0?Xe(Math.pow(Xe(e),1/t)):vs(e)}function on(e,t,n="linear",r=0,o=0){const s=Jt(t),i=new ImageData(e.width,e.height),u=e.data,a=i.data,l=r!==0||o!==0;for(let d=0;d<u.length;d+=4){let x=(u[d]+u[d+1]+u[d+2])/3;l&&(x=Math.max(0,Math.min(255,At(x/255,r,o)*255)));let p;n==="positive"?p=Math.round(128+x/255*127):p=Math.round(x),p=Math.max(0,Math.min(255,p)),a[d]=s[p*3],a[d+1]=s[p*3+1],a[d+2]=s[p*3+2],a[d+3]=u[d+3]}return i}function ws(e,t){return e==="signed"||e==="relative"?"signed":sn(t)}function sn(e){return fs.has(e??"")?"positive":"linear"}function Zn(e,t){const n=new Map;return{get(r){const o=n.get(r);if(o!==void 0)return n.delete(r),n.set(r,o),o},set(r,o){for(n.get(r)!==void 0&&n.delete(r),n.set(r,o);n.size>e;){const i=n.keys().next().value;if(i===void 0)break;n.get(i),n.delete(i)}},has(r){return n.has(r)},get size(){return n.size}}}const jn=Zn(50);function an(e){return jn.get(e)}function cn(e,t){jn.set(e,t)}const Qn=Zn(100);function ys(e){return Qn.get(e)}function Es(e,t){Qn.set(e,t)}function _s(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),s=new ImageData(r,o);for(let i=0;i<o;i++)for(let u=0;u<r;u++){const a=(i*e.width+u)*4,l=(i*t.width+u)*4,d=(i*r+u)*4;for(let x=0;x<3;x++){const p=e.data[a+x],v=t.data[l+x],_=p-v,w=Math.abs(_),M=Math.max(p,1);let m;switch(n){case"signed":m=(_+255)/2;break;case"absolute":m=w;break;case"squared":m=_*_/255;break;case"relative_signed":m=(_/M+1)*127.5;break;case"relative_absolute":m=w/M*255;break;case"relative_squared":m=_*_/(M*M)*255;break}s.data[d+x]=Math.min(255,Math.max(0,Math.round(m)))}s.data[d+3]=255}return s}async function lt(e){const t=ys(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const s=o.getContext("2d");if(!s){n(null);return}s.drawImage(r,0,0);const i=s.getImageData(0,0,o.width,o.height);Es(e,i),n(i)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const Ms={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},Ss={linear:0,signed:1,positive:2},Ps=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,Ts=`#version 300 es
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
}`;let ut=null,re=null,Oe=null,Ct=null;function As(){if(re)return re;try{if(typeof OffscreenCanvas<"u"?ut=new OffscreenCanvas(1,1):ut=document.createElement("canvas"),re=ut.getContext("webgl2",{preserveDrawingBuffer:!0}),!re)return console.warn("[cairn] WebGL 2 not available"),null;const e=re.createShader(re.VERTEX_SHADER);if(re.shaderSource(e,Ps),re.compileShader(e),!re.getShaderParameter(e,re.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",re.getShaderInfoLog(e)),null;const t=re.createShader(re.FRAGMENT_SHADER);if(re.shaderSource(t,Ts),re.compileShader(t),!re.getShaderParameter(t,re.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",re.getShaderInfoLog(t)),null;if(Oe=re.createProgram(),re.attachShader(Oe,e),re.attachShader(Oe,t),re.linkProgram(Oe),!re.getProgramParameter(Oe,re.LINK_STATUS))return console.error("[cairn] WebGL program link:",re.getProgramInfoLog(Oe)),null;Ct=re.createVertexArray(),re.bindVertexArray(Ct);const n=re.createBuffer();re.bindBuffer(re.ARRAY_BUFFER,n),re.bufferData(re.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),re.STATIC_DRAW);const r=re.getAttribLocation(Oe,"a_pos");return re.enableVertexAttribArray(r),re.vertexAttribPointer(r,2,re.FLOAT,!1,0,0),re.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),re}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function Jn(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function Cs(e,t,n){const r=new Uint8Array(1024);for(let s=0;s<256;s++)r[s*4]=t[s*3],r[s*4+1]=t[s*3+1],r[s*4+2]=t[s*3+2],r[s*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function Rs(e,t,n,r){const o=As();if(!o||!Oe||!Ct||!ut)return null;const s=Math.min(e.width,t.width),i=Math.min(e.height,t.height);ut.width=s,ut.height=i,o.viewport(0,0,s,i);const u=Jn(o,e,0),a=Jn(o,t,1);let l=null;n.colormap?l=Cs(o,n.colormap,2):(l=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,l),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(Oe),o.uniform1i(o.getUniformLocation(Oe,"u_baseline"),0),o.uniform1i(o.getUniformLocation(Oe,"u_other"),1),o.uniform1i(o.getUniformLocation(Oe,"u_lut"),2),o.uniform1i(o.getUniformLocation(Oe,"u_diff_mode"),Ms[n.diffMode]),o.uniform1i(o.getUniformLocation(Oe,"u_cmap_mode"),Ss[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(Oe,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(Ct),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=s,r.height=i;const d=r.getContext("2d");return d&&(d.save(),d.scale(1,-1),d.drawImage(ut,0,0,s,i,0,-i,s,i),d.restore()),o.deleteTexture(u),o.deleteTexture(a),o.deleteTexture(l),{width:s,height:i}}const ks="cairn:render-mode";function Ds(){try{const e=localStorage.getItem(ks);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const Ls=.299,Bs=.587,Os=.114;function bt(e,t,n){return(Ls*e+Bs*t+Os*n)/255}const Rt=15360;function kt(e){const t=e&32768?-1:1,n=e>>10&31,r=e&1023;return n===0?r===0?t*0:t*r*2**-24:n===31?r===0?t*(1/0):NaN:t*2**(n-15)*(1+r/1024)}const er=globalThis.Float16Array;function tr(e,t=e.length){if(er){const r=new er(e.buffer,e.byteOffset,t);return Float32Array.from(r)}const n=new Float32Array(t);for(let r=0;r<t;r++)n[r]=kt(e[r]);return n}const We=new Uint32Array(512),He=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(We[e]=0,We[e|256]=32768,He[e]=24,He[e|256]=24):t<-14?(We[e]=1024>>-t-14,We[e|256]=1024>>-t-14|32768,He[e]=-t-1,He[e|256]=-t-1):t<=15?(We[e]=t+15<<10,We[e|256]=t+15<<10|32768,He[e]=13,He[e|256]=13):t<128?(We[e]=31744,We[e|256]=64512,He[e]=24,He[e|256]=24):(We[e]=31744,We[e|256]=64512,He[e]=13,He[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var vt=Uint8Array,nr=Uint16Array,Is=Int32Array,Ns=new vt([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),Fs=new vt([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),rr=function(e,t){for(var n=new nr(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new Is(n[30]),r=1;r<30;++r)for(var s=n[r];s<n[r+1];++s)o[s]=s-n[r]<<5|r;return{b:n,r:o}},or=rr(Ns,2),Us=or.b,Gs=or.r;Us[28]=258,Gs[258]=28,rr(Fs,0);for(var zs=new nr(32768),ye=0;ye<32768;++ye){var ot=(ye&43690)>>1|(ye&21845)<<1;ot=(ot&52428)>>2|(ot&13107)<<2,ot=(ot&61680)>>4|(ot&3855)<<4,zs[ye]=((ot&65280)>>8|(ot&255)<<8)>>1}for(var Dt=new vt(288),ye=0;ye<144;++ye)Dt[ye]=8;for(var ye=144;ye<256;++ye)Dt[ye]=9;for(var ye=256;ye<280;++ye)Dt[ye]=7;for(var ye=280;ye<288;++ye)Dt[ye]=8;for(var $s=new vt(32),ye=0;ye<32;++ye)$s[ye]=5;var Vs=new vt(0),Xs=typeof TextDecoder<"u"&&new TextDecoder,Ws=0;try{Xs.decode(Vs,{stream:!0}),Ws=1}catch{}const sr=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function ln(e){const t=sr.length;return sr[(e%t+t)%t]}function Hs(e){const n=c.useRef(null),[r,o]=c.useState({w:0,h:0}),s=c.useRef(null),i=c.useRef(null),u=c.useRef(null),a=c.useCallback((l,d)=>{o(x=>x.w===l&&x.h===d?x:{w:l,h:d})},[]);return c.useLayoutEffect(()=>{const l=n.current;if(!l||l===u.current)return;const d=l.getBoundingClientRect();(d.width>0||d.height>0)&&(u.current=l,a(d.width,d.height))}),c.useEffect(()=>{var x;const l=n.current;if(l===i.current||((x=s.current)==null||x.disconnect(),s.current=null,i.current=l,!l))return;const d=new ResizeObserver(p=>{for(const v of p)a(v.contentRect.width,v.contentRect.height)});s.current=d,d.observe(l)}),c.useEffect(()=>()=>{var l;return(l=s.current)==null?void 0:l.disconnect()},[]),{ref:n,size:r}}function Ys(){const[e,t]=c.useState(!1);return c.useEffect(()=>{const n=s=>{(s.key==="Alt"||s.key==="Control"||s.key==="Meta")&&t(!0)},r=s=>{(s.key==="Alt"||s.key==="Control"||s.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const Ks=.001;function qs(e,t=Ks){return Math.exp(-e*t)}function ir(e,t){return Math.hypot(e.x-t.x,e.y-t.y)}function ar(e,t){return{x:(e.x+t.x)/2,y:(e.y+t.y)/2}}function Zs(e,t,n,r,o,s,i){const u=t>0&&r>0?r/t:1,a=Math.max(s,Math.min(i,e.zoom*u)),l=(n.x-e.pan.x)/e.zoom,d=(n.y-e.pan.y)/e.zoom;return{zoom:a,pan:{x:o.x-l*a,y:o.y-d*a}}}const js=.25,un=64;function fn(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return un;const o=Math.min(n/e,r/t);return o<=0?un:Math.max(Math.max(n,r)/o,8)}function cr(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:s=js,maxZoom:i=un,naturalWidth:u,naturalHeight:a}=e,l=Ys(),d=c.useRef(l);d.current=l;const x=c.useRef({zoom:n,pan:r});x.current={zoom:n,pan:r};const p=c.useRef(o);p.current=o,c.useEffect(()=>{const P=t.current;if(!P||!o)return;const S=T=>{var Q;if(!T.ctrlKey&&!d.current)return;T.preventDefault(),T.stopPropagation();const A=qs(T.deltaY),L=x.current,C=P.getBoundingClientRect(),B=u&&a?fn(u,a,C.width,C.height):i,k=Math.max(s,Math.min(B,L.zoom*A));if(L.zoom===k)return;const O=T.clientX-C.left,Y=T.clientY-C.top,F=O-(O-L.pan.x)/L.zoom*k,U=Y-(Y-L.pan.y)/L.zoom*k;(Q=p.current)==null||Q.call(p,{zoom:k,pan:{x:F,y:U}})};return P.addEventListener("wheel",S,{passive:!1}),()=>P.removeEventListener("wheel",S)},[t,!!o,s,i,u,a]);const v=c.useRef(new Map),_=c.useRef(null),w=c.useRef(null),M=c.useCallback((P,S,T)=>{const A=P.getBoundingClientRect();return{x:S-A.left,y:T-A.top}},[]),m=c.useCallback(P=>{if(!u||!a)return i;const S=P.getBoundingClientRect();return fn(u,a,S.width,S.height)},[u,a,i]),g=c.useCallback((P,S)=>{const T=v.current,A=T.get(P),L=T.get(S);!A||!L||(_.current=null,w.current={idA:P,idB:S,startDist:ir(A,L),startMid:ar(A,L),startZoom:x.current.zoom,startPan:{...x.current.pan}})},[]),h=c.useCallback(P=>{const S=v.current.get(P);S&&(_.current={pointerId:P,startX:S.x,startY:S.y,panX:x.current.pan.x,panY:x.current.pan.y})},[]),b=c.useCallback(P=>{if(!p.current)return;const S=P.pointerType==="touch";if(!S&&!d.current)return;const T=P.currentTarget;if(T.setPointerCapture(P.pointerId),v.current.set(P.pointerId,M(T,P.clientX,P.clientY)),S&&v.current.size>=2){const A=[...v.current.keys()];g(A[A.length-2],A[A.length-1]);return}h(P.pointerId)},[M,g,h]),y=c.useCallback(P=>{var C,B;const S=P.currentTarget,T=v.current.get(P.pointerId);if(T){const k=M(S,P.clientX,P.clientY);T.x=k.x,T.y=k.y}const A=w.current;if(A){const k=v.current.get(A.idA),O=v.current.get(A.idB);if(!k||!O)return;const Y=Zs({zoom:A.startZoom,pan:A.startPan},A.startDist,A.startMid,ir(k,O),ar(k,O),s,m(S));(C=p.current)==null||C.call(p,Y);return}const L=_.current;!L||L.pointerId!==P.pointerId||!T||(B=p.current)==null||B.call(p,{zoom:x.current.zoom,pan:{x:L.panX+(T.x-L.startX),y:L.panY+(T.y-L.startY)}})},[M,s,m]),E=c.useCallback(P=>{var T;try{P.currentTarget.releasePointerCapture(P.pointerId)}catch{}v.current.delete(P.pointerId);const S=w.current;if(S&&(P.pointerId===S.idA||P.pointerId===S.idB)){w.current=null;const A=[...v.current.keys()];A.length===1&&h(A[0]);return}((T=_.current)==null?void 0:T.pointerId)===P.pointerId&&(_.current=null)},[h]);return{containerProps:{onPointerDown:b,onPointerMove:y,onPointerUp:E,onPointerCancel:E,style:{cursor:l&&!!o?"move":void 0,touchAction:o?"none":void 0}},modifierActive:l}}function dn(){const[e,t]=c.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return c.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),s())};function s(){if(n)return;const i=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${i}dppx)`),r.addEventListener("change",o,{once:!0})}return s(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function Qe(e){const t=c.useRef(e),[n,r]=c.useState(e),o=c.useCallback(()=>r(t.current),[]);return[n,r,{reset:o,isModified:!Object.is(n,t.current),default:t.current}]}function Qs(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function lr(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function pn({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:s}=Hs(),i=c.useRef(null),u=c.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),a=c.useMemo(()=>{const w=s.w,M=s.h;if(w<=0||M<=0||n<=0||r<=0)return null;const m=Math.min(w/n,M/r),g=n*m,h=r*m;return{left:(w-g)/2,top:(M-h)/2,width:g,height:h}},[s.w,s.h,n,r]),l=e.masks,d=t.showMasks&&!!l&&l.length>0,x=c.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(c.useEffect(()=>{if(!d||!l)return;const w=i.current;if(!w)return;(w.width!==n||w.height!==r)&&(w.width=n,w.height=r);const M=w.getContext("2d");if(!M)return;M.clearRect(0,0,w.width,w.height);let m=!1;const g=M.createImageData(n,r),h=g.data;let b=l.length,y=!1;const E=()=>{m||y&&M.putImageData(g,0,0)},R=document.createElement("canvas");R.width=n,R.height=r;const P=R.getContext("2d",{willReadFrequently:!0});for(const S of l){const T=new Image;T.onload=()=>{if(!m){if(P){P.clearRect(0,0,n,r),P.drawImage(T,0,0,n,r);const A=P.getImageData(0,0,n,r).data;for(let L=0;L<n*r;L++){const C=A[L*4];if(C===0||u.has(C))continue;const[B,k,O]=Qs(ln(C));h[L*4]=B,h[L*4+1]=k,h[L*4+2]=O,h[L*4+3]=255,y=!0}}b-=1,b===0&&E()}},T.onerror=()=>{b-=1,b===0&&E()},T.src=`data:image/png;base64,${S.png_b64}`}return()=>{m=!0}},[d,l,n,r,x]),!a)return f.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const p=e.boxes??[],v=t.showBoxes&&p.length>0,_=e.class_labels??{};return f.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[d&&f.jsx("canvas",{ref:i,className:"absolute",style:{left:a.left,top:a.top,width:a.width,height:a.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),v&&f.jsx("svg",{className:"absolute",style:{left:a.left,top:a.top,width:a.width,height:a.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:p.map((w,M)=>{if(!lr(w,t,u))return null;const m=w.domain==="pixel"?1:n,g=w.domain==="pixel"?1:r,h=w.position.minX*m,b=w.position.minY*g,y=(w.position.maxX-w.position.minX)*m,E=(w.position.maxY-w.position.minY)*g;return f.jsx("rect",{x:h,y:b,width:y,height:E,fill:"none",stroke:ln(w.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},M)})}),v&&f.jsx("div",{className:"absolute",style:{left:a.left,top:a.top,width:a.width,height:a.height},children:p.map((w,M)=>{if(!lr(w,t,u))return null;const m=w.domain==="pixel"?1/n:1,g=w.domain==="pixel"?1/r:1,h=w.position.minX*m*100,b=w.position.minY*g*100,y=w.label??_[String(w.class_id)]??`#${w.class_id}`,E=w.score!=null?` ${(w.score*100).toFixed(0)}%`:"";return!y&&!E?null:f.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${h}%`,top:`${b}%`,transform:"translateY(-100%)",backgroundColor:ln(w.class_id)},children:f.jsxs("span",{className:"mono",children:[y,E]})},M)})})]})}function Js(e,t){const n=t==null?void 0:t.precision,r=ei(e,n);return t!=null&&t.minus?r.replace("-","−"):r}function ei(e,t){if(!Number.isFinite(e))return String(e);if(e===0)return"0";const n=Math.abs(e);return n>=1e3||n<.001?e.toExponential(Math.max(0,t-2)):Number(e.toPrecision(t)).toString()}const ti={x:0,y:0,w:1,h:1};function Lt(e){const t=e.sourceWindow??ti,n=t.x*e.naturalWidth,r=t.y*e.naturalHeight,o=t.w*e.naturalWidth,s=t.h*e.naturalHeight,i=Math.min(e.box.width/o,e.box.height/s),u=o*i,a=s*i;return{scale:i,imgLeft:e.box.left+(e.box.width-u)/2,imgTop:e.box.top+(e.box.height-a)/2,srcOriginX:n,srcOriginY:r,visibleW:o,visibleH:s}}function ni(e){return Lt(e).scale}function ur(e,t,n){const r=Lt(n);return{x:r.srcOriginX+(e-r.imgLeft)/r.scale,y:r.srcOriginY+(t-r.imgTop)/r.scale}}function fr(e,t,n){const r=Lt(n);return{x:r.imgLeft+(e-r.srcOriginX)*r.scale,y:r.imgTop+(t-r.srcOriginY)*r.scale}}function ri(e,t){const n=fr(e.x0,e.y0,t),r=fr(e.x1+1,e.y1+1,t);return{left:n.x,top:n.y,width:r.x-n.x,height:r.y-n.y}}function dr(e,t,n,r,o){const s=ur(e,t,o),i=ur(n,r,o),u=o.naturalWidth-1,a=o.naturalHeight-1,l=Math.min(s.x,i.x),d=Math.max(s.x,i.x),x=Math.min(s.y,i.y),p=Math.max(s.y,i.y);return d<0||l>u||p<0||x>a?null:{x0:Tt(l,0,u),y0:Tt(x,0,a),x1:Tt(d,0,u),y1:Tt(p,0,a)}}const hn=30,Bt=["#ff5a5a","#39d353","#5b9bff"];function mn(e){return Js(e,{precision:3})}function mt(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):mn(e/255):mn(n==="int"?e*255:e)}function ft(e,t,n,r){return e.length===1?{lines:[mt(e[0],t,n)],luminance:r}:{lines:e.map(o=>mt(o,t,n)),luminance:r,colors:e.map((o,s)=>Bt[s]??null)}}const oi={x:0,y:0,w:1,h:1};function dt({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:s,notation:i="decimal",version:u=0,onActiveChange:a,sourceWindow:l=oi}){const d=c.useRef(null),x=c.useRef(!1),p=dn(),v=c.useRef(a);v.current=a;const _=c.useCallback(M=>{var m;M!==x.current&&(x.current=M,(m=v.current)==null||m.call(v,M))},[]),w=c.useCallback(()=>{var J;const M=d.current,m=e.current;if(!M)return;const g=window.devicePixelRatio||1,h=M.clientWidth,b=M.clientHeight;if(h===0||b===0)return;M.width!==Math.round(h*g)&&(M.width=Math.round(h*g)),M.height!==Math.round(b*g)&&(M.height=Math.round(b*g));const y=M.getContext("2d");if(!y)return;if(y.setTransform(g,0,0,g,0,0),y.clearRect(0,0,h,b),!m||t<=0||n<=0){_(!1);return}const E=m.getBoundingClientRect(),R=M.getBoundingClientRect();if(E.width===0||E.height===0){_(!1);return}const S=Lt({box:E,naturalWidth:t,naturalHeight:n,sourceWindow:l}),{srcOriginX:T,srcOriginY:A,visibleW:L,visibleH:C,scale:B}=S;if(L<=0||C<=0){_(!1);return}if(B<hn){_(!1);return}const k=S.imgLeft-R.left,O=S.imgTop-R.top,Y=Math.max(Math.floor(T),Math.floor(T+(0-k)/B)),F=Math.min(Math.ceil(T+L),Math.ceil(T+(h-k)/B)),U=Math.max(Math.floor(A),Math.floor(A+(0-O)/B)),Q=Math.min(Math.ceil(A+C),Math.ceil(A+(b-O)/B));if(F<=Y||Q<=U){_(!1);return}_(!0);const oe=k+(0-T)*B,he=O+(0-A)*B,ie=k+(t-T)*B,ge=O+(n-A)*B;y.save(),y.beginPath(),y.rect(oe,he,ie-oe,ge-he),y.clip(),y.textAlign="center",y.textBaseline="middle",y.lineJoin="round";const G=B*.14,V=B-G*2;for(let te=U;te<Q;te++)for(let fe=Y;fe<F;fe++){if(fe<0||te<0||fe>=t||te>=n)continue;const W=s(fe,te,i);if(!W||W.lines.length===0)continue;const ne=W.lines.length;let Ee=1;for(const Fe of W.lines)Fe.length>Ee&&(Ee=Fe.length);const me=V/(ne*1.15),H=V/(Ee*.62)||me,Ce=Math.min(me,H,24);if(Ce<6)continue;const de=k+(fe-T+.5)*B,_e=O+(te-A+.5)*B,ce=Ce*1.15,Re=W.luminance<=.55,$e=Re?"#ffffff":"#000000";y.font=`${Ce}px ui-monospace, SFMono-Regular, Menlo, monospace`,y.lineWidth=Math.max(1.4,Ce*.16),y.strokeStyle=Re?"rgba(0,0,0,0.85)":"rgba(255,255,255,0.9)";let qe=_e-ne*ce/2+ce/2;for(let Fe=0;Fe<W.lines.length;Fe++){const Ge=W.lines[Fe];y.strokeText(Ge,de,qe),y.fillStyle=((J=W.colors)==null?void 0:J[Fe])??$e,y.fillText(Ge,de,qe),qe+=ce}}y.restore()},[e,t,n,s,i,_,l]);return c.useEffect(()=>{w()},[w,r,o.x,o.y,u,i,l,p]),c.useEffect(()=>{const M=d.current;if(!M)return;const m=new ResizeObserver(()=>w());return m.observe(M),()=>m.disconnect()},[w]),f.jsx("canvas",{ref:d,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function pr({notation:e,onChange:t,className:n=""}){return f.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const si=`
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
// managed) (matches OPERATOR_ID in image-engine.ts / TONEMAP_OPERATORS + the
// extended curves in image/tonemap.ts). linear/srgb are the SAME clamp — the
// sRGB OETF lives in outputEncodeF, not here. 4 (extended) is a pure identity —
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
`,Ue=`
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
`,pt=`
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
`,wt=`
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
`,ii=`
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
`,Ot=`
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
`;function hr(e){return`
${Ue}
${pt}
${ii}

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
`}const ai=hr("select(colorB, colorA, uv.x < split)"),ci=hr("mix(colorA, colorB, alpha)");function li(e){switch(e){case"center":return{v:"center",h:"center"};case"top-right":return{v:"top",h:"right"};case"bottom-left":return{v:"bottom",h:"left"};case"bottom-right":return{v:"bottom",h:"right"};case"top-left":default:return{v:"top",h:"left"}}}function mr(e,t,n){const{v:r,h:o}=li(n),s=e.w-t.w,i=e.h-t.h,u=o==="left"?0:o==="right"?s:Math.floor(s/2),a=r==="top"?0:r==="bottom"?i:Math.floor(i/2);return{x:u,y:a}}function yt(e,t,n,r,o="b"){if(r==="fill"){const i=o==="a"?{w:e.w,h:e.h}:{w:t.w,h:t.h};return{fit:r,result:i,offsetA:{x:0,y:0},offsetB:{x:0,y:0}}}const s={w:Math.min(e.w,t.w),h:Math.min(e.h,t.h)};return{fit:r,result:s,offsetA:mr(e,s,n),offsetB:mr(t,s,n)}}function gn(e){return`${e.fit}:${e.result.w}x${e.result.h}:${e.offsetA.x},${e.offsetA.y}:${e.offsetB.x},${e.offsetB.y}`}const xn={linear:0,srgb:1,reinhard:2,aces:3,extended:4,"extended-reinhard":5,"extended-aces":6,"extended-clamp":7},gr=new WeakMap;function ui(e,t){let n=gr.get(e);n||(n=new Map,gr.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:si,targetFormat:t}),n.set(t,r)),r}function xr(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function br(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function fi(e,t,n,r){var M;const o=xr(t),s=ui(e,o),i=br(e,r.isScalar?r.colormap:void 0),u=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,a=xn[r.operator]??xn.srgb,l=new Float32Array([r.exposureEV,a,u,r.isScalar?1:0]),d=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),x=new Float32Array([r.hdrOut?1:0]),p=new Float32Array([r.filter==="nearest"?0:1]),v=new Float32Array([r.offset??0]),_=new Float32Array([r.peak??Vn]);let w;try{w=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:i},{binding:2,resource:{uniform:l}},{binding:3,resource:{uniform:d}},{binding:4,resource:{uniform:x}},{binding:5,resource:{uniform:p}},{binding:6,resource:{uniform:v}},{binding:7,resource:{uniform:_}}]),e.renderFullscreen(t,s,w)}finally{(M=w==null?void 0:w.destroy)==null||M.call(w),i.destroy()}}const vr=new WeakMap;function di(e,t,n){let r=vr.get(e);r||(r=new Map,vr.set(e,r));const o=`${t}:${n}`;let s=r.get(o);return s||(s=e.createRenderPipeline({shaderWGSL:t==="split"?ai:ci,targetFormat:n}),r.set(o,s)),s}function pi(e,t,n,r,o){var w;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const s=xr(t),i=di(e,o.mode,s),u=br(e,void 0),a=o.gamma,l=xn[o.operator],d=new Float32Array([o.exposureEV,l,a,0]),x=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),p=new Float32Array([o.split,o.alpha,0,o.filter==="nearest"?0:1]),v=new Float32Array([o.offset??0,0,0,0]);let _;try{_=e.createBindGroup(i,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:u},{binding:3,resource:{uniform:d}},{binding:4,resource:{uniform:x}},{binding:5,resource:{uniform:p}},{binding:6,resource:{uniform:v}}]),e.renderFullscreen(t,i,_)}finally{(w=_==null?void 0:_.destroy)==null||w.call(_),u.destroy()}}function wr(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,s=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:s,mae:o}}async function yr(e,t,n,r){const o=r??yt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),s=o.result.w,i=o.result.h,u=s*i*3;if(u<=0)return{mse:0,psnr:1/0,mae:0};if(o.fit==="crop"&&o.offsetA.x===0&&o.offsetA.y===0&&o.offsetB.x===0&&o.offsetB.y===0&&e.reduceDiffSumSquaredAbs){const{sumSq:h,sumAbs:b}=await e.reduceDiffSumSquaredAbs(t,n,s,i);return wr(h,b,u)}const l=await e.readback(t),d=await e.readback(n),x=l instanceof Uint8Array?255:1,p=d instanceof Uint8Array?255:1,v=It(l,t.width,t.height,x,o.offsetA,o.fit==="fill",s,i),_=It(d,n.width,n.height,p,o.offsetB,o.fit==="fill",s,i);let w=0,M=0;const m=[0,0,0],g=[0,0,0];for(let h=0;h<i;h++)for(let b=0;b<s;b++){v(b,h,m),_(b,h,g);for(let y=0;y<3;y++){const E=m[y]-g[y];w+=E*E,M+=Math.abs(E)}}return wr(w,M,u)}function It(e,t,n,r,o,s,i,u){const a=(x,p,v)=>e[(p*t+x)*4+v]??0;if(!s)return(x,p,v)=>{const _=Math.min(Math.max(x+o.x,0),t-1),w=Math.min(Math.max(p+o.y,0),n-1);v[0]=a(_,w,0)/r,v[1]=a(_,w,1)/r,v[2]=a(_,w,2)/r};const l=t-1,d=n-1;return(x,p,v)=>{const _=(x+.5)/i,w=(p+.5)/u,M=_*t-.5,m=w*n-.5,g=Math.floor(M),h=Math.floor(m),b=M-g,y=m-h,E=Math.min(Math.max(g,0),l),R=Math.min(Math.max(g+1,0),l),P=Math.min(Math.max(h,0),d),S=Math.min(Math.max(h+1,0),d);for(let T=0;T<3;T++){const A=a(E,P,T),L=a(R,P,T),C=a(E,S,T),B=a(R,S,T),k=A+(L-A)*b,O=C+(B-C)*b;v[T]=(k+(O-k)*y)/r}}}function Er(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const hi=12,st=[];function _r(e){const t=st.indexOf(e);t!==-1&&st.splice(t,1),st.push(e)}function mi(e){const t=st.indexOf(e);t!==-1&&st.splice(t,1)}function Nt(e){e.parked||(mi(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),e.surface=null,e.parked=!0)}function Mr(e){for(;st.length>hi;){const t=st.find(n=>n!==e&&!n.visible)??st.find(n=>n!==e);if(!t)break;Nt(t)}}function Sr(e){var o,s,i,u;if(e.disposed)return;if(Er())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){_r(e),Mr(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||((s=e.deep)==null?void 0:s.width)||1,r=e.backingHeight||((i=e.source)==null?void 0:i.height)||((u=e.deep)==null?void 0:u.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.deep){const a=t.createTexture(e.deep.width,e.deep.height,"rgba16float");e.srcTexture=a,e.deepBuffers=t.createDeepSampleBuffers(e.deep),t.compositeDeep(e.deepBuffers,a,e.deepZNear,e.deepZFar)}else if(e.source){const a=t.createTexture(e.source.width,e.source.height,e.source.format);a.write(e.source.data),e.srcTexture=a}e.parked=!1,_r(e),Mr(e)}function gi(e,t){if(e.disposed||!e.source&&!e.deep)return!0;try{return Sr(e),!e.surface||!e.srcTexture?!1:(fi(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,Nt(e),!1}}function xi(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,e.deep=null,e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},setDeepSource(t,n,r){if(!e.disposed&&(e.deep=t,e.deepZNear=n,e.deepZFar=r,e.source=null,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy(),e.deepBuffers&&e.deepBuffers.destroy();const o=e.device.createTexture(t.width,t.height,"rgba16float");e.srcTexture=o,e.deepBuffers=e.device.createDeepSampleBuffers(t),e.device.compositeDeep(e.deepBuffers,o,n,r)}},setDeepWindow(t,n){e.disposed||(e.deepZNear=t,e.deepZFar=n,!e.parked&&e.deepBuffers&&e.srcTexture&&e.device.compositeDeep(e.deepBuffers,e.srcTexture,t,n))},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return gi(e,t)},park(){e.disposed||Nt(e)},restore(){e.disposed||!e.source&&!e.deep||Sr(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(Nt(e),e.source=null,e.deep=null,e.disposed=!0)}}}async function bi(e,t){const n=await Pt(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,deep:null,deepZNear:-1/0,deepZFar:1/0,deepBuffers:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return xi(r)}function Pr(e){e.dispose()}function Tr({title:e,body:t,className:n}){return f.jsx("div",{className:n??"relative h-full w-full",children:f.jsxs("div",{className:"flex h-full w-full flex-col items-center justify-center gap-1 rounded bg-bg-hover p-4 text-center",children:[f.jsx("div",{className:"text-sm font-semibold text-fg",children:e}),f.jsx("div",{className:"text-xs text-fg-muted",children:t})]})})}function vi(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:s}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...s?["invert(1)"]:[]].join(" ")}function Ar(e){const n=`cairn-gamma-${c.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:s,exposure:i,offset:u,flipSign:a}=e,l=c.useMemo(()=>vi(e,n),[n,r,o,i,a]);return{gammaFilterId:n,filterStr:l,gamma:s,offset:u}}function Cr({id:e,gamma:t,offset:n}){return f.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:f.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:f.jsxs("feComponentTransfer",{children:[f.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),f.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),f.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}const wi=["nw","n","ne","e","se","s","sw","w"];function yi(e,t,n,r,o,s=1){const i=o.w-1,u=o.h-1,a=Math.round(n),l=Math.round(r);if(t==="move"){const g=e.x1-e.x0,h=e.y1-e.y0,b=ct(e.x0+a,0,i-g),y=ct(e.y0+l,0,u-h);return{x0:b,y0:y,x1:b+g,y1:y+h}}let{x0:d,y0:x,x1:p,y1:v}=e;const _=t==="nw"||t==="w"||t==="sw",w=t==="ne"||t==="e"||t==="se",M=t==="nw"||t==="n"||t==="ne",m=t==="sw"||t==="s"||t==="se";return _&&(d=ct(d+a,0,p-(s-1))),w&&(p=ct(p+a,d+(s-1),i)),M&&(x=ct(x+l,0,v-(s-1))),m&&(v=ct(v+l,x+(s-1),u)),{x0:d,y0:x,x1:p,y1:v}}function Rr(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function Ei({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=Rr(e),s=Rr(t),i=[];for(let g=0;g<=e;g+=o)i.push(g);const u=[];for(let g=0;g<=t;g+=s)u.push(g);const a=1/n,l=8*a,d=-12*a,x=-2*a,p=r==null?void 0:r.current;let v=0,_=0,w=0,M=0;if(p){const g=p.clientWidth,h=p.clientHeight,b=g/e,y=h/t,E=Math.min(b,y);w=e*E,M=t*E,v=(g-w)/2,_=(h-M)/2}const m=p&&w>0;return f.jsxs(f.Fragment,{children:[f.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:m?_:0,transform:`translateY(${d}px)`,fontSize:l},children:i.map(g=>f.jsx("span",{className:"mono",style:{position:"absolute",left:m?v+g/e*w:`${g/e*100}%`,transform:"translateX(-50%)"},children:g},g))}),f.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:m?v:0,transform:`translateX(${x}px)`,fontSize:l},children:u.map(g=>f.jsx("span",{className:"mono",style:{position:"absolute",top:m?_+g/t*M:`${g/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*a}px`},children:g},g))})]})}function bn({label:e,corner:t="bottom-left",isDraggable:n=!1,grip:r=n,onDragStart:o}){const s=t==="bottom-right"?"bottom-1 right-1":"bottom-1 left-1";return f.jsxs("span",{className:`absolute ${s} z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${n?" cairn-drag-grip":""}`,draggable:n,onDragStart:o,style:{cursor:n?"grab":void 0},children:[r&&f.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const _i=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function kr(e,t){const n=getComputedStyle(e),r=_i.map(a=>`${a}:${n.getPropertyValue(a)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const s=e.children,i=t.children,u=Math.min(s.length,i.length);for(let a=0;a<u;a++)kr(s[a],i[a])}function vn(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function wn(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function yn(e,t,n,r,o){const s=document.createElement("canvas");s.width=Math.max(1,Math.round(e*n)),s.height=Math.max(1,Math.round(t*n));const i=s.getContext("2d");if(!i)throw new Error("plot-to-png: 2D canvas context unavailable");return i.scale(n,n),r&&(i.fillStyle=r,i.fillRect(0,0,e,t)),o(i),await new Promise((u,a)=>s.toBlob(l=>l?u(l):a(new Error("plot-to-png: toBlob returned null")),"image/png"))}function Mi(e,t,n){const r=e.cloneNode(!0);kr(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),s="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((i,u)=>{const a=new Image;a.onload=()=>i(a),a.onerror=()=>u(new Error("plot-to-png: SVG rasterization failed")),a.src=s})}async function Dr(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,s=(t==null?void 0:t.background)??vn(e);return yn(r,o,wn(t),s,i=>i.drawImage(e,0,0,r,o))}async function Si(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,s=(t==null?void 0:t.background)??vn(e);try{return await yn(r,o,wn(t),s,i=>i.drawImage(e,0,0,r,o))}catch(i){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${i instanceof Error?i.message:String(i)})`)}}function Pi(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const s=o.getBoundingClientRect(),i=s.width*s.height;i>r&&(r=i,n=o)}return n}async function Ti(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),s=o.width||300,i=o.height||150,u=(t==null?void 0:t.background)??vn(e);if(n){const l=n.getBoundingClientRect(),d=await Mi(n,l.width||s,l.height||i);return yn(s,i,wn(t),u,x=>{for(const p of r){const v=p.getBoundingClientRect();x.drawImage(p,v.left-o.left,v.top-o.top,v.width,v.height)}x.drawImage(d,l.left-o.left,l.top-o.top,l.width,l.height)})}if(r.length)return Dr(r[0],t);const a=Pi(e);if(a)return Si(a,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function Ai(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const Ci=8;function Ri(e,t,n,r=Ci){return!(t>0)||!(e>0)?n:e<t+r}function Lr(e,t){return Math.max(0,e.findIndex(n=>n.id===t))}function ki(e){const t=e.trim();if(t==="")return null;const n=t.replace(/−/g,"-").replace(",","."),r=Number(n);return Number.isFinite(r)?r:null}function Di(e,t){const n=ki(e);return n===null?t:n}function Li(e){return String(e)}const Bi={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},Oi={boxZoom:f.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:f.jsxs(f.Fragment,{children:[f.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),f.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),f.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),f.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 2v20M2 12h20"}),f.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),f.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),f.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:f.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:f.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),f.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:f.jsx("path",{d:"M6 9l6 6 6-6"}),ellipsis:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"5",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),f.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),f.jsx("circle",{cx:"19",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"})]}),sun:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"12",cy:"12",r:"4"}),f.jsx("path",{d:"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"})]}),plusminus:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M4 7h6M7 4v6"}),f.jsx("path",{d:"M14 17h6"}),f.jsx("path",{d:"M6 20l12-16"})]}),layers:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 3l9 5-9 5-9-5 9-5z"}),f.jsx("path",{d:"M3 13l9 5 9-5"})]})};function Je({name:e}){return f.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:Oi[e]??null})}function Br({icon:e,label:t,title:n,active:r,disabled:o,onClick:s}){return f.jsx("button",{type:"button",disabled:o,onClick:i=>{i.stopPropagation(),!o&&s()},onPointerDown:i=>i.stopPropagation(),onDoubleClick:i=>i.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?f.jsx("span",{"aria-hidden":"true",children:t}):f.jsx(Je,{name:e??""})})}function Or(){return f.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function Ir(e,t,n){const r=c.useRef(n);r.current=n,c.useEffect(()=>{if(!e)return;const o=i=>{t.current&&!t.current.contains(i.target)&&r.current()},s=i=>{i.key==="Escape"&&(i.stopPropagation(),r.current())};return document.addEventListener("pointerdown",o,!0),document.addEventListener("keydown",s,!0),()=>{document.removeEventListener("pointerdown",o,!0),document.removeEventListener("keydown",s,!0)}},[e,t])}function Ii({icon:e,title:t,menu:n}){var M;const{options:r,value:o,onSelect:s}=n,[i,u]=c.useState(!1),[a,l]=c.useState(0),d=c.useRef(null),x=Lr(r,o),p=e?void 0:((M=r[x])==null?void 0:M.label)??"",v=c.useCallback(()=>{u(m=>{const g=!m;return g&&l(x),g})},[x]),_=c.useCallback(m=>{s(m),u(!1)},[s]);Ir(i,d,()=>u(!1));const w=m=>{if(!i){(m.key==="ArrowDown"||m.key==="Enter"||m.key===" ")&&(m.preventDefault(),l(x),u(!0));return}if(m.key==="ArrowDown")m.preventDefault(),l(g=>(g+1)%r.length);else if(m.key==="ArrowUp")m.preventDefault(),l(g=>(g-1+r.length)%r.length);else if(m.key==="Enter"||m.key===" "){m.preventDefault();const g=r[a];g&&_(g.id)}};return f.jsxs("div",{ref:d,className:"relative inline-flex",onPointerDown:m=>m.stopPropagation(),children:[f.jsxs("button",{type:"button",onClick:m=>{m.stopPropagation(),v()},onDoubleClick:m=>m.stopPropagation(),onKeyDown:w,"aria-haspopup":"listbox","aria-expanded":i,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",p?"px-1.5 text-[10px] font-mono":"px-1 text-xs",i?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[p?f.jsx("span",{"aria-hidden":"true",children:p}):f.jsx(Je,{name:e??""}),f.jsx(Je,{name:"caret"})]}),i&&f.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((m,g)=>{const h=m.id===o,b=g===a;return f.jsx("li",{role:"option","aria-selected":h,children:f.jsx("button",{type:"button",onClick:y=>{y.stopPropagation(),_(m.id)},onPointerEnter:()=>l(g),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",b?"bg-bg-hover":"",h?"text-accent font-medium":"text-fg"].join(" "),children:m.label})},m.id)})})]})}const Ni=e=>e.format?e.format(e.value):String(e.value);function Nr({spec:e}){const[t,n]=c.useState(!1),[r,o]=c.useState(""),s=c.useRef(null),i=c.useCallback(()=>{o(Li(e.value)),n(!0)},[e.value]);c.useEffect(()=>{t&&s.current&&(s.current.focus(),s.current.select())},[t]);const u=c.useCallback(()=>{n(l=>(l&&e.onChange(Di(r,e.value)),!1))},[r,e]),a=c.useCallback(()=>n(!1),[]);return f.jsxs("label",{className:"inline-flex items-center gap-1 text-fg-muted",title:e.title,onPointerDown:l=>l.stopPropagation(),onDoubleClick:l=>{l.stopPropagation(),t||i()},children:[e.icon?f.jsx("span",{"aria-hidden":"true",className:"inline-flex",children:f.jsx(Je,{name:e.icon})}):f.jsx("span",{"aria-hidden":"true",className:"text-[9px] font-mono",children:e.label}),t?f.jsx("input",{ref:s,type:"text",inputMode:"decimal","aria-label":`${e.title} (numeric entry)`,value:r,onChange:l=>o(l.target.value),onPointerDown:l=>l.stopPropagation(),onDoubleClick:l=>l.stopPropagation(),onKeyDown:l=>{l.stopPropagation(),l.key==="Enter"?(l.preventDefault(),u()):l.key==="Escape"&&(l.preventDefault(),a())},onBlur:u,className:"cairn-plot-toolbar-slider-entry h-3.5 w-[6.5rem] rounded border border-border bg-bg px-1 text-[9px] font-mono tabular-nums text-fg outline-none focus:border-accent"}):f.jsxs(f.Fragment,{children:[f.jsx("input",{type:"range","aria-label":e.title,min:e.min,max:e.max,step:e.step,value:e.value,onChange:l=>e.onChange(Number(l.target.value)),onPointerDown:l=>l.stopPropagation(),className:"cairn-plot-toolbar-slider h-1 w-16 cursor-pointer accent-accent"}),f.jsx("span",{"aria-hidden":"true",className:"w-8 text-right text-[9px] font-mono tabular-nums",children:Ni(e)})]})]})}function Fi({icon:e,title:t,menu:n,onClose:r}){var x;const{options:o,value:s,onSelect:i}=n,[u,a]=c.useState(!1),l=Lr(o,s),d=((x=o[l])==null?void 0:x.label)??"";return f.jsxs("div",{children:[f.jsxs("button",{type:"button","aria-haspopup":"menu","aria-expanded":u,"aria-label":t,onClick:p=>{p.stopPropagation(),a(v=>!v)},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",u?"text-accent":"text-fg hover:bg-bg-hover"].join(" "),children:[e?f.jsx(Je,{name:e}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{className:"flex-1",children:t}),f.jsx("span",{className:"font-mono text-[10px] text-fg-muted",children:d}),f.jsx("span",{className:u?"rotate-180 transition-transform":"transition-transform",children:f.jsx(Je,{name:"caret"})})]}),u&&o.map(p=>{const v=p.id===s;return f.jsxs("button",{type:"button",role:"menuitemradio","aria-checked":v,"data-menu-option":"",onClick:_=>{_.stopPropagation(),i(p.id),r()},className:["flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-[11px]",v?"text-accent font-medium bg-bg-hover/40":"text-fg hover:bg-bg-hover"].join(" "),children:[f.jsx("span",{"aria-hidden":"true",className:"w-3 text-center text-accent",children:v?"✓":""}),f.jsx("span",{children:p.label})]},p.id)})]})}function Ui({actions:e,leading:t,sliders:n}){const[r,o]=c.useState(!1),s=c.useRef(null);return Ir(r,s,()=>o(!1)),f.jsxs("div",{ref:s,className:"relative inline-flex",onPointerDown:i=>i.stopPropagation(),children:[f.jsx("button",{type:"button",onClick:i=>{i.stopPropagation(),o(u=>!u)},onDoubleClick:i=>i.stopPropagation(),"aria-haspopup":"menu","aria-expanded":r,"aria-label":"More controls",title:"More controls",className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded text-xs",r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:f.jsx(Je,{name:"ellipsis"})}),r&&f.jsxs("div",{role:"menu",className:["absolute right-0 top-full z-40 mt-1 min-w-[10rem] max-h-80 overflow-auto","rounded border border-border bg-bg-elevated py-1 shadow-md"].join(" "),children:[t.map(i=>i.menu?f.jsx(Fi,{icon:i.icon,title:i.title,menu:i.menu,onClose:()=>o(!1)},i.id):f.jsxs("button",{type:"button",disabled:i.disabled,onClick:u=>{var a;u.stopPropagation(),!i.disabled&&((a=i.onClick)==null||a.call(i),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",i.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",i.active?"text-accent":""].join(" "),children:[i.icon?f.jsx(Je,{name:i.icon}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{children:i.label??i.title})]},i.id)),t.length>0&&e.length>0&&f.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),e.map(i=>f.jsxs("button",{type:"button",role:"menuitem",disabled:i.disabled,onClick:u=>{u.stopPropagation(),!i.disabled&&(i.onClick(),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",i.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",i.active?"text-accent":""].join(" "),children:[i.icon?f.jsx(Je,{name:i.icon}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{children:i.title})]},i.id)),n.length>0&&(e.length>0||t.length>0)&&f.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),n.map(i=>f.jsx("div",{className:"px-2 py-1",children:f.jsx(Nr,{spec:i})},i.id))]})]})}function Gi({controller:e,config:t}){var A,L;const n=c.useRef(null),[r,o]=c.useState(!1),s=c.useRef(r);s.current=r;const i=c.useRef(0),u=`${((A=t==null?void 0:t.leadingButtons)==null?void 0:A.length)??0}:${((L=t==null?void 0:t.sliders)==null?void 0:L.length)??0}:${(t==null?void 0:t.visibility)??"hover"}`;if(c.useEffect(()=>{const C=n.current,B=C==null?void 0:C.parentElement;if(!B)return;const k=()=>{const U=B.clientWidth;if(!s.current&&n.current){const Q=n.current.scrollWidth;Q>0&&(i.current=Q)}o(Ri(U,i.current,s.current))};let O=0;const Y=()=>{O||(O=requestAnimationFrame(()=>{O=0,k()}))},F=new ResizeObserver(Y);return F.observe(B),k(),()=>{F.disconnect(),O&&cancelAnimationFrame(O)}},[u]),(t==null?void 0:t.enabled)===!1)return null;const a=e.capabilities,l=t==null?void 0:t.buttons,d=(C,B)=>B&&(l==null?void 0:l[C])!==!1,x=C=>()=>e.setDragMode(C),p=()=>{e.toPNG({filename:"plot"}).then(C=>Ai(C,"plot.png")).catch(()=>{})},v=[];d("zoom",a.zoom)&&v.push({id:"zoom",icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:x("zoom")}),d("pan",a.pan)&&v.push({id:"pan",icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:x("pan")}),d("select",a.select)&&v.push({id:"select",icon:"select",title:"Box select",active:e.dragMode==="select",onClick:x("select")}),d("lasso",a.lasso)&&v.push({id:"lasso",icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:x("lasso")});const _=[];d("zoomIn",a.zoom)&&_.push({id:"zoomIn",icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),d("zoomOut",a.zoom)&&_.push({id:"zoomOut",icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()});const w=[];d("autoscale",a.autoscale)&&w.push({id:"autoscale",icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),d("reset",a.reset)&&w.push({id:"reset",icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()});const M=[];d("screenshot",a.screenshot)&&M.push({id:"screenshot",icon:"camera",title:"Download plot as PNG",onClick:p});const m=[v,_,w,M].filter(C=>C.length>0),g=m.flat(),h=(t==null?void 0:t.leadingButtons)??[],b=(t==null?void 0:t.sliders)??[];if(!h.length&&g.length===0&&b.length===0)return null;const y=(t==null?void 0:t.position)??"top-right",E=(t==null?void 0:t.visibility)==="always",R=y==="top-right"||y==="bottom-right",S=["cairn-plot-toolbar z-30 rounded border border-border bg-bg-elevated/90 shadow-sm backdrop-blur-sm transition-opacity",E?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),T={position:"absolute",pointerEvents:"auto",...Bi[y]};return r?f.jsx("div",{ref:n,style:T,className:`${S} inline-flex px-0.5 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:f.jsx(Ui,{actions:g,leading:h,sliders:b})}):f.jsxs("div",{ref:n,style:T,className:`${S} flex flex-col gap-0.5 px-1 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:[f.jsxs("div",{className:`flex items-center gap-0.5 ${R?"justify-end":"justify-start"}`,children:[h.length>0&&f.jsxs(f.Fragment,{children:[h.map(C=>C.menu?f.jsx(Ii,{icon:C.icon,title:C.title,menu:C.menu},C.id):f.jsx(Br,{icon:C.icon,label:C.label,title:C.title,active:C.active,disabled:C.disabled,onClick:C.onClick??(()=>{})},C.id)),m.length>0&&f.jsx(Or,{})]}),m.map((C,B)=>f.jsxs("span",{className:"inline-flex items-center gap-0.5",children:[B>0&&f.jsx(Or,{}),C.map(k=>f.jsx(Br,{icon:k.icon,title:k.title,active:k.active,disabled:k.disabled,onClick:k.onClick},k.id))]},C[0].id))]}),b.length>0&&f.jsx("div",{className:`flex items-center gap-2 ${R?"justify-end":"justify-start"}`,children:b.map(C=>f.jsx(Nr,{spec:C},C.id))})]})}const zi={zoom:1,pan:{x:0,y:0}},Fr=1.3,$i=.25,Vi=64,Xi={buttons:{zoom:!1}};function Wi(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const Hi=[{id:"none",label:"None"},...us];function En(e,t){return{id:"colormap",title:"Colormap",menu:{options:Hi,value:e,onSelect:t}}}const Ur={linear:"Linear",srgb:"sRGB",reinhard:"Reinhard",aces:"ACES",extended:"Extended · Linear","extended-clamp":"Extended · Linear (managed)","extended-reinhard":"Extended · Reinhard","extended-aces":"Extended · ACES"},Gr=Hn.map(e=>({id:e,label:Ur[e]})),Yi=Yn.map(e=>({id:e,label:Ur[e]}));function zr(e,t,n){return{id:"tonemap",title:"Tone-mapping operator",menu:{options:n?[...Gr,...Yi]:Gr,value:e,onSelect:t}}}function Ki({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:s,naturalHeight:i,minZoom:u=$i,maxZoom:a=Vi,requestRender:l,onReset:d,extraModified:x=!1}){const p=c.useCallback(E=>{var O;if(!o)return;const R=(O=e.current)==null?void 0:O.getBoundingClientRect(),P=(R==null?void 0:R.width)??0,S=(R==null?void 0:R.height)??0,T=s&&i&&P>0&&S>0?fn(s,i,P,S):a,A=Math.max(u,Math.min(T,n*E));if(A===n)return;const L=P/2,C=S/2,B=L-(L-r.x)/n*A,k=C-(C-r.y)/n*A;o({zoom:A,pan:{x:B,y:k}})},[o,e,s,i,a,u,n,r.x,r.y]),v=c.useCallback(()=>p(Fr),[p]),_=c.useCallback(()=>p(1/Fr),[p]),w=c.useCallback(()=>{o==null||o(zi),d==null||d()},[o,d]),M=c.useCallback(E=>{const R={scale:E==null?void 0:E.scale,filename:E==null?void 0:E.filename};l==null||l();const P=t==null?void 0:t.current;if(P)return Dr(P,R);const S=e.current;return S?Ti(S,R):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,l]),m=c.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),g=n!==1||r.x!==0||r.y!==0||x,h=c.useCallback(E=>{},[]),b=c.useCallback(E=>{},[]),y=c.useCallback(()=>{},[]);return c.useMemo(()=>({capabilities:m,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:g,setDragMode:h,setHoverMode:b,toggleSpikelines:y,zoomIn:v,zoomOut:_,autoscale:w,reset:w,toPNG:M}),[m,g,h,b,y,v,_,w,M])}const qi={zoom:1,pan:{x:0,y:0}};function Ft({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:s,pan:i,onViewportChange:u,naturalDims:a,checkerboard:l,wrapperClassName:d,wrapperStyle:x,viewportPadding:p,header:v,surface:_,showAxes:w,overlayNode:M,overlay:m,notationSeed:g,exportCanvasRef:h,requestRender:b,leadingMenus:y,displayAdjust:E,depthSliders:R,extraSliders:P,regionSelect:S,onReset:T,extraModified:A,label:L,showLabelChip:C,isDraggable:B=!1,onDragStart:k,extraChips:O}){const[Y,F]=c.useState(g),[U,Q]=c.useState(!1),[oe,he]=c.useState(!1),ie="render"in m?null:m,ge=!!S&&!!ie,{containerProps:G}=cr({containerRef:r,zoom:s,pan:i,onViewportChange:u,naturalWidth:a==null?void 0:a.w,naturalHeight:a==null?void 0:a.h}),V=c.useCallback(()=>{E==null||E.onExposureChange(0),E==null||E.onOffsetChange(0),T==null||T()},[E,T]),J=c.useCallback(()=>{u==null||u(qi),V()},[u,V]),te=Ki({rootRef:r,canvasRef:h,zoom:s,pan:i,onViewportChange:u,naturalWidth:a==null?void 0:a.w,naturalHeight:a==null?void 0:a.h,requestRender:b,onReset:V,extraModified:((E==null?void 0:E.exposureEV)??0)!==0||((E==null?void 0:E.offset)??0)!==0||!!A}),fe=c.useMemo(()=>{const de=[];if(R&&de.push(...R),!E)return P&&de.push(...P),de.length?de:void 0;const _e=(ce,Re)=>`${ce>=0?"+":"−"}${Math.abs(ce).toFixed(Re)}`;return de.push({id:"exposure",icon:"sun",label:"EV",title:"Exposure (EV stops) — color × 2^EV. Double-click to type a value (may exceed the slider range).",min:-8,max:8,step:.1,value:E.exposureEV,onChange:E.onExposureChange,format:ce=>_e(ce,1)},{id:"offset",icon:"plusminus",label:"OFF",title:"Offset — added after exposure (before tonemap). Double-click to type a value (may exceed the slider range).",min:-1,max:1,step:.01,value:E.offset,onChange:E.onOffsetChange,format:ce=>_e(ce,2)}),P&&de.push(...P),de},[E,R,P]),W=c.useMemo(()=>ge?{id:"region-depth",icon:"select",title:"Select depth from region — drag a rectangle to set the Z window to the samples it covers (Esc to cancel)",active:oe,onClick:()=>he(de=>!de)}:null,[ge,oe]),ne=c.useMemo(()=>({...Xi,leadingButtons:[...y??[],...W?[W]:[],...U?[Wi(Y,F)]:[]],sliders:fe}),[U,Y,y,W,fe]),Ee=" cairn-checkerboard",me="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(l==="pane"?Ee:""),H=d+(l==="wrapper"?Ee:""),Ce="render"in m?m.render({notation:Y,setOverlayActive:Q}):m.hasSource&&a?f.jsx(dt,{imageElRef:m.displayElRef,naturalWidth:a.w,naturalHeight:a.h,zoom:s,pan:i,sourceWindow:m.sourceWindow,sample:m.sample,notation:Y,version:m.version,onActiveChange:Q}):null;return f.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[v,n&&f.jsx(Gi,{controller:te,config:ne}),f.jsxs("div",{ref:r,className:me,style:{padding:p,...G.style},onPointerDown:G.onPointerDown,onPointerMove:G.onPointerMove,onPointerUp:G.onPointerUp,onPointerCancel:G.onPointerCancel,onDoubleClick:J,...t,children:[f.jsxs("div",{ref:o,className:H,style:x,children:[_,w&&a&&f.jsx(Ei,{naturalWidth:a.w,naturalHeight:a.h,zoom:s,containerRef:o}),M]}),Ce,!n&&U&&f.jsx(pr,{notation:Y,onChange:F}),oe&&S&&ie&&a&&f.jsx(Zi,{imageElRef:ie.displayElRef,naturalDims:a,sourceWindow:ie.sourceWindow,onQueryLive:S.queryLive,onSelect:(de,_e,ce,Re)=>{he(!1),S.commit(de,_e,ce,Re)},onExit:()=>he(!1)}),!oe&&(S==null?void 0:S.rect)&&ie&&a&&f.jsx(Qi,{rect:S.rect,imageElRef:ie.displayElRef,naturalDims:a,sourceWindow:ie.sourceWindow,zoom:s,pan:i,onQueryLive:S.queryLive,onCommit:S.commit,onRemove:S.remove})]}),C&&f.jsx(bn,{label:L,isDraggable:B,onDragStart:k}),O]})}function Zi({imageElRef:e,naturalDims:t,sourceWindow:n,onQueryLive:r,onSelect:o,onExit:s}){var M;const i=c.useRef(null),u=c.useRef(null),[a,l]=c.useState(null),d=c.useCallback((m,g,h,b)=>{const y=e.current;return y?dr(m,g,h,b,{box:y.getBoundingClientRect(),naturalWidth:t.w,naturalHeight:t.h,sourceWindow:n}):null},[e,t,n]);c.useEffect(()=>{const m=g=>{g.key==="Escape"&&s()};return window.addEventListener("keydown",m),()=>window.removeEventListener("keydown",m)},[s]);const x=c.useCallback(m=>{var g,h;(h=(g=m.target).setPointerCapture)==null||h.call(g,m.pointerId),u.current={x:m.clientX,y:m.clientY},l({x0:m.clientX,y0:m.clientY,x1:m.clientX,y1:m.clientY})},[]),p=c.useCallback(m=>{const g=u.current;if(!g)return;l({x0:g.x,y0:g.y,x1:m.clientX,y1:m.clientY});const h=d(g.x,g.y,m.clientX,m.clientY);h&&r(h.x0,h.y0,h.x1,h.y1)},[d,r]),v=c.useCallback(m=>{const g=u.current;u.current=null,l(null);const h=e.current;if(!g||!h){s();return}if(Math.abs(m.clientX-g.x)<3&&Math.abs(m.clientY-g.y)<3){s();return}const b=h.getBoundingClientRect(),y=dr(g.x,g.y,m.clientX,m.clientY,{box:b,naturalWidth:t.w,naturalHeight:t.h,sourceWindow:n});if(!y){s();return}o(y.x0,y.y0,y.x1,y.y1)},[e,t,n,o,s]),_=(M=i.current)==null?void 0:M.getBoundingClientRect(),w=a&&_?{left:Math.min(a.x0,a.x1)-_.left,top:Math.min(a.y0,a.y1)-_.top,width:Math.abs(a.x1-a.x0),height:Math.abs(a.y1-a.y0)}:null;return f.jsx("div",{ref:i,className:"absolute inset-0 z-20",style:{cursor:"crosshair",touchAction:"none"},onPointerDown:x,onPointerMove:p,onPointerUp:v,children:w&&f.jsx("div",{className:"absolute border-2 border-dashed border-sky-400 bg-sky-400/15 pointer-events-none",style:w})})}const ji={nw:{cursor:"nwse-resize",fx:0,fy:0},n:{cursor:"ns-resize",fx:.5,fy:0},ne:{cursor:"nesw-resize",fx:1,fy:0},e:{cursor:"ew-resize",fx:1,fy:.5},se:{cursor:"nwse-resize",fx:1,fy:1},s:{cursor:"ns-resize",fx:.5,fy:1},sw:{cursor:"nesw-resize",fx:0,fy:1},w:{cursor:"ew-resize",fx:0,fy:.5}};function Qi({rect:e,imageElRef:t,naturalDims:n,sourceWindow:r,zoom:o,pan:s,onQueryLive:i,onCommit:u,onRemove:a}){const l=c.useRef(null),[d,x]=c.useState(null),p=c.useRef(null),[v,_]=c.useState(null),w=d??e;c.useLayoutEffect(()=>{const h=()=>{const E=t.current,R=l.current;if(!E||!R)return;const P=E.getBoundingClientRect(),S=R.getBoundingClientRect(),T=ri(w,{box:P,naturalWidth:n.w,naturalHeight:n.h,sourceWindow:r});_({left:T.left-S.left,top:T.top-S.top,width:T.width,height:T.height})};h();const b=t.current;if(!b||typeof ResizeObserver>"u")return;const y=new ResizeObserver(h);return y.observe(b),()=>y.disconnect()},[w,n.w,n.h,r,o,s.x,s.y]);const M=c.useCallback(h=>b=>{var y,E;b.stopPropagation(),(E=(y=b.target).setPointerCapture)==null||E.call(y,b.pointerId),p.current={handle:h,sx:b.clientX,sy:b.clientY,start:w},x(w)},[w]),m=c.useCallback(h=>{const b=p.current,y=t.current;if(!b||!y)return;const E=ni({box:y.getBoundingClientRect(),naturalWidth:n.w,naturalHeight:n.h,sourceWindow:r}),R=(h.clientX-b.sx)/(E||1),P=(h.clientY-b.sy)/(E||1),S=yi(b.start,b.handle,R,P,{w:n.w,h:n.h},1);x(S),i(S.x0,S.y0,S.x1,S.y1)},[t,n.w,n.h,r,i]),g=c.useCallback(()=>{const h=p.current;p.current=null;const b=d;x(null),h&&b&&u(b.x0,b.y0,b.x1,b.y1)},[d,u]);return v?f.jsxs("div",{ref:l,className:"absolute inset-0 z-20 pointer-events-none",style:{touchAction:"none"},children:[f.jsx("div",{className:"absolute border-2 border-sky-400 bg-sky-400/10 pointer-events-auto",style:{...v,cursor:"move",touchAction:"none"},onPointerDown:M("move"),onPointerMove:m,onPointerUp:g}),wi.map(h=>{const b=ji[h];return f.jsx("div",{className:"absolute pointer-events-auto flex items-center justify-center",style:{left:v.left+b.fx*v.width-12,top:v.top+b.fy*v.height-12,width:24,height:24,cursor:b.cursor,touchAction:"none"},onPointerDown:M(h),onPointerMove:m,onPointerUp:g,children:f.jsx("div",{className:"w-2.5 h-2.5 rounded-sm bg-sky-400 border border-white/80"})},h)}),f.jsx("button",{type:"button","aria-label":"Remove depth region",title:"Remove region (reset the depth window)",className:"absolute pointer-events-auto flex items-center justify-center rounded-full text-white",style:{left:v.left+v.width-8,top:v.top-32,width:40,height:40},onPointerDown:h=>h.stopPropagation(),onClick:a,children:f.jsx("span",{className:"flex items-center justify-center w-5 h-5 rounded-full bg-slate-800/90 border border-white/70 text-[11px] leading-none",children:"×"})})]}):f.jsx("div",{ref:l,className:"absolute inset-0 z-20 pointer-events-none"})}const _n={inFlight:!1,pending:null};function $r(e,t){return e.inFlight?{state:{inFlight:!0,pending:t},launch:null}:{state:{inFlight:!0,pending:null},launch:t}}function Vr(e){return e.pending!=null?{state:{inFlight:!0,pending:null},launch:e.pending}:{state:_n,launch:null}}const Ji=1e3,ea=typeof requestAnimationFrame=="function"?e=>requestAnimationFrame(()=>e()):e=>setTimeout(e,0),Xr=typeof cancelAnimationFrame=="function"?cancelAnimationFrame:e=>clearTimeout(e);function Wr(e,t){const n=e.deep,r=(n==null?void 0:n.zMin)??0,o=(n==null?void 0:n.zMax)??0,s=t!=null,[i,u,a]=Qe(r),[l,d,x]=Qe(o),[p,v]=c.useState(null),[_,w]=c.useState(null),M=c.useRef(n);M.current=n;const m=c.useRef(r);m.current=r;const g=c.useRef(o);g.current=o;const h=c.useRef(i);h.current=i;const b=c.useRef(l);b.current=l;const y=c.useRef({near:i,far:l,ver:0}),E=c.useRef(0),R=c.useRef(!0),P=c.useRef(_n),S=c.useRef(null),T=u,A=d,L=c.useCallback(()=>{const G=M.current;if(!G)return;const{near:V,far:J,ver:te}=y.current,fe=()=>{const W=Vr(P.current);P.current=W.state,W.launch!=null&&L()};G.flatten(V,J).then(W=>{y.current.ver===te&&!R.current&&(S.current!=null&&Xr(S.current),S.current=ea(()=>{S.current=null,v(W)})),fe()}).catch(fe)},[]),C=c.useCallback(()=>{const G=$r(P.current,1);P.current=G.state,G.launch!=null&&L()},[L]);c.useEffect(()=>()=>{S.current!=null&&Xr(S.current),n==null||n.dispose()},[n]),c.useEffect(()=>{if(!n)return;const G=i<=r&&l>=o;if(R.current=G,E.current+=1,y.current={near:i,far:l,ver:E.current},s){t(i,l);return}if(G){v(null);return}C()},[n,i,l,r,o,C,s,t]);const B=c.useMemo(()=>n&&!s&&p!=null?{...e,data:p}:e,[e,n,s,p]),k=n!=null&&r>0&&o/r>Ji,O=c.useMemo(()=>{if(!n||!(o>r))return;const G=J=>Math.abs(J)>=1e3||Math.abs(J)<.01&&J!==0?J.toExponential(2):J.toFixed(3),V=(J,te,fe,W,ne)=>{if(k){const Ee=Math.log10(r),me=Math.log10(o);return{id:J,icon:"layers",label:te,title:`${fe} (log scale). Double-click to type a Z.`,min:Ee,max:me,step:(me-Ee)/200,value:Math.log10(Math.max(r,Math.min(W,o))),onChange:H=>ne(10**H),format:H=>G(10**H)}}return{id:J,icon:"layers",label:te,title:`${fe}. Double-click to type a Z.`,min:r,max:o,step:(o-r)/200,value:W,onChange:ne,format:G}};return[V("depth-near","ZN","Depth window NEAR — composite only samples with Z ≥ this",i,T),V("depth-far","ZF","Depth window FAR — composite only samples with Z ≤ this",l,A)]},[n,r,o,i,l,k,T,A]),Y=c.useCallback(G=>{if(G.count===0){const te=m.current,fe=g.current,W=fe>te?0:1;u(fe+W),d(te-W);return}const V=g.current-m.current,J=Math.max(Math.abs(V)*1e-4,1e-4);u(G.zMin-J),d(G.zMax+J)},[u,d]),F=c.useRef(null),U=c.useRef(_n),Q=c.useCallback(()=>{const G=M.current,V=F.current,J=()=>{const te=Vr(U.current);U.current=te.state,te.launch!=null&&Q()};if(!G||!V){J();return}G.zRangeInRect(V.x0,V.y0,V.x1,V.y1).then(te=>{Y(te),J()}).catch(J)},[Y]),oe=c.useCallback((G,V,J,te)=>{F.current={x0:G,y0:V,x1:J,y1:te};const fe=$r(U.current,1);U.current=fe.state,fe.launch!=null&&Q()},[Q]),he=c.useCallback((G,V,J,te)=>{w({x0:G,y0:V,x1:J,y1:te}),oe(G,V,J,te)},[oe]),ie=c.useCallback(()=>{w(null),a.reset(),x.reset(),v(null)},[a,x]),ge=c.useCallback(()=>{a.reset(),x.reset(),w(null),v(null)},[a,x]);return{hdr:B,sliders:O,hasDeep:n!=null,region:_,queryRegionWindow:oe,commitRegion:he,removeRegion:ie,reset:ge,isModified:a.isModified||x.isModified}}function Hr(e){return"hdr"in e&&e.hdr!=null}function Yr(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function De(e){return Number.isFinite(e)?e:0}const ta={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function na(e,t,n,r,o=0){const{h:s,w:i,c:u}=Yr(e.shape),a=e.precision==="f16-bits"?tr(e.data):e.data,l=xs(t),d=new Uint8ClampedArray(i*s*4);for(let x=0;x<i*s;x++){const p=x*u;let v,_,w,M=1;u===1?v=_=w=De(a[p]):u===3?(v=De(a[p]),_=De(a[p+1]),w=De(a[p+2])):(v=De(a[p]),_=De(a[p+1]),w=De(a[p+2]),M=De(a[p+3]));const m=[At(v,n,o),At(_,n,o),At(w,n,o)],[g,h,b]=l(m),y=x*4;d[y]=255*rn(g,r),d[y+1]=255*rn(h,r),d[y+2]=255*rn(b,r),d[y+3]=255*(M<0?0:M>1?1:M)}return new ImageData(d,i,s)}function ra(e){var Ge,et;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:s="auto",colormap:i="none",showAxes:u=!1,processing:a=ta,zoom:l=1,pan:d={x:0,y:0},onViewportChange:x,onNaturalSize:p,label:v,isDraggable:_=!1,onDragStart:w,overlay:M,overlaySettings:m,pixelValueNotation:g="decimal",toolbar:h=!0}=e,[b,y,E]=Qe(i);c.useEffect(()=>{y(i)},[i,y]);const R=c.useRef(null),P=c.useRef(null),S=c.useRef(null),T=c.useRef(null),A=c.useRef(null),L=c.useRef(null),C=c.useRef(null),[B,k]=c.useState(0),O=c.useCallback(()=>k(z=>z+1),[]),Y=c.useMemo(()=>({get current(){const z=A.current;return z instanceof HTMLCanvasElement?z:null}}),[]),F=c.useCallback(z=>{R.current=z,z&&(A.current=z)},[]),U=c.useCallback(z=>{P.current=z,z&&(A.current=z)},[]),Q=c.useCallback(z=>{z&&(A.current=z)},[]),[oe,he]=c.useState(!1),[ie,ge]=c.useState(!1),[G,V]=c.useState(!1),[J,te]=c.useState(null),{flipSign:fe}=a,{gammaFilterId:W,filterStr:ne,gamma:Ee,offset:me}=Ar(a),H=!r&&o!=="none"&&n!=null&&t!=null,Ce=o!=="none"&&n!=null,de=b!=="none"&&!H&&!(r&&Ce)&&t!=null;c.useEffect(()=>{if(!de||!t){V(!1);return}let z=!1;V(!1);const xe=`${t}::${b}`,Pe=an(xe);if(Pe){const le=P.current;if(le){le.width=Pe.width,le.height=Pe.height;const be=le.getContext("2d");be&&be.putImageData(Pe,0,0),C.current=Pe,O(),te({w:Pe.width,h:Pe.height}),p==null||p(Pe.width,Pe.height),V(!0)}return}const Se=new Image;return Se.onload=()=>{if(z)return;const le=document.createElement("canvas");le.width=Se.naturalWidth,le.height=Se.naturalHeight;const be=le.getContext("2d");if(!be)return;be.drawImage(Se,0,0);const Le=be.getImageData(0,0,le.width,le.height),$=sn(b),N=on(Le,b,$);cn(xe,N);const K=P.current;if(!K||z)return;K.width=N.width,K.height=N.height;const I=K.getContext("2d");I&&I.putImageData(N,0,0),C.current=N,O(),te({w:N.width,h:N.height}),p==null||p(N.width,N.height),V(!0)},Se.src=t,()=>{z=!0}},[de,t,b]);const _e=c.useCallback((z,xe)=>{te(Pe=>Pe&&Pe.w===z&&Pe.h===xe?Pe:{w:z,h:xe}),p==null||p(z,xe)},[]);c.useEffect(()=>{if(!t){L.current=null,C.current=null,O();return}let z=!1;return lt(t).then(xe=>{z||(L.current=xe,b==="none"&&(C.current=xe),O())}),()=>{z=!0}},[t,b,O]);const ce=c.useCallback((z,xe,Pe)=>{const Se=L.current;if(!Se||z<0||xe<0||z>=Se.width||xe>=Se.height)return null;const le=(xe*Se.width+z)*4,be=Se.data[le],Le=Se.data[le+1],$=Se.data[le+2],N=C.current;let K=be,I=Le,ee=$;if(N&&N.width===Se.width&&N.height===Se.height){const we=(xe*N.width+z)*4;K=N.data[we],I=N.data[we+1],ee=N.data[we+2]}const j=bt(K,I,ee);return ft(b!=="none"||be===Le&&Le===$?[be]:[be,Le,$],"uint8",Pe,j)},[b]);c.useEffect(()=>{if(ge(!1),!H){he(!1);return}let z=!1;const xe=Ds(),Pe=xe==="gpu"||xe==="auto",Se=`${n}::${t}::${o}::${b}`;if(xe!=="gpu"){const le=an(Se);if(le){const be=R.current;if(be){(be.width!==le.width||be.height!==le.height)&&(be.width=le.width,be.height=le.height);const Le=be.getContext("2d");Le&&Le.putImageData(le,0,0),_e(le.width,le.height),he(!0)}return}}return(async()=>{const[le,be]=await Promise.all([lt(n),lt(t)]);if(z||!le||!be)return;const $=o.includes("signed")?"signed":"positive",N=b!=="none"?Jt(b):null,K={diffMode:o,colormap:N,cmapMode:$};if(Pe)try{const Te=R.current;if(Te){const we=Rs(le,be,K,Te);if(we){if(z)return;_e(we.width,we.height),he(!0);return}}}catch(Te){console.warn("[cairn] WebGL 2 diff error:",Te)}if(xe==="gpu"){z||ge(!0);return}let I=_s(le,be,o);b!=="none"&&(I=on(I,b,$)),cn(Se,I);const ee=R.current;if(!ee||z)return;(ee.width!==I.width||ee.height!==I.height)&&(ee.width=I.width,ee.height=I.height);const j=ee.getContext("2d");j&&j.putImageData(I,0,0),_e(I.width,I.height),he(!0)})(),()=>{z=!0}},[n,t,o,H,b,p]);const Re=s==="auto"?void 0:s,$e=fe?{filter:"invert(1)"}:{},qe=M&&(m!=null&&m.enabled)&&J&&t&&((((Ge=M.boxes)==null?void 0:Ge.length)??0)>0||(((et=M.masks)==null?void 0:et.length)??0)>0)?f.jsx(pn,{data:M,settings:m,naturalWidth:J.w,naturalHeight:J.h}):void 0,Fe=t?H&&ie?f.jsx(Tr,{title:"WebGL 2 unavailable",body:"GPU render mode needs WebGL 2 here — switch render mode to Auto or CPU."}):H?f.jsxs(f.Fragment,{children:[!oe&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),f.jsx("canvas",{ref:F,className:"w-full h-full object-contain block",style:{display:oe?"block":"none",imageRendering:Re,...$e}})]}):de?f.jsxs(f.Fragment,{children:[!G&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),f.jsx("canvas",{ref:U,className:"w-full h-full object-contain block",style:{display:G?"block":"none",imageRendering:Re,...$e}})]}):f.jsx("img",{ref:Q,src:t,alt:v,className:"w-full h-full object-contain block",draggable:!1,style:{filter:ne,imageRendering:Re},onLoad:z=>{const xe=z.currentTarget;te({w:xe.naturalWidth,h:xe.naturalHeight}),p==null||p(xe.naturalWidth,xe.naturalHeight)}}):f.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return f.jsx(Ft,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:h,paneRef:S,wrapperRef:T,zoom:l,pan:d,onViewportChange:x,naturalDims:J,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${d.x}px, ${d.y}px) scale(${l})`,transformOrigin:"0 0"},viewportPadding:u&&J?"16px 4px 4px 28px":"4px",header:f.jsx(Cr,{id:W,gamma:Ee,offset:me}),surface:Fe,showAxes:u,overlayNode:qe,overlay:{displayElRef:A,sample:ce,version:B,hasSource:!!t},notationSeed:g,exportCanvasRef:Y,leadingMenus:[En(b,z=>y(z))],onReset:E.reset,extraModified:E.isModified,label:v,showLabelChip:!!v,isDraggable:_,onDragStart:w})}function oa(e){const{tonemap:t="srgb",exposure:n=0,gamma:r,showAxes:o=!1,label:s="",interpolation:i="auto",zoom:u=1,pan:a={x:0,y:0},onViewportChange:l,pixelValueNotation:d="decimal",toolbar:x=!0}=e,p=Wr(e.hdr),v=p.hdr,[_,w,M]=Qe(nn(t));c.useEffect(()=>{w(nn(t))},[t,w]);const m=c.useRef(null),g=c.useRef(null),h=c.useRef(null),[b,y]=c.useState(null),E=c.useRef(null),[R,P]=c.useState(0),[S,T]=c.useState(0),[A,L]=c.useState(0);c.useEffect(()=>{const k=m.current;if(!k)return;let O;try{O=na(v,_,n+S,r,A)}catch(F){console.error("[cairn] HDR tone-map error:",F);return}(k.width!==O.width||k.height!==O.height)&&(k.width=O.width,k.height=O.height);const Y=k.getContext("2d");Y&&(Y.putImageData(O,0,0),E.current=O,P(F=>F+1),y(F=>F&&F.w===O.width&&F.h===O.height?F:{w:O.width,h:O.height}))},[v,_,n,r,S,A]);const C=c.useCallback((k,O,Y)=>{const F=b;if(!F||k<0||O<0||k>=F.w||O>=F.h)return null;const U=v.shape.length===2?1:v.shape[2]??1,Q=(O*F.w+k)*U,oe=v.data,he=v.precision==="f16-bits"?V=>kt(oe[V]??0):V=>oe[V]??0,ie=E.current;let ge=.5;if(ie&&ie.width===F.w&&ie.height===F.h){const V=(O*F.w+k)*4;ge=bt(ie.data[V],ie.data[V+1],ie.data[V+2])}const G=U===1?[he(Q)]:[he(Q),he(Q+1),he(Q+2)];return ft(G,"unit",Y,ge)},[v,b]),B=i==="auto"?void 0:i;return f.jsx(Ft,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:x,paneRef:g,wrapperRef:h,zoom:u,pan:a,onViewportChange:l,naturalDims:b,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${a.x}px, ${a.y}px) scale(${u})`,transformOrigin:"0 0"},viewportPadding:o&&b?"16px 4px 4px 28px":"4px",surface:f.jsx("canvas",{ref:m,className:"w-full h-full object-contain block",style:{imageRendering:B}}),showAxes:o,overlay:{displayElRef:m,sample:C,version:R,hasSource:!0},notationSeed:d,exportCanvasRef:m,leadingMenus:[zr(_,k=>w(k),!1)],displayAdjust:{exposureEV:S,offset:A,onExposureChange:T,onOffsetChange:L},depthSliders:p.sliders,regionSelect:p.hasDeep?{rect:p.region,queryLive:p.queryRegionWindow,commit:p.commitRegion,remove:p.removeRegion}:void 0,onReset:()=>{p.reset(),M.reset()},extraModified:p.isModified||M.isModified,label:s,showLabelChip:!!s})}function Mn(e){return Hr(e)?f.jsx(oa,{...e}):f.jsx(ra,{...e})}const Kr={"no-webgpu":0,"no-hdr-browser":1,"no-hdr-display":2},sa="https://github.com/doeringchristian/cairn-plot/blob/main/docs/browser-support.md";function ia(e,t=!1){const n=e||"";return t?"brave":/firefox/i.test(n)?"firefox":/safari/i.test(n)&&!/chrome|chromium|crios|android/i.test(n)?"safari":/linux/i.test(n)&&/chrome|chromium/i.test(n)?"chromium-linux":"chromium"}function aa(e){const t=e||"";return/mac os x|macintosh/i.test(t)?"macos":/windows/i.test(t)?"windows":"other"}function ca(e,t){if(e==="no-hdr-display")switch(aa(t.userAgent)){case"macos":return"macOS: EDR engages automatically on HDR-capable displays — confirm your display supports HDR.";case"windows":return"Windows: turn on Settings → System → Display → Use HDR.";default:return"Enable HDR in your display and OS settings."}const n=ia(t.userAgent,t.isBrave);if(e==="no-hdr-browser")switch(n){case"firefox":return"Firefox has no extended-tone-mapping canvas path at all — true HDR output is impossible until Firefox implements it (fundamental browser limitation).";case"safari":return"Safari's WebGPU HDR canvas tone-mapping is still maturing — update to the latest Safari 26+.";default:return"Chrome/Edge 129+ is required for HDR canvas output (toneMapping: extended) — update your browser."}switch(n){case"firefox":return"Firefox: about:config → dom.webgpu.enabled (HDR output is not available in Firefox at all — browser limitation).";case"safari":return"Safari: Develop → Feature Flags → WebGPU (Safari 26+ has it by default).";case"brave":return"Brave: check Shields fingerprint blocking + brave://flags.";case"chromium-linux":return"Chromium on Linux: enable chrome://flags/#enable-unsafe-webgpu.";case"chromium":default:return"Chrome/Edge: enable chrome://flags/#enable-unsafe-webgpu and hardware acceleration."}}function la(e){switch(e){case"no-webgpu":return"GPU renderer unavailable → CPU fallback active; FLIP kernels + HDR compare disabled.";case"no-hdr-browser":return"True HDR output is unsupported by this browser — a fundamental browser limitation, not a cairn-plot bug → HDR images tone-mapped to SDR.";case"no-hdr-display":return"Your display/OS is not in HDR mode → HDR images tone-mapped to SDR."}}function qr(e,t){return`cairn-plot:capnotice:${e}:${t}`}const Zr=new Set;function jr(e){try{if(window.localStorage.getItem(e)==="1")return!0}catch{}try{if(window.sessionStorage.getItem(e)==="1")return!0}catch{}return Zr.has(e)}function ua(e){try{window.localStorage.setItem(e,"1");return}catch{}try{window.sessionStorage.setItem(e,"1");return}catch{}Zr.add(e)}const Qr=new Set;let Ut=null,gt=null;function Jr(){gt&&gt.parentNode&&gt.parentNode.removeChild(gt),gt=null,Ut=null}function fa(e){const t=qr(e,window.location.pathname),n=ca(e,{userAgent:navigator.userAgent,isBrave:!!navigator.brave}),r=document.createElement("div");r.setAttribute("role","status"),r.setAttribute("data-cairn-plot-capnotice",e),Object.assign(r.style,{position:"fixed",bottom:"12px",right:"12px",zIndex:"2147483000",maxWidth:"340px",boxSizing:"border-box",padding:"10px 30px 10px 12px",borderRadius:"6px",border:"1px solid var(--color-border, #d0d7de)",background:"rgb(var(--color-bg-elevated-rgb, 246 248 250) / 0.9)",color:"var(--color-fg-muted, #656d76)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",boxShadow:"0 4px 12px rgba(0, 0, 0, 0.18)",font:"12px/1.4 system-ui, sans-serif"});const o=document.createElement("div");o.textContent=la(e),Object.assign(o.style,{fontWeight:"600",color:"var(--color-fg, #1f2328)",marginBottom:"4px"});const s=document.createElement("div");s.textContent=n,s.style.marginBottom="4px";const i=document.createElement("a");i.href=sa,i.target="_blank",i.rel="noopener noreferrer",i.textContent="Learn more",Object.assign(i.style,{color:"var(--color-accent, #0969da)",textDecoration:"none"});const u=document.createElement("button");u.type="button",u.textContent="×",u.setAttribute("aria-label","Dismiss browser capability notice"),u.title="Dismiss",Object.assign(u.style,{position:"absolute",top:"4px",right:"6px",padding:"0 4px",border:"0",background:"transparent",color:"var(--color-fg-subtle, #8b949e)",cursor:"pointer",fontSize:"16px",lineHeight:"1"}),u.addEventListener("click",()=>{ua(t),Jr()}),r.appendChild(o),r.appendChild(s),r.appendChild(i),r.appendChild(u),document.body.appendChild(r),gt=r,Ut=e}function eo(e){if(typeof document>"u"||typeof window>"u"||Qr.has(e))return;Qr.add(e);const t=qr(e,window.location.pathname);if(jr(t))return;const n=()=>{if(!jr(t)){if(Ut!==null)if(Kr[e]<Kr[Ut])Jr();else return;fa(e)}};document.body?n():window.addEventListener("DOMContentLoaded",n,{once:!0})}const da={data:new Float32Array(0),shape:[0,0],dtype:"<f4"};function pa(e){const{h:t,w:n,c:r}=Yr(e.shape);if(e.precision==="f16-bits"){const i=e.data,u=new Uint16Array(n*t*4);for(let a=0;a<n*t;a++){const l=a*r,d=a*4;if(r===1){const x=i[l];u[d]=x,u[d+1]=x,u[d+2]=x,u[d+3]=Rt}else u[d]=i[l],u[d+1]=i[l+1],u[d+2]=i[l+2],u[d+3]=r>=4?i[l+3]:Rt}return{data:u,width:n,height:t,format:"rgba16float"}}const o=e.data,s=new Float32Array(n*t*4);for(let i=0;i<n*t;i++){const u=i*r;let a,l,d,x=1;r===1?a=l=d=De(o[u]):r===3?(a=De(o[u]),l=De(o[u+1]),d=De(o[u+2])):(a=De(o[u]),l=De(o[u+1]),d=De(o[u+2]),x=De(o[u+3]));const p=i*4;s[p]=a,s[p+1]=l,s[p+2]=d,s[p+3]=x}return{data:s,width:n,height:t,format:"rgba32float"}}function to(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),s=n*o,i=r*o,u=(t.width-s)/2,a=(t.height-i)/2,l=Math.max(e.zoom,1e-6),d=t.width/(l*s),x=t.height/(l*i),p=-u/s-e.pan.x/(l*s),v=-a/i-e.pan.y/(l*i);return{x:p,y:v,w:d,h:x}}function no(e,t,n,r){const o=e.w*n,s=e.h*r;return o<=0||s<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/s)}function ha(e){var le,be,Le;const t=Hr(e),n=c.useRef(null),r=c.useRef(null),o=c.useRef(null),s=c.useRef(null),i=c.useRef(null),u=t&&!!((le=e.hdr)!=null&&le.deep),a=c.useCallback(($,N)=>{var K,I;(K=s.current)==null||K.setDeepWindow($,N),(I=i.current)==null||I.call(i)},[]),l=Wr(t?e.hdr:da,u?a:void 0),d=c.useRef(!1),[x,p]=c.useState(!1),[v,_]=c.useState(!1),[w,M]=c.useState(!1),[m,g]=c.useState(null),[h,b]=c.useState(0),[y,E]=c.useState(0),[R,P]=c.useState({x:0,y:0,w:1,h:1}),S=c.useRef(null),T=c.useRef(null),[A,L]=c.useState(0),C=e.zoom??1,B=e.pan??{x:0,y:0},k=e.onViewportChange,O=t?"none":e.colormap??"none",[Y,F,U]=Qe(O);c.useEffect(()=>{F(O)},[O,F]);const Q=t?"none":Y,oe=t?e.tonemap:void 0,[he,ie]=c.useState(null);c.useEffect(()=>{ie(null)},[oe]);const ge=bs(oe,x),G=he??ge,V=he!==null&&he!==ge,J=c.useCallback(()=>ie(null),[]),[te,fe,W]=Qe(Vn),[ne,Ee]=c.useState(0),[me,H]=c.useState(0),Ce=dn();c.useEffect(()=>{const $=n.current;if(!$)return;let N=!1;return Pt().then(K=>{var Te;if(N)return;const I=((Te=K.probeExtendedToneMapping)==null?void 0:Te.call(K))??!1,ee=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,j=I&&ee&&t;d.current=j,p(j),t&&!j&&eo(I?"no-hdr-display":"no-hdr-browser"),bi($,{hdr:j}).then(we=>{if(N){Pr(we);return}s.current=we,M(!0)}).catch(we=>{N||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",we),_(!0))})}).catch(K=>{N||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",K),_(!0))}),()=>{N=!0,s.current&&(Pr(s.current),s.current=null)}},[]),c.useEffect(()=>{const $=r.current;if(!$)return;const N=new ResizeObserver(()=>E(K=>K+1));return N.observe($),()=>N.disconnect()},[]),c.useEffect(()=>{const $=r.current;if(!$)return;const N=new IntersectionObserver(K=>{const I=K[0];if(!I)return;const ee=s.current;ee&&(ee.setVisible(I.isIntersecting),I.isIntersecting?ee.isParked&&(ee.restore(),E(j=>j+1)):ee.park())},{threshold:0});return N.observe($),()=>N.disconnect()},[]),c.useEffect(()=>{var K;if(!t||!w||u)return;const $=l.hdr;S.current=$;const N=pa($);(K=s.current)==null||K.setSource(N),g(I=>I&&I.w===N.width&&I.h===N.height?I:{w:N.width,h:N.height}),L(I=>I+1),b(I=>I+1)},[t,w,u,t?l.hdr:null]),c.useEffect(()=>{if(!t||!w||!u)return;const $=e.hdr,N=$.deep;S.current=$;let K=!1;return N.getGpuCsr().then(I=>{var ee;K||((ee=s.current)==null||ee.setDeepSource(I,N.zMin,N.zMax),g(j=>j&&j.w===I.width&&j.h===I.height?j:{w:I.width,h:I.height}),L(j=>j+1),b(j=>j+1))}).catch(I=>{K||console.warn("[cairn] deep GPU CSR upload failed:",I)}),()=>{K=!0}},[t,w,u,t?e.hdr.deep:null]),c.useEffect(()=>{if(t||!w)return;const $=e,N=$.imageUrl,K=Y;if(!N){T.current=null,g(null),L(ee=>ee+1);return}let I=!1;return lt(N).then(ee=>{var we,ke;if(I||!ee)return;let j=ee;if(K!=="none"){const ve=`gpu::${N}::${K}::ev${ne}::off${me}`,Ve=an(ve);if(Ve)j=Ve;else{const tt=sn(K);j=on(ee,K,tt,ne,me),cn(ve,j)}}T.current=ee;const Te={data:j.data,width:j.width,height:j.height,format:"rgba8unorm"};(we=s.current)==null||we.setSource(Te),g(ve=>ve&&ve.w===j.width&&ve.h===j.height?ve:{w:j.width,h:j.height}),(ke=$.onNaturalSize)==null||ke.call($,j.width,j.height),L(ve=>ve+1),b(ve=>ve+1)}),()=>{I=!0}},[t,w,t?null:e.imageUrl,t?null:Y,t?0:ne,t?0:me]);const de=t?e.exposure??0:0,_e=t?e.gamma:void 0,ce=c.useCallback(()=>{const $=s.current;if(!$||!w||!m)return;const N=r.current,K=o.current,I=K?K.getBoundingClientRect():N?N.getBoundingClientRect():{width:m.w,height:m.h},ee=to({zoom:C,pan:B},I,m.w,m.h);P(ve=>ve.x===ee.x&&ve.y===ee.y&&ve.w===ee.w&&ve.h===ee.h?ve:ee),I.width>0&&I.height>0&&$.resize(Math.round(I.width*Ce),Math.round(I.height*Ce));const j=no(ee,I,m.w,m.h)>=hn?"nearest":"linear",Te=ee,we=d.current&&Kn(G),ke=t?{exposureEV:de+ne,offset:me,operator:G,gamma:_e,isScalar:!1,hdrOut:we,peak:te,uv:Te,filter:j}:{exposureEV:Q!=="none"?0:ne,offset:Q!=="none"?0:me,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:Te,filter:j};try{$.render(ke)||_(!0)}catch(ve){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",ve),_(!0)}},[w,m,C,B.x,B.y,de,ne,me,G,te,_e,t,Q,Ce]);i.current=ce,c.useEffect(()=>{ce()},[ce,h,y]);const Re=c.useCallback(($,N,K)=>{if(t){const Ve=S.current,tt=m;if(!Ve||!tt||$<0||N<0||$>=tt.w||N>=tt.h)return null;const Ie=Ve.shape.length===2?1:Ve.shape[2]??1,xt=(N*tt.w+$)*Ie,ht=Ve.data,nt=Ve.precision==="f16-bits"?Ze=>kt(ht[Ze]??0):Ze=>ht[Ze]??0,Be=.5,Mt=Ie===1?[nt(xt)]:[nt(xt),nt(xt+1),nt(xt+2)];return ft(Mt,"unit",K,Be)}const I=T.current;if(!I||$<0||N<0||$>=I.width||N>=I.height)return null;const ee=(N*I.width+$)*4,j=I.data[ee],Te=I.data[ee+1],we=I.data[ee+2],ke=bt(j,Te,we);return ft(Q!=="none"||j===Te&&Te===we?[j]:[j,Te,we],"uint8",K,ke)},[t,m,Q]),$e=e.showAxes??!1,qe=t?e.label??"":e.label,Fe=e.interpolation??"auto",Ge=Fe==="auto"?void 0:Fe,et=t?void 0:e.overlay,z=t?void 0:e.overlaySettings,xe=t?!1:e.isDraggable??!1,Pe=t?void 0:e.onDragStart;if(v)return t?f.jsx(Mn,{...e}):f.jsx(Mn,{...e});const Se=et&&(z!=null&&z.enabled)&&m&&((((be=et.boxes)==null?void 0:be.length)??0)>0||(((Le=et.masks)==null?void 0:Le.length)??0)>0)?f.jsx(pn,{data:et,settings:z,naturalWidth:m.w,naturalHeight:m.h}):void 0;return f.jsx(Ft,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":w},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:r,wrapperRef:o,zoom:C,pan:B,onViewportChange:k,naturalDims:m,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:$e&&m?"16px 4px 4px 28px":0,surface:f.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:Ge},"data-gpu-image-canvas":!0}),showAxes:$e,overlayNode:Se,overlay:{displayElRef:n,sample:Re,version:A,hasSource:!0,sourceWindow:R},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:ce,leadingMenus:t?[zr(G,$=>ie($),x)]:[En(Q,$=>F($))],displayAdjust:{exposureEV:ne,offset:me,onExposureChange:Ee,onOffsetChange:H},extraSliders:t&&gs(G)?[{id:"peak",label:"PK",title:"Peak white (×SDR white) — HDR shoulder for the extended Reinhard/ACES operators, or the managed-linear hard ceiling for Extended · Linear (managed). Double-click to type a value.",min:ds,max:ps,step:hs,value:te,onChange:fe,format:$=>`${$.toFixed(1)}×`}]:void 0,depthSliders:l.sliders,regionSelect:u?{rect:l.region,queryLive:l.queryRegionWindow,commit:l.commitRegion,remove:l.removeRegion}:void 0,onReset:()=>{U.reset(),J(),W.reset(),l.reset()},extraModified:U.isModified||V||W.isModified||l.isModified,label:qe,showLabelChip:!!qe,isDraggable:xe,onDragStart:Pe})}const Gt=new Map;function Ye(e){if(Gt.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);Gt.set(e.id,e)}function it(e){return Gt.get(e)}function ma(){return Array.from(Gt.values())}function ro(e,t){return{...e.params??{},...t??{}}}const ga={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},xa={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},ba={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},va={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},wa={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},ya={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},oo=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];_a(oo);const Sn=[1.052156925,1,.91835767],Ea=.7;function _a(e){const[t,n,r]=e[0],[o,s,i]=e[1],[u,a,l]=e[2],d=s*l-i*a,x=-(o*l-i*u),p=o*a-s*u,_=1/(t*d+n*x+r*p);return[[d*_,-(n*l-r*a)*_,(n*i-r*s)*_],[x*_,(t*l-r*u)*_,-(t*i-r*o)*_],[p*_,-(t*a-n*u)*_,(t*s-n*o)*_]]}function Ma(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const Pn=6/29;function Tn(e){return e>Pn**3?Math.cbrt(e):e/(3*Pn*Pn)+4/29}function so(e,t,n){const[r,o,s]=Ma(oo,e,t,n),i=Tn(r*Sn[0]),u=Tn(o*Sn[1]),a=Tn(s*Sn[2]),l=116*u-16,d=500*(i-u),x=200*(u-a);return[l,.01*l*d,.01*l*x]}function Sa(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function Pa(){const e=so(0,1,0),t=so(0,0,1);return Math.pow(Sa(e,t),Ea)}const io=Pa(),Ta=.082;function ao(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],s=Math.max(...n,...o),i=Math.ceil(3*Math.sqrt(s/(2*Math.PI**2))*e),u=1/e,a=Math.PI**2,l=[0,0,0];for(let d=-i;d<=i;d++)for(let x=-i;x<=i;x++){const p=(x*u)**2+(d*u)**2;for(let v=0;v<3;v++)l[v]+=t[v]*Math.sqrt(Math.PI/n[v])*Math.exp(-a*p/n[v])+r[v]*Math.sqrt(Math.PI/o[v])*Math.exp(-a*p/o[v])}return{r:i,deltaX:u,sums:l}}function co(e){const t=.5*Ta*e,n=Math.ceil(3*t);let r=0,o=0,s=0;for(let i=-n;i<=n;i++)for(let u=-n;u<=n;u++){const a=Math.exp(-(u*u+i*i)/(2*t*t)),l=-u*a,d=(u*u/(t*t)-1)*a;l>0&&(r+=l),d>0?o+=d:s-=d}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:s}}const Aa=`
${Ue}
${Ot}
${pt}
${wt}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_map0: vec4<f32>; // offX, offY, fitFill, 0
@group(0) @binding(8) var<uniform> u_map1: vec4<f32>; // resultW, resultH, 0, 0
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = mapSample(src, px, u_map0.x, u_map0.y, u_map1.x, u_map1.y, u_map0.z);
  return vec4<f32>(flip_rgb2ycxcz(s.rgb), 1.0);
}
`,Ca=`
${Ue}
${Ot}
${pt}
${wt}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_map0: vec4<f32>; // offX, offY, fitFill, 0
@group(0) @binding(8) var<uniform> u_map1: vec4<f32>; // resultW, resultH, 0, 0
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = mapSample(src, px, u_map0.x, u_map0.y, u_map1.x, u_map1.y, u_map0.z);
  return vec4<f32>(flip_linrgb2ycxcz(clamp(s.rgb, vec3<f32>(0.0), vec3<f32>(1.0))), 1.0);
}
`,zt=`
${Ue}
${Ot}
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
`,lo=`
${Ue}
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
`;function Ke(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function $t(e,t,n){const r=n.sourceMap,o=r?t==="a"?r.offsetA:r.offsetB:{x:0,y:0},s=r!=null&&r.fill?1:0;return[Ke(e,[o.x,o.y,s,0]),Ke(e+1,[n.width,n.height,0,0])]}function Vt(e){return[Ke(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),Ke(2,[e.sums[2],0,0,0])]}function uo(e){return[Ke(4,[io,e.sd,e.r,e.edgeNorm]),Ke(5,[e.pointPos,e.pointNeg,0,0])]}function fo(e,t,n,r,o,s=""){const i=ao(e),u=co(e),a=`ycxczA${s}`,l=`ycxczB${s}`,d=`labA${s}`,x=`labB${s}`,p=`flip${s}`;return{passes:[{name:a,shader:t,inputs:[n],output:a,uniforms:()=>$t(1,"a",o)},{name:l,shader:t,inputs:[r],output:l,uniforms:()=>$t(1,"b",o)},{name:d,shader:zt,inputs:[a],output:d,uniforms:()=>Vt(i)},{name:x,shader:zt,inputs:[l],output:x,uniforms:()=>Vt(i)},{name:p,shader:lo,inputs:[d,x,a,l],output:p,uniforms:()=>uo(u)}],flipRef:p}}const Ra={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=fo(t,Aa,"srcA","srcB",e);return{passes:n,final:r}}},ka={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=fo(t,Ca,"srcA","srcB",e);return{passes:n,final:r}}},po=`
${Ue}
${Ot}
${pt}
${wt}
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
`,Da=`
${Ue}
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
`,La={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",output:"scalar",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),s=(r-n)/Math.max(o-1,1),i=ao(t),u=co(t),a=[];let l=null;for(let d=0;d<o;d++){const x=n+d*s,p=`_e${d}`,v=`ycxczA${p}`,_=`ycxczB${p}`,w=`labA${p}`,M=`labB${p}`,m=`acc${p}`;a.push({name:v,shader:po,inputs:["srcA"],output:v,uniforms:()=>[Ke(1,[x,0,0,0]),...$t(2,"a",e)]},{name:_,shader:po,inputs:["srcB"],output:_,uniforms:()=>[Ke(1,[x,0,0,0]),...$t(2,"b",e)]},{name:w,shader:zt,inputs:[v],output:w,uniforms:()=>Vt(i)},{name:M,shader:zt,inputs:[_],output:M,uniforms:()=>Vt(i)}),l===null?a.push({name:m,shader:lo,inputs:[w,M,v,_],output:m,uniforms:()=>uo(u)}):a.push({name:m,shader:Da,inputs:[w,M,v,_,l],output:m,uniforms:()=>[Ke(5,[io,u.sd,u.r,u.edgeNorm]),Ke(6,[u.pointPos,u.pointNeg,0,0])]}),l=m}return{passes:a,final:l}}},ho=.01,mo=.03,Xt=1,An=1.5,at=5,Cn=[.2126,.7152,.0722];function Rn(e){return e<=.04045?e/12.92:Math.pow((e+.055)/1.055,2.4)}function go(e,t,n){const r=Cn[0]*Rn(e)+Cn[1]*Rn(t)+Cn[2]*Rn(n);return Math.min(1,Math.max(0,r))}function Ba(e,t){const n=2*t+1,r=new Float64Array(n);let o=0;for(let s=-t,i=0;s<=t;s++,i++){const u=Math.exp(-.5*s*s/(e*e));r[i]=u,o+=u}for(let s=0;s<n;s++)r[s]=r[s]/o;return r}function xo(e,t){if(t===1)return 0;const n=2*t;let r=(e%n+n)%n;return r>=t&&(r=n-1-r),r}const bo=()=>new Promise(e=>{typeof setTimeout=="function"?setTimeout(e,0):Promise.resolve().then(e)}),kn=64;async function Et(e,t,n,r,o,s){const i=new Float64Array(t*n);for(let a=0;a<n;a++){for(let l=0;l<t;l++){let d=0;for(let x=-o,p=0;x<=o;x++,p++)d+=r[p]*e[a*t+xo(l+x,t)];i[a*t+l]=d}(a+1)%kn===0&&await s()}const u=new Float64Array(t*n);for(let a=0;a<n;a++){for(let l=0;l<t;l++){let d=0;for(let x=-o,p=0;x<=o;x++,p++)d+=r[p]*i[xo(a+x,n)*t+l];u[a*t+l]=d}(a+1)%kn===0&&await s()}return u}async function Oa(e,t,n,r,o=bo){const s=n*r;if(s<=0)return NaN;const i=Ba(An,at),u=new Float64Array(s),a=new Float64Array(s),l=new Float64Array(s);for(let g=0;g<s;g++)u[g]=e[g]*e[g],a[g]=t[g]*t[g],l[g]=e[g]*t[g];const d=await Et(e,n,r,i,at,o),x=await Et(t,n,r,i,at,o),p=await Et(u,n,r,i,at,o),v=await Et(a,n,r,i,at,o),_=await Et(l,n,r,i,at,o),w=(ho*Xt)**2,M=(mo*Xt)**2;let m=0;for(let g=0;g<s;g++){const h=p[g]-d[g]*d[g],b=v[g]-x[g]*x[g],y=_[g]-d[g]*x[g],E=2*d[g]*x[g]+w,R=2*y+M,P=d[g]*d[g]+x[g]*x[g]+w,S=h+b+M;m+=E*R/(P*S)}return m/s}const vo=`
${Ue}

fn ssim_srgb2linear(c: f32) -> f32 {
  if (c <= 0.04045) { return c / 12.92; }
  return pow((c + 0.055) / 1.055, 2.4);
}
fn ssim_luma(srgb: vec3<f32>) -> f32 {
  let lin = vec3<f32>(ssim_srgb2linear(srgb.r), ssim_srgb2linear(srgb.g), ssim_srgb2linear(srgb.b));
  return clamp(dot(lin, vec3<f32>(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
}

${pt}
${wt}
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
`,Ia=`
${vo}
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let y = ssim_moment_luma(in);
  return vec4<f32>(y.x, y.y, y.x * y.x, y.y * y.y);
}
`,Na=`
${vo}
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let y = ssim_moment_luma(in);
  return vec4<f32>(y.x * y.y, 0.0, 0.0, 0.0);
}
`,wo=`
${Ue}
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
`,Fa=`
${Ue}
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
`;function _t(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function yo(e){const t=e.sourceMap,n=t?t.offsetA:{x:0,y:0},r=t?t.offsetB:{x:0,y:0},o=t!=null&&t.fill?1:0;return[_t(2,[n.x,n.y,r.x,r.y]),_t(3,[e.width,e.height,o,0])]}function Eo(e,t){const n=`${t}H`,r=`${t}V`;return{passes:[{name:n,shader:wo,inputs:[e],output:n,uniforms:()=>[_t(1,[1,0,at,An])]},{name:r,shader:wo,inputs:[n],output:r,uniforms:()=>[_t(1,[0,1,at,An])]}],out:r}}const Ua={kind:"multipass",id:"ssim",label:"SSIM (1−SSIM)",publicName:"ssim",displayRange:"unit",output:"scalar",buildPasses(e){const t=(ho*Xt)**2,n=(mo*Xt)**2,r=Eo("momA","statsA"),o=Eo("momB","statsB");return{passes:[{name:"momA",shader:Ia,inputs:["srcA","srcB"],output:"momA",uniforms:yo},{name:"momB",shader:Na,inputs:["srcA","srcB"],output:"momB",uniforms:yo},...r.passes,...o.passes,{name:"ssim",shader:Fa,inputs:[r.out,o.out],output:"ssim",uniforms:()=>[_t(2,[t,n,0,0])]}],final:"ssim"}}};let _o=!1;function Ga(){_o||(_o=!0,Ye(xa),Ye(ga),Ye(ba),Ye(wa),Ye(va),Ye(ya),Ye(Ra),Ye(La),Ye(ka),Ye(Ua))}Ga();function Mo(){const e=[];for(const n of ma())n.kind==="pointwise"&&e.push({id:n.id,label:n.label});e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"});const t=it("ssim");return t&&e.push({id:t.id,label:t.label}),e}function za(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}function $a(e,t,n){const r=t*n;if(r<=0)return NaN;let o=0;for(let s=0;s<r;s++)o+=e[s*4]??0;return 1-o/r}function So(e){return e==null||Number.isNaN(e)?"—":e.toFixed(4)}const Po=new WeakMap;function Va(e,t,n){let r=Po.get(e);r||(r=new Map,Po.set(e,r));const o=r.get(t);if(o)return o;const s=n().catch(i=>{throw r.get(t)===s&&r.delete(t),i});return r.set(t,s),s}const To=new WeakMap;function Dn(e,t,n,r){let o=To.get(e);o||(o=new Map,To.set(e,o));const s=`${t}::${r}`;let i=o.get(s);return i||(i=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(s,i)),i}function Xa(e){return`
${Ue}
${pt}
${wt}
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
`}const Wt="rgba16float";function Wa(e,t,n,r,o,s){var M,m;const i=it(r);if(!i)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const u=s??yt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),a=u.result.w,l=u.result.h,d=u.fit==="fill"?1:0,x=ro(i,o);if(i.kind==="pointwise"){const g=e.createTexture(a,l,Wt),h=Dn(e,`pw:${i.id}`,Xa(i.source),Wt),b=new Float32Array([u.offsetA.x,u.offsetA.y,u.offsetB.x,u.offsetB.y]),y=new Float32Array([a,l,d,0]);let E;try{E=e.createBindGroup(h,[{binding:0,resource:t},{binding:1,resource:n},{binding:2,resource:{uniform:b}},{binding:3,resource:{uniform:y}}]),e.renderFullscreen(g,h,E)}finally{(M=E==null?void 0:E.destroy)==null||M.call(E)}return g}const p={width:a,height:l,params:x,sourceMap:{fill:u.fit==="fill",offsetA:u.offsetA,offsetB:u.offsetB}},v=i.buildPasses(p),_=new Map([["srcA",t],["srcB",n]]),w=[];try{for(const h of v.passes){const b=e.createTexture(a,l,Wt);w.push(b),_.set(h.output,b);const y=Dn(e,`mp:${i.id}:${h.name}`,h.shader,Wt),E=h.inputs.map((P,S)=>{const T=_.get(P);if(!T)throw new Error(`computeDiff: pass "${h.name}" input "${P}" not produced yet`);return{binding:S,resource:T}});h.uniforms&&E.push(...h.uniforms(p));let R;try{R=e.createBindGroup(y,E),e.renderFullscreen(b,y,R)}finally{(m=R==null?void 0:R.destroy)==null||m.call(R)}}const g=_.get(v.final);if(!g)throw new Error(`computeDiff: final ref "${v.final}" not produced`);for(const h of w)h!==g&&h.destroy();return g}catch(g){for(const h of w)h.destroy();throw g}}const Ha=8,Ya=256*1024*1024;class Ka{constructor(t=Ha,n=Ya){se(this,"map",new Map);se(this,"totalBytes",0);se(this,"maxEntries");se(this,"maxBytes");this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}accountReadbackBytes(t,n){let r=!1;for(const o of this.map.values())if(o===t){r=!0;break}r&&(t.bytes+=n,this.totalBytes+=n,this.evict())}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const Ao=new WeakMap;function Co(e){let t=Ao.get(e);return t||(t=new Ka,Ao.set(e,t)),t}function qa(e,t){const n=ro(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function Za(e,t,n,r,o){const s=it(n),i=s?qa(s,r):"",u=o?gn(o):"";return`${e}|${t}|${n}|${i}|${u}`}function Ro(e,t,n,r,o,s,i,u){const a=it(r);if(!a)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const l=Co(e),d=u??yt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),x=Za(s,i,r,o,d),p=l.get(x);if(p)return p;const v=Wa(e,t,n,r,o,d),_=d.result.w,w=d.result.h,M={texture:v,width:_,height:w,displayRange:a.displayRange,bytes:_*w*8};return l.set(x,M),M}function ja(e,t,n){return`${e}|${t}|${n?gn(n):""}`}function Qa(e,t,n,r,o,s){return Va(e,ja(r,o,s),()=>Ja(e,t,n,r,o,s))}async function Ja(e,t,n,r,o,s){try{const i=Ro(e,t,n,"ssim",void 0,r,o,s);return i.ssimMean!==void 0?i.ssimMean:(i.ssimMeanPending||(i.ssimMeanPending=ko(e,i).then(u=>{const a=$a(u,i.width,i.height);return i.ssimMean=a,a})),await i.ssimMeanPending)}catch{return ec(e,t,n,s)}}async function ec(e,t,n,r){const o=r??yt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),s=o.result.w,i=o.result.h,u=s*i;if(u<=0)return NaN;const a=await e.readback(t),l=await e.readback(n),d=a instanceof Uint8Array?255:1,x=l instanceof Uint8Array?255:1,p=o.fit==="fill",v=It(a,t.width,t.height,d,o.offsetA,p,s,i),_=It(l,n.width,n.height,x,o.offsetB,p,s,i),w=new Float64Array(u),M=new Float64Array(u),m=[0,0,0],g=[0,0,0];for(let h=0;h<i;h++){for(let b=0;b<s;b++){v(b,h,m),_(b,h,g);const y=h*s+b;w[y]=go(m[0],m[1],m[2]),M[y]=go(g[0],g[1],g[2])}(h+1)%kn===0&&await bo()}return Oa(w,M,s,i)}async function tc(e,t,n,r,o){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=yr(e,n,r,o).then(s=>(t.scalars=s,s))),t.scalarsPending)}async function ko(e,t){return t.resultSamples?t.resultSamples:(t.resultSamplesPending||(t.resultSamplesPending=e.readback(t.texture).then(n=>{const r=n instanceof Float32Array?n:Float32Array.from(n);return t.resultSamples=r,Co(e).accountReadbackBytes(t,r.byteLength),r})),t.resultSamplesPending)}const nc=`
${Ue}
${pt}
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
`,rc={unit:0,signed:1,relative:2},oc={linear:0,signed:1,positive:2};function sc(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function ic(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function ac(e,t,n,r,o){var v,_,w;const s=ic(t),i=Dn(e,"diff-display",nc,s),u=sc(e,o.colormap),a=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),l=new Float32Array([rc[r],oc[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]),d=new Float32Array([o.exposureEV??0,o.offset??0,0,0]),x=new Float32Array([((v=o.sourceDims)==null?void 0:v.w)??0,((_=o.sourceDims)==null?void 0:_.h)??0,0,0]);let p;try{p=e.createBindGroup(i,[{binding:0,resource:n},{binding:1,resource:u},{binding:2,resource:{uniform:a}},{binding:3,resource:{uniform:l}},{binding:4,resource:{uniform:d}},{binding:5,resource:{uniform:x}}]),e.renderFullscreen(t,i,p)}finally{(w=p==null?void 0:p.destroy)==null||w.call(p),u.destroy()}}const Do=.6*.6*2.51,cc=.6*.03,lc=0,Lo=.6*.6*2.43,uc=.6*.59,fc=.14;function Bo(e){const t=(cc-uc*e)/(Do-Lo*e),n=(lc-fc*e)/(Do-Lo*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const dc=.85,pc=.85,Oo=11920928955078125e-23,Ln=[.2126,.7152,.0722];function hc(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function mc(e,t,n,r=3,o={}){const s=t*n,i=Bo(dc),u=Bo(pc),a=new Float64Array(s);let l=0;for(let g=0;g<s;g++){const[h,b,y]=hc(e,g,r),E=h*Ln[0]+b*Ln[1]+y*Ln[2];a[g]=E,E>l&&(l=E)}const d=Float64Array.from(a).sort(),x=s>>1,p=s%2===1?d[x]:d[x-1],v=Math.max(p,Oo),_=Math.max(l,Oo),w=o.startExposure??Math.log2(i/_),M=o.stopExposure??Math.log2(u/v),m=Math.max(2,Math.ceil(M-w));return{startExposure:w,stopExposure:M,numExposures:m}}const gc="absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm pointer-events-none select-none",xc="REF";function Io(){return f.jsx("span",{className:gc,children:xc})}function No({splitPosition:e,onChange:t,onReset:n}){return f.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${e*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:r=>{r.stopPropagation(),n==null||n()},onPointerDown:r=>{r.stopPropagation(),r.preventDefault();const o=r.currentTarget;try{o.setPointerCapture(r.pointerId)}catch{}const i=o.parentElement.getBoundingClientRect(),u=l=>{t==null||t(Math.max(0,Math.min(1,(l.clientX-i.left)/i.width)))},a=()=>{window.removeEventListener("pointermove",u),window.removeEventListener("pointerup",a)};window.addEventListener("pointermove",u),window.addEventListener("pointerup",a)},children:f.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})}const bc={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function vc({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:s,zoom:i,pan:u,onViewportChange:a,processing:l=bc,interpolation:d="auto",label:x="",isDraggable:p=!1,onDragStart:v,overlay:_,overlaySettings:w,pixelValueNotation:M="decimal"}){var te,fe;const m=c.useRef(null),[g,h]=c.useState(null),[b,y]=c.useState(null),[E,R]=c.useState(M),[P,S]=c.useState(!1),T=c.useRef(null),A=c.useRef(null),L=c.useRef(null),C=c.useRef(null),[B,k]=c.useState(0);c.useEffect(()=>{if(!e){L.current=null,k(ne=>ne+1);return}let W=!1;return lt(e).then(ne=>{W||(L.current=ne,k(Ee=>Ee+1))}),()=>{W=!0}},[e]),c.useEffect(()=>{if(!t){C.current=null,k(ne=>ne+1);return}let W=!1;return lt(t).then(ne=>{W||(C.current=ne,k(Ee=>Ee+1))}),()=>{W=!0}},[t]);const O=W=>(ne,Ee,me)=>{const H=W.current;if(!H||ne<0||Ee<0||ne>=H.width||Ee>=H.height)return null;const Ce=(Ee*H.width+ne)*4,de=H.data[Ce],_e=H.data[Ce+1],ce=H.data[Ce+2],Re=bt(de,_e,ce);return de===_e&&_e===ce?{lines:[mt(de,"uint8",me)],luminance:Re}:{lines:[mt(de,"uint8",me),mt(_e,"uint8",me),mt(ce,"uint8",me)],luminance:Re,colors:[Bt[0],Bt[1],Bt[2]]}},Y=c.useMemo(()=>O(L),[]),F=c.useMemo(()=>O(C),[]),U=!!_&&!!(w!=null&&w.enabled)&&!!g&&!!e&&((((te=_.boxes)==null?void 0:te.length)??0)>0||(((fe=_.masks)==null?void 0:fe.length)??0)>0),{gammaFilterId:Q,filterStr:oe,gamma:he,offset:ie}=Ar(l),ge=`translate(${u.x}px, ${u.y}px) scale(${i})`,G=d==="auto"?void 0:d,{containerProps:V,modifierActive:J}=cr({containerRef:m,zoom:i,pan:u,onViewportChange:a});return f.jsxs("div",{className:"relative flex flex-col h-full",children:[f.jsx(Cr,{id:Q,gamma:he,offset:ie}),f.jsxs("div",{ref:m,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...V.style},onPointerDown:V.onPointerDown,onPointerMove:V.onPointerMove,onPointerUp:V.onPointerUp,onPointerCancel:V.onPointerCancel,children:[f.jsxs("div",{className:"relative w-full h-full",children:[f.jsxs("div",{className:"relative w-full h-full",style:{transform:ge,transformOrigin:"0 0"},children:[f.jsx("img",{ref:T,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:oe,imageRendering:G,...n==="blend"?{opacity:o}:{}},onLoad:W=>{const ne=W.currentTarget;h({w:ne.naturalWidth,h:ne.naturalHeight})}}),U&&f.jsx(pn,{data:_,settings:w,naturalWidth:g.w,naturalHeight:g.h})]}),f.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:f.jsx("div",{className:"w-full h-full",style:{transform:ge,transformOrigin:"0 0"},children:f.jsx("img",{ref:A,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:oe,imageRendering:G,...n==="blend"?{opacity:1-o}:{}},onLoad:W=>{const ne=W.currentTarget;y({w:ne.naturalWidth,h:ne.naturalHeight})}})})}),n==="split"&&f.jsx(No,{splitPosition:r,onChange:s,onReset:()=>s==null?void 0:s(.5)})]}),n==="split"?f.jsxs(f.Fragment,{children:[t&&b&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:f.jsx(dt,{imageElRef:A,naturalWidth:b.w,naturalHeight:b.h,zoom:i,pan:u,sample:F,notation:E,version:B})}),e&&g&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:f.jsx(dt,{imageElRef:T,naturalWidth:g.w,naturalHeight:g.h,zoom:i,pan:u,sample:Y,notation:E,version:B,onActiveChange:S})})]}):e&&g&&f.jsx(dt,{imageElRef:T,naturalWidth:g.w,naturalHeight:g.h,zoom:i,pan:u,sample:Y,notation:E,version:B,onActiveChange:S}),P&&f.jsx(pr,{notation:E,onChange:R})]}),n==="split"&&f.jsx(Io,{}),f.jsx(bn,{label:x,corner:"bottom-right",isDraggable:p&&!J,grip:!0,onDragStart:v})]})}function wc(){return f.jsx(Tr,{title:"GPU compare unavailable",body:"Float image sources need the GPU compare (WebGPU), which isn't available in this browser."})}function yc({mode:e,kernel:t,kernelOptions:n,onSlide:r,onBlend:o,onKernel:s,onSide:i}){return{id:"compare-mode",title:"Compare / diff mode",menu:{options:[...i?[{id:"side",label:"Side"}]:[],{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...n],value:e==="side"?"side":e==="split"?"slide":e==="blend"?"blend":t,onSelect:l=>{l==="side"?i==null||i():l==="slide"?r():l==="blend"?o():s(l)}}}}function Ec(e){const t=Jt(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function _c(e){const{width:t,height:n,channels:r}=e,o=t*n;if(e.precision==="f16-bits"){const a=e.data,l=new Uint16Array(o*4);for(let d=0;d<o;d++){const x=d*r,p=d*4;if(r===1){const v=a[x];l[p]=v,l[p+1]=v,l[p+2]=v,l[p+3]=Rt}else l[p]=a[x],l[p+1]=a[x+1],l[p+2]=a[x+2],l[p+3]=r>=4?a[x+3]:Rt}return{data:l,format:"rgba16float"}}const s=e.data,i=new Float32Array(o*4),u=a=>Number.isFinite(a)?a:0;for(let a=0;a<o;a++){const l=a*r;let d,x,p,v=1;r===1?d=x=p=u(s[l]):r===3?(d=u(s[l]),x=u(s[l+1]),p=u(s[l+2])):(d=u(s[l]),x=u(s[l+1]),p=u(s[l+2]),v=u(s[l+3]));const _=a*4;i[_]=d,i[_+1]=x,i[_+2]=p,i[_+3]=v}return{data:i,format:"rgba32float"}}function Mc({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:s,blendAlpha:i,onSplitPositionChange:u,diffSubmode:a,colormap:l="none",align:d="top-left",fit:x="crop",diffKernel:p,onDiffKernelChange:v,onCompareModeChange:_,onRequestSide:w,zoom:M,pan:m,onViewportChange:g,interpolation:h="auto",label:b="",pixelValueNotation:y="decimal"}){var Go;const E=c.useRef(null),R=c.useRef(null),P=c.useRef(null),S=c.useRef(null),T=c.useRef(null),[A,L]=c.useState(!1),[C,B]=c.useState(!1),[k,O]=c.useState(null),[Y,F]=c.useState(null),[U,Q]=c.useState(0),[oe,he]=c.useState(0),[ie,ge]=c.useState(null),[G,V]=c.useState(null),[J,te]=c.useState({x:0,y:0,w:1,h:1}),fe=p??a??"absolute",[W,ne,Ee]=Qe(fe);c.useEffect(()=>{ne(p??a??"absolute")},[p,a,ne]);const me=c.useCallback(D=>{ne(D),v==null||v(D)},[v,ne]);c.useEffect(()=>{const D=E.current;if(D)return D.__cairnDiffKernel={current:W,set:me},()=>{D&&delete D.__cairnDiffKernel}},[W,me]);const[H,Ce,de]=Qe(o);c.useEffect(()=>{Ce(o)},[o,Ce]);const _e=c.useCallback(D=>{Ce(D),_==null||_(D)},[_,Ce]),[ce,Re,$e]=Qe(l);c.useEffect(()=>{Re(l)},[l,Re]);const qe=c.useCallback(()=>{_e(de.default),Re($e.default),me(Ee.default)},[_e,Re,me,de.default,$e.default,Ee.default]),Fe=de.isModified||$e.isModified||Ee.isModified,[Ge,et]=c.useState(0),[z,xe]=c.useState(0),Pe=c.useMemo(()=>{const q=[yc({mode:H,kernel:W,kernelOptions:Mo().map(Z=>({id:Z.id,label:Z.label})),onSide:w,onSlide:()=>_e("split"),onBlend:()=>_e("blend"),onKernel:Z=>{_e("diff"),me(Z)}})];return H==="diff"&&q.push(En(ce,Z=>Re(Z))),q},[H,W,ce,me,_e,w]),Se=c.useRef(null),le=c.useRef(null),be=c.useRef(null),Le=c.useRef(null),[$,N]=c.useState(0),K=c.useRef(null),I=c.useRef(null),[ee,j]=c.useState(0),Te=dn();c.useEffect(()=>{const D=P.current;if(!D)return;let q=!1;return Pt().then(Z=>{if(!q)try{if(Er())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const X=Z.createSurface(D,{hdr:!1});S.current={device:Z,surface:X,texA:null,texB:null},B(!0)}catch(X){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",X),L(!0)}}).catch(Z=>{q||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",Z),L(!0))}),()=>{var X,ae;q=!0;const Z=S.current;Z&&((X=Z.texA)==null||X.destroy(),(ae=Z.texB)==null||ae.destroy(),S.current=null)}},[]),c.useEffect(()=>{const D=E.current;if(!D)return;const q=new ResizeObserver(()=>he(Z=>Z+1));return q.observe(D),()=>q.disconnect()},[]),c.useEffect(()=>{if(!C)return;let D=!1;if(!S.current)return;async function Z(X,ae){if(ae){const Me=_c(ae);return{width:ae.width,height:ae.height,imageData:null,make:Ae=>{const pe=Ae.createTexture(ae.width,ae.height,Me.format);return pe.write(Me.data),pe}}}if(!X)return null;const ue=await lt(X);return ue?{width:ue.width,height:ue.height,imageData:ue,make:Me=>{const Ae=Me.createTexture(ue.width,ue.height,"rgba8unorm");return Ae.write(ue.data),Ae}}:null}return Promise.all([Z(e,n),Z(t,r)]).then(([X,ae])=>{var Ne,ze;if(D||!S.current)return;const ue=S.current;Se.current=(X==null?void 0:X.imageData)??null,le.current=(ae==null?void 0:ae.imageData)??null,be.current=n??null,Le.current=r??null,(Ne=ue.texA)==null||Ne.destroy(),(ze=ue.texB)==null||ze.destroy(),ue.texA=null,ue.texB=null;const Me=X??ae;if(!Me){O(null),F(null),N(je=>je+1);return}const Ae=ae??Me,pe=X??Me;ue.texA=Ae.make(ue.device),ue.texB=pe.make(ue.device),F({a:{w:Ae.width,h:Ae.height},b:{w:pe.width,h:pe.height}}),O({w:Me.width,h:Me.height}),N(je=>je+1),Q(je=>je+1)}),()=>{D=!0}},[C,e,t,n,r]);const we=n!=null||r!=null,ke=c.useMemo(()=>za(W,we),[W,we]),ve=c.useMemo(()=>{if(!we)return null;const D=r??n;if(!D)return null;const q=D.precision==="f16-bits"?tr(D.data):D.data;return mc(q,D.width,D.height,D.channels)},[we,r,n]),Ve=c.useMemo(()=>{var D;return ws(((D=it(ke))==null?void 0:D.displayRange)??"unit",ce==="none"?null:ce)},[ke,ce]),tt=c.useMemo(()=>ce!=="none"?Ec(ce):void 0,[ce]),Ie=c.useMemo(()=>Y?yt(Y.a,Y.b,d,x,"b"):null,[Y,d,x]),xt=c.useMemo(()=>Ie?gn(Ie):"none",[Ie]),ht=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",nt=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",Be=c.useMemo(()=>k?H==="diff"&&Ie?Ie.result:k:null,[H,Ie,k]),Mt=c.useCallback(()=>{const D=S.current;if(!C||!D||!D.surface||!D.texA||!D.texB||!k)return;const q=Be??k,Z=E.current,X=Z?Z.getBoundingClientRect():{width:q.w,height:q.h},ae=to({zoom:M,pan:m},X,q.w,q.h);te(pe=>pe.x===ae.x&&pe.y===ae.y&&pe.w===ae.w&&pe.h===ae.h?pe:ae);const ue=P.current;if(X.width>0&&X.height>0&&ue&&D.surface){const pe=Math.max(1,Math.round(X.width*Te)),Ne=Math.max(1,Math.round(X.height*Te));(ue.width!==pe||ue.height!==Ne)&&(ue.width=pe,ue.height=Ne,D.surface.configure(pe,Ne))}const Me=no(ae,X,q.w,q.h)>=hn?"nearest":"linear",Ae=ae;try{if(H==="diff"){const pe=it(ke)?ke:"absolute",Ne=pe==="hdr-flip"&&ve?{ppd:67,startExposure:ve.startExposure,stopExposure:ve.stopExposure,numExposures:ve.numExposures}:void 0,ze=Ro(D.device,D.texA,D.texB,pe,Ne,ht,nt,Ie??void 0);T.current=ze,ac(D.device,D.surface,ze.texture,ze.displayRange,{uv:Ae,cmapMode:Ve,colormap:tt,filter:Me,exposureEV:Ge,offset:z})}else{const pe={exposureEV:Ge,offset:z,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:Ae,filter:Me,mode:H,split:s,alpha:i};pi(D.device,D.surface,D.texA,D.texB,pe)}}catch(pe){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",pe),L(!0)}},[C,k,Be,Ie,M,m.x,m.y,H,s,i,Ge,z,W,ke,ve,Ve,tt,e,t,n,r,ht,nt,Te]);c.useEffect(()=>{Mt()},[Mt,U,oe]);const Ze=t!=null||r!=null;c.useEffect(()=>{const D=S.current;if(!C||!D||!D.texA||!D.texB||!Ze){ge(null);return}let q=!1;const Z=D.texA,X=D.texB,ae=T.current,ue=H==="diff"?Ie??void 0:void 0;return(H==="diff"&&ae?tc(D.device,ae,Z,X,ue):yr(D.device,Z,X,ue)).then(Ae=>{q||ge(Ae)}),()=>{q=!0}},[C,U,Ze,H,W,Ie]),c.useEffect(()=>{const D=S.current;if(!C||!D||!D.texA||!D.texB||!Ze){V(null);return}let q=!1;V(null);const Z=H==="diff"?Ie??void 0:void 0;return Qa(D.device,D.texA,D.texB,ht,nt,Z).then(X=>{q||V(X)}).catch(()=>{q||V(null)}),()=>{q=!0}},[C,U,Ze,H,xt,ht,nt]),c.useEffect(()=>{if(H!=="diff"){K.current=null,I.current=null;return}const D=S.current,q=T.current;if(!C||!D||!q)return;let Z=!1;return K.current=null,I.current=null,j(X=>X+1),ko(D.device,q).then(X=>{Z||(K.current=X,I.current={w:q.width,h:q.height},j(ae=>ae+1))}).catch(()=>{}),()=>{Z=!0}},[C,H,ke,U,Ie]);const Fo=(D,q)=>(Z,X,ae)=>{const ue=q.current;if(ue){const{data:zo,width:$o,height:Rc,channels:Vo}=ue;if(Z<0||X<0||Z>=$o||X>=Rc)return null;const Yt=(X*$o+Z)*Vo,Kt=ue.precision==="f16-bits"?In=>kt(zo[In]??0):In=>zo[In]??0,kc=.5,Dc=Vo===1?[Kt(Yt)]:[Kt(Yt),Kt(Yt+1),Kt(Yt+2)];return ft(Dc,"unit",ae,kc)}const Me=D.current;if(!Me||Z<0||X<0||Z>=Me.width||X>=Me.height)return null;const Ae=(X*Me.width+Z)*4,pe=Me.data[Ae],Ne=Me.data[Ae+1],ze=Me.data[Ae+2],je=bt(pe,Ne,ze);return ft(pe===Ne&&Ne===ze?[pe]:[pe,Ne,ze],"uint8",ae,je)},Ht=c.useMemo(()=>Fo(Se,be),[]),Bn=c.useMemo(()=>Fo(le,Le),[]),On=c.useMemo(()=>(D,q,Z)=>{var je;const X=K.current,ae=I.current;if(!X||!ae)return null;const{w:ue,h:Me}=ae;if(D<0||q<0||D>=ue||q>=Me)return null;const Ae=(q*ue+D)*4,pe=((je=it(ke))==null?void 0:je.output)??"per-channel",Ne=.5,ze=pe==="scalar"?[X[Ae]??0]:[X[Ae]??0,X[Ae+1]??0,X[Ae+2]??0];return ft(ze,"unit",Z,Ne)},[ke]);c.useEffect(()=>{const D=E.current;if(D)return D.__cairnCompareProbe={sampleDiff:(q,Z,X="decimal")=>On(q,Z,X),sampleFg:(q,Z,X="decimal")=>Ht(q,Z,X),sampleRef:(q,Z,X="decimal")=>Bn(q,Z,X),get diffSamples(){return K.current},get dims(){return Be},get primaryDims(){return k},get diffResultDims(){return I.current},get align(){return d},get fit(){return x},get resolvedKernelId(){return ke},get compareMode(){return H},get ssimScalar(){return G},get ssimText(){return So(G)}},()=>{D&&delete D.__cairnCompareProbe}},[On,Ht,Bn,k,Be,d,x,ke,H,G]);const Tc=h==="auto"?void 0:h;if(A)return n!=null||r!=null?f.jsx(wc,{}):H==="diff"?f.jsx(Mn,{imageUrl:e,baselineUrl:t,diffMode:((Go=it(ke))==null?void 0:Go.kind)==="pointwise"?ke:"absolute",interpolation:h,colormap:ce,showAxes:!1,zoom:M,pan:m,onViewportChange:g,label:b,pixelValueNotation:y}):f.jsx(vc,{imageUrl:e,baselineUrl:t,mode:H,splitPosition:s,blendAlpha:i,onSplitPositionChange:u,zoom:M,pan:m,onViewportChange:g,interpolation:h,label:b,pixelValueNotation:y});const Ac=f.jsxs(f.Fragment,{children:[f.jsx("canvas",{ref:P,className:"w-full h-full block",style:{imageRendering:Tc},"data-gpu-compare-canvas":!0}),H==="split"&&f.jsx(No,{splitPosition:s,onChange:u,onReset:()=>u==null?void 0:u(.5)})]}),Uo=!!b,Cc=Uo?"bottom-7":"bottom-1";return f.jsx(Ft,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":C},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:E,wrapperRef:R,zoom:M,pan:m,onViewportChange:g,naturalDims:Be,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:Ac,showAxes:!1,notationSeed:y,onReset:qe,extraModified:Fe,exportCanvasRef:P,requestRender:Mt,leadingMenus:Pe,displayAdjust:{exposureEV:Ge,offset:z,onExposureChange:et,onOffsetChange:xe},label:"",showLabelChip:!1,overlay:{render:({notation:D,setOverlayActive:q})=>H==="split"?f.jsxs(f.Fragment,{children:[Ze&&Be&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-s)*100}% 0 0)`},children:f.jsx(dt,{imageElRef:P,naturalWidth:Be.w,naturalHeight:Be.h,zoom:M,pan:m,sourceWindow:J,sample:Bn,notation:D,version:$})}),Ze&&Be&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${s*100}%)`},children:f.jsx(dt,{imageElRef:P,naturalWidth:Be.w,naturalHeight:Be.h,zoom:M,pan:m,sourceWindow:J,sample:Ht,notation:D,version:$,onActiveChange:q})})]}):Be&&f.jsx(dt,{imageElRef:P,naturalWidth:Be.w,naturalHeight:Be.h,zoom:M,pan:m,sourceWindow:J,sample:H==="diff"?On:Ht,notation:D,version:H==="diff"?ee:$,onActiveChange:q})},extraChips:f.jsxs(f.Fragment,{children:[H==="split"&&f.jsx(Io,{}),Uo?f.jsx(bn,{label:b,corner:"bottom-right"}):null,ie&&f.jsxs("span",{className:`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${Cc}`,"data-gpu-compare-metrics":!0,children:["MSE ",ie.mse.toExponential(2)," · PSNR ",Number.isFinite(ie.psnr)?ie.psnr.toFixed(1):"∞"," dB · MAE"," ",ie.mae.toExponential(2)," · SSIM ",So(G)]})]})})}const Sc="cairn-plot:gpu-image-ready";async function Pc(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await Pt(),window.__cairnPlotGpuImagePane=ha,window.__cairnPlotGpuComparePane=Mc,window.__cairnPlotDiffMenuModes=Mo(),window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(Sc))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e),eo("no-webgpu")}}}Pc()})(__cairnPlotJsxRuntime,__cairnPlotReact);
