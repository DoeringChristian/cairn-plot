var lc=Object.defineProperty;var uc=(f,l,rt)=>l in f?lc(f,l,{enumerable:!0,configurable:!0,writable:!0,value:rt}):f[l]=rt;var ae=(f,l,rt)=>uc(f,typeof l!="symbol"?l+"":l,rt);(function(f,l){"use strict";const rt=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function Ln(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:rt}),{hdr:!1,format:n}}function Ro(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:rt}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:rt}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return Ln(e,t)}}}const Co=`
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
`,ko=`
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
`;function qt(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Bn(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Do(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const Lo={texture:0,sampler:1,uniform:2};function Zt(e,t){return e*3+Lo[t]}const Bo={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function Oo(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),s=r[2]!==void 0,i=r[3].trim();if(s){const c=Bo[i];if(c===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${i}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:c})}else i==="sampler"||i==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class On{constructor(t,n,r,o){ae(this,"width");ae(this,"height");ae(this,"format");ae(this,"gpuTexture");ae(this,"device");ae(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:qt(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*Bn(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class In{constructor(t){ae(this,"_s");ae(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class Io{constructor(t,n,r,o,s){ae(this,"_p");ae(this,"gpuPipeline");ae(this,"bindings");ae(this,"bindGroupLayout");ae(this,"variants");ae(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=s,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function No(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class Fo{constructor(t){ae(this,"_c");ae(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class Uo{constructor(t,n,r,o,s){ae(this,"width");ae(this,"height");ae(this,"paramsBuffer");ae(this,"bindGroup");ae(this,"buffers");ae(this,"destroyed",!1);this.width=t,this.height=n,this.buffers=r,this.paramsBuffer=o,this.bindGroup=s}destroy(){if(!this.destroyed){for(const t of this.buffers)t.destroy();this.paramsBuffer.destroy(),this.destroyed=!0}}}class Go{constructor(t,n){ae(this,"_b");ae(this,"gpuBindGroup");ae(this,"ownedBuffers");ae(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class zo{constructor(t,n,r,o){ae(this,"canvas");ae(this,"hdr");ae(this,"format");ae(this,"context");ae(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function St(e){return"canvas"in e}async function Vo(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function s(d){return St(d)?d.getCurrentTextureView():d.gpuTexture.createView()}function i(d){if(St(d))return{width:d.canvas.width,height:d.canvas.height};const x=d;return{width:x.width,height:x.height}}let c=!1,a=null;function u(){var x,v;if(a!==null)return a;let d=!1;try{if(typeof document<"u"){const g=document.createElement("canvas");g.width=1,g.height=1;const E=g.getContext("webgpu");if(E)try{E.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:GPUTextureUsage.RENDER_ATTACHMENT});const k=(x=E.getConfiguration)==null?void 0:x.call(E);d=((v=k==null?void 0:k.toneMapping)==null?void 0:v.mode)==="extended"}catch{d=!1}finally{try{E.unconfigure()}catch{}}}}catch{d=!1}return a=d,d}const p=256;let b=null,h=null;function y(){if(!b||!h){const d=t.createShaderModule({code:Co});h=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const x=t.createPipelineLayout({bindGroupLayouts:[h]});b=t.createComputePipeline({layout:x,compute:{module:d,entryPoint:"cs_main"}})}return{pipeline:b,layout:h}}let _=null,w=null;function S(){if(!_||!w){const d=t.createShaderModule({code:ko});w=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});const x=t.createPipelineLayout({bindGroupLayouts:[w]});_=t.createRenderPipeline({layout:x,vertex:{module:d,entryPoint:"vs_main"},fragment:{module:d,entryPoint:"fs_main",targets:[{format:"rgba16float"}]},primitive:{topology:"triangle-list"}})}return{pipeline:_,layout:w}}return{backend:"webgpu",capabilities:n,probeExtendedToneMapping:u,createTexture(d,x,v){return new On(t,d,x,v)},createSampler(d){const x=(d==null?void 0:d.filter)==="linear"?"linear":"nearest",v=t.createSampler({magFilter:x,minFilter:x,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new In(v)},createRenderPipeline(d){const x=t.createShaderModule({code:d.shaderWGSL}),v=Oo(d.shaderWGSL),g=qt(d.targetFormat),E=No(t,v),k=t.createPipelineLayout({bindGroupLayouts:[E]}),T=P=>t.createRenderPipeline({layout:k,vertex:{module:x,entryPoint:"vs_main"},fragment:{module:x,entryPoint:"fs_main",targets:[{format:P}]},primitive:{topology:"triangle-list"}}),M=T(g);return new Io(M,v,E,g,T)},createComputePipeline(d){const x=t.createShaderModule({code:d.shaderWGSL}),v=t.createComputePipeline({layout:"auto",compute:{module:x,entryPoint:"cs_main"}});return new Fo(v)},createBindGroup(d,x){const v=d,g=new Map,E=[];for(const[T,M]of v.bindings)if(M.kind==="uniform"){const P=t.createBuffer({size:M.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});E.push(P),g.set(T,{binding:T,resource:{buffer:P}})}else M.kind==="sampler"&&g.set(T,{binding:T,resource:o()});for(const T of x){const M=T.resource;if(M instanceof On){const P=Zt(T.binding,"texture");v.bindings.has(P)&&g.set(P,{binding:P,resource:M.gpuTexture.createView()})}else if(M instanceof In){const P=Zt(T.binding,"sampler");v.bindings.has(P)&&g.set(P,{binding:P,resource:M.gpuSampler})}else{const P=Zt(T.binding,"uniform"),D=v.bindings.get(P);if(D&&D.kind==="uniform"){const R=M.uniform,A=t.createBuffer({size:Math.max(D.sizeBytes,R.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(A,0,R.buffer,R.byteOffset,R.byteLength),E.push(A),g.set(P,{binding:P,resource:{buffer:A}})}}}const k=t.createBindGroup({layout:v.bindGroupLayout,entries:Array.from(g.values())});return new Go(k,E)},createSurface(d,x){const v=d.getContext("webgpu");if(!v)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const g=x.hdr&&n.hdr,E=()=>g?Ro(v,t):Ln(v,t),k=E();return new zo(d,v,k,E)},renderFullscreen(d,x,v){const g=x,E=v,k=s(d),{width:T,height:M}=i(d),P=St(d)?d.format:qt(d.format),D=g.pipelineFor(P),R=t.createCommandEncoder(),A=R.beginRenderPass({colorAttachments:[{view:k,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});A.setPipeline(D),A.setBindGroup(0,E.gpuBindGroup),A.setViewport(0,0,T,M,0,1),A.draw(3),A.end(),t.queue.submit([R.finish()])},createDeepSampleBuffers(d){const{layout:x}=S(),v=P=>{const D=t.createBuffer({size:P.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});return t.queue.writeBuffer(D,0,P.buffer,P.byteOffset,P.byteLength),D},g=v(d.offsets),E=v(d.colors),k=v(d.zs),T=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),M=t.createBindGroup({layout:x,entries:[{binding:0,resource:{buffer:g}},{binding:1,resource:{buffer:E}},{binding:2,resource:{buffer:k}},{binding:3,resource:{buffer:T}}]});return new Uo(d.width,d.height,[g,E,k],T,M)},compositeDeep(d,x,v,g){const E=d,k=x,{pipeline:T}=S();t.queue.writeBuffer(E.paramsBuffer,0,new Float32Array([E.width,E.height,g,v]));const M=t.createCommandEncoder(),P=M.beginRenderPass({colorAttachments:[{view:k.gpuTexture.createView(),loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});P.setPipeline(T),P.setBindGroup(0,E.bindGroup),P.setViewport(0,0,k.width,k.height,0,1),P.draw(3),P.end(),t.queue.submit([M.finish()])},async readback(d){const x=St(d),{width:v,height:g}=i(d),E=x?d.hdr?"rgba16float":"rgba8unorm":d.format,k=x&&d.format==="bgra8unorm",T=x?d.getCurrentGPUTexture():d.gpuTexture,M=Bn(E),P=v*M,D=256,R=Math.ceil(P/D)*D,A=R*g,X=t.createBuffer({size:A,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),L=t.createCommandEncoder();L.copyTextureToBuffer({texture:T},{buffer:X,bytesPerRow:R,rowsPerImage:g},{width:v,height:g,depthOrArrayLayers:1}),t.queue.submit([L.finish()]),await X.mapAsync(GPUMapMode.READ);const B=new Uint8Array(X.getMappedRange()),I=new Uint8Array(P*g);for(let O=0;O<g;O++){const q=O*R,Z=O*P;I.set(B.subarray(q,q+P),Z)}if(X.unmap(),X.destroy(),E==="rgba8unorm"){if(k)for(let O=0;O<I.length;O+=4){const q=I[O],Z=I[O+2];I[O]=Z,I[O+2]=q}return I}if(E==="rgba16float"){const O=new Uint16Array(I.buffer,I.byteOffset,I.byteLength/2),q=new Float32Array(O.length);for(let Z=0;Z<O.length;Z++)q[Z]=Do(O[Z]);return q}return new Float32Array(I.buffer,I.byteOffset,I.byteLength/4)},async reduceDiffSumSquaredAbs(d,x,v,g){const E=d,k=x,T=Math.max(0,v*g),M=Math.max(1,Math.ceil(T/p)),{pipeline:P,layout:D}=y(),R=M*2*4,A=t.createBuffer({size:R,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),X=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(X,0,new Uint32Array([Math.max(1,v),Math.max(1,g),T,0]));const L=t.createBindGroup({layout:D,entries:[{binding:0,resource:E.gpuTexture.createView()},{binding:1,resource:k.gpuTexture.createView()},{binding:2,resource:{buffer:A}},{binding:3,resource:{buffer:X}}]}),B=t.createBuffer({size:R,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),I=t.createCommandEncoder(),O=I.beginComputePass();O.setPipeline(P),O.setBindGroup(0,L),O.dispatchWorkgroups(M),O.end(),I.copyBufferToBuffer(A,0,B,0,R),t.queue.submit([I.finish()]),await B.mapAsync(GPUMapMode.READ);const Z=new Float32Array(B.getMappedRange()).slice();B.unmap(),B.destroy(),A.destroy(),X.destroy();let be=0,xe=0;for(let ee=0;ee<M;ee++)be+=Z[ee*2],xe+=Z[ee*2+1];return{sumSq:be,sumAbs:xe}},destroy(){c||(t.destroy(),c=!0)},isContextLost(){return!1}}}let jt=null;async function $o(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return Vo()}function Tt(){return jt||(jt=$o()),jt}function Xo(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function Wo(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),s=Math.floor(o),i=Math.min(s+1,e.length-1),c=o-s,[a,u,p]=Xo(e[s],e[i],c);t[n*3]=Math.round(a),t[n*3+1]=Math.round(u),t[n*3+2]=Math.round(p)}return t}const Nn={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},Yo=new Set(["red-green","red-blue"]),Fn=new Map;function Qt(e){let t=Fn.get(e);if(!t){const n=Nn[e]??Nn.viridis;t=Wo(n),Fn.set(e,t)}return t}const He=e=>e<0?0:e>1?1:e,Jt=e=>{const t=e<0?0:e;return t/(1+t)},en=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return He(n/r)},Pt=4,Ho=1,Ko=16,qo=.5,Un={linear:([e,t,n])=>[He(e),He(t),He(n)],srgb:([e,t,n])=>[He(e),He(t),He(n)],reinhard:([e,t,n])=>[Jt(e),Jt(t),Jt(n)],aces:([e,t,n])=>[en(e),en(t),en(n)],extended:([e,t,n])=>[e,t,n]},Gn="srgb",Zo=["linear","srgb","reinhard","aces"],jo=["extended","extended-reinhard","extended-aces"],Qo=["extended-reinhard","extended-aces"];function zn(e){return!!e&&jo.includes(e)}function Jo(e){return!!e&&Qo.includes(e)}const Vn={extended:"linear","extended-reinhard":"reinhard","extended-aces":"aces"};function es(e){return e&&Un[e]||Un[Gn]}function tn(e){return e&&Vn[e]?Vn[e]:e&&Zo.includes(e)?e:Gn}function ts(e,t){return t?zn(e)?e:"extended":tn(e)}function At(e,t,n){return e*2**t+n}function ns(e){const t=He(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function nn(e,t){return typeof t=="number"&&t>0?He(Math.pow(He(e),1/t)):ns(e)}function rn(e,t,n="linear",r=0,o=0){const s=Qt(t),i=new ImageData(e.width,e.height),c=e.data,a=i.data,u=r!==0||o!==0;for(let p=0;p<c.length;p+=4){let b=(c[p]+c[p+1]+c[p+2])/3;u&&(b=Math.max(0,Math.min(255,At(b/255,r,o)*255)));let h;n==="positive"?h=Math.round(128+b/255*127):h=Math.round(b),h=Math.max(0,Math.min(255,h)),a[p]=s[h*3],a[p+1]=s[h*3+1],a[p+2]=s[h*3+2],a[p+3]=c[p+3]}return i}function rs(e,t){return e==="signed"||e==="relative"?"signed":on(t)}function on(e){return Yo.has(e??"")?"positive":"linear"}function $n(e){const t=new Map;return{get(n){return t.get(n)},set(n,r){if(t.size>=e){const o=t.keys().next().value;o!==void 0&&t.delete(o)}t.set(n,r)}}}const Xn=$n(50);function sn(e){return Xn.get(e)}function an(e,t){Xn.set(e,t)}const Wn=$n(100);function os(e){return Wn.get(e)}function ss(e,t){Wn.set(e,t)}function is(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),s=new ImageData(r,o);for(let i=0;i<o;i++)for(let c=0;c<r;c++){const a=(i*e.width+c)*4,u=(i*t.width+c)*4,p=(i*r+c)*4;for(let b=0;b<3;b++){const h=e.data[a+b],y=t.data[u+b],_=h-y,w=Math.abs(_),S=Math.max(h,1);let m;switch(n){case"signed":m=(_+255)/2;break;case"absolute":m=w;break;case"squared":m=_*_/255;break;case"relative_signed":m=(_/S+1)*127.5;break;case"relative_absolute":m=w/S*255;break;case"relative_squared":m=_*_/(S*S)*255;break}s.data[p+b]=Math.min(255,Math.max(0,Math.round(m)))}s.data[p+3]=255}return s}async function at(e){const t=os(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const s=o.getContext("2d");if(!s){n(null);return}s.drawImage(r,0,0);const i=s.getImageData(0,0,o.width,o.height);ss(e,i),n(i)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const as={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},cs={linear:0,signed:1,positive:2},ls=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,us=`#version 300 es
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
}`;let ct=null,Q=null,Ne=null,Rt=null;function fs(){if(Q)return Q;try{if(typeof OffscreenCanvas<"u"?ct=new OffscreenCanvas(1,1):ct=document.createElement("canvas"),Q=ct.getContext("webgl2",{preserveDrawingBuffer:!0}),!Q)return console.warn("[cairn] WebGL 2 not available"),null;const e=Q.createShader(Q.VERTEX_SHADER);if(Q.shaderSource(e,ls),Q.compileShader(e),!Q.getShaderParameter(e,Q.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",Q.getShaderInfoLog(e)),null;const t=Q.createShader(Q.FRAGMENT_SHADER);if(Q.shaderSource(t,us),Q.compileShader(t),!Q.getShaderParameter(t,Q.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",Q.getShaderInfoLog(t)),null;if(Ne=Q.createProgram(),Q.attachShader(Ne,e),Q.attachShader(Ne,t),Q.linkProgram(Ne),!Q.getProgramParameter(Ne,Q.LINK_STATUS))return console.error("[cairn] WebGL program link:",Q.getProgramInfoLog(Ne)),null;Rt=Q.createVertexArray(),Q.bindVertexArray(Rt);const n=Q.createBuffer();Q.bindBuffer(Q.ARRAY_BUFFER,n),Q.bufferData(Q.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),Q.STATIC_DRAW);const r=Q.getAttribLocation(Ne,"a_pos");return Q.enableVertexAttribArray(r),Q.vertexAttribPointer(r,2,Q.FLOAT,!1,0,0),Q.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),Q}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function Yn(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function ds(e,t,n){const r=new Uint8Array(1024);for(let s=0;s<256;s++)r[s*4]=t[s*3],r[s*4+1]=t[s*3+1],r[s*4+2]=t[s*3+2],r[s*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function ps(e,t,n,r){const o=fs();if(!o||!Ne||!Rt||!ct)return null;const s=Math.min(e.width,t.width),i=Math.min(e.height,t.height);ct.width=s,ct.height=i,o.viewport(0,0,s,i);const c=Yn(o,e,0),a=Yn(o,t,1);let u=null;n.colormap?u=ds(o,n.colormap,2):(u=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,u),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(Ne),o.uniform1i(o.getUniformLocation(Ne,"u_baseline"),0),o.uniform1i(o.getUniformLocation(Ne,"u_other"),1),o.uniform1i(o.getUniformLocation(Ne,"u_lut"),2),o.uniform1i(o.getUniformLocation(Ne,"u_diff_mode"),as[n.diffMode]),o.uniform1i(o.getUniformLocation(Ne,"u_cmap_mode"),cs[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(Ne,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(Rt),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=s,r.height=i;const p=r.getContext("2d");return p&&(p.save(),p.scale(1,-1),p.drawImage(ct,0,0,s,i,0,-i,s,i),p.restore()),o.deleteTexture(c),o.deleteTexture(a),o.deleteTexture(u),{width:s,height:i}}const hs="cairn:render-mode";function ms(){try{const e=localStorage.getItem(hs);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const Ct=15360;function kt(e){const t=e&32768?-1:1,n=e>>10&31,r=e&1023;return n===0?r===0?t*0:t*r*2**-24:n===31?r===0?t*(1/0):NaN:t*2**(n-15)*(1+r/1024)}const Hn=globalThis.Float16Array;function Kn(e,t=e.length){if(Hn){const r=new Hn(e.buffer,e.byteOffset,t);return Float32Array.from(r)}const n=new Float32Array(t);for(let r=0;r<t;r++)n[r]=kt(e[r]);return n}const Ke=new Uint32Array(512),qe=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(Ke[e]=0,Ke[e|256]=32768,qe[e]=24,qe[e|256]=24):t<-14?(Ke[e]=1024>>-t-14,Ke[e|256]=1024>>-t-14|32768,qe[e]=-t-1,qe[e|256]=-t-1):t<=15?(Ke[e]=t+15<<10,Ke[e|256]=t+15<<10|32768,qe[e]=13,qe[e|256]=13):t<128?(Ke[e]=31744,Ke[e|256]=64512,qe[e]=24,qe[e|256]=24):(Ke[e]=31744,Ke[e|256]=64512,qe[e]=13,qe[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var wt=Uint8Array,qn=Uint16Array,gs=Int32Array,xs=new wt([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),bs=new wt([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),Zn=function(e,t){for(var n=new qn(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new gs(n[30]),r=1;r<30;++r)for(var s=n[r];s<n[r+1];++s)o[s]=s-n[r]<<5|r;return{b:n,r:o}},jn=Zn(xs,2),vs=jn.b,ws=jn.r;vs[28]=258,ws[258]=28,Zn(bs,0);for(var ys=new qn(32768),Ee=0;Ee<32768;++Ee){var ot=(Ee&43690)>>1|(Ee&21845)<<1;ot=(ot&52428)>>2|(ot&13107)<<2,ot=(ot&61680)>>4|(ot&3855)<<4,ys[Ee]=((ot&65280)>>8|(ot&255)<<8)>>1}for(var Dt=new wt(288),Ee=0;Ee<144;++Ee)Dt[Ee]=8;for(var Ee=144;Ee<256;++Ee)Dt[Ee]=9;for(var Ee=256;Ee<280;++Ee)Dt[Ee]=7;for(var Ee=280;Ee<288;++Ee)Dt[Ee]=8;for(var Es=new wt(32),Ee=0;Ee<32;++Ee)Es[Ee]=5;var _s=new wt(0),Ms=typeof TextDecoder<"u"&&new TextDecoder,Ss=0;try{Ms.decode(_s,{stream:!0}),Ss=1}catch{}const Qn=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function cn(e){const t=Qn.length;return Qn[(e%t+t)%t]}function Ts(e){const n=l.useRef(null),[r,o]=l.useState({w:0,h:0}),s=l.useRef(null),i=l.useRef(null),c=l.useRef(null),a=l.useCallback((u,p)=>{o(b=>b.w===u&&b.h===p?b:{w:u,h:p})},[]);return l.useLayoutEffect(()=>{const u=n.current;if(!u||u===c.current)return;const p=u.getBoundingClientRect();(p.width>0||p.height>0)&&(c.current=u,a(p.width,p.height))}),l.useEffect(()=>{var b;const u=n.current;if(u===i.current||((b=s.current)==null||b.disconnect(),s.current=null,i.current=u,!u))return;const p=new ResizeObserver(h=>{for(const y of h)a(y.contentRect.width,y.contentRect.height)});s.current=p,p.observe(u)}),l.useEffect(()=>()=>{var u;return(u=s.current)==null?void 0:u.disconnect()},[]),{ref:n,size:r}}function Ps(){const[e,t]=l.useState(!1);return l.useEffect(()=>{const n=s=>{(s.key==="Alt"||s.key==="Control"||s.key==="Meta")&&t(!0)},r=s=>{(s.key==="Alt"||s.key==="Control"||s.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const As=.001;function Rs(e,t=As){return Math.exp(-e*t)}function Jn(e,t){return Math.hypot(e.x-t.x,e.y-t.y)}function er(e,t){return{x:(e.x+t.x)/2,y:(e.y+t.y)/2}}function Cs(e,t,n,r,o,s,i){const c=t>0&&r>0?r/t:1,a=Math.max(s,Math.min(i,e.zoom*c)),u=(n.x-e.pan.x)/e.zoom,p=(n.y-e.pan.y)/e.zoom;return{zoom:a,pan:{x:o.x-u*a,y:o.y-p*a}}}const ks=.25,ln=64;function un(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return ln;const o=Math.min(n/e,r/t);return o<=0?ln:Math.max(Math.max(n,r)/o,8)}function tr(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:s=ks,maxZoom:i=ln,naturalWidth:c,naturalHeight:a}=e,u=Ps(),p=l.useRef(u);p.current=u;const b=l.useRef({zoom:n,pan:r});b.current={zoom:n,pan:r};const h=l.useRef(o);h.current=o,l.useEffect(()=>{const T=t.current;if(!T||!o)return;const M=P=>{var Z;if(!P.ctrlKey&&!p.current)return;P.preventDefault(),P.stopPropagation();const D=Rs(P.deltaY),R=b.current,A=T.getBoundingClientRect(),X=c&&a?un(c,a,A.width,A.height):i,L=Math.max(s,Math.min(X,R.zoom*D));if(R.zoom===L)return;const B=P.clientX-A.left,I=P.clientY-A.top,O=B-(B-R.pan.x)/R.zoom*L,q=I-(I-R.pan.y)/R.zoom*L;(Z=h.current)==null||Z.call(h,{zoom:L,pan:{x:O,y:q}})};return T.addEventListener("wheel",M,{passive:!1}),()=>T.removeEventListener("wheel",M)},[t,!!o,s,i,c,a]);const y=l.useRef(new Map),_=l.useRef(null),w=l.useRef(null),S=l.useCallback((T,M,P)=>{const D=T.getBoundingClientRect();return{x:M-D.left,y:P-D.top}},[]),m=l.useCallback(T=>{if(!c||!a)return i;const M=T.getBoundingClientRect();return un(c,a,M.width,M.height)},[c,a,i]),d=l.useCallback((T,M)=>{const P=y.current,D=P.get(T),R=P.get(M);!D||!R||(_.current=null,w.current={idA:T,idB:M,startDist:Jn(D,R),startMid:er(D,R),startZoom:b.current.zoom,startPan:{...b.current.pan}})},[]),x=l.useCallback(T=>{const M=y.current.get(T);M&&(_.current={pointerId:T,startX:M.x,startY:M.y,panX:b.current.pan.x,panY:b.current.pan.y})},[]),v=l.useCallback(T=>{if(!h.current)return;const M=T.pointerType==="touch";if(!M&&!p.current)return;const P=T.currentTarget;if(P.setPointerCapture(T.pointerId),y.current.set(T.pointerId,S(P,T.clientX,T.clientY)),M&&y.current.size>=2){const D=[...y.current.keys()];d(D[D.length-2],D[D.length-1]);return}x(T.pointerId)},[S,d,x]),g=l.useCallback(T=>{var A,X;const M=T.currentTarget,P=y.current.get(T.pointerId);if(P){const L=S(M,T.clientX,T.clientY);P.x=L.x,P.y=L.y}const D=w.current;if(D){const L=y.current.get(D.idA),B=y.current.get(D.idB);if(!L||!B)return;const I=Cs({zoom:D.startZoom,pan:D.startPan},D.startDist,D.startMid,Jn(L,B),er(L,B),s,m(M));(A=h.current)==null||A.call(h,I);return}const R=_.current;!R||R.pointerId!==T.pointerId||!P||(X=h.current)==null||X.call(h,{zoom:b.current.zoom,pan:{x:R.panX+(P.x-R.startX),y:R.panY+(P.y-R.startY)}})},[S,s,m]),E=l.useCallback(T=>{var P;try{T.currentTarget.releasePointerCapture(T.pointerId)}catch{}y.current.delete(T.pointerId);const M=w.current;if(M&&(T.pointerId===M.idA||T.pointerId===M.idB)){w.current=null;const D=[...y.current.keys()];D.length===1&&x(D[0]);return}((P=_.current)==null?void 0:P.pointerId)===T.pointerId&&(_.current=null)},[x]);return{containerProps:{onPointerDown:v,onPointerMove:g,onPointerUp:E,onPointerCancel:E,style:{cursor:u&&!!o?"move":void 0,touchAction:o?"none":void 0}},modifierActive:u}}function fn(){const[e,t]=l.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return l.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),s())};function s(){if(n)return;const i=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${i}dppx)`),r.addEventListener("change",o,{once:!0})}return s(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function lt(e){const t=l.useRef(e),[n,r]=l.useState(e),o=l.useCallback(()=>r(t.current),[]);return[n,r,{reset:o,isModified:!Object.is(n,t.current),default:t.current}]}function Ds(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function nr(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function dn({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:s}=Ts(),i=l.useRef(null),c=l.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),a=l.useMemo(()=>{const w=s.w,S=s.h;if(w<=0||S<=0||n<=0||r<=0)return null;const m=Math.min(w/n,S/r),d=n*m,x=r*m;return{left:(w-d)/2,top:(S-x)/2,width:d,height:x}},[s.w,s.h,n,r]),u=e.masks,p=t.showMasks&&!!u&&u.length>0,b=l.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(l.useEffect(()=>{if(!p||!u)return;const w=i.current;if(!w)return;(w.width!==n||w.height!==r)&&(w.width=n,w.height=r);const S=w.getContext("2d");if(!S)return;S.clearRect(0,0,w.width,w.height);let m=!1;const d=S.createImageData(n,r),x=d.data;let v=u.length,g=!1;const E=()=>{m||g&&S.putImageData(d,0,0)},k=document.createElement("canvas");k.width=n,k.height=r;const T=k.getContext("2d",{willReadFrequently:!0});for(const M of u){const P=new Image;P.onload=()=>{if(!m){if(T){T.clearRect(0,0,n,r),T.drawImage(P,0,0,n,r);const D=T.getImageData(0,0,n,r).data;for(let R=0;R<n*r;R++){const A=D[R*4];if(A===0||c.has(A))continue;const[X,L,B]=Ds(cn(A));x[R*4]=X,x[R*4+1]=L,x[R*4+2]=B,x[R*4+3]=255,g=!0}}v-=1,v===0&&E()}},P.onerror=()=>{v-=1,v===0&&E()},P.src=`data:image/png;base64,${M.png_b64}`}return()=>{m=!0}},[p,u,n,r,b]),!a)return f.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const h=e.boxes??[],y=t.showBoxes&&h.length>0,_=e.class_labels??{};return f.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[p&&f.jsx("canvas",{ref:i,className:"absolute",style:{left:a.left,top:a.top,width:a.width,height:a.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),y&&f.jsx("svg",{className:"absolute",style:{left:a.left,top:a.top,width:a.width,height:a.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:h.map((w,S)=>{if(!nr(w,t,c))return null;const m=w.domain==="pixel"?1:n,d=w.domain==="pixel"?1:r,x=w.position.minX*m,v=w.position.minY*d,g=(w.position.maxX-w.position.minX)*m,E=(w.position.maxY-w.position.minY)*d;return f.jsx("rect",{x,y:v,width:g,height:E,fill:"none",stroke:cn(w.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},S)})}),y&&f.jsx("div",{className:"absolute",style:{left:a.left,top:a.top,width:a.width,height:a.height},children:h.map((w,S)=>{if(!nr(w,t,c))return null;const m=w.domain==="pixel"?1/n:1,d=w.domain==="pixel"?1/r:1,x=w.position.minX*m*100,v=w.position.minY*d*100,g=w.label??_[String(w.class_id)]??`#${w.class_id}`,E=w.score!=null?` ${(w.score*100).toFixed(0)}%`:"";return!g&&!E?null:f.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${x}%`,top:`${v}%`,transform:"translateY(-100%)",backgroundColor:cn(w.class_id)},children:f.jsxs("span",{className:"mono",children:[g,E]})},S)})})]})}const pn=30,Lt=["#ff5a5a","#39d353","#5b9bff"];function hn(e){if(!Number.isFinite(e))return"0";const t=Math.abs(e);return t!==0&&(t<.001||t>=1e4)?e.toExponential(1):String(Number(e.toPrecision(3)))}function mt(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):hn(e/255):hn(n==="int"?e*255:e)}function ut(e,t,n,r){return e.length===1?{lines:[mt(e[0],t,n)],luminance:r}:{lines:e.map(o=>mt(o,t,n)),luminance:r,colors:e.map((o,s)=>Lt[s]??null)}}const Ls={x:0,y:0,w:1,h:1};function ft({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:s,notation:i="decimal",version:c=0,onActiveChange:a,sourceWindow:u=Ls}){const p=l.useRef(null),b=l.useRef(!1),h=fn(),y=l.useRef(a);y.current=a;const _=l.useCallback(S=>{var m;S!==b.current&&(b.current=S,(m=y.current)==null||m.call(y,S))},[]),w=l.useCallback(()=>{var J;const S=p.current,m=e.current;if(!S)return;const d=window.devicePixelRatio||1,x=S.clientWidth,v=S.clientHeight;if(x===0||v===0)return;S.width!==Math.round(x*d)&&(S.width=Math.round(x*d)),S.height!==Math.round(v*d)&&(S.height=Math.round(v*d));const g=S.getContext("2d");if(!g)return;if(g.setTransform(d,0,0,d,0,0),g.clearRect(0,0,x,v),!m||t<=0||n<=0){_(!1);return}const E=m.getBoundingClientRect(),k=S.getBoundingClientRect();if(E.width===0||E.height===0){_(!1);return}const T=u.x*t,M=u.y*n,P=u.w*t,D=u.h*n;if(P<=0||D<=0){_(!1);return}const R=Math.min(E.width/P,E.height/D);if(R<pn){_(!1);return}const A=P*R,X=D*R,L=E.left+(E.width-A)/2-k.left,B=E.top+(E.height-X)/2-k.top,I=Math.max(Math.floor(T),Math.floor(T+(0-L)/R)),O=Math.min(Math.ceil(T+P),Math.ceil(T+(x-L)/R)),q=Math.max(Math.floor(M),Math.floor(M+(0-B)/R)),Z=Math.min(Math.ceil(M+D),Math.ceil(M+(v-B)/R));if(O<=I||Z<=q){_(!1);return}_(!0);const be=L+(0-T)*R,xe=B+(0-M)*R,ee=L+(t-T)*R,Pe=B+(n-M)*R;g.save(),g.beginPath(),g.rect(be,xe,ee-be,Pe-xe),g.clip(),g.textAlign="center",g.textBaseline="middle",g.lineJoin="round";const $=R*.14,F=R-$*2;for(let oe=q;oe<Z;oe++)for(let ce=I;ce<O;ce++){if(ce<0||oe<0||ce>=t||oe>=n)continue;const U=s(ce,oe,i);if(!U||U.lines.length===0)continue;const ne=U.lines.length;let he=1;for(const Fe of U.lines)Fe.length>he&&(he=Fe.length);const ue=F/(ne*1.15),W=F/(he*.62)||ue,de=Math.min(ue,W,24);if(de<6)continue;const me=L+(ce-T+.5)*R,we=B+(oe-M+.5)*R,fe=de*1.15,ke=U.luminance<=.55,$e=ke?"#ffffff":"#000000";g.font=`${de}px ui-monospace, SFMono-Regular, Menlo, monospace`,g.lineWidth=Math.max(1.4,de*.16),g.strokeStyle=ke?"rgba(0,0,0,0.85)":"rgba(255,255,255,0.9)";let Qe=we-ne*fe/2+fe/2;for(let Fe=0;Fe<U.lines.length;Fe++){const V=U.lines[Fe];g.strokeText(V,me,Qe),g.fillStyle=((J=U.colors)==null?void 0:J[Fe])??$e,g.fillText(V,me,Qe),Qe+=fe}}g.restore()},[e,t,n,s,i,_,u]);return l.useEffect(()=>{w()},[w,r,o.x,o.y,c,i,u,h]),l.useEffect(()=>{const S=p.current;if(!S)return;const m=new ResizeObserver(()=>w());return m.observe(S),()=>m.disconnect()},[w]),f.jsx("canvas",{ref:p,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function rr({notation:e,onChange:t,className:n=""}){return f.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const Bs=`
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
`,Ve=`
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
`,yt=`
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
`,Os=`
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
`,Bt=`
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
`;function or(e){return`
${Ve}
${dt}
${Os}

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
`}const Is=or("select(colorB, colorA, uv.x < split)"),Ns=or("mix(colorA, colorB, alpha)");function Fs(e){switch(e){case"center":return{v:"center",h:"center"};case"top-right":return{v:"top",h:"right"};case"bottom-left":return{v:"bottom",h:"left"};case"bottom-right":return{v:"bottom",h:"right"};case"top-left":default:return{v:"top",h:"left"}}}function sr(e,t,n){const{v:r,h:o}=Fs(n),s=e.w-t.w,i=e.h-t.h,c=o==="left"?0:o==="right"?s:Math.floor(s/2),a=r==="top"?0:r==="bottom"?i:Math.floor(i/2);return{x:c,y:a}}function Et(e,t,n,r,o="b"){if(r==="fill"){const i=o==="a"?{w:e.w,h:e.h}:{w:t.w,h:t.h};return{fit:r,result:i,offsetA:{x:0,y:0},offsetB:{x:0,y:0}}}const s={w:Math.min(e.w,t.w),h:Math.min(e.h,t.h)};return{fit:r,result:s,offsetA:sr(e,s,n),offsetB:sr(t,s,n)}}function Us(e){return`${e.fit}:${e.result.w}x${e.result.h}:${e.offsetA.x},${e.offsetA.y}:${e.offsetB.x},${e.offsetB.y}`}const mn={linear:0,srgb:1,reinhard:2,aces:3,extended:4,"extended-reinhard":5,"extended-aces":6},ir=new WeakMap;function Gs(e,t){let n=ir.get(e);n||(n=new Map,ir.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:Bs,targetFormat:t}),n.set(t,r)),r}function ar(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function cr(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function zs(e,t,n,r){var S;const o=ar(t),s=Gs(e,o),i=cr(e,r.isScalar?r.colormap:void 0),c=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,a=mn[r.operator]??mn.srgb,u=new Float32Array([r.exposureEV,a,c,r.isScalar?1:0]),p=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),b=new Float32Array([r.hdrOut?1:0]),h=new Float32Array([r.filter==="nearest"?0:1]),y=new Float32Array([r.offset??0]),_=new Float32Array([r.peak??Pt]);let w;try{w=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:i},{binding:2,resource:{uniform:u}},{binding:3,resource:{uniform:p}},{binding:4,resource:{uniform:b}},{binding:5,resource:{uniform:h}},{binding:6,resource:{uniform:y}},{binding:7,resource:{uniform:_}}]),e.renderFullscreen(t,s,w)}finally{(S=w==null?void 0:w.destroy)==null||S.call(w),i.destroy()}}const lr=new WeakMap;function Vs(e,t,n){let r=lr.get(e);r||(r=new Map,lr.set(e,r));const o=`${t}:${n}`;let s=r.get(o);return s||(s=e.createRenderPipeline({shaderWGSL:t==="split"?Is:Ns,targetFormat:n}),r.set(o,s)),s}function $s(e,t,n,r,o){var w;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const s=ar(t),i=Vs(e,o.mode,s),c=cr(e,void 0),a=o.gamma,u=mn[o.operator],p=new Float32Array([o.exposureEV,u,a,0]),b=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),h=new Float32Array([o.split,o.alpha,0,o.filter==="nearest"?0:1]),y=new Float32Array([o.offset??0,0,0,0]);let _;try{_=e.createBindGroup(i,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:c},{binding:3,resource:{uniform:p}},{binding:4,resource:{uniform:b}},{binding:5,resource:{uniform:h}},{binding:6,resource:{uniform:y}}]),e.renderFullscreen(t,i,_)}finally{(w=_==null?void 0:_.destroy)==null||w.call(_),c.destroy()}}function ur(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,s=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:s,mae:o}}async function fr(e,t,n,r){const o=r??Et({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),s=o.result.w,i=o.result.h,c=s*i*3;if(c<=0)return{mse:0,psnr:1/0,mae:0};if(o.fit==="crop"&&o.offsetA.x===0&&o.offsetA.y===0&&o.offsetB.x===0&&o.offsetB.y===0&&e.reduceDiffSumSquaredAbs){const{sumSq:x,sumAbs:v}=await e.reduceDiffSumSquaredAbs(t,n,s,i);return ur(x,v,c)}const u=await e.readback(t),p=await e.readback(n),b=u instanceof Uint8Array?255:1,h=p instanceof Uint8Array?255:1,y=Ot(u,t.width,t.height,b,o.offsetA,o.fit==="fill",s,i),_=Ot(p,n.width,n.height,h,o.offsetB,o.fit==="fill",s,i);let w=0,S=0;const m=[0,0,0],d=[0,0,0];for(let x=0;x<i;x++)for(let v=0;v<s;v++){y(v,x,m),_(v,x,d);for(let g=0;g<3;g++){const E=m[g]-d[g];w+=E*E,S+=Math.abs(E)}}return ur(w,S,c)}function Ot(e,t,n,r,o,s,i,c){const a=(b,h,y)=>e[(h*t+b)*4+y]??0;if(!s)return(b,h,y)=>{const _=Math.min(Math.max(b+o.x,0),t-1),w=Math.min(Math.max(h+o.y,0),n-1);y[0]=a(_,w,0)/r,y[1]=a(_,w,1)/r,y[2]=a(_,w,2)/r};const u=t-1,p=n-1;return(b,h,y)=>{const _=(b+.5)/i,w=(h+.5)/c,S=_*t-.5,m=w*n-.5,d=Math.floor(S),x=Math.floor(m),v=S-d,g=m-x,E=Math.min(Math.max(d,0),u),k=Math.min(Math.max(d+1,0),u),T=Math.min(Math.max(x,0),p),M=Math.min(Math.max(x+1,0),p);for(let P=0;P<3;P++){const D=a(E,T,P),R=a(k,T,P),A=a(E,M,P),X=a(k,M,P),L=D+(R-D)*v,B=A+(X-A)*v;y[P]=(L+(B-L)*g)/r}}}function dr(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const Xs=12,st=[];function pr(e){const t=st.indexOf(e);t!==-1&&st.splice(t,1),st.push(e)}function Ws(e){const t=st.indexOf(e);t!==-1&&st.splice(t,1)}function It(e){e.parked||(Ws(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),e.surface=null,e.parked=!0)}function hr(e){for(;st.length>Xs;){const t=st.find(n=>n!==e&&!n.visible)??st.find(n=>n!==e);if(!t)break;It(t)}}function mr(e){var o,s,i,c;if(e.disposed)return;if(dr())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){pr(e),hr(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||((s=e.deep)==null?void 0:s.width)||1,r=e.backingHeight||((i=e.source)==null?void 0:i.height)||((c=e.deep)==null?void 0:c.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.deep){const a=t.createTexture(e.deep.width,e.deep.height,"rgba16float");e.srcTexture=a,e.deepBuffers=t.createDeepSampleBuffers(e.deep),t.compositeDeep(e.deepBuffers,a,e.deepZNear,e.deepZFar)}else if(e.source){const a=t.createTexture(e.source.width,e.source.height,e.source.format);a.write(e.source.data),e.srcTexture=a}e.parked=!1,pr(e),hr(e)}function Ys(e,t){if(e.disposed||!e.source&&!e.deep)return!0;try{return mr(e),!e.surface||!e.srcTexture?!1:(zs(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,It(e),!1}}function Hs(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,e.deep=null,e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},setDeepSource(t,n,r){if(!e.disposed&&(e.deep=t,e.deepZNear=n,e.deepZFar=r,e.source=null,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy(),e.deepBuffers&&e.deepBuffers.destroy();const o=e.device.createTexture(t.width,t.height,"rgba16float");e.srcTexture=o,e.deepBuffers=e.device.createDeepSampleBuffers(t),e.device.compositeDeep(e.deepBuffers,o,n,r)}},setDeepWindow(t,n){e.disposed||(e.deepZNear=t,e.deepZFar=n,!e.parked&&e.deepBuffers&&e.srcTexture&&e.device.compositeDeep(e.deepBuffers,e.srcTexture,t,n))},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return Ys(e,t)},park(){e.disposed||It(e)},restore(){e.disposed||!e.source&&!e.deep||mr(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(It(e),e.source=null,e.deep=null,e.disposed=!0)}}}async function Ks(e,t){const n=await Tt(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,deep:null,deepZNear:-1/0,deepZFar:1/0,deepBuffers:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return Hs(r)}function gr(e){e.dispose()}function qs(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:s}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...s?["invert(1)"]:[]].join(" ")}function xr(e){const n=`cairn-gamma-${l.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:s,exposure:i,offset:c,flipSign:a}=e,u=l.useMemo(()=>qs(e,n),[n,r,o,i,a]);return{gammaFilterId:n,filterStr:u,gamma:s,offset:c}}function br({id:e,gamma:t,offset:n}){return f.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:f.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:f.jsxs("feComponentTransfer",{children:[f.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),f.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),f.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}const Zs={x:0,y:0,w:1,h:1};function gn(e){const t=e.sourceWindow??Zs,n=t.x*e.naturalWidth,r=t.y*e.naturalHeight,o=t.w*e.naturalWidth,s=t.h*e.naturalHeight,i=Math.min(e.box.width/o,e.box.height/s),c=o*i,a=s*i;return{scale:i,imgLeft:e.box.left+(e.box.width-c)/2,imgTop:e.box.top+(e.box.height-a)/2,srcOriginX:n,srcOriginY:r}}function js(e){return gn(e).scale}function vr(e,t,n){const r=gn(n);return{x:r.srcOriginX+(e-r.imgLeft)/r.scale,y:r.srcOriginY+(t-r.imgTop)/r.scale}}function wr(e,t,n){const r=gn(n);return{x:r.imgLeft+(e-r.srcOriginX)*r.scale,y:r.imgTop+(t-r.srcOriginY)*r.scale}}function Qs(e,t){const n=wr(e.x0,e.y0,t),r=wr(e.x1+1,e.y1+1,t);return{left:n.x,top:n.y,width:r.x-n.x,height:r.y-n.y}}const Nt=(e,t,n)=>Math.max(t,Math.min(n,Math.floor(e)));function yr(e,t,n,r,o){const s=vr(e,t,o),i=vr(n,r,o),c=o.naturalWidth-1,a=o.naturalHeight-1,u=Math.min(s.x,i.x),p=Math.max(s.x,i.x),b=Math.min(s.y,i.y),h=Math.max(s.y,i.y);return p<0||u>c||h<0||b>a?null:{x0:Nt(u,0,c),y0:Nt(b,0,a),x1:Nt(p,0,c),y1:Nt(h,0,a)}}const Js=["nw","n","ne","e","se","s","sw","w"],gt=(e,t,n)=>e<t?t:e>n?n:e;function ei(e,t,n,r,o,s=1){const i=o.w-1,c=o.h-1,a=Math.round(n),u=Math.round(r);if(t==="move"){const d=e.x1-e.x0,x=e.y1-e.y0,v=gt(e.x0+a,0,i-d),g=gt(e.y0+u,0,c-x);return{x0:v,y0:g,x1:v+d,y1:g+x}}let{x0:p,y0:b,x1:h,y1:y}=e;const _=t==="nw"||t==="w"||t==="sw",w=t==="ne"||t==="e"||t==="se",S=t==="nw"||t==="n"||t==="ne",m=t==="sw"||t==="s"||t==="se";return _&&(p=gt(p+a,0,h-(s-1))),w&&(h=gt(h+a,p+(s-1),i)),S&&(b=gt(b+u,0,y-(s-1))),m&&(y=gt(y+u,b+(s-1),c)),{x0:p,y0:b,x1:h,y1:y}}function Er(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function ti({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=Er(e),s=Er(t),i=[];for(let d=0;d<=e;d+=o)i.push(d);const c=[];for(let d=0;d<=t;d+=s)c.push(d);const a=1/n,u=8*a,p=-12*a,b=-2*a,h=r==null?void 0:r.current;let y=0,_=0,w=0,S=0;if(h){const d=h.clientWidth,x=h.clientHeight,v=d/e,g=x/t,E=Math.min(v,g);w=e*E,S=t*E,y=(d-w)/2,_=(x-S)/2}const m=h&&w>0;return f.jsxs(f.Fragment,{children:[f.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:m?_:0,transform:`translateY(${p}px)`,fontSize:u},children:i.map(d=>f.jsx("span",{className:"mono",style:{position:"absolute",left:m?y+d/e*w:`${d/e*100}%`,transform:"translateX(-50%)"},children:d},d))}),f.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:m?y:0,transform:`translateX(${b}px)`,fontSize:u},children:c.map(d=>f.jsx("span",{className:"mono",style:{position:"absolute",top:m?_+d/t*S:`${d/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*a}px`},children:d},d))})]})}function ni({label:e,isDraggable:t,onDragStart:n}){return f.jsxs("span",{className:`absolute bottom-1 left-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${t?" cairn-drag-grip":""}`,draggable:t,onDragStart:n,style:{cursor:t?"grab":void 0},children:[t&&f.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const ri=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function _r(e,t){const n=getComputedStyle(e),r=ri.map(a=>`${a}:${n.getPropertyValue(a)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const s=e.children,i=t.children,c=Math.min(s.length,i.length);for(let a=0;a<c;a++)_r(s[a],i[a])}function xn(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function bn(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function vn(e,t,n,r,o){const s=document.createElement("canvas");s.width=Math.max(1,Math.round(e*n)),s.height=Math.max(1,Math.round(t*n));const i=s.getContext("2d");if(!i)throw new Error("plot-to-png: 2D canvas context unavailable");return i.scale(n,n),r&&(i.fillStyle=r,i.fillRect(0,0,e,t)),o(i),await new Promise((c,a)=>s.toBlob(u=>u?c(u):a(new Error("plot-to-png: toBlob returned null")),"image/png"))}function oi(e,t,n){const r=e.cloneNode(!0);_r(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),s="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((i,c)=>{const a=new Image;a.onload=()=>i(a),a.onerror=()=>c(new Error("plot-to-png: SVG rasterization failed")),a.src=s})}async function Mr(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,s=(t==null?void 0:t.background)??xn(e);return vn(r,o,bn(t),s,i=>i.drawImage(e,0,0,r,o))}async function si(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,s=(t==null?void 0:t.background)??xn(e);try{return await vn(r,o,bn(t),s,i=>i.drawImage(e,0,0,r,o))}catch(i){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${i instanceof Error?i.message:String(i)})`)}}function ii(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const s=o.getBoundingClientRect(),i=s.width*s.height;i>r&&(r=i,n=o)}return n}async function ai(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),s=o.width||300,i=o.height||150,c=(t==null?void 0:t.background)??xn(e);if(n){const u=n.getBoundingClientRect(),p=await oi(n,u.width||s,u.height||i);return vn(s,i,bn(t),c,b=>{for(const h of r){const y=h.getBoundingClientRect();b.drawImage(h,y.left-o.left,y.top-o.top,y.width,y.height)}b.drawImage(p,u.left-o.left,u.top-o.top,u.width,u.height)})}if(r.length)return Mr(r[0],t);const a=ii(e);if(a)return si(a,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function ci(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const li=8;function ui(e,t,n,r=li){return!(t>0)||!(e>0)?n:e<t+r}function Sr(e,t){return Math.max(0,e.findIndex(n=>n.id===t))}function fi(e){const t=e.trim();if(t==="")return null;const n=t.replace(/−/g,"-").replace(",","."),r=Number(n);return Number.isFinite(r)?r:null}function di(e,t){const n=fi(e);return n===null?t:n}function pi(e){return String(e)}const hi={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},mi={boxZoom:f.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:f.jsxs(f.Fragment,{children:[f.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),f.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),f.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),f.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 2v20M2 12h20"}),f.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),f.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),f.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:f.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:f.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),f.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:f.jsx("path",{d:"M6 9l6 6 6-6"}),ellipsis:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"5",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),f.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),f.jsx("circle",{cx:"19",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"})]}),sun:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"12",cy:"12",r:"4"}),f.jsx("path",{d:"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"})]}),plusminus:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M4 7h6M7 4v6"}),f.jsx("path",{d:"M14 17h6"}),f.jsx("path",{d:"M6 20l12-16"})]}),layers:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 3l9 5-9 5-9-5 9-5z"}),f.jsx("path",{d:"M3 13l9 5 9-5"})]})};function et({name:e}){return f.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:mi[e]??null})}function Tr({icon:e,label:t,title:n,active:r,disabled:o,onClick:s}){return f.jsx("button",{type:"button",disabled:o,onClick:i=>{i.stopPropagation(),!o&&s()},onPointerDown:i=>i.stopPropagation(),onDoubleClick:i=>i.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?f.jsx("span",{"aria-hidden":"true",children:t}):f.jsx(et,{name:e??""})})}function Pr(){return f.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function gi({icon:e,title:t,menu:n}){var S;const{options:r,value:o,onSelect:s}=n,[i,c]=l.useState(!1),[a,u]=l.useState(0),p=l.useRef(null),b=Sr(r,o),h=e?void 0:((S=r[b])==null?void 0:S.label)??"",y=l.useCallback(()=>{c(m=>{const d=!m;return d&&u(b),d})},[b]),_=l.useCallback(m=>{s(m),c(!1)},[s]);l.useEffect(()=>{if(!i)return;const m=x=>{p.current&&!p.current.contains(x.target)&&c(!1)},d=x=>{x.key==="Escape"&&(x.stopPropagation(),c(!1))};return document.addEventListener("pointerdown",m,!0),document.addEventListener("keydown",d,!0),()=>{document.removeEventListener("pointerdown",m,!0),document.removeEventListener("keydown",d,!0)}},[i]);const w=m=>{if(!i){(m.key==="ArrowDown"||m.key==="Enter"||m.key===" ")&&(m.preventDefault(),u(b),c(!0));return}if(m.key==="ArrowDown")m.preventDefault(),u(d=>(d+1)%r.length);else if(m.key==="ArrowUp")m.preventDefault(),u(d=>(d-1+r.length)%r.length);else if(m.key==="Enter"||m.key===" "){m.preventDefault();const d=r[a];d&&_(d.id)}};return f.jsxs("div",{ref:p,className:"relative inline-flex",onPointerDown:m=>m.stopPropagation(),children:[f.jsxs("button",{type:"button",onClick:m=>{m.stopPropagation(),y()},onDoubleClick:m=>m.stopPropagation(),onKeyDown:w,"aria-haspopup":"listbox","aria-expanded":i,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",h?"px-1.5 text-[10px] font-mono":"px-1 text-xs",i?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[h?f.jsx("span",{"aria-hidden":"true",children:h}):f.jsx(et,{name:e??""}),f.jsx(et,{name:"caret"})]}),i&&f.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((m,d)=>{const x=m.id===o,v=d===a;return f.jsx("li",{role:"option","aria-selected":x,children:f.jsx("button",{type:"button",onClick:g=>{g.stopPropagation(),_(m.id)},onPointerEnter:()=>u(d),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",v?"bg-bg-hover":"",x?"text-accent font-medium":"text-fg"].join(" "),children:m.label})},m.id)})})]})}const xi=e=>e.format?e.format(e.value):String(e.value);function Ar({spec:e}){const[t,n]=l.useState(!1),[r,o]=l.useState(""),s=l.useRef(null),i=l.useCallback(()=>{o(pi(e.value)),n(!0)},[e.value]);l.useEffect(()=>{t&&s.current&&(s.current.focus(),s.current.select())},[t]);const c=l.useCallback(()=>{n(u=>(u&&e.onChange(di(r,e.value)),!1))},[r,e]),a=l.useCallback(()=>n(!1),[]);return f.jsxs("label",{className:"inline-flex items-center gap-1 text-fg-muted",title:e.title,onPointerDown:u=>u.stopPropagation(),onDoubleClick:u=>{u.stopPropagation(),t||i()},children:[e.icon?f.jsx("span",{"aria-hidden":"true",className:"inline-flex",children:f.jsx(et,{name:e.icon})}):f.jsx("span",{"aria-hidden":"true",className:"text-[9px] font-mono",children:e.label}),t?f.jsx("input",{ref:s,type:"text",inputMode:"decimal","aria-label":`${e.title} (numeric entry)`,value:r,onChange:u=>o(u.target.value),onPointerDown:u=>u.stopPropagation(),onDoubleClick:u=>u.stopPropagation(),onKeyDown:u=>{u.stopPropagation(),u.key==="Enter"?(u.preventDefault(),c()):u.key==="Escape"&&(u.preventDefault(),a())},onBlur:c,className:"cairn-plot-toolbar-slider-entry h-3.5 w-[6.5rem] rounded border border-border bg-bg px-1 text-[9px] font-mono tabular-nums text-fg outline-none focus:border-accent"}):f.jsxs(f.Fragment,{children:[f.jsx("input",{type:"range","aria-label":e.title,min:e.min,max:e.max,step:e.step,value:e.value,onChange:u=>e.onChange(Number(u.target.value)),onPointerDown:u=>u.stopPropagation(),className:"cairn-plot-toolbar-slider h-1 w-16 cursor-pointer accent-accent"}),f.jsx("span",{"aria-hidden":"true",className:"w-8 text-right text-[9px] font-mono tabular-nums",children:xi(e)})]})]})}function bi({icon:e,title:t,menu:n,onClose:r}){var b;const{options:o,value:s,onSelect:i}=n,[c,a]=l.useState(!1),u=Sr(o,s),p=((b=o[u])==null?void 0:b.label)??"";return f.jsxs("div",{children:[f.jsxs("button",{type:"button","aria-haspopup":"menu","aria-expanded":c,"aria-label":t,onClick:h=>{h.stopPropagation(),a(y=>!y)},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",c?"text-accent":"text-fg hover:bg-bg-hover"].join(" "),children:[e?f.jsx(et,{name:e}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{className:"flex-1",children:t}),f.jsx("span",{className:"font-mono text-[10px] text-fg-muted",children:p}),f.jsx("span",{className:c?"rotate-180 transition-transform":"transition-transform",children:f.jsx(et,{name:"caret"})})]}),c&&o.map(h=>{const y=h.id===s;return f.jsxs("button",{type:"button",role:"menuitemradio","aria-checked":y,"data-menu-option":"",onClick:_=>{_.stopPropagation(),i(h.id),r()},className:["flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-[11px]",y?"text-accent font-medium bg-bg-hover/40":"text-fg hover:bg-bg-hover"].join(" "),children:[f.jsx("span",{"aria-hidden":"true",className:"w-3 text-center text-accent",children:y?"✓":""}),f.jsx("span",{children:h.label})]},h.id)})]})}function vi({actions:e,leading:t,sliders:n}){const[r,o]=l.useState(!1),s=l.useRef(null);return l.useEffect(()=>{if(!r)return;const i=a=>{s.current&&!s.current.contains(a.target)&&o(!1)},c=a=>{a.key==="Escape"&&(a.stopPropagation(),o(!1))};return document.addEventListener("pointerdown",i,!0),document.addEventListener("keydown",c,!0),()=>{document.removeEventListener("pointerdown",i,!0),document.removeEventListener("keydown",c,!0)}},[r]),f.jsxs("div",{ref:s,className:"relative inline-flex",onPointerDown:i=>i.stopPropagation(),children:[f.jsx("button",{type:"button",onClick:i=>{i.stopPropagation(),o(c=>!c)},onDoubleClick:i=>i.stopPropagation(),"aria-haspopup":"menu","aria-expanded":r,"aria-label":"More controls",title:"More controls",className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded text-xs",r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:f.jsx(et,{name:"ellipsis"})}),r&&f.jsxs("div",{role:"menu",className:["absolute right-0 top-full z-40 mt-1 min-w-[10rem] max-h-80 overflow-auto","rounded border border-border bg-bg-elevated py-1 shadow-md"].join(" "),children:[t.map(i=>i.menu?f.jsx(bi,{icon:i.icon,title:i.title,menu:i.menu,onClose:()=>o(!1)},i.id):f.jsxs("button",{type:"button",disabled:i.disabled,onClick:c=>{var a;c.stopPropagation(),!i.disabled&&((a=i.onClick)==null||a.call(i),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",i.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",i.active?"text-accent":""].join(" "),children:[i.icon?f.jsx(et,{name:i.icon}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{children:i.label??i.title})]},i.id)),t.length>0&&e.length>0&&f.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),e.map(i=>f.jsxs("button",{type:"button",role:"menuitem",disabled:i.disabled,onClick:c=>{c.stopPropagation(),!i.disabled&&(i.onClick(),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",i.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",i.active?"text-accent":""].join(" "),children:[i.icon?f.jsx(et,{name:i.icon}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{children:i.title})]},i.id)),n.length>0&&(e.length>0||t.length>0)&&f.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),n.map(i=>f.jsx("div",{className:"px-2 py-1",children:f.jsx(Ar,{spec:i})},i.id))]})]})}function wi({controller:e,config:t}){var D,R;const n=l.useRef(null),[r,o]=l.useState(!1),s=l.useRef(r);s.current=r;const i=l.useRef(0),c=`${((D=t==null?void 0:t.leadingButtons)==null?void 0:D.length)??0}:${((R=t==null?void 0:t.sliders)==null?void 0:R.length)??0}:${(t==null?void 0:t.visibility)??"hover"}`;if(l.useEffect(()=>{const A=n.current,X=A==null?void 0:A.parentElement;if(!X)return;const L=()=>{const q=X.clientWidth;if(!s.current&&n.current){const Z=n.current.scrollWidth;Z>0&&(i.current=Z)}o(ui(q,i.current,s.current))};let B=0;const I=()=>{B||(B=requestAnimationFrame(()=>{B=0,L()}))},O=new ResizeObserver(I);return O.observe(X),L(),()=>{O.disconnect(),B&&cancelAnimationFrame(B)}},[c]),(t==null?void 0:t.enabled)===!1)return null;const a=e.capabilities,u=t==null?void 0:t.buttons,p=(A,X)=>X&&(u==null?void 0:u[A])!==!1,b=A=>()=>e.setDragMode(A),h=()=>{e.toPNG({filename:"plot"}).then(A=>ci(A,"plot.png")).catch(()=>{})},y=[];p("zoom",a.zoom)&&y.push({id:"zoom",icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:b("zoom")}),p("pan",a.pan)&&y.push({id:"pan",icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:b("pan")}),p("select",a.select)&&y.push({id:"select",icon:"select",title:"Box select",active:e.dragMode==="select",onClick:b("select")}),p("lasso",a.lasso)&&y.push({id:"lasso",icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:b("lasso")});const _=[];p("zoomIn",a.zoom)&&_.push({id:"zoomIn",icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),p("zoomOut",a.zoom)&&_.push({id:"zoomOut",icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()});const w=[];p("autoscale",a.autoscale)&&w.push({id:"autoscale",icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),p("reset",a.reset)&&w.push({id:"reset",icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()});const S=[];p("screenshot",a.screenshot)&&S.push({id:"screenshot",icon:"camera",title:"Download plot as PNG",onClick:h});const m=[y,_,w,S].filter(A=>A.length>0),d=m.flat(),x=(t==null?void 0:t.leadingButtons)??[],v=(t==null?void 0:t.sliders)??[];if(!x.length&&d.length===0&&v.length===0)return null;const g=(t==null?void 0:t.position)??"top-right",E=(t==null?void 0:t.visibility)==="always",k=g==="top-right"||g==="bottom-right",M=["cairn-plot-toolbar z-30 rounded border border-border bg-bg-elevated/90 shadow-sm backdrop-blur-sm transition-opacity",E?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),P={position:"absolute",pointerEvents:"auto",...hi[g]};return r?f.jsx("div",{ref:n,style:P,className:`${M} inline-flex px-0.5 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:f.jsx(vi,{actions:d,leading:x,sliders:v})}):f.jsxs("div",{ref:n,style:P,className:`${M} flex flex-col gap-0.5 px-1 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:[f.jsxs("div",{className:`flex items-center gap-0.5 ${k?"justify-end":"justify-start"}`,children:[x.length>0&&f.jsxs(f.Fragment,{children:[x.map(A=>A.menu?f.jsx(gi,{icon:A.icon,title:A.title,menu:A.menu},A.id):f.jsx(Tr,{icon:A.icon,label:A.label,title:A.title,active:A.active,disabled:A.disabled,onClick:A.onClick??(()=>{})},A.id)),m.length>0&&f.jsx(Pr,{})]}),m.map((A,X)=>f.jsxs("span",{className:"inline-flex items-center gap-0.5",children:[X>0&&f.jsx(Pr,{}),A.map(L=>f.jsx(Tr,{icon:L.icon,title:L.title,active:L.active,disabled:L.disabled,onClick:L.onClick},L.id))]},A[0].id))]}),v.length>0&&f.jsx("div",{className:`flex items-center gap-2 ${k?"justify-end":"justify-start"}`,children:v.map(A=>f.jsx(Ar,{spec:A},A.id))})]})}const yi={zoom:1,pan:{x:0,y:0}},Rr=1.3,Ei=.25,_i=64,Mi={buttons:{zoom:!1}};function Si(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const Ti=[{id:"none",label:"None"},{id:"viridis",label:"Viridis"},{id:"plasma",label:"Plasma"},{id:"magma",label:"Magma"},{id:"red-green",label:"Red–Green"},{id:"red-blue",label:"Red–Blue"}];function wn(e,t){return{id:"colormap",title:"Colormap",menu:{options:Ti,value:e,onSelect:t}}}const Cr=[{id:"linear",label:"Linear"},{id:"srgb",label:"sRGB"},{id:"reinhard",label:"Reinhard"},{id:"aces",label:"ACES"}],Pi=[{id:"extended",label:"Extended · Linear"},{id:"extended-reinhard",label:"Extended · Reinhard"},{id:"extended-aces",label:"Extended · ACES"}];function kr(e,t,n){return{id:"tonemap",title:"Tone-mapping operator",menu:{options:n?[...Cr,...Pi]:Cr,value:e,onSelect:t}}}function Ai({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:s,naturalHeight:i,minZoom:c=Ei,maxZoom:a=_i,requestRender:u,onReset:p,extraModified:b=!1}){const h=l.useCallback(E=>{var B;if(!o)return;const k=(B=e.current)==null?void 0:B.getBoundingClientRect(),T=(k==null?void 0:k.width)??0,M=(k==null?void 0:k.height)??0,P=s&&i&&T>0&&M>0?un(s,i,T,M):a,D=Math.max(c,Math.min(P,n*E));if(D===n)return;const R=T/2,A=M/2,X=R-(R-r.x)/n*D,L=A-(A-r.y)/n*D;o({zoom:D,pan:{x:X,y:L}})},[o,e,s,i,a,c,n,r.x,r.y]),y=l.useCallback(()=>h(Rr),[h]),_=l.useCallback(()=>h(1/Rr),[h]),w=l.useCallback(()=>{o==null||o(yi),p==null||p()},[o,p]),S=l.useCallback(E=>{const k={scale:E==null?void 0:E.scale,filename:E==null?void 0:E.filename};u==null||u();const T=t==null?void 0:t.current;if(T)return Mr(T,k);const M=e.current;return M?ai(M,k):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,u]),m=l.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),d=n!==1||r.x!==0||r.y!==0||b,x=l.useCallback(E=>{},[]),v=l.useCallback(E=>{},[]),g=l.useCallback(()=>{},[]);return l.useMemo(()=>({capabilities:m,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:d,setDragMode:x,setHoverMode:v,toggleSpikelines:g,zoomIn:y,zoomOut:_,autoscale:w,reset:w,toPNG:S}),[m,d,x,v,g,y,_,w,S])}const Ri={zoom:1,pan:{x:0,y:0}};function Ft({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:s,pan:i,onViewportChange:c,naturalDims:a,checkerboard:u,wrapperClassName:p,wrapperStyle:b,viewportPadding:h,header:y,surface:_,showAxes:w,overlayNode:S,overlay:m,notationSeed:d,exportCanvasRef:x,requestRender:v,leadingMenus:g,displayAdjust:E,depthSliders:k,extraSliders:T,regionSelect:M,onReset:P,extraModified:D,label:R,showLabelChip:A,isDraggable:X=!1,onDragStart:L,extraChips:B}){const[I,O]=l.useState(d),[q,Z]=l.useState(!1),[be,xe]=l.useState(!1),ee="render"in m?null:m,Pe=!!M&&!!ee,{containerProps:$}=tr({containerRef:r,zoom:s,pan:i,onViewportChange:c,naturalWidth:a==null?void 0:a.w,naturalHeight:a==null?void 0:a.h}),F=l.useCallback(()=>{E==null||E.onExposureChange(0),E==null||E.onOffsetChange(0),P==null||P()},[E,P]),J=l.useCallback(()=>{c==null||c(Ri),F()},[c,F]),oe=Ai({rootRef:r,canvasRef:x,zoom:s,pan:i,onViewportChange:c,naturalWidth:a==null?void 0:a.w,naturalHeight:a==null?void 0:a.h,requestRender:v,onReset:F,extraModified:((E==null?void 0:E.exposureEV)??0)!==0||((E==null?void 0:E.offset)??0)!==0||!!D}),ce=l.useMemo(()=>{const me=[];if(k&&me.push(...k),!E)return T&&me.push(...T),me.length?me:void 0;const we=(fe,ke)=>`${fe>=0?"+":"−"}${Math.abs(fe).toFixed(ke)}`;return me.push({id:"exposure",icon:"sun",label:"EV",title:"Exposure (EV stops) — color × 2^EV. Double-click to type a value (may exceed the slider range).",min:-8,max:8,step:.1,value:E.exposureEV,onChange:E.onExposureChange,format:fe=>we(fe,1)},{id:"offset",icon:"plusminus",label:"OFF",title:"Offset — added after exposure (before tonemap). Double-click to type a value (may exceed the slider range).",min:-1,max:1,step:.01,value:E.offset,onChange:E.onOffsetChange,format:fe=>we(fe,2)}),T&&me.push(...T),me},[E,k,T]),U=l.useMemo(()=>Pe?{id:"region-depth",icon:"select",title:"Select depth from region — drag a rectangle to set the Z window to the samples it covers (Esc to cancel)",active:be,onClick:()=>xe(me=>!me)}:null,[Pe,be]),ne=l.useMemo(()=>({...Mi,leadingButtons:[...g??[],...U?[U]:[],...q?[Si(I,O)]:[]],sliders:ce}),[q,I,g,U,ce]),he=" cairn-checkerboard",ue="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(u==="pane"?he:""),W=p+(u==="wrapper"?he:""),de="render"in m?m.render({notation:I,setOverlayActive:Z}):m.hasSource&&a?f.jsx(ft,{imageElRef:m.displayElRef,naturalWidth:a.w,naturalHeight:a.h,zoom:s,pan:i,sourceWindow:m.sourceWindow,sample:m.sample,notation:I,version:m.version,onActiveChange:Z}):null;return f.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[y,n&&f.jsx(wi,{controller:oe,config:ne}),f.jsxs("div",{ref:r,className:ue,style:{padding:h,...$.style},onPointerDown:$.onPointerDown,onPointerMove:$.onPointerMove,onPointerUp:$.onPointerUp,onPointerCancel:$.onPointerCancel,onDoubleClick:J,...t,children:[f.jsxs("div",{ref:o,className:W,style:b,children:[_,w&&a&&f.jsx(ti,{naturalWidth:a.w,naturalHeight:a.h,zoom:s,containerRef:o}),S]}),de,!n&&q&&f.jsx(rr,{notation:I,onChange:O}),be&&M&&ee&&a&&f.jsx(Ci,{imageElRef:ee.displayElRef,naturalDims:a,sourceWindow:ee.sourceWindow,onQueryLive:M.queryLive,onSelect:(me,we,fe,ke)=>{xe(!1),M.commit(me,we,fe,ke)},onExit:()=>xe(!1)}),!be&&(M==null?void 0:M.rect)&&ee&&a&&f.jsx(Di,{rect:M.rect,imageElRef:ee.displayElRef,naturalDims:a,sourceWindow:ee.sourceWindow,zoom:s,pan:i,onQueryLive:M.queryLive,onCommit:M.commit,onRemove:M.remove})]}),A&&f.jsx(ni,{label:R,isDraggable:X,onDragStart:L}),B]})}function Ci({imageElRef:e,naturalDims:t,sourceWindow:n,onQueryLive:r,onSelect:o,onExit:s}){var S;const i=l.useRef(null),c=l.useRef(null),[a,u]=l.useState(null),p=l.useCallback((m,d,x,v)=>{const g=e.current;return g?yr(m,d,x,v,{box:g.getBoundingClientRect(),naturalWidth:t.w,naturalHeight:t.h,sourceWindow:n}):null},[e,t,n]);l.useEffect(()=>{const m=d=>{d.key==="Escape"&&s()};return window.addEventListener("keydown",m),()=>window.removeEventListener("keydown",m)},[s]);const b=l.useCallback(m=>{var d,x;(x=(d=m.target).setPointerCapture)==null||x.call(d,m.pointerId),c.current={x:m.clientX,y:m.clientY},u({x0:m.clientX,y0:m.clientY,x1:m.clientX,y1:m.clientY})},[]),h=l.useCallback(m=>{const d=c.current;if(!d)return;u({x0:d.x,y0:d.y,x1:m.clientX,y1:m.clientY});const x=p(d.x,d.y,m.clientX,m.clientY);x&&r(x.x0,x.y0,x.x1,x.y1)},[p,r]),y=l.useCallback(m=>{const d=c.current;c.current=null,u(null);const x=e.current;if(!d||!x){s();return}if(Math.abs(m.clientX-d.x)<3&&Math.abs(m.clientY-d.y)<3){s();return}const v=x.getBoundingClientRect(),g=yr(d.x,d.y,m.clientX,m.clientY,{box:v,naturalWidth:t.w,naturalHeight:t.h,sourceWindow:n});if(!g){s();return}o(g.x0,g.y0,g.x1,g.y1)},[e,t,n,o,s]),_=(S=i.current)==null?void 0:S.getBoundingClientRect(),w=a&&_?{left:Math.min(a.x0,a.x1)-_.left,top:Math.min(a.y0,a.y1)-_.top,width:Math.abs(a.x1-a.x0),height:Math.abs(a.y1-a.y0)}:null;return f.jsx("div",{ref:i,className:"absolute inset-0 z-20",style:{cursor:"crosshair",touchAction:"none"},onPointerDown:b,onPointerMove:h,onPointerUp:y,children:w&&f.jsx("div",{className:"absolute border-2 border-dashed border-sky-400 bg-sky-400/15 pointer-events-none",style:w})})}const ki={nw:{cursor:"nwse-resize",fx:0,fy:0},n:{cursor:"ns-resize",fx:.5,fy:0},ne:{cursor:"nesw-resize",fx:1,fy:0},e:{cursor:"ew-resize",fx:1,fy:.5},se:{cursor:"nwse-resize",fx:1,fy:1},s:{cursor:"ns-resize",fx:.5,fy:1},sw:{cursor:"nesw-resize",fx:0,fy:1},w:{cursor:"ew-resize",fx:0,fy:.5}};function Di({rect:e,imageElRef:t,naturalDims:n,sourceWindow:r,zoom:o,pan:s,onQueryLive:i,onCommit:c,onRemove:a}){const u=l.useRef(null),[p,b]=l.useState(null),h=l.useRef(null),[y,_]=l.useState(null),w=p??e;l.useLayoutEffect(()=>{const x=()=>{const E=t.current,k=u.current;if(!E||!k)return;const T=E.getBoundingClientRect(),M=k.getBoundingClientRect(),P=Qs(w,{box:T,naturalWidth:n.w,naturalHeight:n.h,sourceWindow:r});_({left:P.left-M.left,top:P.top-M.top,width:P.width,height:P.height})};x();const v=t.current;if(!v||typeof ResizeObserver>"u")return;const g=new ResizeObserver(x);return g.observe(v),()=>g.disconnect()},[w,n.w,n.h,r,o,s.x,s.y]);const S=l.useCallback(x=>v=>{var g,E;v.stopPropagation(),(E=(g=v.target).setPointerCapture)==null||E.call(g,v.pointerId),h.current={handle:x,sx:v.clientX,sy:v.clientY,start:w},b(w)},[w]),m=l.useCallback(x=>{const v=h.current,g=t.current;if(!v||!g)return;const E=js({box:g.getBoundingClientRect(),naturalWidth:n.w,naturalHeight:n.h,sourceWindow:r}),k=(x.clientX-v.sx)/(E||1),T=(x.clientY-v.sy)/(E||1),M=ei(v.start,v.handle,k,T,{w:n.w,h:n.h},1);b(M),i(M.x0,M.y0,M.x1,M.y1)},[t,n.w,n.h,r,i]),d=l.useCallback(()=>{const x=h.current;h.current=null;const v=p;b(null),x&&v&&c(v.x0,v.y0,v.x1,v.y1)},[p,c]);return y?f.jsxs("div",{ref:u,className:"absolute inset-0 z-20 pointer-events-none",style:{touchAction:"none"},children:[f.jsx("div",{className:"absolute border-2 border-sky-400 bg-sky-400/10 pointer-events-auto",style:{...y,cursor:"move",touchAction:"none"},onPointerDown:S("move"),onPointerMove:m,onPointerUp:d}),Js.map(x=>{const v=ki[x];return f.jsx("div",{className:"absolute pointer-events-auto flex items-center justify-center",style:{left:y.left+v.fx*y.width-12,top:y.top+v.fy*y.height-12,width:24,height:24,cursor:v.cursor,touchAction:"none"},onPointerDown:S(x),onPointerMove:m,onPointerUp:d,children:f.jsx("div",{className:"w-2.5 h-2.5 rounded-sm bg-sky-400 border border-white/80"})},x)}),f.jsx("button",{type:"button","aria-label":"Remove depth region",title:"Remove region (reset the depth window)",className:"absolute pointer-events-auto flex items-center justify-center rounded-full text-white",style:{left:y.left+y.width-8,top:y.top-32,width:40,height:40},onPointerDown:x=>x.stopPropagation(),onClick:a,children:f.jsx("span",{className:"flex items-center justify-center w-5 h-5 rounded-full bg-slate-800/90 border border-white/70 text-[11px] leading-none",children:"×"})})]}):f.jsx("div",{ref:u,className:"absolute inset-0 z-20 pointer-events-none"})}const yn={inFlight:!1,pending:null};function Dr(e,t){return e.inFlight?{state:{inFlight:!0,pending:t},launch:null}:{state:{inFlight:!0,pending:null},launch:t}}function Lr(e){return e.pending!=null?{state:{inFlight:!0,pending:null},launch:e.pending}:{state:yn,launch:null}}const Li=1e3,Bi=typeof requestAnimationFrame=="function"?e=>requestAnimationFrame(()=>e()):e=>setTimeout(e,0),Br=typeof cancelAnimationFrame=="function"?cancelAnimationFrame:e=>clearTimeout(e);function Or(e,t){const n=e.deep,r=(n==null?void 0:n.zMin)??0,o=(n==null?void 0:n.zMax)??0,s=t!=null,[i,c,a]=lt(r),[u,p,b]=lt(o),[h,y]=l.useState(null),[_,w]=l.useState(null),S=l.useRef(n);S.current=n;const m=l.useRef(r);m.current=r;const d=l.useRef(o);d.current=o;const x=l.useRef(i);x.current=i;const v=l.useRef(u);v.current=u;const g=l.useRef({near:i,far:u,ver:0}),E=l.useRef(0),k=l.useRef(!0),T=l.useRef(yn),M=l.useRef(null),P=c,D=p,R=l.useCallback(()=>{const $=S.current;if(!$)return;const{near:F,far:J,ver:oe}=g.current,ce=()=>{const U=Lr(T.current);T.current=U.state,U.launch!=null&&R()};$.flatten(F,J).then(U=>{g.current.ver===oe&&!k.current&&(M.current!=null&&Br(M.current),M.current=Bi(()=>{M.current=null,y(U)})),ce()}).catch(ce)},[]),A=l.useCallback(()=>{const $=Dr(T.current,1);T.current=$.state,$.launch!=null&&R()},[R]);l.useEffect(()=>()=>{M.current!=null&&Br(M.current),n==null||n.dispose()},[n]),l.useEffect(()=>{if(!n)return;const $=i<=r&&u>=o;if(k.current=$,E.current+=1,g.current={near:i,far:u,ver:E.current},s){t(i,u);return}if($){y(null);return}A()},[n,i,u,r,o,A,s,t]);const X=l.useMemo(()=>n&&!s&&h!=null?{...e,data:h}:e,[e,n,s,h]),L=n!=null&&r>0&&o/r>Li,B=l.useMemo(()=>{if(!n||!(o>r))return;const $=J=>Math.abs(J)>=1e3||Math.abs(J)<.01&&J!==0?J.toExponential(2):J.toFixed(3),F=(J,oe,ce,U,ne)=>{if(L){const he=Math.log10(r),ue=Math.log10(o);return{id:J,icon:"layers",label:oe,title:`${ce} (log scale). Double-click to type a Z.`,min:he,max:ue,step:(ue-he)/200,value:Math.log10(Math.max(r,Math.min(U,o))),onChange:W=>ne(10**W),format:W=>$(10**W)}}return{id:J,icon:"layers",label:oe,title:`${ce}. Double-click to type a Z.`,min:r,max:o,step:(o-r)/200,value:U,onChange:ne,format:$}};return[F("depth-near","ZN","Depth window NEAR — composite only samples with Z ≥ this",i,P),F("depth-far","ZF","Depth window FAR — composite only samples with Z ≤ this",u,D)]},[n,r,o,i,u,L,P,D]),I=l.useCallback($=>{if($.count===0){const oe=m.current,ce=d.current,U=ce>oe?0:1;c(ce+U),p(oe-U);return}const F=d.current-m.current,J=Math.max(Math.abs(F)*1e-4,1e-4);c($.zMin-J),p($.zMax+J)},[c,p]),O=l.useRef(null),q=l.useRef(yn),Z=l.useCallback(()=>{const $=S.current,F=O.current,J=()=>{const oe=Lr(q.current);q.current=oe.state,oe.launch!=null&&Z()};if(!$||!F){J();return}$.zRangeInRect(F.x0,F.y0,F.x1,F.y1).then(oe=>{I(oe),J()}).catch(J)},[I]),be=l.useCallback(($,F,J,oe)=>{O.current={x0:$,y0:F,x1:J,y1:oe};const ce=Dr(q.current,1);q.current=ce.state,ce.launch!=null&&Z()},[Z]),xe=l.useCallback(($,F,J,oe)=>{w({x0:$,y0:F,x1:J,y1:oe}),be($,F,J,oe)},[be]),ee=l.useCallback(()=>{w(null),a.reset(),b.reset(),y(null)},[a,b]),Pe=l.useCallback(()=>{a.reset(),b.reset(),w(null),y(null)},[a,b]);return{hdr:X,sliders:B,hasDeep:n!=null,region:_,queryRegionWindow:be,commitRegion:xe,removeRegion:ee,reset:Pe,isModified:a.isModified||b.isModified}}function Ir(e){return"hdr"in e&&e.hdr!=null}function Nr(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function Oe(e){return Number.isFinite(e)?e:0}const Oi={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Ii(e,t,n,r,o=0){const{h:s,w:i,c}=Nr(e.shape),a=e.precision==="f16-bits"?Kn(e.data):e.data,u=es(t),p=new Uint8ClampedArray(i*s*4);for(let b=0;b<i*s;b++){const h=b*c;let y,_,w,S=1;c===1?y=_=w=Oe(a[h]):c===3?(y=Oe(a[h]),_=Oe(a[h+1]),w=Oe(a[h+2])):(y=Oe(a[h]),_=Oe(a[h+1]),w=Oe(a[h+2]),S=Oe(a[h+3]));const m=[At(y,n,o),At(_,n,o),At(w,n,o)],[d,x,v]=u(m),g=b*4;p[g]=255*nn(d,r),p[g+1]=255*nn(x,r),p[g+2]=255*nn(v,r),p[g+3]=255*(S<0?0:S>1?1:S)}return new ImageData(p,i,s)}function Ni(e){var Qe,Fe;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:s="auto",colormap:i="none",showAxes:c=!1,processing:a=Oi,zoom:u=1,pan:p={x:0,y:0},onViewportChange:b,onNaturalSize:h,label:y,isDraggable:_=!1,onDragStart:w,overlay:S,overlaySettings:m,pixelValueNotation:d="decimal",toolbar:x=!0}=e,[v,g,E]=lt(i);l.useEffect(()=>{g(i)},[i,g]);const k=l.useRef(null),T=l.useRef(null),M=l.useRef(null),P=l.useRef(null),D=l.useRef(null),R=l.useRef(null),A=l.useRef(null),[X,L]=l.useState(0),B=l.useCallback(()=>L(V=>V+1),[]),I=l.useMemo(()=>({get current(){const V=D.current;return V instanceof HTMLCanvasElement?V:null}}),[]),O=l.useCallback(V=>{k.current=V,V&&(D.current=V)},[]),q=l.useCallback(V=>{T.current=V,V&&(D.current=V)},[]),Z=l.useCallback(V=>{V&&(D.current=V)},[]),[be,xe]=l.useState(!1),[ee,Pe]=l.useState(!1),[$,F]=l.useState(null),{flipSign:J}=a,{gammaFilterId:oe,filterStr:ce,gamma:U,offset:ne}=xr(a),he=!r&&o!=="none"&&n!=null&&t!=null,ue=o!=="none"&&n!=null,W=v!=="none"&&!he&&!(r&&ue)&&t!=null;l.useEffect(()=>{if(!W||!t){Pe(!1);return}let V=!1;Pe(!1);const ge=`${t}::${v}`,_e=sn(ge);if(_e){const ie=T.current;if(ie){ie.width=_e.width,ie.height=_e.height;const ve=ie.getContext("2d");ve&&ve.putImageData(_e,0,0),A.current=_e,B(),F({w:_e.width,h:_e.height}),h==null||h(_e.width,_e.height),Pe(!0)}return}const Me=new Image;return Me.onload=()=>{if(V)return;const ie=document.createElement("canvas");ie.width=Me.naturalWidth,ie.height=Me.naturalHeight;const ve=ie.getContext("2d");if(!ve)return;ve.drawImage(Me,0,0);const Ue=ve.getImageData(0,0,ie.width,ie.height),ze=on(v),Se=rn(Ue,v,ze);an(ge,Se);const Ie=T.current;if(!Ie||V)return;Ie.width=Se.width,Ie.height=Se.height;const Re=Ie.getContext("2d");Re&&Re.putImageData(Se,0,0),A.current=Se,B(),F({w:Se.width,h:Se.height}),h==null||h(Se.width,Se.height),Pe(!0)},Me.src=t,()=>{V=!0}},[W,t,v]);const de=l.useCallback((V,ge)=>{F(_e=>_e&&_e.w===V&&_e.h===ge?_e:{w:V,h:ge}),h==null||h(V,ge)},[]);l.useEffect(()=>{if(!t){R.current=null,A.current=null,B();return}let V=!1;return at(t).then(ge=>{V||(R.current=ge,v==="none"&&(A.current=ge),B())}),()=>{V=!0}},[t,v,B]);const me=l.useCallback((V,ge,_e)=>{const Me=R.current;if(!Me||V<0||ge<0||V>=Me.width||ge>=Me.height)return null;const ie=(ge*Me.width+V)*4,ve=Me.data[ie],Ue=Me.data[ie+1],ze=Me.data[ie+2],Se=A.current;let Ie=ve,Re=Ue,G=ze;if(Se&&Se.width===Me.width&&Se.height===Me.height){const N=(ge*Se.width+V)*4;Ie=Se.data[N],Re=Se.data[N+1],G=Se.data[N+2]}const H=(.299*Ie+.587*Re+.114*G)/255;return ut(v!=="none"||ve===Ue&&Ue===ze?[ve]:[ve,Ue,ze],"uint8",_e,H)},[v]);l.useEffect(()=>{if(!he){xe(!1);return}let V=!1;const ge=ms(),_e=ge==="gpu"||ge==="auto",Me=`${n}::${t}::${o}::${v}`;if(ge!=="gpu"){const ie=sn(Me);if(ie){const ve=k.current;if(ve){(ve.width!==ie.width||ve.height!==ie.height)&&(ve.width=ie.width,ve.height=ie.height);const Ue=ve.getContext("2d");Ue&&Ue.putImageData(ie,0,0),de(ie.width,ie.height),xe(!0)}return}}return(async()=>{const[ie,ve]=await Promise.all([at(n),at(t)]);if(V||!ie||!ve)return;const ze=o.includes("signed")?"signed":"positive",Se=v!=="none"?Qt(v):null,Ie={diffMode:o,colormap:Se,cmapMode:ze};if(_e)try{const te=k.current;if(te){const N=ps(ie,ve,Ie,te);if(N){if(V)return;de(N.width,N.height),xe(!0);return}}}catch(te){console.warn("[cairn] WebGL 2 diff error:",te)}if(ge==="gpu"){console.error("[cairn] WebGL 2 unavailable — set render mode to 'Auto' or 'CPU'");return}let Re=is(ie,ve,o);v!=="none"&&(Re=rn(Re,v,ze)),an(Me,Re);const G=k.current;if(!G||V)return;(G.width!==Re.width||G.height!==Re.height)&&(G.width=Re.width,G.height=Re.height);const H=G.getContext("2d");H&&H.putImageData(Re,0,0),de(Re.width,Re.height),xe(!0)})(),()=>{V=!0}},[n,t,o,he,v,h]);const we=s==="auto"?void 0:s,fe=J?{filter:"invert(1)"}:{},ke=S&&(m!=null&&m.enabled)&&$&&t&&((((Qe=S.boxes)==null?void 0:Qe.length)??0)>0||(((Fe=S.masks)==null?void 0:Fe.length)??0)>0)?f.jsx(dn,{data:S,settings:m,naturalWidth:$.w,naturalHeight:$.h}):void 0,$e=t?he?f.jsxs(f.Fragment,{children:[!be&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),f.jsx("canvas",{ref:O,className:"w-full h-full object-contain block",style:{display:be?"block":"none",imageRendering:we,...fe}})]}):W?f.jsxs(f.Fragment,{children:[!ee&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),f.jsx("canvas",{ref:q,className:"w-full h-full object-contain block",style:{display:ee?"block":"none",imageRendering:we,...fe}})]}):f.jsx("img",{ref:Z,src:t,alt:y,className:"w-full h-full object-contain block",draggable:!1,style:{filter:ce,imageRendering:we},onLoad:V=>{const ge=V.currentTarget;F({w:ge.naturalWidth,h:ge.naturalHeight}),h==null||h(ge.naturalWidth,ge.naturalHeight)}}):f.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return f.jsx(Ft,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:x,paneRef:M,wrapperRef:P,zoom:u,pan:p,onViewportChange:b,naturalDims:$,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${p.x}px, ${p.y}px) scale(${u})`,transformOrigin:"0 0"},viewportPadding:c&&$?"16px 4px 4px 28px":"4px",header:f.jsx(br,{id:oe,gamma:U,offset:ne}),surface:$e,showAxes:c,overlayNode:ke,overlay:{displayElRef:D,sample:me,version:X,hasSource:!!t},notationSeed:d,exportCanvasRef:I,leadingMenus:[wn(v,V=>g(V))],onReset:E.reset,extraModified:E.isModified,label:y,showLabelChip:!!y,isDraggable:_,onDragStart:w})}function Fi(e){const{tonemap:t="srgb",exposure:n=0,gamma:r,showAxes:o=!1,label:s="",interpolation:i="auto",zoom:c=1,pan:a={x:0,y:0},onViewportChange:u,pixelValueNotation:p="decimal",toolbar:b=!0}=e,h=Or(e.hdr),y=h.hdr,[_,w,S]=lt(tn(t));l.useEffect(()=>{w(tn(t))},[t,w]);const m=l.useRef(null),d=l.useRef(null),x=l.useRef(null),[v,g]=l.useState(null),E=l.useRef(null),[k,T]=l.useState(0),[M,P]=l.useState(0),[D,R]=l.useState(0);l.useEffect(()=>{const L=m.current;if(!L)return;let B;try{B=Ii(y,_,n+M,r,D)}catch(O){console.error("[cairn] HDR tone-map error:",O);return}(L.width!==B.width||L.height!==B.height)&&(L.width=B.width,L.height=B.height);const I=L.getContext("2d");I&&(I.putImageData(B,0,0),E.current=B,T(O=>O+1),g(O=>O&&O.w===B.width&&O.h===B.height?O:{w:B.width,h:B.height}))},[y,_,n,r,M,D]);const A=l.useCallback((L,B,I)=>{const O=v;if(!O||L<0||B<0||L>=O.w||B>=O.h)return null;const q=y.shape.length===2?1:y.shape[2]??1,Z=(B*O.w+L)*q,be=y.data,xe=y.precision==="f16-bits"?F=>kt(be[F]??0):F=>be[F]??0,ee=E.current;let Pe=.5;if(ee&&ee.width===O.w&&ee.height===O.h){const F=(B*O.w+L)*4;Pe=(.299*ee.data[F]+.587*ee.data[F+1]+.114*ee.data[F+2])/255}const $=q===1?[xe(Z)]:[xe(Z),xe(Z+1),xe(Z+2)];return ut($,"unit",I,Pe)},[y,v]),X=i==="auto"?void 0:i;return f.jsx(Ft,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:b,paneRef:d,wrapperRef:x,zoom:c,pan:a,onViewportChange:u,naturalDims:v,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${a.x}px, ${a.y}px) scale(${c})`,transformOrigin:"0 0"},viewportPadding:o&&v?"16px 4px 4px 28px":"4px",surface:f.jsx("canvas",{ref:m,className:"w-full h-full object-contain block",style:{imageRendering:X}}),showAxes:o,overlay:{displayElRef:m,sample:A,version:k,hasSource:!0},notationSeed:p,exportCanvasRef:m,leadingMenus:[kr(_,L=>w(L),!1)],displayAdjust:{exposureEV:M,offset:D,onExposureChange:P,onOffsetChange:R},depthSliders:h.sliders,regionSelect:h.hasDeep?{rect:h.region,queryLive:h.queryRegionWindow,commit:h.commitRegion,remove:h.removeRegion}:void 0,onReset:()=>{h.reset(),S.reset()},extraModified:h.isModified||S.isModified,label:s,showLabelChip:!!s})}function En(e){return Ir(e)?f.jsx(Fi,{...e}):f.jsx(Ni,{...e})}const Fr={"no-webgpu":0,"no-hdr-browser":1,"no-hdr-display":2},Ui="https://github.com/doeringchristian/cairn-plot/blob/main/docs/browser-support.md";function Gi(e,t=!1){const n=e||"";return t?"brave":/firefox/i.test(n)?"firefox":/safari/i.test(n)&&!/chrome|chromium|crios|android/i.test(n)?"safari":/linux/i.test(n)&&/chrome|chromium/i.test(n)?"chromium-linux":"chromium"}function zi(e){const t=e||"";return/mac os x|macintosh/i.test(t)?"macos":/windows/i.test(t)?"windows":"other"}function Vi(e,t){if(e==="no-hdr-display")switch(zi(t.userAgent)){case"macos":return"macOS: EDR engages automatically on HDR-capable displays — confirm your display supports HDR.";case"windows":return"Windows: turn on Settings → System → Display → Use HDR.";default:return"Enable HDR in your display and OS settings."}const n=Gi(t.userAgent,t.isBrave);if(e==="no-hdr-browser")switch(n){case"firefox":return"Firefox has no extended-tone-mapping canvas path at all — true HDR output is impossible until Firefox implements it (fundamental browser limitation).";case"safari":return"Safari's WebGPU HDR canvas tone-mapping is still maturing — update to the latest Safari 26+.";default:return"Chrome/Edge 129+ is required for HDR canvas output (toneMapping: extended) — update your browser."}switch(n){case"firefox":return"Firefox: about:config → dom.webgpu.enabled (HDR output is not available in Firefox at all — browser limitation).";case"safari":return"Safari: Develop → Feature Flags → WebGPU (Safari 26+ has it by default).";case"brave":return"Brave: check Shields fingerprint blocking + brave://flags.";case"chromium-linux":return"Chromium on Linux: enable chrome://flags/#enable-unsafe-webgpu.";case"chromium":default:return"Chrome/Edge: enable chrome://flags/#enable-unsafe-webgpu and hardware acceleration."}}function $i(e){switch(e){case"no-webgpu":return"GPU renderer unavailable → CPU fallback active; FLIP kernels + HDR compare disabled.";case"no-hdr-browser":return"True HDR output is unsupported by this browser — a fundamental browser limitation, not a cairn-plot bug → HDR images tone-mapped to SDR.";case"no-hdr-display":return"Your display/OS is not in HDR mode → HDR images tone-mapped to SDR."}}function Ur(e,t){return`cairn-plot:capnotice:${e}:${t}`}const Gr=new Set;function zr(e){try{if(window.localStorage.getItem(e)==="1")return!0}catch{}try{if(window.sessionStorage.getItem(e)==="1")return!0}catch{}return Gr.has(e)}function Xi(e){try{window.localStorage.setItem(e,"1");return}catch{}try{window.sessionStorage.setItem(e,"1");return}catch{}Gr.add(e)}const Vr=new Set;let Ut=null,xt=null;function $r(){xt&&xt.parentNode&&xt.parentNode.removeChild(xt),xt=null,Ut=null}function Wi(e){const t=Ur(e,window.location.pathname),n=Vi(e,{userAgent:navigator.userAgent,isBrave:!!navigator.brave}),r=document.createElement("div");r.setAttribute("role","status"),r.setAttribute("data-cairn-plot-capnotice",e),Object.assign(r.style,{position:"fixed",bottom:"12px",right:"12px",zIndex:"2147483000",maxWidth:"340px",boxSizing:"border-box",padding:"10px 30px 10px 12px",borderRadius:"6px",border:"1px solid var(--color-border, #d0d7de)",background:"rgb(var(--color-bg-elevated-rgb, 246 248 250) / 0.9)",color:"var(--color-fg-muted, #656d76)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",boxShadow:"0 4px 12px rgba(0, 0, 0, 0.18)",font:"12px/1.4 system-ui, sans-serif"});const o=document.createElement("div");o.textContent=$i(e),Object.assign(o.style,{fontWeight:"600",color:"var(--color-fg, #1f2328)",marginBottom:"4px"});const s=document.createElement("div");s.textContent=n,s.style.marginBottom="4px";const i=document.createElement("a");i.href=Ui,i.target="_blank",i.rel="noopener noreferrer",i.textContent="Learn more",Object.assign(i.style,{color:"var(--color-accent, #0969da)",textDecoration:"none"});const c=document.createElement("button");c.type="button",c.textContent="×",c.setAttribute("aria-label","Dismiss browser capability notice"),c.title="Dismiss",Object.assign(c.style,{position:"absolute",top:"4px",right:"6px",padding:"0 4px",border:"0",background:"transparent",color:"var(--color-fg-subtle, #8b949e)",cursor:"pointer",fontSize:"16px",lineHeight:"1"}),c.addEventListener("click",()=>{Xi(t),$r()}),r.appendChild(o),r.appendChild(s),r.appendChild(i),r.appendChild(c),document.body.appendChild(r),xt=r,Ut=e}function Xr(e){if(typeof document>"u"||typeof window>"u"||Vr.has(e))return;Vr.add(e);const t=Ur(e,window.location.pathname);if(zr(t))return;const n=()=>{if(!zr(t)){if(Ut!==null)if(Fr[e]<Fr[Ut])$r();else return;Wi(e)}};document.body?n():window.addEventListener("DOMContentLoaded",n,{once:!0})}const Yi={data:new Float32Array(0),shape:[0,0],dtype:"<f4"};function Hi(e){const{h:t,w:n,c:r}=Nr(e.shape);if(e.precision==="f16-bits"){const i=e.data,c=new Uint16Array(n*t*4);for(let a=0;a<n*t;a++){const u=a*r,p=a*4;if(r===1){const b=i[u];c[p]=b,c[p+1]=b,c[p+2]=b,c[p+3]=Ct}else c[p]=i[u],c[p+1]=i[u+1],c[p+2]=i[u+2],c[p+3]=r>=4?i[u+3]:Ct}return{data:c,width:n,height:t,format:"rgba16float"}}const o=e.data,s=new Float32Array(n*t*4);for(let i=0;i<n*t;i++){const c=i*r;let a,u,p,b=1;r===1?a=u=p=Oe(o[c]):r===3?(a=Oe(o[c]),u=Oe(o[c+1]),p=Oe(o[c+2])):(a=Oe(o[c]),u=Oe(o[c+1]),p=Oe(o[c+2]),b=Oe(o[c+3]));const h=i*4;s[h]=a,s[h+1]=u,s[h+2]=p,s[h+3]=b}return{data:s,width:n,height:t,format:"rgba32float"}}function Wr(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),s=n*o,i=r*o,c=(t.width-s)/2,a=(t.height-i)/2,u=Math.max(e.zoom,1e-6),p=t.width/(u*s),b=t.height/(u*i),h=-c/s-e.pan.x/(u*s),y=-a/i-e.pan.y/(u*i);return{x:h,y,w:p,h:b}}function Yr(e,t,n,r){const o=e.w*n,s=e.h*r;return o<=0||s<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/s)}function Ki(e){var Se,Ie,Re;const t=Ir(e),n=l.useRef(null),r=l.useRef(null),o=l.useRef(null),s=l.useRef(null),i=l.useRef(null),c=t&&!!((Se=e.hdr)!=null&&Se.deep),a=l.useCallback((G,H)=>{var te,N;(te=s.current)==null||te.setDeepWindow(G,H),(N=i.current)==null||N.call(i)},[]),u=Or(t?e.hdr:Yi,c?a:void 0),p=l.useRef(!1),[b,h]=l.useState(!1),[y,_]=l.useState(!1),[w,S]=l.useState(!1),[m,d]=l.useState(null),[x,v]=l.useState(0),[g,E]=l.useState(0),[k,T]=l.useState({x:0,y:0,w:1,h:1}),M=l.useRef(null),P=l.useRef(null),[D,R]=l.useState(0),A=e.zoom??1,X=e.pan??{x:0,y:0},L=e.onViewportChange,B=t?"none":e.colormap??"none",[I,O]=l.useState(B);l.useEffect(()=>{O(B)},[B]);const q=t?"none":I,Z=l.useRef(B),be=l.useCallback(()=>{O(Z.current)},[]),xe=t?e.tonemap:void 0,[ee,Pe]=l.useState(null);l.useEffect(()=>{Pe(null)},[xe]);const $=ts(xe,b),F=ee??$,J=ee!==null&&ee!==$,oe=l.useCallback(()=>Pe(null),[]),[ce,U]=l.useState(Pt),ne=ce!==Pt,he=l.useCallback(()=>U(Pt),[]),[ue,W]=l.useState(0),[de,me]=l.useState(0),we=fn();l.useEffect(()=>{const G=n.current;if(!G)return;let H=!1;return Tt().then(te=>{var Te;if(H)return;const N=((Te=te.probeExtendedToneMapping)==null?void 0:Te.call(te))??!1,le=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,j=N&&le&&t;p.current=j,h(j),t&&!j&&Xr(N?"no-hdr-display":"no-hdr-browser"),Ks(G,{hdr:j}).then(De=>{if(H){gr(De);return}s.current=De,S(!0)}).catch(De=>{H||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",De),_(!0))})}).catch(te=>{H||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",te),_(!0))}),()=>{H=!0,s.current&&(gr(s.current),s.current=null)}},[]),l.useEffect(()=>{const G=r.current;if(!G)return;const H=new ResizeObserver(()=>E(te=>te+1));return H.observe(G),()=>H.disconnect()},[]),l.useEffect(()=>{const G=r.current;if(!G)return;const H=new IntersectionObserver(te=>{const N=te[0];if(!N)return;const le=s.current;le&&(le.setVisible(N.isIntersecting),N.isIntersecting?le.isParked&&(le.restore(),E(j=>j+1)):le.park())},{threshold:0});return H.observe(G),()=>H.disconnect()},[]),l.useEffect(()=>{var te;if(!t||!w||c)return;const G=u.hdr;M.current=G;const H=Hi(G);(te=s.current)==null||te.setSource(H),d(N=>N&&N.w===H.width&&N.h===H.height?N:{w:H.width,h:H.height}),R(N=>N+1),v(N=>N+1)},[t,w,c,t?u.hdr:null]),l.useEffect(()=>{if(!t||!w||!c)return;const G=e.hdr,H=G.deep;M.current=G;let te=!1;return H.getGpuCsr().then(N=>{var le;te||((le=s.current)==null||le.setDeepSource(N,H.zMin,H.zMax),d(j=>j&&j.w===N.width&&j.h===N.height?j:{w:N.width,h:N.height}),R(j=>j+1),v(j=>j+1))}).catch(N=>{te||console.warn("[cairn] deep GPU CSR upload failed:",N)}),()=>{te=!0}},[t,w,c,t?e.hdr.deep:null]),l.useEffect(()=>{if(t||!w)return;const G=e,H=G.imageUrl,te=I;if(!H){P.current=null,d(null),R(le=>le+1);return}let N=!1;return at(H).then(le=>{var De,nt;if(N||!le)return;let j=le;if(te!=="none"){const Ae=`gpu::${H}::${te}::ev${ue}::off${de}`,Le=sn(Ae);if(Le)j=Le;else{const We=on(te);j=rn(le,te,We,ue,de),an(Ae,j)}}P.current=le;const Te={data:j.data,width:j.width,height:j.height,format:"rgba8unorm"};(De=s.current)==null||De.setSource(Te),d(Ae=>Ae&&Ae.w===j.width&&Ae.h===j.height?Ae:{w:j.width,h:j.height}),(nt=G.onNaturalSize)==null||nt.call(G,j.width,j.height),R(Ae=>Ae+1),v(Ae=>Ae+1)}),()=>{N=!0}},[t,w,t?null:e.imageUrl,t?null:I,t?0:ue,t?0:de]);const fe=t?e.exposure??0:0,ke=t?e.gamma:void 0,$e=l.useCallback(()=>{const G=s.current;if(!G||!w||!m)return;const H=r.current,te=o.current,N=te?te.getBoundingClientRect():H?H.getBoundingClientRect():{width:m.w,height:m.h},le=Wr({zoom:A,pan:X},N,m.w,m.h);T(Ae=>Ae.x===le.x&&Ae.y===le.y&&Ae.w===le.w&&Ae.h===le.h?Ae:le),N.width>0&&N.height>0&&G.resize(Math.round(N.width*we),Math.round(N.height*we));const j=Yr(le,N,m.w,m.h)>=pn?"nearest":"linear",Te=le,De=p.current&&zn(F),nt=t?{exposureEV:fe+ue,offset:de,operator:F,gamma:ke,isScalar:!1,hdrOut:De,peak:ce,uv:Te,filter:j}:{exposureEV:q!=="none"?0:ue,offset:q!=="none"?0:de,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:Te,filter:j};try{G.render(nt)||_(!0)}catch(Ae){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",Ae),_(!0)}},[w,m,A,X.x,X.y,fe,ue,de,F,ce,ke,t,q,we]);i.current=$e,l.useEffect(()=>{$e()},[$e,x,g]);const Qe=l.useCallback((G,H,te)=>{if(t){const Le=M.current,We=m;if(!Le||!We||G<0||H<0||G>=We.w||H>=We.h)return null;const pt=Le.shape.length===2?1:Le.shape[2]??1,Be=(H*We.w+G)*pt,bt=Le.data,Ye=Le.precision==="f16-bits"?ht=>kt(bt[ht]??0):ht=>bt[ht]??0,Yt=.5,vt=pt===1?[Ye(Be)]:[Ye(Be),Ye(Be+1),Ye(Be+2)];return ut(vt,"unit",te,Yt)}const N=P.current;if(!N||G<0||H<0||G>=N.width||H>=N.height)return null;const le=(H*N.width+G)*4,j=N.data[le],Te=N.data[le+1],De=N.data[le+2],nt=(.299*j+.587*Te+.114*De)/255;return ut(q!=="none"||j===Te&&Te===De?[j]:[j,Te,De],"uint8",te,nt)},[t,m,q]),Fe=e.showAxes??!1,V=t?e.label??"":e.label,ge=e.interpolation??"auto",_e=ge==="auto"?void 0:ge,Me=t?void 0:e.overlay,ie=t?void 0:e.overlaySettings,ve=t?!1:e.isDraggable??!1,Ue=t?void 0:e.onDragStart;if(y)return t?f.jsx(En,{...e}):f.jsx(En,{...e});const ze=Me&&(ie!=null&&ie.enabled)&&m&&((((Ie=Me.boxes)==null?void 0:Ie.length)??0)>0||(((Re=Me.masks)==null?void 0:Re.length)??0)>0)?f.jsx(dn,{data:Me,settings:ie,naturalWidth:m.w,naturalHeight:m.h}):void 0;return f.jsx(Ft,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":w},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:r,wrapperRef:o,zoom:A,pan:X,onViewportChange:L,naturalDims:m,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:Fe&&m?"16px 4px 4px 28px":0,surface:f.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:_e},"data-gpu-image-canvas":!0}),showAxes:Fe,overlayNode:ze,overlay:{displayElRef:n,sample:Qe,version:D,hasSource:!0,sourceWindow:k},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:$e,leadingMenus:t?[kr(F,G=>Pe(G),b)]:[wn(q,G=>O(G))],displayAdjust:{exposureEV:ue,offset:de,onExposureChange:W,onOffsetChange:me},extraSliders:t&&Jo(F)?[{id:"peak",label:"PK",title:"Peak white (×SDR white) — HDR roll-off shoulder for the extended Reinhard/ACES operators. Double-click to type a value.",min:Ho,max:Ko,step:qo,value:ce,onChange:U,format:G=>`${G.toFixed(1)}×`}]:void 0,depthSliders:u.sliders,regionSelect:c?{rect:u.region,queryLive:u.queryRegionWindow,commit:u.commitRegion,remove:u.removeRegion}:void 0,onReset:()=>{be(),oe(),he(),u.reset()},extraModified:I!==Z.current||J||ne||u.isModified,label:V,showLabelChip:!!V,isDraggable:ve,onDragStart:Ue})}const Gt=new Map;function Ze(e){if(Gt.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);Gt.set(e.id,e)}function it(e){return Gt.get(e)}function qi(){return Array.from(Gt.values())}function Hr(e,t){return{...e.params??{},...t??{}}}const Zi={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},ji={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},Qi={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},Ji={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},ea={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},ta={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},Kr=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];ra(Kr);const _n=[1.052156925,1,.91835767],na=.7;function ra(e){const[t,n,r]=e[0],[o,s,i]=e[1],[c,a,u]=e[2],p=s*u-i*a,b=-(o*u-i*c),h=o*a-s*c,_=1/(t*p+n*b+r*h);return[[p*_,-(n*u-r*a)*_,(n*i-r*s)*_],[b*_,(t*u-r*c)*_,-(t*i-r*o)*_],[h*_,-(t*a-n*c)*_,(t*s-n*o)*_]]}function oa(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const Mn=6/29;function Sn(e){return e>Mn**3?Math.cbrt(e):e/(3*Mn*Mn)+4/29}function qr(e,t,n){const[r,o,s]=oa(Kr,e,t,n),i=Sn(r*_n[0]),c=Sn(o*_n[1]),a=Sn(s*_n[2]),u=116*c-16,p=500*(i-c),b=200*(c-a);return[u,.01*u*p,.01*u*b]}function sa(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function ia(){const e=qr(0,1,0),t=qr(0,0,1);return Math.pow(sa(e,t),na)}const Zr=ia(),aa=.082;function jr(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],s=Math.max(...n,...o),i=Math.ceil(3*Math.sqrt(s/(2*Math.PI**2))*e),c=1/e,a=Math.PI**2,u=[0,0,0];for(let p=-i;p<=i;p++)for(let b=-i;b<=i;b++){const h=(b*c)**2+(p*c)**2;for(let y=0;y<3;y++)u[y]+=t[y]*Math.sqrt(Math.PI/n[y])*Math.exp(-a*h/n[y])+r[y]*Math.sqrt(Math.PI/o[y])*Math.exp(-a*h/o[y])}return{r:i,deltaX:c,sums:u}}function Qr(e){const t=.5*aa*e,n=Math.ceil(3*t);let r=0,o=0,s=0;for(let i=-n;i<=n;i++)for(let c=-n;c<=n;c++){const a=Math.exp(-(c*c+i*i)/(2*t*t)),u=-c*a,p=(c*c/(t*t)-1)*a;u>0&&(r+=u),p>0?o+=p:s-=p}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:s}}const ca=`
${Ve}
${Bt}
${dt}
${yt}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_map0: vec4<f32>; // offX, offY, fitFill, 0
@group(0) @binding(8) var<uniform> u_map1: vec4<f32>; // resultW, resultH, 0, 0
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = mapSample(src, px, u_map0.x, u_map0.y, u_map1.x, u_map1.y, u_map0.z);
  return vec4<f32>(flip_rgb2ycxcz(s.rgb), 1.0);
}
`,la=`
${Ve}
${Bt}
${dt}
${yt}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_map0: vec4<f32>; // offX, offY, fitFill, 0
@group(0) @binding(8) var<uniform> u_map1: vec4<f32>; // resultW, resultH, 0, 0
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = mapSample(src, px, u_map0.x, u_map0.y, u_map1.x, u_map1.y, u_map0.z);
  return vec4<f32>(flip_linrgb2ycxcz(clamp(s.rgb, vec3<f32>(0.0), vec3<f32>(1.0))), 1.0);
}
`,zt=`
${Ve}
${Bt}
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
`,Jr=`
${Ve}
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
`;function je(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function Vt(e,t,n){const r=n.sourceMap,o=r?t==="a"?r.offsetA:r.offsetB:{x:0,y:0},s=r!=null&&r.fill?1:0;return[je(e,[o.x,o.y,s,0]),je(e+1,[n.width,n.height,0,0])]}function $t(e){return[je(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),je(2,[e.sums[2],0,0,0])]}function eo(e){return[je(4,[Zr,e.sd,e.r,e.edgeNorm]),je(5,[e.pointPos,e.pointNeg,0,0])]}function to(e,t,n,r,o,s=""){const i=jr(e),c=Qr(e),a=`ycxczA${s}`,u=`ycxczB${s}`,p=`labA${s}`,b=`labB${s}`,h=`flip${s}`;return{passes:[{name:a,shader:t,inputs:[n],output:a,uniforms:()=>Vt(1,"a",o)},{name:u,shader:t,inputs:[r],output:u,uniforms:()=>Vt(1,"b",o)},{name:p,shader:zt,inputs:[a],output:p,uniforms:()=>$t(i)},{name:b,shader:zt,inputs:[u],output:b,uniforms:()=>$t(i)},{name:h,shader:Jr,inputs:[p,b,a,u],output:h,uniforms:()=>eo(c)}],flipRef:h}}const ua={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=to(t,ca,"srcA","srcB",e);return{passes:n,final:r}}},fa={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=to(t,la,"srcA","srcB",e);return{passes:n,final:r}}},no=`
${Ve}
${Bt}
${dt}
${yt}
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
`,da=`
${Ve}
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
`,pa={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",output:"scalar",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),s=(r-n)/Math.max(o-1,1),i=jr(t),c=Qr(t),a=[];let u=null;for(let p=0;p<o;p++){const b=n+p*s,h=`_e${p}`,y=`ycxczA${h}`,_=`ycxczB${h}`,w=`labA${h}`,S=`labB${h}`,m=`acc${h}`;a.push({name:y,shader:no,inputs:["srcA"],output:y,uniforms:()=>[je(1,[b,0,0,0]),...Vt(2,"a",e)]},{name:_,shader:no,inputs:["srcB"],output:_,uniforms:()=>[je(1,[b,0,0,0]),...Vt(2,"b",e)]},{name:w,shader:zt,inputs:[y],output:w,uniforms:()=>$t(i)},{name:S,shader:zt,inputs:[_],output:S,uniforms:()=>$t(i)}),u===null?a.push({name:m,shader:Jr,inputs:[w,S,y,_],output:m,uniforms:()=>eo(c)}):a.push({name:m,shader:da,inputs:[w,S,y,_,u],output:m,uniforms:()=>[je(5,[Zr,c.sd,c.r,c.edgeNorm]),je(6,[c.pointPos,c.pointNeg,0,0])]}),u=m}return{passes:a,final:u}}},ro=.01,oo=.03,Xt=1,Tn=1.5,tt=5,Pn=[.2126,.7152,.0722];function An(e){return e<=.04045?e/12.92:Math.pow((e+.055)/1.055,2.4)}function so(e,t,n){const r=Pn[0]*An(e)+Pn[1]*An(t)+Pn[2]*An(n);return Math.min(1,Math.max(0,r))}function ha(e,t){const n=2*t+1,r=new Float64Array(n);let o=0;for(let s=-t,i=0;s<=t;s++,i++){const c=Math.exp(-.5*s*s/(e*e));r[i]=c,o+=c}for(let s=0;s<n;s++)r[s]=r[s]/o;return r}function io(e,t){if(t===1)return 0;const n=2*t;let r=(e%n+n)%n;return r>=t&&(r=n-1-r),r}function _t(e,t,n,r,o){const s=new Float64Array(t*n);for(let c=0;c<n;c++)for(let a=0;a<t;a++){let u=0;for(let p=-o,b=0;p<=o;p++,b++)u+=r[b]*e[c*t+io(a+p,t)];s[c*t+a]=u}const i=new Float64Array(t*n);for(let c=0;c<n;c++)for(let a=0;a<t;a++){let u=0;for(let p=-o,b=0;p<=o;p++,b++)u+=r[b]*s[io(c+p,n)*t+a];i[c*t+a]=u}return i}function ma(e,t,n,r){const o=n*r,s=ha(Tn,tt),i=new Float64Array(o),c=new Float64Array(o),a=new Float64Array(o);for(let g=0;g<o;g++)i[g]=e[g]*e[g],c[g]=t[g]*t[g],a[g]=e[g]*t[g];const u=_t(e,n,r,s,tt),p=_t(t,n,r,s,tt),b=_t(i,n,r,s,tt),h=_t(c,n,r,s,tt),y=_t(a,n,r,s,tt),_=(ro*Xt)**2,w=(oo*Xt)**2,S=new Float32Array(o);for(let g=0;g<o;g++){const E=b[g]-u[g]*u[g],k=h[g]-p[g]*p[g],T=y[g]-u[g]*p[g],M=2*u[g]*p[g]+_,P=2*T+w,D=u[g]*u[g]+p[g]*p[g]+_,R=E+k+w;S[g]=M*P/(D*R)}const m=tt;let d=0,x=0;for(let g=m;g<r-m;g++)for(let E=m;E<n-m;E++)d+=S[g*n+E],x++;const v=x>0?d/x:NaN;return{ssim:S,mssim:v}}const ao=`
${Ve}

fn ssim_srgb2linear(c: f32) -> f32 {
  if (c <= 0.04045) { return c / 12.92; }
  return pow((c + 0.055) / 1.055, 2.4);
}
fn ssim_luma(srgb: vec3<f32>) -> f32 {
  let lin = vec3<f32>(ssim_srgb2linear(srgb.r), ssim_srgb2linear(srgb.g), ssim_srgb2linear(srgb.b));
  return clamp(dot(lin, vec3<f32>(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
}

${dt}
${yt}
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
`,ga=`
${ao}
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let y = ssim_moment_luma(in);
  return vec4<f32>(y.x, y.y, y.x * y.x, y.y * y.y);
}
`,xa=`
${ao}
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let y = ssim_moment_luma(in);
  return vec4<f32>(y.x * y.y, 0.0, 0.0, 0.0);
}
`,co=`
${Ve}
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
`,ba=`
${Ve}
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
`;function Mt(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function lo(e){const t=e.sourceMap,n=t?t.offsetA:{x:0,y:0},r=t?t.offsetB:{x:0,y:0},o=t!=null&&t.fill?1:0;return[Mt(2,[n.x,n.y,r.x,r.y]),Mt(3,[e.width,e.height,o,0])]}function uo(e,t){const n=`${t}H`,r=`${t}V`;return{passes:[{name:n,shader:co,inputs:[e],output:n,uniforms:()=>[Mt(1,[1,0,tt,Tn])]},{name:r,shader:co,inputs:[n],output:r,uniforms:()=>[Mt(1,[0,1,tt,Tn])]}],out:r}}const va={kind:"multipass",id:"ssim",label:"SSIM (1−SSIM)",publicName:"ssim",displayRange:"unit",output:"scalar",buildPasses(e){const t=(ro*Xt)**2,n=(oo*Xt)**2,r=uo("momA","statsA"),o=uo("momB","statsB");return{passes:[{name:"momA",shader:ga,inputs:["srcA","srcB"],output:"momA",uniforms:lo},{name:"momB",shader:xa,inputs:["srcA","srcB"],output:"momB",uniforms:lo},...r.passes,...o.passes,{name:"ssim",shader:ba,inputs:[r.out,o.out],output:"ssim",uniforms:()=>[Mt(2,[t,n,0,0])]}],final:"ssim"}}};let fo=!1;function wa(){fo||(fo=!0,Ze(ji),Ze(Zi),Ze(Qi),Ze(ea),Ze(Ji),Ze(ta),Ze(ua),Ze(pa),Ze(fa),Ze(va))}wa();function po(){const e=[];for(const n of qi())n.kind==="pointwise"&&e.push({id:n.id,label:n.label});e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"});const t=it("ssim");return t&&e.push({id:t.id,label:t.label}),e}function ya(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}function Ea(e,t,n){const r=t*n;if(r<=0)return NaN;let o=0;for(let s=0;s<r;s++)o+=e[s*4]??0;return 1-o/r}function ho(e){return e==null||Number.isNaN(e)?"—":e.toFixed(4)}const mo=new WeakMap;function Rn(e,t,n,r){let o=mo.get(e);o||(o=new Map,mo.set(e,o));const s=`${t}::${r}`;let i=o.get(s);return i||(i=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(s,i)),i}function _a(e){return`
${Ve}
${dt}
${yt}
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
`}const Wt="rgba16float";function Ma(e,t,n,r,o,s){var S,m;const i=it(r);if(!i)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const c=s??Et({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),a=c.result.w,u=c.result.h,p=c.fit==="fill"?1:0,b=Hr(i,o);if(i.kind==="pointwise"){const d=e.createTexture(a,u,Wt),x=Rn(e,`pw:${i.id}`,_a(i.source),Wt),v=new Float32Array([c.offsetA.x,c.offsetA.y,c.offsetB.x,c.offsetB.y]),g=new Float32Array([a,u,p,0]);let E;try{E=e.createBindGroup(x,[{binding:0,resource:t},{binding:1,resource:n},{binding:2,resource:{uniform:v}},{binding:3,resource:{uniform:g}}]),e.renderFullscreen(d,x,E)}finally{(S=E==null?void 0:E.destroy)==null||S.call(E)}return d}const h={width:a,height:u,params:b,sourceMap:{fill:c.fit==="fill",offsetA:c.offsetA,offsetB:c.offsetB}},y=i.buildPasses(h),_=new Map([["srcA",t],["srcB",n]]),w=[];try{for(const x of y.passes){const v=e.createTexture(a,u,Wt);w.push(v),_.set(x.output,v);const g=Rn(e,`mp:${i.id}:${x.name}`,x.shader,Wt),E=x.inputs.map((T,M)=>{const P=_.get(T);if(!P)throw new Error(`computeDiff: pass "${x.name}" input "${T}" not produced yet`);return{binding:M,resource:P}});x.uniforms&&E.push(...x.uniforms(h));let k;try{k=e.createBindGroup(g,E),e.renderFullscreen(v,g,k)}finally{(m=k==null?void 0:k.destroy)==null||m.call(k)}}const d=_.get(y.final);if(!d)throw new Error(`computeDiff: final ref "${y.final}" not produced`);for(const x of w)x!==d&&x.destroy();return d}catch(d){for(const x of w)x.destroy();throw d}}const Sa=8,Ta=256*1024*1024;class Pa{constructor(t=Sa,n=Ta){ae(this,"map",new Map);ae(this,"totalBytes",0);this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}accountReadbackBytes(t,n){let r=!1;for(const o of this.map.values())if(o===t){r=!0;break}r&&(t.bytes+=n,this.totalBytes+=n,this.evict())}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const go=new WeakMap;function xo(e){let t=go.get(e);return t||(t=new Pa,go.set(e,t)),t}function Aa(e,t){const n=Hr(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function Ra(e,t,n,r,o){const s=it(n),i=s?Aa(s,r):"",c=o?Us(o):"";return`${e}|${t}|${n}|${i}|${c}`}function bo(e,t,n,r,o,s,i,c){const a=it(r);if(!a)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const u=xo(e),p=c??Et({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),b=Ra(s,i,r,o,p),h=u.get(b);if(h)return h;const y=Ma(e,t,n,r,o,p),_=p.result.w,w=p.result.h,S={texture:y,width:_,height:w,displayRange:a.displayRange,bytes:_*w*8};return u.set(b,S),S}async function Ca(e,t,n,r,o,s){try{const i=bo(e,t,n,"ssim",void 0,r,o,s);return i.ssimMean!==void 0?i.ssimMean:(i.ssimMeanPending||(i.ssimMeanPending=vo(e,i).then(c=>{const a=Ea(c,i.width,i.height);return i.ssimMean=a,a})),await i.ssimMeanPending)}catch{return ka(e,t,n,s)}}async function ka(e,t,n,r){const o=r??Et({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),s=o.result.w,i=o.result.h,c=s*i;if(c<=0)return NaN;const a=await e.readback(t),u=await e.readback(n),p=a instanceof Uint8Array?255:1,b=u instanceof Uint8Array?255:1,h=o.fit==="fill",y=Ot(a,t.width,t.height,p,o.offsetA,h,s,i),_=Ot(u,n.width,n.height,b,o.offsetB,h,s,i),w=new Float64Array(c),S=new Float64Array(c),m=[0,0,0],d=[0,0,0];for(let g=0;g<i;g++)for(let E=0;E<s;E++){y(E,g,m),_(E,g,d);const k=g*s+E;w[k]=so(m[0],m[1],m[2]),S[k]=so(d[0],d[1],d[2])}const{ssim:x}=ma(w,S,s,i);let v=0;for(let g=0;g<c;g++)v+=x[g];return v/c}async function Da(e,t,n,r,o){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=fr(e,n,r,o).then(s=>(t.scalars=s,s))),t.scalarsPending)}async function vo(e,t){return t.resultSamples?t.resultSamples:(t.resultSamplesPending||(t.resultSamplesPending=e.readback(t.texture).then(n=>{const r=n instanceof Float32Array?n:Float32Array.from(n);return t.resultSamples=r,xo(e).accountReadbackBytes(t,r.byteLength),r})),t.resultSamplesPending)}const La=`
${Ve}
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
`,Ba={unit:0,signed:1,relative:2},Oa={linear:0,signed:1,positive:2};function Ia(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function Na(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function Fa(e,t,n,r,o){var y,_,w;const s=Na(t),i=Rn(e,"diff-display",La,s),c=Ia(e,o.colormap),a=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),u=new Float32Array([Ba[r],Oa[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]),p=new Float32Array([o.exposureEV??0,o.offset??0,0,0]),b=new Float32Array([((y=o.sourceDims)==null?void 0:y.w)??0,((_=o.sourceDims)==null?void 0:_.h)??0,0,0]);let h;try{h=e.createBindGroup(i,[{binding:0,resource:n},{binding:1,resource:c},{binding:2,resource:{uniform:a}},{binding:3,resource:{uniform:u}},{binding:4,resource:{uniform:p}},{binding:5,resource:{uniform:b}}]),e.renderFullscreen(t,i,h)}finally{(w=h==null?void 0:h.destroy)==null||w.call(h),c.destroy()}}const wo=.6*.6*2.51,Ua=.6*.03,Ga=0,yo=.6*.6*2.43,za=.6*.59,Va=.14;function Eo(e){const t=(Ua-za*e)/(wo-yo*e),n=(Ga-Va*e)/(wo-yo*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const $a=.85,Xa=.85,_o=11920928955078125e-23,Cn=[.2126,.7152,.0722];function Wa(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function Ya(e,t,n,r=3,o={}){const s=t*n,i=Eo($a),c=Eo(Xa),a=new Float64Array(s);let u=0;for(let d=0;d<s;d++){const[x,v,g]=Wa(e,d,r),E=x*Cn[0]+v*Cn[1]+g*Cn[2];a[d]=E,E>u&&(u=E)}const p=Float64Array.from(a).sort(),b=s>>1,h=s%2===1?p[b]:p[b-1],y=Math.max(h,_o),_=Math.max(u,_o),w=o.startExposure??Math.log2(i/_),S=o.stopExposure??Math.log2(c/y),m=Math.max(2,Math.ceil(S-w));return{startExposure:w,stopExposure:S,numExposures:m}}const Ha="absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm pointer-events-none select-none",Ka="REF";function Mo(){return f.jsx("span",{className:Ha,children:Ka})}const qa={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Za({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:s,zoom:i,pan:c,onViewportChange:a,processing:u=qa,interpolation:p="auto",label:b="",isDraggable:h=!1,onDragStart:y,overlay:_,overlaySettings:w,pixelValueNotation:S="decimal"}){var oe,ce;const m=l.useRef(null),[d,x]=l.useState(null),[v,g]=l.useState(null),[E,k]=l.useState(S),[T,M]=l.useState(!1),P=l.useRef(null),D=l.useRef(null),R=l.useRef(null),A=l.useRef(null),[X,L]=l.useState(0);l.useEffect(()=>{if(!e){R.current=null,L(ne=>ne+1);return}let U=!1;return at(e).then(ne=>{U||(R.current=ne,L(he=>he+1))}),()=>{U=!0}},[e]),l.useEffect(()=>{if(!t){A.current=null,L(ne=>ne+1);return}let U=!1;return at(t).then(ne=>{U||(A.current=ne,L(he=>he+1))}),()=>{U=!0}},[t]);const B=U=>(ne,he,ue)=>{const W=U.current;if(!W||ne<0||he<0||ne>=W.width||he>=W.height)return null;const de=(he*W.width+ne)*4,me=W.data[de],we=W.data[de+1],fe=W.data[de+2],ke=(.299*me+.587*we+.114*fe)/255;return me===we&&we===fe?{lines:[mt(me,"uint8",ue)],luminance:ke}:{lines:[mt(me,"uint8",ue),mt(we,"uint8",ue),mt(fe,"uint8",ue)],luminance:ke,colors:[Lt[0],Lt[1],Lt[2]]}},I=l.useMemo(()=>B(R),[]),O=l.useMemo(()=>B(A),[]),q=!!_&&!!(w!=null&&w.enabled)&&!!d&&!!e&&((((oe=_.boxes)==null?void 0:oe.length)??0)>0||(((ce=_.masks)==null?void 0:ce.length)??0)>0),{gammaFilterId:Z,filterStr:be,gamma:xe,offset:ee}=xr(u),Pe=`translate(${c.x}px, ${c.y}px) scale(${i})`,$=p==="auto"?void 0:p,{containerProps:F,modifierActive:J}=tr({containerRef:m,zoom:i,pan:c,onViewportChange:a});return f.jsxs("div",{className:"relative flex flex-col h-full",children:[f.jsx(br,{id:Z,gamma:xe,offset:ee}),f.jsxs("div",{ref:m,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...F.style},onPointerDown:F.onPointerDown,onPointerMove:F.onPointerMove,onPointerUp:F.onPointerUp,onPointerCancel:F.onPointerCancel,children:[f.jsxs("div",{className:"relative w-full h-full",children:[f.jsxs("div",{className:"relative w-full h-full",style:{transform:Pe,transformOrigin:"0 0"},children:[f.jsx("img",{ref:P,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:be,imageRendering:$,...n==="blend"?{opacity:o}:{}},onLoad:U=>{const ne=U.currentTarget;x({w:ne.naturalWidth,h:ne.naturalHeight})}}),q&&f.jsx(dn,{data:_,settings:w,naturalWidth:d.w,naturalHeight:d.h})]}),f.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:f.jsx("div",{className:"w-full h-full",style:{transform:Pe,transformOrigin:"0 0"},children:f.jsx("img",{ref:D,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:be,imageRendering:$,...n==="blend"?{opacity:1-o}:{}},onLoad:U=>{const ne=U.currentTarget;g({w:ne.naturalWidth,h:ne.naturalHeight})}})})}),n==="split"&&f.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${r*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:()=>s==null?void 0:s(.5),onPointerDown:U=>{U.stopPropagation(),U.preventDefault();const ne=U.currentTarget;try{ne.setPointerCapture(U.pointerId)}catch{}const ue=ne.parentElement.getBoundingClientRect(),W=me=>{s==null||s(Math.max(0,Math.min(1,(me.clientX-ue.left)/ue.width)))},de=()=>{window.removeEventListener("pointermove",W),window.removeEventListener("pointerup",de)};window.addEventListener("pointermove",W),window.addEventListener("pointerup",de)},children:f.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})]}),n==="split"?f.jsxs(f.Fragment,{children:[t&&v&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:f.jsx(ft,{imageElRef:D,naturalWidth:v.w,naturalHeight:v.h,zoom:i,pan:c,sample:O,notation:E,version:X})}),e&&d&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:f.jsx(ft,{imageElRef:P,naturalWidth:d.w,naturalHeight:d.h,zoom:i,pan:c,sample:I,notation:E,version:X,onActiveChange:M})})]}):e&&d&&f.jsx(ft,{imageElRef:P,naturalWidth:d.w,naturalHeight:d.h,zoom:i,pan:c,sample:I,notation:E,version:X,onActiveChange:M}),T&&f.jsx(rr,{notation:E,onChange:k})]}),n==="split"&&f.jsx(Mo,{}),f.jsxs("span",{className:`absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${h&&!J?" cairn-drag-grip":""}`,draggable:h&&!J,onDragStart:y,style:{cursor:h&&!J?"grab":void 0},children:[f.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50"}),b]})]})}function ja(){return f.jsx("div",{className:"card p-4 text-sm text-red-400 h-full flex items-center justify-center text-center",children:"Plot error: float URL sources need the GPU compare (WebGPU) — unavailable here"})}function Qa({mode:e,kernel:t,kernelOptions:n,onSlide:r,onBlend:o,onKernel:s,onSide:i}){return{id:"compare-mode",title:"Compare / diff mode",menu:{options:[...i?[{id:"side",label:"Side"}]:[],{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...n],value:e==="side"?"side":e==="split"?"slide":e==="blend"?"blend":t,onSelect:u=>{u==="side"?i==null||i():u==="slide"?r():u==="blend"?o():s(u)}}}}function Ja(e){const t=Qt(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function ec(e){const{width:t,height:n,channels:r}=e,o=t*n;if(e.precision==="f16-bits"){const a=e.data,u=new Uint16Array(o*4);for(let p=0;p<o;p++){const b=p*r,h=p*4;if(r===1){const y=a[b];u[h]=y,u[h+1]=y,u[h+2]=y,u[h+3]=Ct}else u[h]=a[b],u[h+1]=a[b+1],u[h+2]=a[b+2],u[h+3]=r>=4?a[b+3]:Ct}return{data:u,format:"rgba16float"}}const s=e.data,i=new Float32Array(o*4),c=a=>Number.isFinite(a)?a:0;for(let a=0;a<o;a++){const u=a*r;let p,b,h,y=1;r===1?p=b=h=c(s[u]):r===3?(p=c(s[u]),b=c(s[u+1]),h=c(s[u+2])):(p=c(s[u]),b=c(s[u+1]),h=c(s[u+2]),y=c(s[u+3]));const _=a*4;i[_]=p,i[_+1]=b,i[_+2]=h,i[_+3]=y}return{data:i,format:"rgba32float"}}function tc({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:s,blendAlpha:i,onSplitPositionChange:c,diffSubmode:a,colormap:u="none",align:p="top-left",fit:b="crop",diffKernel:h,onDiffKernelChange:y,onCompareModeChange:_,onRequestSide:w,zoom:S,pan:m,onViewportChange:d,interpolation:x="auto",label:v="",pixelValueNotation:g="decimal"}){var So;const E=l.useRef(null),k=l.useRef(null),T=l.useRef(null),M=l.useRef(null),P=l.useRef(null),[D,R]=l.useState(!1),[A,X]=l.useState(!1),[L,B]=l.useState(null),[I,O]=l.useState(null),[q,Z]=l.useState(0),[be,xe]=l.useState(0),[ee,Pe]=l.useState(null),[$,F]=l.useState(null),[J,oe]=l.useState({x:0,y:0,w:1,h:1}),ce=h??a??"absolute",[U,ne,he]=lt(ce);l.useEffect(()=>{ne(h??a??"absolute")},[h,a,ne]);const ue=l.useCallback(C=>{ne(C),y==null||y(C)},[y,ne]);l.useEffect(()=>{const C=E.current;if(C)return C.__cairnDiffKernel={current:U,set:ue},()=>{C&&delete C.__cairnDiffKernel}},[U,ue]);const[W,de,me]=lt(o);l.useEffect(()=>{de(o)},[o,de]);const we=l.useCallback(C=>{de(C),_==null||_(C)},[_,de]),[fe,ke,$e]=lt(u);l.useEffect(()=>{ke(u)},[u,ke]);const Qe=l.useCallback(()=>{we(me.default),ke($e.default),ue(he.default)},[we,ke,ue,me.default,$e.default,he.default]),Fe=me.isModified||$e.isModified||he.isModified,[V,ge]=l.useState(0),[_e,Me]=l.useState(0),ie=l.useMemo(()=>{const Y=[Qa({mode:W,kernel:U,kernelOptions:po().map(K=>({id:K.id,label:K.label})),onSide:w,onSlide:()=>we("split"),onBlend:()=>we("blend"),onKernel:K=>{we("diff"),ue(K)}})];return W==="diff"&&Y.push(wn(fe,K=>ke(K))),Y},[W,U,fe,ue,we,w]),ve=l.useRef(null),Ue=l.useRef(null),ze=l.useRef(null),Se=l.useRef(null),[Ie,Re]=l.useState(0),G=l.useRef(null),H=l.useRef(null),[te,N]=l.useState(0),le=fn();l.useEffect(()=>{const C=T.current;if(!C)return;let Y=!1;return Tt().then(K=>{if(!Y)try{if(dr())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const z=K.createSurface(C,{hdr:!1});M.current={device:K,surface:z,texA:null,texB:null},X(!0)}catch(z){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",z),R(!0)}}).catch(K=>{Y||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",K),R(!0))}),()=>{var z,re;Y=!0;const K=M.current;K&&((z=K.texA)==null||z.destroy(),(re=K.texB)==null||re.destroy(),M.current=null)}},[]),l.useEffect(()=>{const C=E.current;if(!C)return;const Y=new ResizeObserver(()=>xe(K=>K+1));return Y.observe(C),()=>Y.disconnect()},[]),l.useEffect(()=>{if(!A)return;let C=!1;if(!M.current)return;async function K(z,re){if(re){const ye=ec(re);return{width:re.width,height:re.height,imageData:null,make:Ce=>{const pe=Ce.createTexture(re.width,re.height,ye.format);return pe.write(ye.data),pe}}}if(!z)return null;const se=await at(z);return se?{width:se.width,height:se.height,imageData:se,make:ye=>{const Ce=ye.createTexture(se.width,se.height,"rgba8unorm");return Ce.write(se.data),Ce}}:null}return Promise.all([K(e,n),K(t,r)]).then(([z,re])=>{var Ge,Xe;if(C||!M.current)return;const se=M.current;ve.current=(z==null?void 0:z.imageData)??null,Ue.current=(re==null?void 0:re.imageData)??null,ze.current=n??null,Se.current=r??null,(Ge=se.texA)==null||Ge.destroy(),(Xe=se.texB)==null||Xe.destroy(),se.texA=null,se.texB=null;const ye=z??re;if(!ye){B(null),O(null),Re(Je=>Je+1);return}const Ce=re??ye,pe=z??ye;se.texA=Ce.make(se.device),se.texB=pe.make(se.device),O({a:{w:Ce.width,h:Ce.height},b:{w:pe.width,h:pe.height}}),B({w:ye.width,h:ye.height}),Re(Je=>Je+1),Z(Je=>Je+1)}),()=>{C=!0}},[A,e,t,n,r]);const j=n!=null||r!=null,Te=l.useMemo(()=>ya(U,j),[U,j]),De=l.useMemo(()=>{if(!j)return null;const C=r??n;if(!C)return null;const Y=C.precision==="f16-bits"?Kn(C.data):C.data;return Ya(Y,C.width,C.height,C.channels)},[j,r,n]),nt=l.useMemo(()=>{var C;return rs(((C=it(Te))==null?void 0:C.displayRange)??"unit",fe==="none"?null:fe)},[Te,fe]),Ae=l.useMemo(()=>fe!=="none"?Ja(fe):void 0,[fe]),Le=l.useMemo(()=>I?Et(I.a,I.b,p,b,"b"):null,[I,p,b]),We=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",pt=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",Be=l.useMemo(()=>L?W==="diff"&&Le?Le.result:L:null,[W,Le,L]),bt=l.useCallback(()=>{const C=M.current;if(!A||!C||!C.surface||!C.texA||!C.texB||!L)return;const Y=Be??L,K=E.current,z=K?K.getBoundingClientRect():{width:Y.w,height:Y.h},re=Wr({zoom:S,pan:m},z,Y.w,Y.h);oe(pe=>pe.x===re.x&&pe.y===re.y&&pe.w===re.w&&pe.h===re.h?pe:re);const se=T.current;if(z.width>0&&z.height>0&&se&&C.surface){const pe=Math.max(1,Math.round(z.width*le)),Ge=Math.max(1,Math.round(z.height*le));(se.width!==pe||se.height!==Ge)&&(se.width=pe,se.height=Ge,C.surface.configure(pe,Ge))}const ye=Yr(re,z,Y.w,Y.h)>=pn?"nearest":"linear",Ce=re;try{if(W==="diff"){const pe=it(Te)?Te:"absolute",Ge=pe==="hdr-flip"&&De?{ppd:67,startExposure:De.startExposure,stopExposure:De.stopExposure,numExposures:De.numExposures}:void 0,Xe=bo(C.device,C.texA,C.texB,pe,Ge,We,pt,Le??void 0);P.current=Xe,Fa(C.device,C.surface,Xe.texture,Xe.displayRange,{uv:Ce,cmapMode:nt,colormap:Ae,filter:ye,exposureEV:V,offset:_e})}else{const pe={exposureEV:V,offset:_e,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:Ce,filter:ye,mode:W,split:s,alpha:i};$s(C.device,C.surface,C.texA,C.texB,pe)}}catch(pe){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",pe),R(!0)}},[A,L,Be,Le,S,m.x,m.y,W,s,i,V,_e,U,Te,De,nt,Ae,e,t,n,r,We,pt,le]);l.useEffect(()=>{bt()},[bt,q,be]);const Ye=t!=null||r!=null;l.useEffect(()=>{const C=M.current;if(!A||!C||!C.texA||!C.texB||!Ye){Pe(null);return}let Y=!1;const K=C.texA,z=C.texB,re=P.current,se=W==="diff"?Le??void 0:void 0;return(W==="diff"&&re?Da(C.device,re,K,z,se):fr(C.device,K,z,se)).then(Ce=>{Y||Pe(Ce)}),()=>{Y=!0}},[A,q,Ye,W,U,Le]),l.useEffect(()=>{const C=M.current;if(!A||!C||!C.texA||!C.texB||!Ye){F(null);return}let Y=!1;F(null);const K=W==="diff"?Le??void 0:void 0;return Ca(C.device,C.texA,C.texB,We,pt,K).then(z=>{Y||F(z)}).catch(()=>{Y||F(null)}),()=>{Y=!0}},[A,q,Ye,W,Le,We,pt]),l.useEffect(()=>{if(W!=="diff"){G.current=null,H.current=null;return}const C=M.current,Y=P.current;if(!A||!C||!Y)return;let K=!1;return G.current=null,H.current=null,N(z=>z+1),vo(C.device,Y).then(z=>{K||(G.current=z,H.current={w:Y.width,h:Y.height},N(re=>re+1))}).catch(()=>{}),()=>{K=!0}},[A,W,Te,q,Le]);const Yt=(C,Y)=>(K,z,re)=>{const se=Y.current;if(se){const{data:To,width:Po,height:ic,channels:Ao}=se;if(K<0||z<0||K>=Po||z>=ic)return null;const Ht=(z*Po+K)*Ao,Kt=se.precision==="f16-bits"?Dn=>kt(To[Dn]??0):Dn=>To[Dn]??0,ac=.5,cc=Ao===1?[Kt(Ht)]:[Kt(Ht),Kt(Ht+1),Kt(Ht+2)];return ut(cc,"unit",re,ac)}const ye=C.current;if(!ye||K<0||z<0||K>=ye.width||z>=ye.height)return null;const Ce=(z*ye.width+K)*4,pe=ye.data[Ce],Ge=ye.data[Ce+1],Xe=ye.data[Ce+2],Je=(.299*pe+.587*Ge+.114*Xe)/255;return ut(pe===Ge&&Ge===Xe?[pe]:[pe,Ge,Xe],"uint8",re,Je)},vt=l.useMemo(()=>Yt(ve,ze),[]),ht=l.useMemo(()=>Yt(Ue,Se),[]),kn=l.useMemo(()=>(C,Y,K)=>{var Je;const z=G.current,re=H.current;if(!z||!re)return null;const{w:se,h:ye}=re;if(C<0||Y<0||C>=se||Y>=ye)return null;const Ce=(Y*se+C)*4,pe=((Je=it(Te))==null?void 0:Je.output)??"per-channel",Ge=.5,Xe=pe==="scalar"?[z[Ce]??0]:[z[Ce]??0,z[Ce+1]??0,z[Ce+2]??0];return ut(Xe,"unit",K,Ge)},[Te]);l.useEffect(()=>{const C=E.current;if(C)return C.__cairnCompareProbe={sampleDiff:(Y,K,z="decimal")=>kn(Y,K,z),sampleFg:(Y,K,z="decimal")=>vt(Y,K,z),sampleRef:(Y,K,z="decimal")=>ht(Y,K,z),get diffSamples(){return G.current},get dims(){return Be},get primaryDims(){return L},get diffResultDims(){return H.current},get align(){return p},get fit(){return b},get resolvedKernelId(){return Te},get compareMode(){return W},get ssimScalar(){return $},get ssimText(){return ho($)}},()=>{C&&delete C.__cairnCompareProbe}},[kn,vt,ht,L,Be,p,b,Te,W,$]);const oc=x==="auto"?void 0:x;if(D)return n!=null||r!=null?f.jsx(ja,{}):W==="diff"?f.jsx(En,{imageUrl:e,baselineUrl:t,diffMode:((So=it(Te))==null?void 0:So.kind)==="pointwise"?Te:"absolute",interpolation:x,colormap:fe,showAxes:!1,zoom:S,pan:m,onViewportChange:d,label:v,pixelValueNotation:g}):f.jsx(Za,{imageUrl:e,baselineUrl:t,mode:W,splitPosition:s,blendAlpha:i,onSplitPositionChange:c,zoom:S,pan:m,onViewportChange:d,interpolation:x,label:v,pixelValueNotation:g});const sc=f.jsxs(f.Fragment,{children:[f.jsx("canvas",{ref:T,className:"w-full h-full block",style:{imageRendering:oc},"data-gpu-compare-canvas":!0}),W==="split"&&f.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${s*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:C=>{C.stopPropagation(),c==null||c(.5)},onPointerDown:C=>{C.stopPropagation(),C.preventDefault();const Y=C.currentTarget;try{Y.setPointerCapture(C.pointerId)}catch{}const z=Y.parentElement.getBoundingClientRect(),re=ye=>{c==null||c(Math.max(0,Math.min(1,(ye.clientX-z.left)/z.width)))},se=()=>{window.removeEventListener("pointermove",re),window.removeEventListener("pointerup",se)};window.addEventListener("pointermove",re),window.addEventListener("pointerup",se)},children:f.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})]});return f.jsx(Ft,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":A},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:E,wrapperRef:k,zoom:S,pan:m,onViewportChange:d,naturalDims:Be,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:sc,showAxes:!1,notationSeed:g,onReset:Qe,extraModified:Fe,exportCanvasRef:T,requestRender:bt,leadingMenus:ie,displayAdjust:{exposureEV:V,offset:_e,onExposureChange:ge,onOffsetChange:Me},label:"",showLabelChip:!1,overlay:{render:({notation:C,setOverlayActive:Y})=>W==="split"?f.jsxs(f.Fragment,{children:[Ye&&Be&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-s)*100}% 0 0)`},children:f.jsx(ft,{imageElRef:T,naturalWidth:Be.w,naturalHeight:Be.h,zoom:S,pan:m,sourceWindow:J,sample:ht,notation:C,version:Ie})}),Ye&&Be&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${s*100}%)`},children:f.jsx(ft,{imageElRef:T,naturalWidth:Be.w,naturalHeight:Be.h,zoom:S,pan:m,sourceWindow:J,sample:vt,notation:C,version:Ie,onActiveChange:Y})})]}):Be&&f.jsx(ft,{imageElRef:T,naturalWidth:Be.w,naturalHeight:Be.h,zoom:S,pan:m,sourceWindow:J,sample:W==="diff"?kn:vt,notation:C,version:W==="diff"?te:Ie,onActiveChange:Y})},extraChips:f.jsxs(f.Fragment,{children:[W==="split"&&f.jsx(Mo,{}),v?f.jsx("span",{className:"absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm",children:v}):null,ee&&f.jsxs("span",{className:`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${v?"bottom-7":"bottom-1"}`,"data-gpu-compare-metrics":!0,children:["MSE ",ee.mse.toExponential(2)," · PSNR ",Number.isFinite(ee.psnr)?ee.psnr.toFixed(1):"∞"," dB · MAE"," ",ee.mae.toExponential(2)," · SSIM ",ho($)]})]})})}const nc="cairn-plot:gpu-image-ready";async function rc(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await Tt(),window.__cairnPlotGpuImagePane=Ki,window.__cairnPlotGpuComparePane=tc,window.__cairnPlotDiffMenuModes=po(),window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(nc))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e),Xr("no-webgpu")}}}rc()})(__cairnPlotJsxRuntime,__cairnPlotReact);
