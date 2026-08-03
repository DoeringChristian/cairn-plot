var kc=Object.defineProperty;var Dc=(d,c,rt)=>c in d?kc(d,c,{enumerable:!0,configurable:!0,writable:!0,value:rt}):d[c]=rt;var se=(d,c,rt)=>Dc(d,typeof c!="symbol"?c+"":c,rt);(function(d,c){"use strict";const rt=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function Nn(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:rt}),{hdr:!1,format:n}}function $o(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:rt}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:rt}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return Nn(e,t)}}}const Xo=`
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
`,Wo=`
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
`;function qt(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Fn(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Ho(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const Yo={texture:0,sampler:1,uniform:2};function Zt(e,t){return e*3+Yo[t]}const Ko={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function qo(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),s=r[2]!==void 0,i=r[3].trim();if(s){const l=Ko[i];if(l===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${i}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:l})}else i==="sampler"||i==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class Un{constructor(t,n,r,o){se(this,"width");se(this,"height");se(this,"format");se(this,"gpuTexture");se(this,"device");se(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:qt(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*Fn(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class Gn{constructor(t){se(this,"_s");se(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class Zo{constructor(t,n,r,o,s){se(this,"_p");se(this,"gpuPipeline");se(this,"bindings");se(this,"bindGroupLayout");se(this,"variants");se(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=s,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function jo(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class Qo{constructor(t){se(this,"_c");se(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class Jo{constructor(t,n,r,o,s){se(this,"width");se(this,"height");se(this,"paramsBuffer");se(this,"bindGroup");se(this,"buffers");se(this,"destroyed",!1);this.width=t,this.height=n,this.buffers=r,this.paramsBuffer=o,this.bindGroup=s}destroy(){if(!this.destroyed){for(const t of this.buffers)t.destroy();this.paramsBuffer.destroy(),this.destroyed=!0}}}class es{constructor(t,n){se(this,"_b");se(this,"gpuBindGroup");se(this,"ownedBuffers");se(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class ts{constructor(t,n,r,o){se(this,"canvas");se(this,"hdr");se(this,"format");se(this,"context");se(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function St(e){return"canvas"in e}async function ns(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function s(f){return St(f)?f.getCurrentTextureView():f.gpuTexture.createView()}function i(f){if(St(f))return{width:f.canvas.width,height:f.canvas.height};const b=f;return{width:b.width,height:b.height}}let l=!1,a=null;function u(){var b,x;if(a!==null)return a;let f=!1;try{if(typeof document<"u"){const _=document.createElement("canvas");_.width=1,_.height=1;const y=_.getContext("webgpu");if(y)try{y.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:GPUTextureUsage.RENDER_ATTACHMENT});const C=(b=y.getConfiguration)==null?void 0:b.call(y);f=((x=C==null?void 0:C.toneMapping)==null?void 0:x.mode)==="extended"}catch{f=!1}finally{try{y.unconfigure()}catch{}}}}catch{f=!1}return a=f,f}const p=256;let g=null,h=null;function w(){if(!g||!h){const f=t.createShaderModule({code:Xo});h=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const b=t.createPipelineLayout({bindGroupLayouts:[h]});g=t.createComputePipeline({layout:b,compute:{module:f,entryPoint:"cs_main"}})}return{pipeline:g,layout:h}}let E=null,v=null;function M(){if(!E||!v){const f=t.createShaderModule({code:Wo});v=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});const b=t.createPipelineLayout({bindGroupLayouts:[v]});E=t.createRenderPipeline({layout:b,vertex:{module:f,entryPoint:"vs_main"},fragment:{module:f,entryPoint:"fs_main",targets:[{format:"rgba16float"}]},primitive:{topology:"triangle-list"}})}return{pipeline:E,layout:v}}return{backend:"webgpu",capabilities:n,probeExtendedToneMapping:u,createTexture(f,b,x){return new Un(t,f,b,x)},createSampler(f){const b=(f==null?void 0:f.filter)==="linear"?"linear":"nearest",x=t.createSampler({magFilter:b,minFilter:b,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new Gn(x)},createRenderPipeline(f){const b=t.createShaderModule({code:f.shaderWGSL}),x=qo(f.shaderWGSL),_=qt(f.targetFormat),y=jo(t,x),C=t.createPipelineLayout({bindGroupLayouts:[y]}),T=P=>t.createRenderPipeline({layout:C,vertex:{module:b,entryPoint:"vs_main"},fragment:{module:b,entryPoint:"fs_main",targets:[{format:P}]},primitive:{topology:"triangle-list"}}),S=T(_);return new Zo(S,x,y,_,T)},createComputePipeline(f){const b=t.createShaderModule({code:f.shaderWGSL}),x=t.createComputePipeline({layout:"auto",compute:{module:b,entryPoint:"cs_main"}});return new Qo(x)},createBindGroup(f,b){const x=f,_=new Map,y=[];for(const[T,S]of x.bindings)if(S.kind==="uniform"){const P=t.createBuffer({size:S.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});y.push(P),_.set(T,{binding:T,resource:{buffer:P}})}else S.kind==="sampler"&&_.set(T,{binding:T,resource:o()});for(const T of b){const S=T.resource;if(S instanceof Un){const P=Zt(T.binding,"texture");x.bindings.has(P)&&_.set(P,{binding:P,resource:S.gpuTexture.createView()})}else if(S instanceof Gn){const P=Zt(T.binding,"sampler");x.bindings.has(P)&&_.set(P,{binding:P,resource:S.gpuSampler})}else{const P=Zt(T.binding,"uniform"),R=x.bindings.get(P);if(R&&R.kind==="uniform"){const D=S.uniform,A=t.createBuffer({size:Math.max(R.sizeBytes,D.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(A,0,D.buffer,D.byteOffset,D.byteLength),y.push(A),_.set(P,{binding:P,resource:{buffer:A}})}}}const C=t.createBindGroup({layout:x.bindGroupLayout,entries:Array.from(_.values())});return new es(C,y)},createSurface(f,b){const x=f.getContext("webgpu");if(!x)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const _=b.hdr&&n.hdr,y=()=>_?$o(x,t):Nn(x,t),C=y();return new ts(f,x,C,y)},renderFullscreen(f,b,x){const _=b,y=x,C=s(f),{width:T,height:S}=i(f),P=St(f)?f.format:qt(f.format),R=_.pipelineFor(P),D=t.createCommandEncoder(),A=D.beginRenderPass({colorAttachments:[{view:C,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});A.setPipeline(R),A.setBindGroup(0,y.gpuBindGroup),A.setViewport(0,0,T,S,0,1),A.draw(3),A.end(),t.queue.submit([D.finish()])},createDeepSampleBuffers(f){const{layout:b}=M(),x=P=>{const R=t.createBuffer({size:P.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});return t.queue.writeBuffer(R,0,P.buffer,P.byteOffset,P.byteLength),R},_=x(f.offsets),y=x(f.colors),C=x(f.zs),T=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),S=t.createBindGroup({layout:b,entries:[{binding:0,resource:{buffer:_}},{binding:1,resource:{buffer:y}},{binding:2,resource:{buffer:C}},{binding:3,resource:{buffer:T}}]});return new Jo(f.width,f.height,[_,y,C],T,S)},compositeDeep(f,b,x,_){const y=f,C=b,{pipeline:T}=M();t.queue.writeBuffer(y.paramsBuffer,0,new Float32Array([y.width,y.height,_,x]));const S=t.createCommandEncoder(),P=S.beginRenderPass({colorAttachments:[{view:C.gpuTexture.createView(),loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});P.setPipeline(T),P.setBindGroup(0,y.bindGroup),P.setViewport(0,0,C.width,C.height,0,1),P.draw(3),P.end(),t.queue.submit([S.finish()])},async readback(f){const b=St(f),{width:x,height:_}=i(f),y=b?f.hdr?"rgba16float":"rgba8unorm":f.format,C=b&&f.format==="bgra8unorm",T=b?f.getCurrentGPUTexture():f.gpuTexture,S=Fn(y),P=x*S,R=256,D=Math.ceil(P/R)*R,A=D*_,N=t.createBuffer({size:A,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),L=t.createCommandEncoder();L.copyTextureToBuffer({texture:T},{buffer:N,bytesPerRow:D,rowsPerImage:_},{width:x,height:_,depthOrArrayLayers:1}),t.queue.submit([L.finish()]),await N.mapAsync(GPUMapMode.READ);const B=new Uint8Array(N.getMappedRange()),U=new Uint8Array(P*_);for(let I=0;I<_;I++){const re=I*D,Z=I*P;U.set(B.subarray(re,re+P),Z)}if(N.unmap(),N.destroy(),y==="rgba8unorm"){if(C)for(let I=0;I<U.length;I+=4){const re=U[I],Z=U[I+2];U[I]=Z,U[I+2]=re}return U}if(y==="rgba16float"){const I=new Uint16Array(U.buffer,U.byteOffset,U.byteLength/2),re=new Float32Array(I.length);for(let Z=0;Z<I.length;Z++)re[Z]=Ho(I[Z]);return re}return new Float32Array(U.buffer,U.byteOffset,U.byteLength/4)},async reduceDiffSumSquaredAbs(f,b,x,_){const y=f,C=b,T=Math.max(0,x*_),S=Math.max(1,Math.ceil(T/p)),{pipeline:P,layout:R}=w(),D=S*2*4,A=t.createBuffer({size:D,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),N=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(N,0,new Uint32Array([Math.max(1,x),Math.max(1,_),T,0]));const L=t.createBindGroup({layout:R,entries:[{binding:0,resource:y.gpuTexture.createView()},{binding:1,resource:C.gpuTexture.createView()},{binding:2,resource:{buffer:A}},{binding:3,resource:{buffer:N}}]}),B=t.createBuffer({size:D,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),U=t.createCommandEncoder(),I=U.beginComputePass();I.setPipeline(P),I.setBindGroup(0,L),I.dispatchWorkgroups(S),I.end(),U.copyBufferToBuffer(A,0,B,0,D),t.queue.submit([U.finish()]),await B.mapAsync(GPUMapMode.READ);const Z=new Float32Array(B.getMappedRange()).slice();B.unmap(),B.destroy(),A.destroy(),N.destroy();let me=0,pe=0;for(let oe=0;oe<S;oe++)me+=Z[oe*2],pe+=Z[oe*2+1];return{sumSq:me,sumAbs:pe}},destroy(){l||(t.destroy(),l=!0)},isContextLost(){return!1}}}let jt=null;async function rs(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return ns()}function Pt(){return jt||(jt=rs()),jt}function os(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function ss(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),s=Math.floor(o),i=Math.min(s+1,e.length-1),l=o-s,[a,u,p]=os(e[s],e[i],l);t[n*3]=Math.round(a),t[n*3+1]=Math.round(u),t[n*3+2]=Math.round(p)}return t}const Qt={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},is=Object.keys(Qt),as={viridis:"Viridis",plasma:"Plasma",magma:"Magma","red-green":"Red–Green","red-blue":"Red–Blue"},cs=is.map(e=>({id:e,label:as[e]})),ls=new Set(["red-green","red-blue"]),zn=new Map;function Jt(e){let t=zn.get(e);if(!t){const n=Qt[e]??Qt.viridis;t=ss(n),zn.set(e,t)}return t}function ct(e,t,n){return e<t?t:e>n?n:e}function Xe(e){return e<0?0:e>1?1:e}function Tt(e,t,n){return ct(Math.floor(e),t,n)}const en=e=>{const t=e<0?0:e;return t/(1+t)},tn=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return Xe(n/r)},Vn=4,us=1,fs=16,ds=.5,$n={linear:([e,t,n])=>[Xe(e),Xe(t),Xe(n)],srgb:([e,t,n])=>[Xe(e),Xe(t),Xe(n)],reinhard:([e,t,n])=>[en(e),en(t),en(n)],aces:([e,t,n])=>[tn(e),tn(t),tn(n)],extended:([e,t,n])=>[e,t,n]},Xn="srgb",Wn=["linear","srgb","reinhard","aces"],Hn=["extended","extended-reinhard","extended-aces"],ps=["extended-reinhard","extended-aces"];function Yn(e){return!!e&&Hn.includes(e)}function hs(e){return!!e&&ps.includes(e)}const Kn={extended:"linear","extended-reinhard":"reinhard","extended-aces":"aces"};function ms(e){return e&&$n[e]||$n[Xn]}function nn(e){return e&&Kn[e]?Kn[e]:e&&Wn.includes(e)?e:Xn}function gs(e,t){return t?Yn(e)?e:"extended":nn(e)}function At(e,t,n){return e*2**t+n}function xs(e){const t=Xe(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function rn(e,t){return typeof t=="number"&&t>0?Xe(Math.pow(Xe(e),1/t)):xs(e)}function on(e,t,n="linear",r=0,o=0){const s=Jt(t),i=new ImageData(e.width,e.height),l=e.data,a=i.data,u=r!==0||o!==0;for(let p=0;p<l.length;p+=4){let g=(l[p]+l[p+1]+l[p+2])/3;u&&(g=Math.max(0,Math.min(255,At(g/255,r,o)*255)));let h;n==="positive"?h=Math.round(128+g/255*127):h=Math.round(g),h=Math.max(0,Math.min(255,h)),a[p]=s[h*3],a[p+1]=s[h*3+1],a[p+2]=s[h*3+2],a[p+3]=l[p+3]}return i}function bs(e,t){return e==="signed"||e==="relative"?"signed":sn(t)}function sn(e){return ls.has(e??"")?"positive":"linear"}function qn(e,t){const n=new Map;return{get(r){const o=n.get(r);if(o!==void 0)return n.delete(r),n.set(r,o),o},set(r,o){for(n.get(r)!==void 0&&n.delete(r),n.set(r,o);n.size>e;){const i=n.keys().next().value;if(i===void 0)break;n.get(i),n.delete(i)}},has(r){return n.has(r)},get size(){return n.size}}}const Zn=qn(50);function an(e){return Zn.get(e)}function cn(e,t){Zn.set(e,t)}const jn=qn(100);function vs(e){return jn.get(e)}function ws(e,t){jn.set(e,t)}function ys(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),s=new ImageData(r,o);for(let i=0;i<o;i++)for(let l=0;l<r;l++){const a=(i*e.width+l)*4,u=(i*t.width+l)*4,p=(i*r+l)*4;for(let g=0;g<3;g++){const h=e.data[a+g],w=t.data[u+g],E=h-w,v=Math.abs(E),M=Math.max(h,1);let m;switch(n){case"signed":m=(E+255)/2;break;case"absolute":m=v;break;case"squared":m=E*E/255;break;case"relative_signed":m=(E/M+1)*127.5;break;case"relative_absolute":m=v/M*255;break;case"relative_squared":m=E*E/(M*M)*255;break}s.data[p+g]=Math.min(255,Math.max(0,Math.round(m)))}s.data[p+3]=255}return s}async function lt(e){const t=vs(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const s=o.getContext("2d");if(!s){n(null);return}s.drawImage(r,0,0);const i=s.getImageData(0,0,o.width,o.height);ws(e,i),n(i)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const Es={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},_s={linear:0,signed:1,positive:2},Ms=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,Ss=`#version 300 es
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
}`;let ut=null,ne=null,Oe=null,Ct=null;function Ps(){if(ne)return ne;try{if(typeof OffscreenCanvas<"u"?ut=new OffscreenCanvas(1,1):ut=document.createElement("canvas"),ne=ut.getContext("webgl2",{preserveDrawingBuffer:!0}),!ne)return console.warn("[cairn] WebGL 2 not available"),null;const e=ne.createShader(ne.VERTEX_SHADER);if(ne.shaderSource(e,Ms),ne.compileShader(e),!ne.getShaderParameter(e,ne.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",ne.getShaderInfoLog(e)),null;const t=ne.createShader(ne.FRAGMENT_SHADER);if(ne.shaderSource(t,Ss),ne.compileShader(t),!ne.getShaderParameter(t,ne.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",ne.getShaderInfoLog(t)),null;if(Oe=ne.createProgram(),ne.attachShader(Oe,e),ne.attachShader(Oe,t),ne.linkProgram(Oe),!ne.getProgramParameter(Oe,ne.LINK_STATUS))return console.error("[cairn] WebGL program link:",ne.getProgramInfoLog(Oe)),null;Ct=ne.createVertexArray(),ne.bindVertexArray(Ct);const n=ne.createBuffer();ne.bindBuffer(ne.ARRAY_BUFFER,n),ne.bufferData(ne.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),ne.STATIC_DRAW);const r=ne.getAttribLocation(Oe,"a_pos");return ne.enableVertexAttribArray(r),ne.vertexAttribPointer(r,2,ne.FLOAT,!1,0,0),ne.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),ne}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function Qn(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function Ts(e,t,n){const r=new Uint8Array(1024);for(let s=0;s<256;s++)r[s*4]=t[s*3],r[s*4+1]=t[s*3+1],r[s*4+2]=t[s*3+2],r[s*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function As(e,t,n,r){const o=Ps();if(!o||!Oe||!Ct||!ut)return null;const s=Math.min(e.width,t.width),i=Math.min(e.height,t.height);ut.width=s,ut.height=i,o.viewport(0,0,s,i);const l=Qn(o,e,0),a=Qn(o,t,1);let u=null;n.colormap?u=Ts(o,n.colormap,2):(u=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,u),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(Oe),o.uniform1i(o.getUniformLocation(Oe,"u_baseline"),0),o.uniform1i(o.getUniformLocation(Oe,"u_other"),1),o.uniform1i(o.getUniformLocation(Oe,"u_lut"),2),o.uniform1i(o.getUniformLocation(Oe,"u_diff_mode"),Es[n.diffMode]),o.uniform1i(o.getUniformLocation(Oe,"u_cmap_mode"),_s[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(Oe,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(Ct),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=s,r.height=i;const p=r.getContext("2d");return p&&(p.save(),p.scale(1,-1),p.drawImage(ut,0,0,s,i,0,-i,s,i),p.restore()),o.deleteTexture(l),o.deleteTexture(a),o.deleteTexture(u),{width:s,height:i}}const Cs="cairn:render-mode";function Rs(){try{const e=localStorage.getItem(Cs);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const ks=.299,Ds=.587,Ls=.114;function bt(e,t,n){return(ks*e+Ds*t+Ls*n)/255}const Rt=15360;function kt(e){const t=e&32768?-1:1,n=e>>10&31,r=e&1023;return n===0?r===0?t*0:t*r*2**-24:n===31?r===0?t*(1/0):NaN:t*2**(n-15)*(1+r/1024)}const Jn=globalThis.Float16Array;function er(e,t=e.length){if(Jn){const r=new Jn(e.buffer,e.byteOffset,t);return Float32Array.from(r)}const n=new Float32Array(t);for(let r=0;r<t;r++)n[r]=kt(e[r]);return n}const We=new Uint32Array(512),He=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(We[e]=0,We[e|256]=32768,He[e]=24,He[e|256]=24):t<-14?(We[e]=1024>>-t-14,We[e|256]=1024>>-t-14|32768,He[e]=-t-1,He[e|256]=-t-1):t<=15?(We[e]=t+15<<10,We[e|256]=t+15<<10|32768,He[e]=13,He[e|256]=13):t<128?(We[e]=31744,We[e|256]=64512,He[e]=24,He[e|256]=24):(We[e]=31744,We[e|256]=64512,He[e]=13,He[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var vt=Uint8Array,tr=Uint16Array,Bs=Int32Array,Os=new vt([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),Is=new vt([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),nr=function(e,t){for(var n=new tr(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new Bs(n[30]),r=1;r<30;++r)for(var s=n[r];s<n[r+1];++s)o[s]=s-n[r]<<5|r;return{b:n,r:o}},rr=nr(Os,2),Ns=rr.b,Fs=rr.r;Ns[28]=258,Fs[258]=28,nr(Is,0);for(var Us=new tr(32768),we=0;we<32768;++we){var ot=(we&43690)>>1|(we&21845)<<1;ot=(ot&52428)>>2|(ot&13107)<<2,ot=(ot&61680)>>4|(ot&3855)<<4,Us[we]=((ot&65280)>>8|(ot&255)<<8)>>1}for(var Dt=new vt(288),we=0;we<144;++we)Dt[we]=8;for(var we=144;we<256;++we)Dt[we]=9;for(var we=256;we<280;++we)Dt[we]=7;for(var we=280;we<288;++we)Dt[we]=8;for(var Gs=new vt(32),we=0;we<32;++we)Gs[we]=5;var zs=new vt(0),Vs=typeof TextDecoder<"u"&&new TextDecoder,$s=0;try{Vs.decode(zs,{stream:!0}),$s=1}catch{}const or=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function ln(e){const t=or.length;return or[(e%t+t)%t]}function Xs(e){const n=c.useRef(null),[r,o]=c.useState({w:0,h:0}),s=c.useRef(null),i=c.useRef(null),l=c.useRef(null),a=c.useCallback((u,p)=>{o(g=>g.w===u&&g.h===p?g:{w:u,h:p})},[]);return c.useLayoutEffect(()=>{const u=n.current;if(!u||u===l.current)return;const p=u.getBoundingClientRect();(p.width>0||p.height>0)&&(l.current=u,a(p.width,p.height))}),c.useEffect(()=>{var g;const u=n.current;if(u===i.current||((g=s.current)==null||g.disconnect(),s.current=null,i.current=u,!u))return;const p=new ResizeObserver(h=>{for(const w of h)a(w.contentRect.width,w.contentRect.height)});s.current=p,p.observe(u)}),c.useEffect(()=>()=>{var u;return(u=s.current)==null?void 0:u.disconnect()},[]),{ref:n,size:r}}function Ws(){const[e,t]=c.useState(!1);return c.useEffect(()=>{const n=s=>{(s.key==="Alt"||s.key==="Control"||s.key==="Meta")&&t(!0)},r=s=>{(s.key==="Alt"||s.key==="Control"||s.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const Hs=.001;function Ys(e,t=Hs){return Math.exp(-e*t)}function sr(e,t){return Math.hypot(e.x-t.x,e.y-t.y)}function ir(e,t){return{x:(e.x+t.x)/2,y:(e.y+t.y)/2}}function Ks(e,t,n,r,o,s,i){const l=t>0&&r>0?r/t:1,a=Math.max(s,Math.min(i,e.zoom*l)),u=(n.x-e.pan.x)/e.zoom,p=(n.y-e.pan.y)/e.zoom;return{zoom:a,pan:{x:o.x-u*a,y:o.y-p*a}}}const qs=.25,un=64;function fn(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return un;const o=Math.min(n/e,r/t);return o<=0?un:Math.max(Math.max(n,r)/o,8)}function ar(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:s=qs,maxZoom:i=un,naturalWidth:l,naturalHeight:a}=e,u=Ws(),p=c.useRef(u);p.current=u;const g=c.useRef({zoom:n,pan:r});g.current={zoom:n,pan:r};const h=c.useRef(o);h.current=o,c.useEffect(()=>{const T=t.current;if(!T||!o)return;const S=P=>{var Z;if(!P.ctrlKey&&!p.current)return;P.preventDefault(),P.stopPropagation();const R=Ys(P.deltaY),D=g.current,A=T.getBoundingClientRect(),N=l&&a?fn(l,a,A.width,A.height):i,L=Math.max(s,Math.min(N,D.zoom*R));if(D.zoom===L)return;const B=P.clientX-A.left,U=P.clientY-A.top,I=B-(B-D.pan.x)/D.zoom*L,re=U-(U-D.pan.y)/D.zoom*L;(Z=h.current)==null||Z.call(h,{zoom:L,pan:{x:I,y:re}})};return T.addEventListener("wheel",S,{passive:!1}),()=>T.removeEventListener("wheel",S)},[t,!!o,s,i,l,a]);const w=c.useRef(new Map),E=c.useRef(null),v=c.useRef(null),M=c.useCallback((T,S,P)=>{const R=T.getBoundingClientRect();return{x:S-R.left,y:P-R.top}},[]),m=c.useCallback(T=>{if(!l||!a)return i;const S=T.getBoundingClientRect();return fn(l,a,S.width,S.height)},[l,a,i]),f=c.useCallback((T,S)=>{const P=w.current,R=P.get(T),D=P.get(S);!R||!D||(E.current=null,v.current={idA:T,idB:S,startDist:sr(R,D),startMid:ir(R,D),startZoom:g.current.zoom,startPan:{...g.current.pan}})},[]),b=c.useCallback(T=>{const S=w.current.get(T);S&&(E.current={pointerId:T,startX:S.x,startY:S.y,panX:g.current.pan.x,panY:g.current.pan.y})},[]),x=c.useCallback(T=>{if(!h.current)return;const S=T.pointerType==="touch";if(!S&&!p.current)return;const P=T.currentTarget;if(P.setPointerCapture(T.pointerId),w.current.set(T.pointerId,M(P,T.clientX,T.clientY)),S&&w.current.size>=2){const R=[...w.current.keys()];f(R[R.length-2],R[R.length-1]);return}b(T.pointerId)},[M,f,b]),_=c.useCallback(T=>{var A,N;const S=T.currentTarget,P=w.current.get(T.pointerId);if(P){const L=M(S,T.clientX,T.clientY);P.x=L.x,P.y=L.y}const R=v.current;if(R){const L=w.current.get(R.idA),B=w.current.get(R.idB);if(!L||!B)return;const U=Ks({zoom:R.startZoom,pan:R.startPan},R.startDist,R.startMid,sr(L,B),ir(L,B),s,m(S));(A=h.current)==null||A.call(h,U);return}const D=E.current;!D||D.pointerId!==T.pointerId||!P||(N=h.current)==null||N.call(h,{zoom:g.current.zoom,pan:{x:D.panX+(P.x-D.startX),y:D.panY+(P.y-D.startY)}})},[M,s,m]),y=c.useCallback(T=>{var P;try{T.currentTarget.releasePointerCapture(T.pointerId)}catch{}w.current.delete(T.pointerId);const S=v.current;if(S&&(T.pointerId===S.idA||T.pointerId===S.idB)){v.current=null;const R=[...w.current.keys()];R.length===1&&b(R[0]);return}((P=E.current)==null?void 0:P.pointerId)===T.pointerId&&(E.current=null)},[b]);return{containerProps:{onPointerDown:x,onPointerMove:_,onPointerUp:y,onPointerCancel:y,style:{cursor:u&&!!o?"move":void 0,touchAction:o?"none":void 0}},modifierActive:u}}function dn(){const[e,t]=c.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return c.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),s())};function s(){if(n)return;const i=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${i}dppx)`),r.addEventListener("change",o,{once:!0})}return s(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function Qe(e){const t=c.useRef(e),[n,r]=c.useState(e),o=c.useCallback(()=>r(t.current),[]);return[n,r,{reset:o,isModified:!Object.is(n,t.current),default:t.current}]}function Zs(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function cr(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function pn({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:s}=Xs(),i=c.useRef(null),l=c.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),a=c.useMemo(()=>{const v=s.w,M=s.h;if(v<=0||M<=0||n<=0||r<=0)return null;const m=Math.min(v/n,M/r),f=n*m,b=r*m;return{left:(v-f)/2,top:(M-b)/2,width:f,height:b}},[s.w,s.h,n,r]),u=e.masks,p=t.showMasks&&!!u&&u.length>0,g=c.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(c.useEffect(()=>{if(!p||!u)return;const v=i.current;if(!v)return;(v.width!==n||v.height!==r)&&(v.width=n,v.height=r);const M=v.getContext("2d");if(!M)return;M.clearRect(0,0,v.width,v.height);let m=!1;const f=M.createImageData(n,r),b=f.data;let x=u.length,_=!1;const y=()=>{m||_&&M.putImageData(f,0,0)},C=document.createElement("canvas");C.width=n,C.height=r;const T=C.getContext("2d",{willReadFrequently:!0});for(const S of u){const P=new Image;P.onload=()=>{if(!m){if(T){T.clearRect(0,0,n,r),T.drawImage(P,0,0,n,r);const R=T.getImageData(0,0,n,r).data;for(let D=0;D<n*r;D++){const A=R[D*4];if(A===0||l.has(A))continue;const[N,L,B]=Zs(ln(A));b[D*4]=N,b[D*4+1]=L,b[D*4+2]=B,b[D*4+3]=255,_=!0}}x-=1,x===0&&y()}},P.onerror=()=>{x-=1,x===0&&y()},P.src=`data:image/png;base64,${S.png_b64}`}return()=>{m=!0}},[p,u,n,r,g]),!a)return d.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const h=e.boxes??[],w=t.showBoxes&&h.length>0,E=e.class_labels??{};return d.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[p&&d.jsx("canvas",{ref:i,className:"absolute",style:{left:a.left,top:a.top,width:a.width,height:a.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),w&&d.jsx("svg",{className:"absolute",style:{left:a.left,top:a.top,width:a.width,height:a.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:h.map((v,M)=>{if(!cr(v,t,l))return null;const m=v.domain==="pixel"?1:n,f=v.domain==="pixel"?1:r,b=v.position.minX*m,x=v.position.minY*f,_=(v.position.maxX-v.position.minX)*m,y=(v.position.maxY-v.position.minY)*f;return d.jsx("rect",{x:b,y:x,width:_,height:y,fill:"none",stroke:ln(v.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},M)})}),w&&d.jsx("div",{className:"absolute",style:{left:a.left,top:a.top,width:a.width,height:a.height},children:h.map((v,M)=>{if(!cr(v,t,l))return null;const m=v.domain==="pixel"?1/n:1,f=v.domain==="pixel"?1/r:1,b=v.position.minX*m*100,x=v.position.minY*f*100,_=v.label??E[String(v.class_id)]??`#${v.class_id}`,y=v.score!=null?` ${(v.score*100).toFixed(0)}%`:"";return!_&&!y?null:d.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${b}%`,top:`${x}%`,transform:"translateY(-100%)",backgroundColor:ln(v.class_id)},children:d.jsxs("span",{className:"mono",children:[_,y]})},M)})})]})}function js(e,t){const n=t==null?void 0:t.precision,r=Qs(e,n);return t!=null&&t.minus?r.replace("-","−"):r}function Qs(e,t){if(!Number.isFinite(e))return String(e);if(e===0)return"0";const n=Math.abs(e);return n>=1e3||n<.001?e.toExponential(Math.max(0,t-2)):Number(e.toPrecision(t)).toString()}const Js={x:0,y:0,w:1,h:1};function Lt(e){const t=e.sourceWindow??Js,n=t.x*e.naturalWidth,r=t.y*e.naturalHeight,o=t.w*e.naturalWidth,s=t.h*e.naturalHeight,i=Math.min(e.box.width/o,e.box.height/s),l=o*i,a=s*i;return{scale:i,imgLeft:e.box.left+(e.box.width-l)/2,imgTop:e.box.top+(e.box.height-a)/2,srcOriginX:n,srcOriginY:r,visibleW:o,visibleH:s}}function ei(e){return Lt(e).scale}function lr(e,t,n){const r=Lt(n);return{x:r.srcOriginX+(e-r.imgLeft)/r.scale,y:r.srcOriginY+(t-r.imgTop)/r.scale}}function ur(e,t,n){const r=Lt(n);return{x:r.imgLeft+(e-r.srcOriginX)*r.scale,y:r.imgTop+(t-r.srcOriginY)*r.scale}}function ti(e,t){const n=ur(e.x0,e.y0,t),r=ur(e.x1+1,e.y1+1,t);return{left:n.x,top:n.y,width:r.x-n.x,height:r.y-n.y}}function fr(e,t,n,r,o){const s=lr(e,t,o),i=lr(n,r,o),l=o.naturalWidth-1,a=o.naturalHeight-1,u=Math.min(s.x,i.x),p=Math.max(s.x,i.x),g=Math.min(s.y,i.y),h=Math.max(s.y,i.y);return p<0||u>l||h<0||g>a?null:{x0:Tt(u,0,l),y0:Tt(g,0,a),x1:Tt(p,0,l),y1:Tt(h,0,a)}}const hn=30,Bt=["#ff5a5a","#39d353","#5b9bff"];function mn(e){return js(e,{precision:3})}function mt(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):mn(e/255):mn(n==="int"?e*255:e)}function ft(e,t,n,r){return e.length===1?{lines:[mt(e[0],t,n)],luminance:r}:{lines:e.map(o=>mt(o,t,n)),luminance:r,colors:e.map((o,s)=>Bt[s]??null)}}const ni={x:0,y:0,w:1,h:1};function dt({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:s,notation:i="decimal",version:l=0,onActiveChange:a,sourceWindow:u=ni}){const p=c.useRef(null),g=c.useRef(!1),h=dn(),w=c.useRef(a);w.current=a;const E=c.useCallback(M=>{var m;M!==g.current&&(g.current=M,(m=w.current)==null||m.call(w,M))},[]),v=c.useCallback(()=>{var Q;const M=p.current,m=e.current;if(!M)return;const f=window.devicePixelRatio||1,b=M.clientWidth,x=M.clientHeight;if(b===0||x===0)return;M.width!==Math.round(b*f)&&(M.width=Math.round(b*f)),M.height!==Math.round(x*f)&&(M.height=Math.round(x*f));const _=M.getContext("2d");if(!_)return;if(_.setTransform(f,0,0,f,0,0),_.clearRect(0,0,b,x),!m||t<=0||n<=0){E(!1);return}const y=m.getBoundingClientRect(),C=M.getBoundingClientRect();if(y.width===0||y.height===0){E(!1);return}const S=Lt({box:y,naturalWidth:t,naturalHeight:n,sourceWindow:u}),{srcOriginX:P,srcOriginY:R,visibleW:D,visibleH:A,scale:N}=S;if(D<=0||A<=0){E(!1);return}if(N<hn){E(!1);return}const L=S.imgLeft-C.left,B=S.imgTop-C.top,U=Math.max(Math.floor(P),Math.floor(P+(0-L)/N)),I=Math.min(Math.ceil(P+D),Math.ceil(P+(b-L)/N)),re=Math.max(Math.floor(R),Math.floor(R+(0-B)/N)),Z=Math.min(Math.ceil(R+A),Math.ceil(R+(x-B)/N));if(I<=U||Z<=re){E(!1);return}E(!0);const me=L+(0-P)*N,pe=B+(0-R)*N,oe=L+(t-P)*N,Ae=B+(n-R)*N;_.save(),_.beginPath(),_.rect(me,pe,oe-me,Ae-pe),_.clip(),_.textAlign="center",_.textBaseline="middle",_.lineJoin="round";const V=N*.14,$=N-V*2;for(let ee=re;ee<Z;ee++)for(let ue=U;ue<I;ue++){if(ue<0||ee<0||ue>=t||ee>=n)continue;const W=s(ue,ee,i);if(!W||W.lines.length===0)continue;const te=W.lines.length;let ye=1;for(const Fe of W.lines)Fe.length>ye&&(ye=Fe.length);const he=$/(te*1.15),H=$/(ye*.62)||he,Ce=Math.min(he,H,24);if(Ce<6)continue;const fe=L+(ue-P+.5)*N,Ee=B+(ee-R+.5)*N,ae=Ce*1.15,Re=W.luminance<=.55,Ve=Re?"#ffffff":"#000000";_.font=`${Ce}px ui-monospace, SFMono-Regular, Menlo, monospace`,_.lineWidth=Math.max(1.4,Ce*.16),_.strokeStyle=Re?"rgba(0,0,0,0.85)":"rgba(255,255,255,0.9)";let qe=Ee-te*ae/2+ae/2;for(let Fe=0;Fe<W.lines.length;Fe++){const Ge=W.lines[Fe];_.strokeText(Ge,fe,qe),_.fillStyle=((Q=W.colors)==null?void 0:Q[Fe])??Ve,_.fillText(Ge,fe,qe),qe+=ae}}_.restore()},[e,t,n,s,i,E,u]);return c.useEffect(()=>{v()},[v,r,o.x,o.y,l,i,u,h]),c.useEffect(()=>{const M=p.current;if(!M)return;const m=new ResizeObserver(()=>v());return m.observe(M),()=>m.disconnect()},[v]),d.jsx("canvas",{ref:p,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function dr({notation:e,onChange:t,className:n=""}){return d.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const ri=`
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
`,oi=`
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
`;function pr(e){return`
${Ue}
${pt}
${oi}

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
`}const si=pr("select(colorB, colorA, uv.x < split)"),ii=pr("mix(colorA, colorB, alpha)");function ai(e){switch(e){case"center":return{v:"center",h:"center"};case"top-right":return{v:"top",h:"right"};case"bottom-left":return{v:"bottom",h:"left"};case"bottom-right":return{v:"bottom",h:"right"};case"top-left":default:return{v:"top",h:"left"}}}function hr(e,t,n){const{v:r,h:o}=ai(n),s=e.w-t.w,i=e.h-t.h,l=o==="left"?0:o==="right"?s:Math.floor(s/2),a=r==="top"?0:r==="bottom"?i:Math.floor(i/2);return{x:l,y:a}}function yt(e,t,n,r,o="b"){if(r==="fill"){const i=o==="a"?{w:e.w,h:e.h}:{w:t.w,h:t.h};return{fit:r,result:i,offsetA:{x:0,y:0},offsetB:{x:0,y:0}}}const s={w:Math.min(e.w,t.w),h:Math.min(e.h,t.h)};return{fit:r,result:s,offsetA:hr(e,s,n),offsetB:hr(t,s,n)}}function gn(e){return`${e.fit}:${e.result.w}x${e.result.h}:${e.offsetA.x},${e.offsetA.y}:${e.offsetB.x},${e.offsetB.y}`}const xn={linear:0,srgb:1,reinhard:2,aces:3,extended:4,"extended-reinhard":5,"extended-aces":6},mr=new WeakMap;function ci(e,t){let n=mr.get(e);n||(n=new Map,mr.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:ri,targetFormat:t}),n.set(t,r)),r}function gr(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function xr(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function li(e,t,n,r){var M;const o=gr(t),s=ci(e,o),i=xr(e,r.isScalar?r.colormap:void 0),l=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,a=xn[r.operator]??xn.srgb,u=new Float32Array([r.exposureEV,a,l,r.isScalar?1:0]),p=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),g=new Float32Array([r.hdrOut?1:0]),h=new Float32Array([r.filter==="nearest"?0:1]),w=new Float32Array([r.offset??0]),E=new Float32Array([r.peak??Vn]);let v;try{v=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:i},{binding:2,resource:{uniform:u}},{binding:3,resource:{uniform:p}},{binding:4,resource:{uniform:g}},{binding:5,resource:{uniform:h}},{binding:6,resource:{uniform:w}},{binding:7,resource:{uniform:E}}]),e.renderFullscreen(t,s,v)}finally{(M=v==null?void 0:v.destroy)==null||M.call(v),i.destroy()}}const br=new WeakMap;function ui(e,t,n){let r=br.get(e);r||(r=new Map,br.set(e,r));const o=`${t}:${n}`;let s=r.get(o);return s||(s=e.createRenderPipeline({shaderWGSL:t==="split"?si:ii,targetFormat:n}),r.set(o,s)),s}function fi(e,t,n,r,o){var v;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const s=gr(t),i=ui(e,o.mode,s),l=xr(e,void 0),a=o.gamma,u=xn[o.operator],p=new Float32Array([o.exposureEV,u,a,0]),g=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),h=new Float32Array([o.split,o.alpha,0,o.filter==="nearest"?0:1]),w=new Float32Array([o.offset??0,0,0,0]);let E;try{E=e.createBindGroup(i,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:l},{binding:3,resource:{uniform:p}},{binding:4,resource:{uniform:g}},{binding:5,resource:{uniform:h}},{binding:6,resource:{uniform:w}}]),e.renderFullscreen(t,i,E)}finally{(v=E==null?void 0:E.destroy)==null||v.call(E),l.destroy()}}function vr(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,s=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:s,mae:o}}async function wr(e,t,n,r){const o=r??yt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),s=o.result.w,i=o.result.h,l=s*i*3;if(l<=0)return{mse:0,psnr:1/0,mae:0};if(o.fit==="crop"&&o.offsetA.x===0&&o.offsetA.y===0&&o.offsetB.x===0&&o.offsetB.y===0&&e.reduceDiffSumSquaredAbs){const{sumSq:b,sumAbs:x}=await e.reduceDiffSumSquaredAbs(t,n,s,i);return vr(b,x,l)}const u=await e.readback(t),p=await e.readback(n),g=u instanceof Uint8Array?255:1,h=p instanceof Uint8Array?255:1,w=It(u,t.width,t.height,g,o.offsetA,o.fit==="fill",s,i),E=It(p,n.width,n.height,h,o.offsetB,o.fit==="fill",s,i);let v=0,M=0;const m=[0,0,0],f=[0,0,0];for(let b=0;b<i;b++)for(let x=0;x<s;x++){w(x,b,m),E(x,b,f);for(let _=0;_<3;_++){const y=m[_]-f[_];v+=y*y,M+=Math.abs(y)}}return vr(v,M,l)}function It(e,t,n,r,o,s,i,l){const a=(g,h,w)=>e[(h*t+g)*4+w]??0;if(!s)return(g,h,w)=>{const E=Math.min(Math.max(g+o.x,0),t-1),v=Math.min(Math.max(h+o.y,0),n-1);w[0]=a(E,v,0)/r,w[1]=a(E,v,1)/r,w[2]=a(E,v,2)/r};const u=t-1,p=n-1;return(g,h,w)=>{const E=(g+.5)/i,v=(h+.5)/l,M=E*t-.5,m=v*n-.5,f=Math.floor(M),b=Math.floor(m),x=M-f,_=m-b,y=Math.min(Math.max(f,0),u),C=Math.min(Math.max(f+1,0),u),T=Math.min(Math.max(b,0),p),S=Math.min(Math.max(b+1,0),p);for(let P=0;P<3;P++){const R=a(y,T,P),D=a(C,T,P),A=a(y,S,P),N=a(C,S,P),L=R+(D-R)*x,B=A+(N-A)*x;w[P]=(L+(B-L)*_)/r}}}function yr(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const di=12,st=[];function Er(e){const t=st.indexOf(e);t!==-1&&st.splice(t,1),st.push(e)}function pi(e){const t=st.indexOf(e);t!==-1&&st.splice(t,1)}function Nt(e){e.parked||(pi(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),e.surface=null,e.parked=!0)}function _r(e){for(;st.length>di;){const t=st.find(n=>n!==e&&!n.visible)??st.find(n=>n!==e);if(!t)break;Nt(t)}}function Mr(e){var o,s,i,l;if(e.disposed)return;if(yr())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){Er(e),_r(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||((s=e.deep)==null?void 0:s.width)||1,r=e.backingHeight||((i=e.source)==null?void 0:i.height)||((l=e.deep)==null?void 0:l.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.deep){const a=t.createTexture(e.deep.width,e.deep.height,"rgba16float");e.srcTexture=a,e.deepBuffers=t.createDeepSampleBuffers(e.deep),t.compositeDeep(e.deepBuffers,a,e.deepZNear,e.deepZFar)}else if(e.source){const a=t.createTexture(e.source.width,e.source.height,e.source.format);a.write(e.source.data),e.srcTexture=a}e.parked=!1,Er(e),_r(e)}function hi(e,t){if(e.disposed||!e.source&&!e.deep)return!0;try{return Mr(e),!e.surface||!e.srcTexture?!1:(li(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,Nt(e),!1}}function mi(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,e.deep=null,e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},setDeepSource(t,n,r){if(!e.disposed&&(e.deep=t,e.deepZNear=n,e.deepZFar=r,e.source=null,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy(),e.deepBuffers&&e.deepBuffers.destroy();const o=e.device.createTexture(t.width,t.height,"rgba16float");e.srcTexture=o,e.deepBuffers=e.device.createDeepSampleBuffers(t),e.device.compositeDeep(e.deepBuffers,o,n,r)}},setDeepWindow(t,n){e.disposed||(e.deepZNear=t,e.deepZFar=n,!e.parked&&e.deepBuffers&&e.srcTexture&&e.device.compositeDeep(e.deepBuffers,e.srcTexture,t,n))},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return hi(e,t)},park(){e.disposed||Nt(e)},restore(){e.disposed||!e.source&&!e.deep||Mr(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(Nt(e),e.source=null,e.deep=null,e.disposed=!0)}}}async function gi(e,t){const n=await Pt(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,deep:null,deepZNear:-1/0,deepZFar:1/0,deepBuffers:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return mi(r)}function Sr(e){e.dispose()}function Pr({title:e,body:t,className:n}){return d.jsx("div",{className:n??"relative h-full w-full",children:d.jsxs("div",{className:"flex h-full w-full flex-col items-center justify-center gap-1 rounded bg-bg-hover p-4 text-center",children:[d.jsx("div",{className:"text-sm font-semibold text-fg",children:e}),d.jsx("div",{className:"text-xs text-fg-muted",children:t})]})})}function xi(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:s}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...s?["invert(1)"]:[]].join(" ")}function Tr(e){const n=`cairn-gamma-${c.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:s,exposure:i,offset:l,flipSign:a}=e,u=c.useMemo(()=>xi(e,n),[n,r,o,i,a]);return{gammaFilterId:n,filterStr:u,gamma:s,offset:l}}function Ar({id:e,gamma:t,offset:n}){return d.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:d.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:d.jsxs("feComponentTransfer",{children:[d.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),d.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),d.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}const bi=["nw","n","ne","e","se","s","sw","w"];function vi(e,t,n,r,o,s=1){const i=o.w-1,l=o.h-1,a=Math.round(n),u=Math.round(r);if(t==="move"){const f=e.x1-e.x0,b=e.y1-e.y0,x=ct(e.x0+a,0,i-f),_=ct(e.y0+u,0,l-b);return{x0:x,y0:_,x1:x+f,y1:_+b}}let{x0:p,y0:g,x1:h,y1:w}=e;const E=t==="nw"||t==="w"||t==="sw",v=t==="ne"||t==="e"||t==="se",M=t==="nw"||t==="n"||t==="ne",m=t==="sw"||t==="s"||t==="se";return E&&(p=ct(p+a,0,h-(s-1))),v&&(h=ct(h+a,p+(s-1),i)),M&&(g=ct(g+u,0,w-(s-1))),m&&(w=ct(w+u,g+(s-1),l)),{x0:p,y0:g,x1:h,y1:w}}function Cr(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function wi({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=Cr(e),s=Cr(t),i=[];for(let f=0;f<=e;f+=o)i.push(f);const l=[];for(let f=0;f<=t;f+=s)l.push(f);const a=1/n,u=8*a,p=-12*a,g=-2*a,h=r==null?void 0:r.current;let w=0,E=0,v=0,M=0;if(h){const f=h.clientWidth,b=h.clientHeight,x=f/e,_=b/t,y=Math.min(x,_);v=e*y,M=t*y,w=(f-v)/2,E=(b-M)/2}const m=h&&v>0;return d.jsxs(d.Fragment,{children:[d.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:m?E:0,transform:`translateY(${p}px)`,fontSize:u},children:i.map(f=>d.jsx("span",{className:"mono",style:{position:"absolute",left:m?w+f/e*v:`${f/e*100}%`,transform:"translateX(-50%)"},children:f},f))}),d.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:m?w:0,transform:`translateX(${g}px)`,fontSize:u},children:l.map(f=>d.jsx("span",{className:"mono",style:{position:"absolute",top:m?E+f/t*M:`${f/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*a}px`},children:f},f))})]})}function bn({label:e,corner:t="bottom-left",isDraggable:n=!1,grip:r=n,onDragStart:o}){const s=t==="bottom-right"?"bottom-1 right-1":"bottom-1 left-1";return d.jsxs("span",{className:`absolute ${s} z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${n?" cairn-drag-grip":""}`,draggable:n,onDragStart:o,style:{cursor:n?"grab":void 0},children:[r&&d.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const yi=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function Rr(e,t){const n=getComputedStyle(e),r=yi.map(a=>`${a}:${n.getPropertyValue(a)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const s=e.children,i=t.children,l=Math.min(s.length,i.length);for(let a=0;a<l;a++)Rr(s[a],i[a])}function vn(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function wn(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function yn(e,t,n,r,o){const s=document.createElement("canvas");s.width=Math.max(1,Math.round(e*n)),s.height=Math.max(1,Math.round(t*n));const i=s.getContext("2d");if(!i)throw new Error("plot-to-png: 2D canvas context unavailable");return i.scale(n,n),r&&(i.fillStyle=r,i.fillRect(0,0,e,t)),o(i),await new Promise((l,a)=>s.toBlob(u=>u?l(u):a(new Error("plot-to-png: toBlob returned null")),"image/png"))}function Ei(e,t,n){const r=e.cloneNode(!0);Rr(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),s="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((i,l)=>{const a=new Image;a.onload=()=>i(a),a.onerror=()=>l(new Error("plot-to-png: SVG rasterization failed")),a.src=s})}async function kr(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,s=(t==null?void 0:t.background)??vn(e);return yn(r,o,wn(t),s,i=>i.drawImage(e,0,0,r,o))}async function _i(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,s=(t==null?void 0:t.background)??vn(e);try{return await yn(r,o,wn(t),s,i=>i.drawImage(e,0,0,r,o))}catch(i){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${i instanceof Error?i.message:String(i)})`)}}function Mi(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const s=o.getBoundingClientRect(),i=s.width*s.height;i>r&&(r=i,n=o)}return n}async function Si(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),s=o.width||300,i=o.height||150,l=(t==null?void 0:t.background)??vn(e);if(n){const u=n.getBoundingClientRect(),p=await Ei(n,u.width||s,u.height||i);return yn(s,i,wn(t),l,g=>{for(const h of r){const w=h.getBoundingClientRect();g.drawImage(h,w.left-o.left,w.top-o.top,w.width,w.height)}g.drawImage(p,u.left-o.left,u.top-o.top,u.width,u.height)})}if(r.length)return kr(r[0],t);const a=Mi(e);if(a)return _i(a,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function Pi(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const Ti=8;function Ai(e,t,n,r=Ti){return!(t>0)||!(e>0)?n:e<t+r}function Dr(e,t){return Math.max(0,e.findIndex(n=>n.id===t))}function Ci(e){const t=e.trim();if(t==="")return null;const n=t.replace(/−/g,"-").replace(",","."),r=Number(n);return Number.isFinite(r)?r:null}function Ri(e,t){const n=Ci(e);return n===null?t:n}function ki(e){return String(e)}const Di={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},Li={boxZoom:d.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:d.jsxs(d.Fragment,{children:[d.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),d.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:d.jsxs(d.Fragment,{children:[d.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),d.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),d.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:d.jsxs(d.Fragment,{children:[d.jsx("path",{d:"M12 2v20M2 12h20"}),d.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:d.jsxs(d.Fragment,{children:[d.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),d.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:d.jsxs(d.Fragment,{children:[d.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),d.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:d.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:d.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:d.jsxs(d.Fragment,{children:[d.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),d.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:d.jsx("path",{d:"M6 9l6 6 6-6"}),ellipsis:d.jsxs(d.Fragment,{children:[d.jsx("circle",{cx:"5",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),d.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),d.jsx("circle",{cx:"19",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"})]}),sun:d.jsxs(d.Fragment,{children:[d.jsx("circle",{cx:"12",cy:"12",r:"4"}),d.jsx("path",{d:"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"})]}),plusminus:d.jsxs(d.Fragment,{children:[d.jsx("path",{d:"M4 7h6M7 4v6"}),d.jsx("path",{d:"M14 17h6"}),d.jsx("path",{d:"M6 20l12-16"})]}),layers:d.jsxs(d.Fragment,{children:[d.jsx("path",{d:"M12 3l9 5-9 5-9-5 9-5z"}),d.jsx("path",{d:"M3 13l9 5 9-5"})]})};function Je({name:e}){return d.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:Li[e]??null})}function Lr({icon:e,label:t,title:n,active:r,disabled:o,onClick:s}){return d.jsx("button",{type:"button",disabled:o,onClick:i=>{i.stopPropagation(),!o&&s()},onPointerDown:i=>i.stopPropagation(),onDoubleClick:i=>i.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?d.jsx("span",{"aria-hidden":"true",children:t}):d.jsx(Je,{name:e??""})})}function Br(){return d.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function Or(e,t,n){const r=c.useRef(n);r.current=n,c.useEffect(()=>{if(!e)return;const o=i=>{t.current&&!t.current.contains(i.target)&&r.current()},s=i=>{i.key==="Escape"&&(i.stopPropagation(),r.current())};return document.addEventListener("pointerdown",o,!0),document.addEventListener("keydown",s,!0),()=>{document.removeEventListener("pointerdown",o,!0),document.removeEventListener("keydown",s,!0)}},[e,t])}function Bi({icon:e,title:t,menu:n}){var M;const{options:r,value:o,onSelect:s}=n,[i,l]=c.useState(!1),[a,u]=c.useState(0),p=c.useRef(null),g=Dr(r,o),h=e?void 0:((M=r[g])==null?void 0:M.label)??"",w=c.useCallback(()=>{l(m=>{const f=!m;return f&&u(g),f})},[g]),E=c.useCallback(m=>{s(m),l(!1)},[s]);Or(i,p,()=>l(!1));const v=m=>{if(!i){(m.key==="ArrowDown"||m.key==="Enter"||m.key===" ")&&(m.preventDefault(),u(g),l(!0));return}if(m.key==="ArrowDown")m.preventDefault(),u(f=>(f+1)%r.length);else if(m.key==="ArrowUp")m.preventDefault(),u(f=>(f-1+r.length)%r.length);else if(m.key==="Enter"||m.key===" "){m.preventDefault();const f=r[a];f&&E(f.id)}};return d.jsxs("div",{ref:p,className:"relative inline-flex",onPointerDown:m=>m.stopPropagation(),children:[d.jsxs("button",{type:"button",onClick:m=>{m.stopPropagation(),w()},onDoubleClick:m=>m.stopPropagation(),onKeyDown:v,"aria-haspopup":"listbox","aria-expanded":i,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",h?"px-1.5 text-[10px] font-mono":"px-1 text-xs",i?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[h?d.jsx("span",{"aria-hidden":"true",children:h}):d.jsx(Je,{name:e??""}),d.jsx(Je,{name:"caret"})]}),i&&d.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((m,f)=>{const b=m.id===o,x=f===a;return d.jsx("li",{role:"option","aria-selected":b,children:d.jsx("button",{type:"button",onClick:_=>{_.stopPropagation(),E(m.id)},onPointerEnter:()=>u(f),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",x?"bg-bg-hover":"",b?"text-accent font-medium":"text-fg"].join(" "),children:m.label})},m.id)})})]})}const Oi=e=>e.format?e.format(e.value):String(e.value);function Ir({spec:e}){const[t,n]=c.useState(!1),[r,o]=c.useState(""),s=c.useRef(null),i=c.useCallback(()=>{o(ki(e.value)),n(!0)},[e.value]);c.useEffect(()=>{t&&s.current&&(s.current.focus(),s.current.select())},[t]);const l=c.useCallback(()=>{n(u=>(u&&e.onChange(Ri(r,e.value)),!1))},[r,e]),a=c.useCallback(()=>n(!1),[]);return d.jsxs("label",{className:"inline-flex items-center gap-1 text-fg-muted",title:e.title,onPointerDown:u=>u.stopPropagation(),onDoubleClick:u=>{u.stopPropagation(),t||i()},children:[e.icon?d.jsx("span",{"aria-hidden":"true",className:"inline-flex",children:d.jsx(Je,{name:e.icon})}):d.jsx("span",{"aria-hidden":"true",className:"text-[9px] font-mono",children:e.label}),t?d.jsx("input",{ref:s,type:"text",inputMode:"decimal","aria-label":`${e.title} (numeric entry)`,value:r,onChange:u=>o(u.target.value),onPointerDown:u=>u.stopPropagation(),onDoubleClick:u=>u.stopPropagation(),onKeyDown:u=>{u.stopPropagation(),u.key==="Enter"?(u.preventDefault(),l()):u.key==="Escape"&&(u.preventDefault(),a())},onBlur:l,className:"cairn-plot-toolbar-slider-entry h-3.5 w-[6.5rem] rounded border border-border bg-bg px-1 text-[9px] font-mono tabular-nums text-fg outline-none focus:border-accent"}):d.jsxs(d.Fragment,{children:[d.jsx("input",{type:"range","aria-label":e.title,min:e.min,max:e.max,step:e.step,value:e.value,onChange:u=>e.onChange(Number(u.target.value)),onPointerDown:u=>u.stopPropagation(),className:"cairn-plot-toolbar-slider h-1 w-16 cursor-pointer accent-accent"}),d.jsx("span",{"aria-hidden":"true",className:"w-8 text-right text-[9px] font-mono tabular-nums",children:Oi(e)})]})]})}function Ii({icon:e,title:t,menu:n,onClose:r}){var g;const{options:o,value:s,onSelect:i}=n,[l,a]=c.useState(!1),u=Dr(o,s),p=((g=o[u])==null?void 0:g.label)??"";return d.jsxs("div",{children:[d.jsxs("button",{type:"button","aria-haspopup":"menu","aria-expanded":l,"aria-label":t,onClick:h=>{h.stopPropagation(),a(w=>!w)},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",l?"text-accent":"text-fg hover:bg-bg-hover"].join(" "),children:[e?d.jsx(Je,{name:e}):d.jsx("span",{className:"w-[13px]"}),d.jsx("span",{className:"flex-1",children:t}),d.jsx("span",{className:"font-mono text-[10px] text-fg-muted",children:p}),d.jsx("span",{className:l?"rotate-180 transition-transform":"transition-transform",children:d.jsx(Je,{name:"caret"})})]}),l&&o.map(h=>{const w=h.id===s;return d.jsxs("button",{type:"button",role:"menuitemradio","aria-checked":w,"data-menu-option":"",onClick:E=>{E.stopPropagation(),i(h.id),r()},className:["flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-[11px]",w?"text-accent font-medium bg-bg-hover/40":"text-fg hover:bg-bg-hover"].join(" "),children:[d.jsx("span",{"aria-hidden":"true",className:"w-3 text-center text-accent",children:w?"✓":""}),d.jsx("span",{children:h.label})]},h.id)})]})}function Ni({actions:e,leading:t,sliders:n}){const[r,o]=c.useState(!1),s=c.useRef(null);return Or(r,s,()=>o(!1)),d.jsxs("div",{ref:s,className:"relative inline-flex",onPointerDown:i=>i.stopPropagation(),children:[d.jsx("button",{type:"button",onClick:i=>{i.stopPropagation(),o(l=>!l)},onDoubleClick:i=>i.stopPropagation(),"aria-haspopup":"menu","aria-expanded":r,"aria-label":"More controls",title:"More controls",className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded text-xs",r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:d.jsx(Je,{name:"ellipsis"})}),r&&d.jsxs("div",{role:"menu",className:["absolute right-0 top-full z-40 mt-1 min-w-[10rem] max-h-80 overflow-auto","rounded border border-border bg-bg-elevated py-1 shadow-md"].join(" "),children:[t.map(i=>i.menu?d.jsx(Ii,{icon:i.icon,title:i.title,menu:i.menu,onClose:()=>o(!1)},i.id):d.jsxs("button",{type:"button",disabled:i.disabled,onClick:l=>{var a;l.stopPropagation(),!i.disabled&&((a=i.onClick)==null||a.call(i),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",i.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",i.active?"text-accent":""].join(" "),children:[i.icon?d.jsx(Je,{name:i.icon}):d.jsx("span",{className:"w-[13px]"}),d.jsx("span",{children:i.label??i.title})]},i.id)),t.length>0&&e.length>0&&d.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),e.map(i=>d.jsxs("button",{type:"button",role:"menuitem",disabled:i.disabled,onClick:l=>{l.stopPropagation(),!i.disabled&&(i.onClick(),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",i.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",i.active?"text-accent":""].join(" "),children:[i.icon?d.jsx(Je,{name:i.icon}):d.jsx("span",{className:"w-[13px]"}),d.jsx("span",{children:i.title})]},i.id)),n.length>0&&(e.length>0||t.length>0)&&d.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),n.map(i=>d.jsx("div",{className:"px-2 py-1",children:d.jsx(Ir,{spec:i})},i.id))]})]})}function Fi({controller:e,config:t}){var R,D;const n=c.useRef(null),[r,o]=c.useState(!1),s=c.useRef(r);s.current=r;const i=c.useRef(0),l=`${((R=t==null?void 0:t.leadingButtons)==null?void 0:R.length)??0}:${((D=t==null?void 0:t.sliders)==null?void 0:D.length)??0}:${(t==null?void 0:t.visibility)??"hover"}`;if(c.useEffect(()=>{const A=n.current,N=A==null?void 0:A.parentElement;if(!N)return;const L=()=>{const re=N.clientWidth;if(!s.current&&n.current){const Z=n.current.scrollWidth;Z>0&&(i.current=Z)}o(Ai(re,i.current,s.current))};let B=0;const U=()=>{B||(B=requestAnimationFrame(()=>{B=0,L()}))},I=new ResizeObserver(U);return I.observe(N),L(),()=>{I.disconnect(),B&&cancelAnimationFrame(B)}},[l]),(t==null?void 0:t.enabled)===!1)return null;const a=e.capabilities,u=t==null?void 0:t.buttons,p=(A,N)=>N&&(u==null?void 0:u[A])!==!1,g=A=>()=>e.setDragMode(A),h=()=>{e.toPNG({filename:"plot"}).then(A=>Pi(A,"plot.png")).catch(()=>{})},w=[];p("zoom",a.zoom)&&w.push({id:"zoom",icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:g("zoom")}),p("pan",a.pan)&&w.push({id:"pan",icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:g("pan")}),p("select",a.select)&&w.push({id:"select",icon:"select",title:"Box select",active:e.dragMode==="select",onClick:g("select")}),p("lasso",a.lasso)&&w.push({id:"lasso",icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:g("lasso")});const E=[];p("zoomIn",a.zoom)&&E.push({id:"zoomIn",icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),p("zoomOut",a.zoom)&&E.push({id:"zoomOut",icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()});const v=[];p("autoscale",a.autoscale)&&v.push({id:"autoscale",icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),p("reset",a.reset)&&v.push({id:"reset",icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()});const M=[];p("screenshot",a.screenshot)&&M.push({id:"screenshot",icon:"camera",title:"Download plot as PNG",onClick:h});const m=[w,E,v,M].filter(A=>A.length>0),f=m.flat(),b=(t==null?void 0:t.leadingButtons)??[],x=(t==null?void 0:t.sliders)??[];if(!b.length&&f.length===0&&x.length===0)return null;const _=(t==null?void 0:t.position)??"top-right",y=(t==null?void 0:t.visibility)==="always",C=_==="top-right"||_==="bottom-right",S=["cairn-plot-toolbar z-30 rounded border border-border bg-bg-elevated/90 shadow-sm backdrop-blur-sm transition-opacity",y?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),P={position:"absolute",pointerEvents:"auto",...Di[_]};return r?d.jsx("div",{ref:n,style:P,className:`${S} inline-flex px-0.5 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:d.jsx(Ni,{actions:f,leading:b,sliders:x})}):d.jsxs("div",{ref:n,style:P,className:`${S} flex flex-col gap-0.5 px-1 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:[d.jsxs("div",{className:`flex items-center gap-0.5 ${C?"justify-end":"justify-start"}`,children:[b.length>0&&d.jsxs(d.Fragment,{children:[b.map(A=>A.menu?d.jsx(Bi,{icon:A.icon,title:A.title,menu:A.menu},A.id):d.jsx(Lr,{icon:A.icon,label:A.label,title:A.title,active:A.active,disabled:A.disabled,onClick:A.onClick??(()=>{})},A.id)),m.length>0&&d.jsx(Br,{})]}),m.map((A,N)=>d.jsxs("span",{className:"inline-flex items-center gap-0.5",children:[N>0&&d.jsx(Br,{}),A.map(L=>d.jsx(Lr,{icon:L.icon,title:L.title,active:L.active,disabled:L.disabled,onClick:L.onClick},L.id))]},A[0].id))]}),x.length>0&&d.jsx("div",{className:`flex items-center gap-2 ${C?"justify-end":"justify-start"}`,children:x.map(A=>d.jsx(Ir,{spec:A},A.id))})]})}const Ui={zoom:1,pan:{x:0,y:0}},Nr=1.3,Gi=.25,zi=64,Vi={buttons:{zoom:!1}};function $i(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const Xi=[{id:"none",label:"None"},...cs];function En(e,t){return{id:"colormap",title:"Colormap",menu:{options:Xi,value:e,onSelect:t}}}const Fr={linear:"Linear",srgb:"sRGB",reinhard:"Reinhard",aces:"ACES",extended:"Extended · Linear","extended-reinhard":"Extended · Reinhard","extended-aces":"Extended · ACES"},Ur=Wn.map(e=>({id:e,label:Fr[e]})),Wi=Hn.map(e=>({id:e,label:Fr[e]}));function Gr(e,t,n){return{id:"tonemap",title:"Tone-mapping operator",menu:{options:n?[...Ur,...Wi]:Ur,value:e,onSelect:t}}}function Hi({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:s,naturalHeight:i,minZoom:l=Gi,maxZoom:a=zi,requestRender:u,onReset:p,extraModified:g=!1}){const h=c.useCallback(y=>{var B;if(!o)return;const C=(B=e.current)==null?void 0:B.getBoundingClientRect(),T=(C==null?void 0:C.width)??0,S=(C==null?void 0:C.height)??0,P=s&&i&&T>0&&S>0?fn(s,i,T,S):a,R=Math.max(l,Math.min(P,n*y));if(R===n)return;const D=T/2,A=S/2,N=D-(D-r.x)/n*R,L=A-(A-r.y)/n*R;o({zoom:R,pan:{x:N,y:L}})},[o,e,s,i,a,l,n,r.x,r.y]),w=c.useCallback(()=>h(Nr),[h]),E=c.useCallback(()=>h(1/Nr),[h]),v=c.useCallback(()=>{o==null||o(Ui),p==null||p()},[o,p]),M=c.useCallback(y=>{const C={scale:y==null?void 0:y.scale,filename:y==null?void 0:y.filename};u==null||u();const T=t==null?void 0:t.current;if(T)return kr(T,C);const S=e.current;return S?Si(S,C):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,u]),m=c.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),f=n!==1||r.x!==0||r.y!==0||g,b=c.useCallback(y=>{},[]),x=c.useCallback(y=>{},[]),_=c.useCallback(()=>{},[]);return c.useMemo(()=>({capabilities:m,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:f,setDragMode:b,setHoverMode:x,toggleSpikelines:_,zoomIn:w,zoomOut:E,autoscale:v,reset:v,toPNG:M}),[m,f,b,x,_,w,E,v,M])}const Yi={zoom:1,pan:{x:0,y:0}};function Ft({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:s,pan:i,onViewportChange:l,naturalDims:a,checkerboard:u,wrapperClassName:p,wrapperStyle:g,viewportPadding:h,header:w,surface:E,showAxes:v,overlayNode:M,overlay:m,notationSeed:f,exportCanvasRef:b,requestRender:x,leadingMenus:_,displayAdjust:y,depthSliders:C,extraSliders:T,regionSelect:S,onReset:P,extraModified:R,label:D,showLabelChip:A,isDraggable:N=!1,onDragStart:L,extraChips:B}){const[U,I]=c.useState(f),[re,Z]=c.useState(!1),[me,pe]=c.useState(!1),oe="render"in m?null:m,Ae=!!S&&!!oe,{containerProps:V}=ar({containerRef:r,zoom:s,pan:i,onViewportChange:l,naturalWidth:a==null?void 0:a.w,naturalHeight:a==null?void 0:a.h}),$=c.useCallback(()=>{y==null||y.onExposureChange(0),y==null||y.onOffsetChange(0),P==null||P()},[y,P]),Q=c.useCallback(()=>{l==null||l(Yi),$()},[l,$]),ee=Hi({rootRef:r,canvasRef:b,zoom:s,pan:i,onViewportChange:l,naturalWidth:a==null?void 0:a.w,naturalHeight:a==null?void 0:a.h,requestRender:x,onReset:$,extraModified:((y==null?void 0:y.exposureEV)??0)!==0||((y==null?void 0:y.offset)??0)!==0||!!R}),ue=c.useMemo(()=>{const fe=[];if(C&&fe.push(...C),!y)return T&&fe.push(...T),fe.length?fe:void 0;const Ee=(ae,Re)=>`${ae>=0?"+":"−"}${Math.abs(ae).toFixed(Re)}`;return fe.push({id:"exposure",icon:"sun",label:"EV",title:"Exposure (EV stops) — color × 2^EV. Double-click to type a value (may exceed the slider range).",min:-8,max:8,step:.1,value:y.exposureEV,onChange:y.onExposureChange,format:ae=>Ee(ae,1)},{id:"offset",icon:"plusminus",label:"OFF",title:"Offset — added after exposure (before tonemap). Double-click to type a value (may exceed the slider range).",min:-1,max:1,step:.01,value:y.offset,onChange:y.onOffsetChange,format:ae=>Ee(ae,2)}),T&&fe.push(...T),fe},[y,C,T]),W=c.useMemo(()=>Ae?{id:"region-depth",icon:"select",title:"Select depth from region — drag a rectangle to set the Z window to the samples it covers (Esc to cancel)",active:me,onClick:()=>pe(fe=>!fe)}:null,[Ae,me]),te=c.useMemo(()=>({...Vi,leadingButtons:[..._??[],...W?[W]:[],...re?[$i(U,I)]:[]],sliders:ue}),[re,U,_,W,ue]),ye=" cairn-checkerboard",he="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(u==="pane"?ye:""),H=p+(u==="wrapper"?ye:""),Ce="render"in m?m.render({notation:U,setOverlayActive:Z}):m.hasSource&&a?d.jsx(dt,{imageElRef:m.displayElRef,naturalWidth:a.w,naturalHeight:a.h,zoom:s,pan:i,sourceWindow:m.sourceWindow,sample:m.sample,notation:U,version:m.version,onActiveChange:Z}):null;return d.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[w,n&&d.jsx(Fi,{controller:ee,config:te}),d.jsxs("div",{ref:r,className:he,style:{padding:h,...V.style},onPointerDown:V.onPointerDown,onPointerMove:V.onPointerMove,onPointerUp:V.onPointerUp,onPointerCancel:V.onPointerCancel,onDoubleClick:Q,...t,children:[d.jsxs("div",{ref:o,className:H,style:g,children:[E,v&&a&&d.jsx(wi,{naturalWidth:a.w,naturalHeight:a.h,zoom:s,containerRef:o}),M]}),Ce,!n&&re&&d.jsx(dr,{notation:U,onChange:I}),me&&S&&oe&&a&&d.jsx(Ki,{imageElRef:oe.displayElRef,naturalDims:a,sourceWindow:oe.sourceWindow,onQueryLive:S.queryLive,onSelect:(fe,Ee,ae,Re)=>{pe(!1),S.commit(fe,Ee,ae,Re)},onExit:()=>pe(!1)}),!me&&(S==null?void 0:S.rect)&&oe&&a&&d.jsx(Zi,{rect:S.rect,imageElRef:oe.displayElRef,naturalDims:a,sourceWindow:oe.sourceWindow,zoom:s,pan:i,onQueryLive:S.queryLive,onCommit:S.commit,onRemove:S.remove})]}),A&&d.jsx(bn,{label:D,isDraggable:N,onDragStart:L}),B]})}function Ki({imageElRef:e,naturalDims:t,sourceWindow:n,onQueryLive:r,onSelect:o,onExit:s}){var M;const i=c.useRef(null),l=c.useRef(null),[a,u]=c.useState(null),p=c.useCallback((m,f,b,x)=>{const _=e.current;return _?fr(m,f,b,x,{box:_.getBoundingClientRect(),naturalWidth:t.w,naturalHeight:t.h,sourceWindow:n}):null},[e,t,n]);c.useEffect(()=>{const m=f=>{f.key==="Escape"&&s()};return window.addEventListener("keydown",m),()=>window.removeEventListener("keydown",m)},[s]);const g=c.useCallback(m=>{var f,b;(b=(f=m.target).setPointerCapture)==null||b.call(f,m.pointerId),l.current={x:m.clientX,y:m.clientY},u({x0:m.clientX,y0:m.clientY,x1:m.clientX,y1:m.clientY})},[]),h=c.useCallback(m=>{const f=l.current;if(!f)return;u({x0:f.x,y0:f.y,x1:m.clientX,y1:m.clientY});const b=p(f.x,f.y,m.clientX,m.clientY);b&&r(b.x0,b.y0,b.x1,b.y1)},[p,r]),w=c.useCallback(m=>{const f=l.current;l.current=null,u(null);const b=e.current;if(!f||!b){s();return}if(Math.abs(m.clientX-f.x)<3&&Math.abs(m.clientY-f.y)<3){s();return}const x=b.getBoundingClientRect(),_=fr(f.x,f.y,m.clientX,m.clientY,{box:x,naturalWidth:t.w,naturalHeight:t.h,sourceWindow:n});if(!_){s();return}o(_.x0,_.y0,_.x1,_.y1)},[e,t,n,o,s]),E=(M=i.current)==null?void 0:M.getBoundingClientRect(),v=a&&E?{left:Math.min(a.x0,a.x1)-E.left,top:Math.min(a.y0,a.y1)-E.top,width:Math.abs(a.x1-a.x0),height:Math.abs(a.y1-a.y0)}:null;return d.jsx("div",{ref:i,className:"absolute inset-0 z-20",style:{cursor:"crosshair",touchAction:"none"},onPointerDown:g,onPointerMove:h,onPointerUp:w,children:v&&d.jsx("div",{className:"absolute border-2 border-dashed border-sky-400 bg-sky-400/15 pointer-events-none",style:v})})}const qi={nw:{cursor:"nwse-resize",fx:0,fy:0},n:{cursor:"ns-resize",fx:.5,fy:0},ne:{cursor:"nesw-resize",fx:1,fy:0},e:{cursor:"ew-resize",fx:1,fy:.5},se:{cursor:"nwse-resize",fx:1,fy:1},s:{cursor:"ns-resize",fx:.5,fy:1},sw:{cursor:"nesw-resize",fx:0,fy:1},w:{cursor:"ew-resize",fx:0,fy:.5}};function Zi({rect:e,imageElRef:t,naturalDims:n,sourceWindow:r,zoom:o,pan:s,onQueryLive:i,onCommit:l,onRemove:a}){const u=c.useRef(null),[p,g]=c.useState(null),h=c.useRef(null),[w,E]=c.useState(null),v=p??e;c.useLayoutEffect(()=>{const b=()=>{const y=t.current,C=u.current;if(!y||!C)return;const T=y.getBoundingClientRect(),S=C.getBoundingClientRect(),P=ti(v,{box:T,naturalWidth:n.w,naturalHeight:n.h,sourceWindow:r});E({left:P.left-S.left,top:P.top-S.top,width:P.width,height:P.height})};b();const x=t.current;if(!x||typeof ResizeObserver>"u")return;const _=new ResizeObserver(b);return _.observe(x),()=>_.disconnect()},[v,n.w,n.h,r,o,s.x,s.y]);const M=c.useCallback(b=>x=>{var _,y;x.stopPropagation(),(y=(_=x.target).setPointerCapture)==null||y.call(_,x.pointerId),h.current={handle:b,sx:x.clientX,sy:x.clientY,start:v},g(v)},[v]),m=c.useCallback(b=>{const x=h.current,_=t.current;if(!x||!_)return;const y=ei({box:_.getBoundingClientRect(),naturalWidth:n.w,naturalHeight:n.h,sourceWindow:r}),C=(b.clientX-x.sx)/(y||1),T=(b.clientY-x.sy)/(y||1),S=vi(x.start,x.handle,C,T,{w:n.w,h:n.h},1);g(S),i(S.x0,S.y0,S.x1,S.y1)},[t,n.w,n.h,r,i]),f=c.useCallback(()=>{const b=h.current;h.current=null;const x=p;g(null),b&&x&&l(x.x0,x.y0,x.x1,x.y1)},[p,l]);return w?d.jsxs("div",{ref:u,className:"absolute inset-0 z-20 pointer-events-none",style:{touchAction:"none"},children:[d.jsx("div",{className:"absolute border-2 border-sky-400 bg-sky-400/10 pointer-events-auto",style:{...w,cursor:"move",touchAction:"none"},onPointerDown:M("move"),onPointerMove:m,onPointerUp:f}),bi.map(b=>{const x=qi[b];return d.jsx("div",{className:"absolute pointer-events-auto flex items-center justify-center",style:{left:w.left+x.fx*w.width-12,top:w.top+x.fy*w.height-12,width:24,height:24,cursor:x.cursor,touchAction:"none"},onPointerDown:M(b),onPointerMove:m,onPointerUp:f,children:d.jsx("div",{className:"w-2.5 h-2.5 rounded-sm bg-sky-400 border border-white/80"})},b)}),d.jsx("button",{type:"button","aria-label":"Remove depth region",title:"Remove region (reset the depth window)",className:"absolute pointer-events-auto flex items-center justify-center rounded-full text-white",style:{left:w.left+w.width-8,top:w.top-32,width:40,height:40},onPointerDown:b=>b.stopPropagation(),onClick:a,children:d.jsx("span",{className:"flex items-center justify-center w-5 h-5 rounded-full bg-slate-800/90 border border-white/70 text-[11px] leading-none",children:"×"})})]}):d.jsx("div",{ref:u,className:"absolute inset-0 z-20 pointer-events-none"})}const _n={inFlight:!1,pending:null};function zr(e,t){return e.inFlight?{state:{inFlight:!0,pending:t},launch:null}:{state:{inFlight:!0,pending:null},launch:t}}function Vr(e){return e.pending!=null?{state:{inFlight:!0,pending:null},launch:e.pending}:{state:_n,launch:null}}const ji=1e3,Qi=typeof requestAnimationFrame=="function"?e=>requestAnimationFrame(()=>e()):e=>setTimeout(e,0),$r=typeof cancelAnimationFrame=="function"?cancelAnimationFrame:e=>clearTimeout(e);function Xr(e,t){const n=e.deep,r=(n==null?void 0:n.zMin)??0,o=(n==null?void 0:n.zMax)??0,s=t!=null,[i,l,a]=Qe(r),[u,p,g]=Qe(o),[h,w]=c.useState(null),[E,v]=c.useState(null),M=c.useRef(n);M.current=n;const m=c.useRef(r);m.current=r;const f=c.useRef(o);f.current=o;const b=c.useRef(i);b.current=i;const x=c.useRef(u);x.current=u;const _=c.useRef({near:i,far:u,ver:0}),y=c.useRef(0),C=c.useRef(!0),T=c.useRef(_n),S=c.useRef(null),P=l,R=p,D=c.useCallback(()=>{const V=M.current;if(!V)return;const{near:$,far:Q,ver:ee}=_.current,ue=()=>{const W=Vr(T.current);T.current=W.state,W.launch!=null&&D()};V.flatten($,Q).then(W=>{_.current.ver===ee&&!C.current&&(S.current!=null&&$r(S.current),S.current=Qi(()=>{S.current=null,w(W)})),ue()}).catch(ue)},[]),A=c.useCallback(()=>{const V=zr(T.current,1);T.current=V.state,V.launch!=null&&D()},[D]);c.useEffect(()=>()=>{S.current!=null&&$r(S.current),n==null||n.dispose()},[n]),c.useEffect(()=>{if(!n)return;const V=i<=r&&u>=o;if(C.current=V,y.current+=1,_.current={near:i,far:u,ver:y.current},s){t(i,u);return}if(V){w(null);return}A()},[n,i,u,r,o,A,s,t]);const N=c.useMemo(()=>n&&!s&&h!=null?{...e,data:h}:e,[e,n,s,h]),L=n!=null&&r>0&&o/r>ji,B=c.useMemo(()=>{if(!n||!(o>r))return;const V=Q=>Math.abs(Q)>=1e3||Math.abs(Q)<.01&&Q!==0?Q.toExponential(2):Q.toFixed(3),$=(Q,ee,ue,W,te)=>{if(L){const ye=Math.log10(r),he=Math.log10(o);return{id:Q,icon:"layers",label:ee,title:`${ue} (log scale). Double-click to type a Z.`,min:ye,max:he,step:(he-ye)/200,value:Math.log10(Math.max(r,Math.min(W,o))),onChange:H=>te(10**H),format:H=>V(10**H)}}return{id:Q,icon:"layers",label:ee,title:`${ue}. Double-click to type a Z.`,min:r,max:o,step:(o-r)/200,value:W,onChange:te,format:V}};return[$("depth-near","ZN","Depth window NEAR — composite only samples with Z ≥ this",i,P),$("depth-far","ZF","Depth window FAR — composite only samples with Z ≤ this",u,R)]},[n,r,o,i,u,L,P,R]),U=c.useCallback(V=>{if(V.count===0){const ee=m.current,ue=f.current,W=ue>ee?0:1;l(ue+W),p(ee-W);return}const $=f.current-m.current,Q=Math.max(Math.abs($)*1e-4,1e-4);l(V.zMin-Q),p(V.zMax+Q)},[l,p]),I=c.useRef(null),re=c.useRef(_n),Z=c.useCallback(()=>{const V=M.current,$=I.current,Q=()=>{const ee=Vr(re.current);re.current=ee.state,ee.launch!=null&&Z()};if(!V||!$){Q();return}V.zRangeInRect($.x0,$.y0,$.x1,$.y1).then(ee=>{U(ee),Q()}).catch(Q)},[U]),me=c.useCallback((V,$,Q,ee)=>{I.current={x0:V,y0:$,x1:Q,y1:ee};const ue=zr(re.current,1);re.current=ue.state,ue.launch!=null&&Z()},[Z]),pe=c.useCallback((V,$,Q,ee)=>{v({x0:V,y0:$,x1:Q,y1:ee}),me(V,$,Q,ee)},[me]),oe=c.useCallback(()=>{v(null),a.reset(),g.reset(),w(null)},[a,g]),Ae=c.useCallback(()=>{a.reset(),g.reset(),v(null),w(null)},[a,g]);return{hdr:N,sliders:B,hasDeep:n!=null,region:E,queryRegionWindow:me,commitRegion:pe,removeRegion:oe,reset:Ae,isModified:a.isModified||g.isModified}}function Wr(e){return"hdr"in e&&e.hdr!=null}function Hr(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function De(e){return Number.isFinite(e)?e:0}const Ji={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function ea(e,t,n,r,o=0){const{h:s,w:i,c:l}=Hr(e.shape),a=e.precision==="f16-bits"?er(e.data):e.data,u=ms(t),p=new Uint8ClampedArray(i*s*4);for(let g=0;g<i*s;g++){const h=g*l;let w,E,v,M=1;l===1?w=E=v=De(a[h]):l===3?(w=De(a[h]),E=De(a[h+1]),v=De(a[h+2])):(w=De(a[h]),E=De(a[h+1]),v=De(a[h+2]),M=De(a[h+3]));const m=[At(w,n,o),At(E,n,o),At(v,n,o)],[f,b,x]=u(m),_=g*4;p[_]=255*rn(f,r),p[_+1]=255*rn(b,r),p[_+2]=255*rn(x,r),p[_+3]=255*(M<0?0:M>1?1:M)}return new ImageData(p,i,s)}function ta(e){var Ge,et;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:s="auto",colormap:i="none",showAxes:l=!1,processing:a=Ji,zoom:u=1,pan:p={x:0,y:0},onViewportChange:g,onNaturalSize:h,label:w,isDraggable:E=!1,onDragStart:v,overlay:M,overlaySettings:m,pixelValueNotation:f="decimal",toolbar:b=!0}=e,[x,_,y]=Qe(i);c.useEffect(()=>{_(i)},[i,_]);const C=c.useRef(null),T=c.useRef(null),S=c.useRef(null),P=c.useRef(null),R=c.useRef(null),D=c.useRef(null),A=c.useRef(null),[N,L]=c.useState(0),B=c.useCallback(()=>L(G=>G+1),[]),U=c.useMemo(()=>({get current(){const G=R.current;return G instanceof HTMLCanvasElement?G:null}}),[]),I=c.useCallback(G=>{C.current=G,G&&(R.current=G)},[]),re=c.useCallback(G=>{T.current=G,G&&(R.current=G)},[]),Z=c.useCallback(G=>{G&&(R.current=G)},[]),[me,pe]=c.useState(!1),[oe,Ae]=c.useState(!1),[V,$]=c.useState(!1),[Q,ee]=c.useState(null),{flipSign:ue}=a,{gammaFilterId:W,filterStr:te,gamma:ye,offset:he}=Tr(a),H=!r&&o!=="none"&&n!=null&&t!=null,Ce=o!=="none"&&n!=null,fe=x!=="none"&&!H&&!(r&&Ce)&&t!=null;c.useEffect(()=>{if(!fe||!t){$(!1);return}let G=!1;$(!1);const ge=`${t}::${x}`,Se=an(ge);if(Se){const ce=T.current;if(ce){ce.width=Se.width,ce.height=Se.height;const xe=ce.getContext("2d");xe&&xe.putImageData(Se,0,0),A.current=Se,B(),ee({w:Se.width,h:Se.height}),h==null||h(Se.width,Se.height),$(!0)}return}const Me=new Image;return Me.onload=()=>{if(G)return;const ce=document.createElement("canvas");ce.width=Me.naturalWidth,ce.height=Me.naturalHeight;const xe=ce.getContext("2d");if(!xe)return;xe.drawImage(Me,0,0);const Le=xe.getImageData(0,0,ce.width,ce.height),z=sn(x),F=on(Le,x,z);cn(ge,F);const Y=T.current;if(!Y||G)return;Y.width=F.width,Y.height=F.height;const O=Y.getContext("2d");O&&O.putImageData(F,0,0),A.current=F,B(),ee({w:F.width,h:F.height}),h==null||h(F.width,F.height),$(!0)},Me.src=t,()=>{G=!0}},[fe,t,x]);const Ee=c.useCallback((G,ge)=>{ee(Se=>Se&&Se.w===G&&Se.h===ge?Se:{w:G,h:ge}),h==null||h(G,ge)},[]);c.useEffect(()=>{if(!t){D.current=null,A.current=null,B();return}let G=!1;return lt(t).then(ge=>{G||(D.current=ge,x==="none"&&(A.current=ge),B())}),()=>{G=!0}},[t,x,B]);const ae=c.useCallback((G,ge,Se)=>{const Me=D.current;if(!Me||G<0||ge<0||G>=Me.width||ge>=Me.height)return null;const ce=(ge*Me.width+G)*4,xe=Me.data[ce],Le=Me.data[ce+1],z=Me.data[ce+2],F=A.current;let Y=xe,O=Le,J=z;if(F&&F.width===Me.width&&F.height===Me.height){const ve=(ge*F.width+G)*4;Y=F.data[ve],O=F.data[ve+1],J=F.data[ve+2]}const j=bt(Y,O,J);return ft(x!=="none"||xe===Le&&Le===z?[xe]:[xe,Le,z],"uint8",Se,j)},[x]);c.useEffect(()=>{if(Ae(!1),!H){pe(!1);return}let G=!1;const ge=Rs(),Se=ge==="gpu"||ge==="auto",Me=`${n}::${t}::${o}::${x}`;if(ge!=="gpu"){const ce=an(Me);if(ce){const xe=C.current;if(xe){(xe.width!==ce.width||xe.height!==ce.height)&&(xe.width=ce.width,xe.height=ce.height);const Le=xe.getContext("2d");Le&&Le.putImageData(ce,0,0),Ee(ce.width,ce.height),pe(!0)}return}}return(async()=>{const[ce,xe]=await Promise.all([lt(n),lt(t)]);if(G||!ce||!xe)return;const z=o.includes("signed")?"signed":"positive",F=x!=="none"?Jt(x):null,Y={diffMode:o,colormap:F,cmapMode:z};if(Se)try{const Pe=C.current;if(Pe){const ve=As(ce,xe,Y,Pe);if(ve){if(G)return;Ee(ve.width,ve.height),pe(!0);return}}}catch(Pe){console.warn("[cairn] WebGL 2 diff error:",Pe)}if(ge==="gpu"){G||Ae(!0);return}let O=ys(ce,xe,o);x!=="none"&&(O=on(O,x,z)),cn(Me,O);const J=C.current;if(!J||G)return;(J.width!==O.width||J.height!==O.height)&&(J.width=O.width,J.height=O.height);const j=J.getContext("2d");j&&j.putImageData(O,0,0),Ee(O.width,O.height),pe(!0)})(),()=>{G=!0}},[n,t,o,H,x,h]);const Re=s==="auto"?void 0:s,Ve=ue?{filter:"invert(1)"}:{},qe=M&&(m!=null&&m.enabled)&&Q&&t&&((((Ge=M.boxes)==null?void 0:Ge.length)??0)>0||(((et=M.masks)==null?void 0:et.length)??0)>0)?d.jsx(pn,{data:M,settings:m,naturalWidth:Q.w,naturalHeight:Q.h}):void 0,Fe=t?H&&oe?d.jsx(Pr,{title:"WebGL 2 unavailable",body:"GPU render mode needs WebGL 2 here — switch render mode to Auto or CPU."}):H?d.jsxs(d.Fragment,{children:[!me&&d.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),d.jsx("canvas",{ref:I,className:"w-full h-full object-contain block",style:{display:me?"block":"none",imageRendering:Re,...Ve}})]}):fe?d.jsxs(d.Fragment,{children:[!V&&d.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),d.jsx("canvas",{ref:re,className:"w-full h-full object-contain block",style:{display:V?"block":"none",imageRendering:Re,...Ve}})]}):d.jsx("img",{ref:Z,src:t,alt:w,className:"w-full h-full object-contain block",draggable:!1,style:{filter:te,imageRendering:Re},onLoad:G=>{const ge=G.currentTarget;ee({w:ge.naturalWidth,h:ge.naturalHeight}),h==null||h(ge.naturalWidth,ge.naturalHeight)}}):d.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return d.jsx(Ft,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:b,paneRef:S,wrapperRef:P,zoom:u,pan:p,onViewportChange:g,naturalDims:Q,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${p.x}px, ${p.y}px) scale(${u})`,transformOrigin:"0 0"},viewportPadding:l&&Q?"16px 4px 4px 28px":"4px",header:d.jsx(Ar,{id:W,gamma:ye,offset:he}),surface:Fe,showAxes:l,overlayNode:qe,overlay:{displayElRef:R,sample:ae,version:N,hasSource:!!t},notationSeed:f,exportCanvasRef:U,leadingMenus:[En(x,G=>_(G))],onReset:y.reset,extraModified:y.isModified,label:w,showLabelChip:!!w,isDraggable:E,onDragStart:v})}function na(e){const{tonemap:t="srgb",exposure:n=0,gamma:r,showAxes:o=!1,label:s="",interpolation:i="auto",zoom:l=1,pan:a={x:0,y:0},onViewportChange:u,pixelValueNotation:p="decimal",toolbar:g=!0}=e,h=Xr(e.hdr),w=h.hdr,[E,v,M]=Qe(nn(t));c.useEffect(()=>{v(nn(t))},[t,v]);const m=c.useRef(null),f=c.useRef(null),b=c.useRef(null),[x,_]=c.useState(null),y=c.useRef(null),[C,T]=c.useState(0),[S,P]=c.useState(0),[R,D]=c.useState(0);c.useEffect(()=>{const L=m.current;if(!L)return;let B;try{B=ea(w,E,n+S,r,R)}catch(I){console.error("[cairn] HDR tone-map error:",I);return}(L.width!==B.width||L.height!==B.height)&&(L.width=B.width,L.height=B.height);const U=L.getContext("2d");U&&(U.putImageData(B,0,0),y.current=B,T(I=>I+1),_(I=>I&&I.w===B.width&&I.h===B.height?I:{w:B.width,h:B.height}))},[w,E,n,r,S,R]);const A=c.useCallback((L,B,U)=>{const I=x;if(!I||L<0||B<0||L>=I.w||B>=I.h)return null;const re=w.shape.length===2?1:w.shape[2]??1,Z=(B*I.w+L)*re,me=w.data,pe=w.precision==="f16-bits"?$=>kt(me[$]??0):$=>me[$]??0,oe=y.current;let Ae=.5;if(oe&&oe.width===I.w&&oe.height===I.h){const $=(B*I.w+L)*4;Ae=bt(oe.data[$],oe.data[$+1],oe.data[$+2])}const V=re===1?[pe(Z)]:[pe(Z),pe(Z+1),pe(Z+2)];return ft(V,"unit",U,Ae)},[w,x]),N=i==="auto"?void 0:i;return d.jsx(Ft,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:g,paneRef:f,wrapperRef:b,zoom:l,pan:a,onViewportChange:u,naturalDims:x,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${a.x}px, ${a.y}px) scale(${l})`,transformOrigin:"0 0"},viewportPadding:o&&x?"16px 4px 4px 28px":"4px",surface:d.jsx("canvas",{ref:m,className:"w-full h-full object-contain block",style:{imageRendering:N}}),showAxes:o,overlay:{displayElRef:m,sample:A,version:C,hasSource:!0},notationSeed:p,exportCanvasRef:m,leadingMenus:[Gr(E,L=>v(L),!1)],displayAdjust:{exposureEV:S,offset:R,onExposureChange:P,onOffsetChange:D},depthSliders:h.sliders,regionSelect:h.hasDeep?{rect:h.region,queryLive:h.queryRegionWindow,commit:h.commitRegion,remove:h.removeRegion}:void 0,onReset:()=>{h.reset(),M.reset()},extraModified:h.isModified||M.isModified,label:s,showLabelChip:!!s})}function Mn(e){return Wr(e)?d.jsx(na,{...e}):d.jsx(ta,{...e})}const Yr={"no-webgpu":0,"no-hdr-browser":1,"no-hdr-display":2},ra="https://github.com/doeringchristian/cairn-plot/blob/main/docs/browser-support.md";function oa(e,t=!1){const n=e||"";return t?"brave":/firefox/i.test(n)?"firefox":/safari/i.test(n)&&!/chrome|chromium|crios|android/i.test(n)?"safari":/linux/i.test(n)&&/chrome|chromium/i.test(n)?"chromium-linux":"chromium"}function sa(e){const t=e||"";return/mac os x|macintosh/i.test(t)?"macos":/windows/i.test(t)?"windows":"other"}function ia(e,t){if(e==="no-hdr-display")switch(sa(t.userAgent)){case"macos":return"macOS: EDR engages automatically on HDR-capable displays — confirm your display supports HDR.";case"windows":return"Windows: turn on Settings → System → Display → Use HDR.";default:return"Enable HDR in your display and OS settings."}const n=oa(t.userAgent,t.isBrave);if(e==="no-hdr-browser")switch(n){case"firefox":return"Firefox has no extended-tone-mapping canvas path at all — true HDR output is impossible until Firefox implements it (fundamental browser limitation).";case"safari":return"Safari's WebGPU HDR canvas tone-mapping is still maturing — update to the latest Safari 26+.";default:return"Chrome/Edge 129+ is required for HDR canvas output (toneMapping: extended) — update your browser."}switch(n){case"firefox":return"Firefox: about:config → dom.webgpu.enabled (HDR output is not available in Firefox at all — browser limitation).";case"safari":return"Safari: Develop → Feature Flags → WebGPU (Safari 26+ has it by default).";case"brave":return"Brave: check Shields fingerprint blocking + brave://flags.";case"chromium-linux":return"Chromium on Linux: enable chrome://flags/#enable-unsafe-webgpu.";case"chromium":default:return"Chrome/Edge: enable chrome://flags/#enable-unsafe-webgpu and hardware acceleration."}}function aa(e){switch(e){case"no-webgpu":return"GPU renderer unavailable → CPU fallback active; FLIP kernels + HDR compare disabled.";case"no-hdr-browser":return"True HDR output is unsupported by this browser — a fundamental browser limitation, not a cairn-plot bug → HDR images tone-mapped to SDR.";case"no-hdr-display":return"Your display/OS is not in HDR mode → HDR images tone-mapped to SDR."}}function Kr(e,t){return`cairn-plot:capnotice:${e}:${t}`}const qr=new Set;function Zr(e){try{if(window.localStorage.getItem(e)==="1")return!0}catch{}try{if(window.sessionStorage.getItem(e)==="1")return!0}catch{}return qr.has(e)}function ca(e){try{window.localStorage.setItem(e,"1");return}catch{}try{window.sessionStorage.setItem(e,"1");return}catch{}qr.add(e)}const jr=new Set;let Ut=null,gt=null;function Qr(){gt&&gt.parentNode&&gt.parentNode.removeChild(gt),gt=null,Ut=null}function la(e){const t=Kr(e,window.location.pathname),n=ia(e,{userAgent:navigator.userAgent,isBrave:!!navigator.brave}),r=document.createElement("div");r.setAttribute("role","status"),r.setAttribute("data-cairn-plot-capnotice",e),Object.assign(r.style,{position:"fixed",bottom:"12px",right:"12px",zIndex:"2147483000",maxWidth:"340px",boxSizing:"border-box",padding:"10px 30px 10px 12px",borderRadius:"6px",border:"1px solid var(--color-border, #d0d7de)",background:"rgb(var(--color-bg-elevated-rgb, 246 248 250) / 0.9)",color:"var(--color-fg-muted, #656d76)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",boxShadow:"0 4px 12px rgba(0, 0, 0, 0.18)",font:"12px/1.4 system-ui, sans-serif"});const o=document.createElement("div");o.textContent=aa(e),Object.assign(o.style,{fontWeight:"600",color:"var(--color-fg, #1f2328)",marginBottom:"4px"});const s=document.createElement("div");s.textContent=n,s.style.marginBottom="4px";const i=document.createElement("a");i.href=ra,i.target="_blank",i.rel="noopener noreferrer",i.textContent="Learn more",Object.assign(i.style,{color:"var(--color-accent, #0969da)",textDecoration:"none"});const l=document.createElement("button");l.type="button",l.textContent="×",l.setAttribute("aria-label","Dismiss browser capability notice"),l.title="Dismiss",Object.assign(l.style,{position:"absolute",top:"4px",right:"6px",padding:"0 4px",border:"0",background:"transparent",color:"var(--color-fg-subtle, #8b949e)",cursor:"pointer",fontSize:"16px",lineHeight:"1"}),l.addEventListener("click",()=>{ca(t),Qr()}),r.appendChild(o),r.appendChild(s),r.appendChild(i),r.appendChild(l),document.body.appendChild(r),gt=r,Ut=e}function Jr(e){if(typeof document>"u"||typeof window>"u"||jr.has(e))return;jr.add(e);const t=Kr(e,window.location.pathname);if(Zr(t))return;const n=()=>{if(!Zr(t)){if(Ut!==null)if(Yr[e]<Yr[Ut])Qr();else return;la(e)}};document.body?n():window.addEventListener("DOMContentLoaded",n,{once:!0})}const ua={data:new Float32Array(0),shape:[0,0],dtype:"<f4"};function fa(e){const{h:t,w:n,c:r}=Hr(e.shape);if(e.precision==="f16-bits"){const i=e.data,l=new Uint16Array(n*t*4);for(let a=0;a<n*t;a++){const u=a*r,p=a*4;if(r===1){const g=i[u];l[p]=g,l[p+1]=g,l[p+2]=g,l[p+3]=Rt}else l[p]=i[u],l[p+1]=i[u+1],l[p+2]=i[u+2],l[p+3]=r>=4?i[u+3]:Rt}return{data:l,width:n,height:t,format:"rgba16float"}}const o=e.data,s=new Float32Array(n*t*4);for(let i=0;i<n*t;i++){const l=i*r;let a,u,p,g=1;r===1?a=u=p=De(o[l]):r===3?(a=De(o[l]),u=De(o[l+1]),p=De(o[l+2])):(a=De(o[l]),u=De(o[l+1]),p=De(o[l+2]),g=De(o[l+3]));const h=i*4;s[h]=a,s[h+1]=u,s[h+2]=p,s[h+3]=g}return{data:s,width:n,height:t,format:"rgba32float"}}function eo(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),s=n*o,i=r*o,l=(t.width-s)/2,a=(t.height-i)/2,u=Math.max(e.zoom,1e-6),p=t.width/(u*s),g=t.height/(u*i),h=-l/s-e.pan.x/(u*s),w=-a/i-e.pan.y/(u*i);return{x:h,y:w,w:p,h:g}}function to(e,t,n,r){const o=e.w*n,s=e.h*r;return o<=0||s<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/s)}function da(e){var ce,xe,Le;const t=Wr(e),n=c.useRef(null),r=c.useRef(null),o=c.useRef(null),s=c.useRef(null),i=c.useRef(null),l=t&&!!((ce=e.hdr)!=null&&ce.deep),a=c.useCallback((z,F)=>{var Y,O;(Y=s.current)==null||Y.setDeepWindow(z,F),(O=i.current)==null||O.call(i)},[]),u=Xr(t?e.hdr:ua,l?a:void 0),p=c.useRef(!1),[g,h]=c.useState(!1),[w,E]=c.useState(!1),[v,M]=c.useState(!1),[m,f]=c.useState(null),[b,x]=c.useState(0),[_,y]=c.useState(0),[C,T]=c.useState({x:0,y:0,w:1,h:1}),S=c.useRef(null),P=c.useRef(null),[R,D]=c.useState(0),A=e.zoom??1,N=e.pan??{x:0,y:0},L=e.onViewportChange,B=t?"none":e.colormap??"none",[U,I,re]=Qe(B);c.useEffect(()=>{I(B)},[B,I]);const Z=t?"none":U,me=t?e.tonemap:void 0,[pe,oe]=c.useState(null);c.useEffect(()=>{oe(null)},[me]);const Ae=gs(me,g),V=pe??Ae,$=pe!==null&&pe!==Ae,Q=c.useCallback(()=>oe(null),[]),[ee,ue,W]=Qe(Vn),[te,ye]=c.useState(0),[he,H]=c.useState(0),Ce=dn();c.useEffect(()=>{const z=n.current;if(!z)return;let F=!1;return Pt().then(Y=>{var Pe;if(F)return;const O=((Pe=Y.probeExtendedToneMapping)==null?void 0:Pe.call(Y))??!1,J=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,j=O&&J&&t;p.current=j,h(j),t&&!j&&Jr(O?"no-hdr-display":"no-hdr-browser"),gi(z,{hdr:j}).then(ve=>{if(F){Sr(ve);return}s.current=ve,M(!0)}).catch(ve=>{F||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",ve),E(!0))})}).catch(Y=>{F||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",Y),E(!0))}),()=>{F=!0,s.current&&(Sr(s.current),s.current=null)}},[]),c.useEffect(()=>{const z=r.current;if(!z)return;const F=new ResizeObserver(()=>y(Y=>Y+1));return F.observe(z),()=>F.disconnect()},[]),c.useEffect(()=>{const z=r.current;if(!z)return;const F=new IntersectionObserver(Y=>{const O=Y[0];if(!O)return;const J=s.current;J&&(J.setVisible(O.isIntersecting),O.isIntersecting?J.isParked&&(J.restore(),y(j=>j+1)):J.park())},{threshold:0});return F.observe(z),()=>F.disconnect()},[]),c.useEffect(()=>{var Y;if(!t||!v||l)return;const z=u.hdr;S.current=z;const F=fa(z);(Y=s.current)==null||Y.setSource(F),f(O=>O&&O.w===F.width&&O.h===F.height?O:{w:F.width,h:F.height}),D(O=>O+1),x(O=>O+1)},[t,v,l,t?u.hdr:null]),c.useEffect(()=>{if(!t||!v||!l)return;const z=e.hdr,F=z.deep;S.current=z;let Y=!1;return F.getGpuCsr().then(O=>{var J;Y||((J=s.current)==null||J.setDeepSource(O,F.zMin,F.zMax),f(j=>j&&j.w===O.width&&j.h===O.height?j:{w:O.width,h:O.height}),D(j=>j+1),x(j=>j+1))}).catch(O=>{Y||console.warn("[cairn] deep GPU CSR upload failed:",O)}),()=>{Y=!0}},[t,v,l,t?e.hdr.deep:null]),c.useEffect(()=>{if(t||!v)return;const z=e,F=z.imageUrl,Y=U;if(!F){P.current=null,f(null),D(J=>J+1);return}let O=!1;return lt(F).then(J=>{var ve,ke;if(O||!J)return;let j=J;if(Y!=="none"){const be=`gpu::${F}::${Y}::ev${te}::off${he}`,$e=an(be);if($e)j=$e;else{const tt=sn(Y);j=on(J,Y,tt,te,he),cn(be,j)}}P.current=J;const Pe={data:j.data,width:j.width,height:j.height,format:"rgba8unorm"};(ve=s.current)==null||ve.setSource(Pe),f(be=>be&&be.w===j.width&&be.h===j.height?be:{w:j.width,h:j.height}),(ke=z.onNaturalSize)==null||ke.call(z,j.width,j.height),D(be=>be+1),x(be=>be+1)}),()=>{O=!0}},[t,v,t?null:e.imageUrl,t?null:U,t?0:te,t?0:he]);const fe=t?e.exposure??0:0,Ee=t?e.gamma:void 0,ae=c.useCallback(()=>{const z=s.current;if(!z||!v||!m)return;const F=r.current,Y=o.current,O=Y?Y.getBoundingClientRect():F?F.getBoundingClientRect():{width:m.w,height:m.h},J=eo({zoom:A,pan:N},O,m.w,m.h);T(be=>be.x===J.x&&be.y===J.y&&be.w===J.w&&be.h===J.h?be:J),O.width>0&&O.height>0&&z.resize(Math.round(O.width*Ce),Math.round(O.height*Ce));const j=to(J,O,m.w,m.h)>=hn?"nearest":"linear",Pe=J,ve=p.current&&Yn(V),ke=t?{exposureEV:fe+te,offset:he,operator:V,gamma:Ee,isScalar:!1,hdrOut:ve,peak:ee,uv:Pe,filter:j}:{exposureEV:Z!=="none"?0:te,offset:Z!=="none"?0:he,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:Pe,filter:j};try{z.render(ke)||E(!0)}catch(be){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",be),E(!0)}},[v,m,A,N.x,N.y,fe,te,he,V,ee,Ee,t,Z,Ce]);i.current=ae,c.useEffect(()=>{ae()},[ae,b,_]);const Re=c.useCallback((z,F,Y)=>{if(t){const $e=S.current,tt=m;if(!$e||!tt||z<0||F<0||z>=tt.w||F>=tt.h)return null;const Ie=$e.shape.length===2?1:$e.shape[2]??1,xt=(F*tt.w+z)*Ie,ht=$e.data,nt=$e.precision==="f16-bits"?Ze=>kt(ht[Ze]??0):Ze=>ht[Ze]??0,Be=.5,Mt=Ie===1?[nt(xt)]:[nt(xt),nt(xt+1),nt(xt+2)];return ft(Mt,"unit",Y,Be)}const O=P.current;if(!O||z<0||F<0||z>=O.width||F>=O.height)return null;const J=(F*O.width+z)*4,j=O.data[J],Pe=O.data[J+1],ve=O.data[J+2],ke=bt(j,Pe,ve);return ft(Z!=="none"||j===Pe&&Pe===ve?[j]:[j,Pe,ve],"uint8",Y,ke)},[t,m,Z]),Ve=e.showAxes??!1,qe=t?e.label??"":e.label,Fe=e.interpolation??"auto",Ge=Fe==="auto"?void 0:Fe,et=t?void 0:e.overlay,G=t?void 0:e.overlaySettings,ge=t?!1:e.isDraggable??!1,Se=t?void 0:e.onDragStart;if(w)return t?d.jsx(Mn,{...e}):d.jsx(Mn,{...e});const Me=et&&(G!=null&&G.enabled)&&m&&((((xe=et.boxes)==null?void 0:xe.length)??0)>0||(((Le=et.masks)==null?void 0:Le.length)??0)>0)?d.jsx(pn,{data:et,settings:G,naturalWidth:m.w,naturalHeight:m.h}):void 0;return d.jsx(Ft,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":v},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:r,wrapperRef:o,zoom:A,pan:N,onViewportChange:L,naturalDims:m,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:Ve&&m?"16px 4px 4px 28px":0,surface:d.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:Ge},"data-gpu-image-canvas":!0}),showAxes:Ve,overlayNode:Me,overlay:{displayElRef:n,sample:Re,version:R,hasSource:!0,sourceWindow:C},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:ae,leadingMenus:t?[Gr(V,z=>oe(z),g)]:[En(Z,z=>I(z))],displayAdjust:{exposureEV:te,offset:he,onExposureChange:ye,onOffsetChange:H},extraSliders:t&&hs(V)?[{id:"peak",label:"PK",title:"Peak white (×SDR white) — HDR roll-off shoulder for the extended Reinhard/ACES operators. Double-click to type a value.",min:us,max:fs,step:ds,value:ee,onChange:ue,format:z=>`${z.toFixed(1)}×`}]:void 0,depthSliders:u.sliders,regionSelect:l?{rect:u.region,queryLive:u.queryRegionWindow,commit:u.commitRegion,remove:u.removeRegion}:void 0,onReset:()=>{re.reset(),Q(),W.reset(),u.reset()},extraModified:re.isModified||$||W.isModified||u.isModified,label:qe,showLabelChip:!!qe,isDraggable:ge,onDragStart:Se})}const Gt=new Map;function Ye(e){if(Gt.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);Gt.set(e.id,e)}function it(e){return Gt.get(e)}function pa(){return Array.from(Gt.values())}function no(e,t){return{...e.params??{},...t??{}}}const ha={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},ma={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},ga={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},xa={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},ba={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},va={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},ro=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];ya(ro);const Sn=[1.052156925,1,.91835767],wa=.7;function ya(e){const[t,n,r]=e[0],[o,s,i]=e[1],[l,a,u]=e[2],p=s*u-i*a,g=-(o*u-i*l),h=o*a-s*l,E=1/(t*p+n*g+r*h);return[[p*E,-(n*u-r*a)*E,(n*i-r*s)*E],[g*E,(t*u-r*l)*E,-(t*i-r*o)*E],[h*E,-(t*a-n*l)*E,(t*s-n*o)*E]]}function Ea(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const Pn=6/29;function Tn(e){return e>Pn**3?Math.cbrt(e):e/(3*Pn*Pn)+4/29}function oo(e,t,n){const[r,o,s]=Ea(ro,e,t,n),i=Tn(r*Sn[0]),l=Tn(o*Sn[1]),a=Tn(s*Sn[2]),u=116*l-16,p=500*(i-l),g=200*(l-a);return[u,.01*u*p,.01*u*g]}function _a(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function Ma(){const e=oo(0,1,0),t=oo(0,0,1);return Math.pow(_a(e,t),wa)}const so=Ma(),Sa=.082;function io(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],s=Math.max(...n,...o),i=Math.ceil(3*Math.sqrt(s/(2*Math.PI**2))*e),l=1/e,a=Math.PI**2,u=[0,0,0];for(let p=-i;p<=i;p++)for(let g=-i;g<=i;g++){const h=(g*l)**2+(p*l)**2;for(let w=0;w<3;w++)u[w]+=t[w]*Math.sqrt(Math.PI/n[w])*Math.exp(-a*h/n[w])+r[w]*Math.sqrt(Math.PI/o[w])*Math.exp(-a*h/o[w])}return{r:i,deltaX:l,sums:u}}function ao(e){const t=.5*Sa*e,n=Math.ceil(3*t);let r=0,o=0,s=0;for(let i=-n;i<=n;i++)for(let l=-n;l<=n;l++){const a=Math.exp(-(l*l+i*i)/(2*t*t)),u=-l*a,p=(l*l/(t*t)-1)*a;u>0&&(r+=u),p>0?o+=p:s-=p}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:s}}const Pa=`
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
`,Ta=`
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
`,co=`
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
`;function Ke(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function Vt(e,t,n){const r=n.sourceMap,o=r?t==="a"?r.offsetA:r.offsetB:{x:0,y:0},s=r!=null&&r.fill?1:0;return[Ke(e,[o.x,o.y,s,0]),Ke(e+1,[n.width,n.height,0,0])]}function $t(e){return[Ke(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),Ke(2,[e.sums[2],0,0,0])]}function lo(e){return[Ke(4,[so,e.sd,e.r,e.edgeNorm]),Ke(5,[e.pointPos,e.pointNeg,0,0])]}function uo(e,t,n,r,o,s=""){const i=io(e),l=ao(e),a=`ycxczA${s}`,u=`ycxczB${s}`,p=`labA${s}`,g=`labB${s}`,h=`flip${s}`;return{passes:[{name:a,shader:t,inputs:[n],output:a,uniforms:()=>Vt(1,"a",o)},{name:u,shader:t,inputs:[r],output:u,uniforms:()=>Vt(1,"b",o)},{name:p,shader:zt,inputs:[a],output:p,uniforms:()=>$t(i)},{name:g,shader:zt,inputs:[u],output:g,uniforms:()=>$t(i)},{name:h,shader:co,inputs:[p,g,a,u],output:h,uniforms:()=>lo(l)}],flipRef:h}}const Aa={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=uo(t,Pa,"srcA","srcB",e);return{passes:n,final:r}}},Ca={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=uo(t,Ta,"srcA","srcB",e);return{passes:n,final:r}}},fo=`
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
`,Ra=`
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
`,ka={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",output:"scalar",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),s=(r-n)/Math.max(o-1,1),i=io(t),l=ao(t),a=[];let u=null;for(let p=0;p<o;p++){const g=n+p*s,h=`_e${p}`,w=`ycxczA${h}`,E=`ycxczB${h}`,v=`labA${h}`,M=`labB${h}`,m=`acc${h}`;a.push({name:w,shader:fo,inputs:["srcA"],output:w,uniforms:()=>[Ke(1,[g,0,0,0]),...Vt(2,"a",e)]},{name:E,shader:fo,inputs:["srcB"],output:E,uniforms:()=>[Ke(1,[g,0,0,0]),...Vt(2,"b",e)]},{name:v,shader:zt,inputs:[w],output:v,uniforms:()=>$t(i)},{name:M,shader:zt,inputs:[E],output:M,uniforms:()=>$t(i)}),u===null?a.push({name:m,shader:co,inputs:[v,M,w,E],output:m,uniforms:()=>lo(l)}):a.push({name:m,shader:Ra,inputs:[v,M,w,E,u],output:m,uniforms:()=>[Ke(5,[so,l.sd,l.r,l.edgeNorm]),Ke(6,[l.pointPos,l.pointNeg,0,0])]}),u=m}return{passes:a,final:u}}},po=.01,ho=.03,Xt=1,An=1.5,at=5,Cn=[.2126,.7152,.0722];function Rn(e){return e<=.04045?e/12.92:Math.pow((e+.055)/1.055,2.4)}function mo(e,t,n){const r=Cn[0]*Rn(e)+Cn[1]*Rn(t)+Cn[2]*Rn(n);return Math.min(1,Math.max(0,r))}function Da(e,t){const n=2*t+1,r=new Float64Array(n);let o=0;for(let s=-t,i=0;s<=t;s++,i++){const l=Math.exp(-.5*s*s/(e*e));r[i]=l,o+=l}for(let s=0;s<n;s++)r[s]=r[s]/o;return r}function go(e,t){if(t===1)return 0;const n=2*t;let r=(e%n+n)%n;return r>=t&&(r=n-1-r),r}const xo=()=>new Promise(e=>{typeof setTimeout=="function"?setTimeout(e,0):Promise.resolve().then(e)}),kn=64;async function Et(e,t,n,r,o,s){const i=new Float64Array(t*n);for(let a=0;a<n;a++){for(let u=0;u<t;u++){let p=0;for(let g=-o,h=0;g<=o;g++,h++)p+=r[h]*e[a*t+go(u+g,t)];i[a*t+u]=p}(a+1)%kn===0&&await s()}const l=new Float64Array(t*n);for(let a=0;a<n;a++){for(let u=0;u<t;u++){let p=0;for(let g=-o,h=0;g<=o;g++,h++)p+=r[h]*i[go(a+g,n)*t+u];l[a*t+u]=p}(a+1)%kn===0&&await s()}return l}async function La(e,t,n,r,o=xo){const s=n*r;if(s<=0)return NaN;const i=Da(An,at),l=new Float64Array(s),a=new Float64Array(s),u=new Float64Array(s);for(let f=0;f<s;f++)l[f]=e[f]*e[f],a[f]=t[f]*t[f],u[f]=e[f]*t[f];const p=await Et(e,n,r,i,at,o),g=await Et(t,n,r,i,at,o),h=await Et(l,n,r,i,at,o),w=await Et(a,n,r,i,at,o),E=await Et(u,n,r,i,at,o),v=(po*Xt)**2,M=(ho*Xt)**2;let m=0;for(let f=0;f<s;f++){const b=h[f]-p[f]*p[f],x=w[f]-g[f]*g[f],_=E[f]-p[f]*g[f],y=2*p[f]*g[f]+v,C=2*_+M,T=p[f]*p[f]+g[f]*g[f]+v,S=b+x+M;m+=y*C/(T*S)}return m/s}const bo=`
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
`,Ba=`
${bo}
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let y = ssim_moment_luma(in);
  return vec4<f32>(y.x, y.y, y.x * y.x, y.y * y.y);
}
`,Oa=`
${bo}
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let y = ssim_moment_luma(in);
  return vec4<f32>(y.x * y.y, 0.0, 0.0, 0.0);
}
`,vo=`
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
`,Ia=`
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
`;function _t(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function wo(e){const t=e.sourceMap,n=t?t.offsetA:{x:0,y:0},r=t?t.offsetB:{x:0,y:0},o=t!=null&&t.fill?1:0;return[_t(2,[n.x,n.y,r.x,r.y]),_t(3,[e.width,e.height,o,0])]}function yo(e,t){const n=`${t}H`,r=`${t}V`;return{passes:[{name:n,shader:vo,inputs:[e],output:n,uniforms:()=>[_t(1,[1,0,at,An])]},{name:r,shader:vo,inputs:[n],output:r,uniforms:()=>[_t(1,[0,1,at,An])]}],out:r}}const Na={kind:"multipass",id:"ssim",label:"SSIM (1−SSIM)",publicName:"ssim",displayRange:"unit",output:"scalar",buildPasses(e){const t=(po*Xt)**2,n=(ho*Xt)**2,r=yo("momA","statsA"),o=yo("momB","statsB");return{passes:[{name:"momA",shader:Ba,inputs:["srcA","srcB"],output:"momA",uniforms:wo},{name:"momB",shader:Oa,inputs:["srcA","srcB"],output:"momB",uniforms:wo},...r.passes,...o.passes,{name:"ssim",shader:Ia,inputs:[r.out,o.out],output:"ssim",uniforms:()=>[_t(2,[t,n,0,0])]}],final:"ssim"}}};let Eo=!1;function Fa(){Eo||(Eo=!0,Ye(ma),Ye(ha),Ye(ga),Ye(ba),Ye(xa),Ye(va),Ye(Aa),Ye(ka),Ye(Ca),Ye(Na))}Fa();function _o(){const e=[];for(const n of pa())n.kind==="pointwise"&&e.push({id:n.id,label:n.label});e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"});const t=it("ssim");return t&&e.push({id:t.id,label:t.label}),e}function Ua(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}function Ga(e,t,n){const r=t*n;if(r<=0)return NaN;let o=0;for(let s=0;s<r;s++)o+=e[s*4]??0;return 1-o/r}function Mo(e){return e==null||Number.isNaN(e)?"—":e.toFixed(4)}const So=new WeakMap;function za(e,t,n){let r=So.get(e);r||(r=new Map,So.set(e,r));const o=r.get(t);if(o)return o;const s=n().catch(i=>{throw r.get(t)===s&&r.delete(t),i});return r.set(t,s),s}const Po=new WeakMap;function Dn(e,t,n,r){let o=Po.get(e);o||(o=new Map,Po.set(e,o));const s=`${t}::${r}`;let i=o.get(s);return i||(i=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(s,i)),i}function Va(e){return`
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
`}const Wt="rgba16float";function $a(e,t,n,r,o,s){var M,m;const i=it(r);if(!i)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const l=s??yt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),a=l.result.w,u=l.result.h,p=l.fit==="fill"?1:0,g=no(i,o);if(i.kind==="pointwise"){const f=e.createTexture(a,u,Wt),b=Dn(e,`pw:${i.id}`,Va(i.source),Wt),x=new Float32Array([l.offsetA.x,l.offsetA.y,l.offsetB.x,l.offsetB.y]),_=new Float32Array([a,u,p,0]);let y;try{y=e.createBindGroup(b,[{binding:0,resource:t},{binding:1,resource:n},{binding:2,resource:{uniform:x}},{binding:3,resource:{uniform:_}}]),e.renderFullscreen(f,b,y)}finally{(M=y==null?void 0:y.destroy)==null||M.call(y)}return f}const h={width:a,height:u,params:g,sourceMap:{fill:l.fit==="fill",offsetA:l.offsetA,offsetB:l.offsetB}},w=i.buildPasses(h),E=new Map([["srcA",t],["srcB",n]]),v=[];try{for(const b of w.passes){const x=e.createTexture(a,u,Wt);v.push(x),E.set(b.output,x);const _=Dn(e,`mp:${i.id}:${b.name}`,b.shader,Wt),y=b.inputs.map((T,S)=>{const P=E.get(T);if(!P)throw new Error(`computeDiff: pass "${b.name}" input "${T}" not produced yet`);return{binding:S,resource:P}});b.uniforms&&y.push(...b.uniforms(h));let C;try{C=e.createBindGroup(_,y),e.renderFullscreen(x,_,C)}finally{(m=C==null?void 0:C.destroy)==null||m.call(C)}}const f=E.get(w.final);if(!f)throw new Error(`computeDiff: final ref "${w.final}" not produced`);for(const b of v)b!==f&&b.destroy();return f}catch(f){for(const b of v)b.destroy();throw f}}const Xa=8,Wa=256*1024*1024;class Ha{constructor(t=Xa,n=Wa){se(this,"map",new Map);se(this,"totalBytes",0);se(this,"maxEntries");se(this,"maxBytes");this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}accountReadbackBytes(t,n){let r=!1;for(const o of this.map.values())if(o===t){r=!0;break}r&&(t.bytes+=n,this.totalBytes+=n,this.evict())}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const To=new WeakMap;function Ao(e){let t=To.get(e);return t||(t=new Ha,To.set(e,t)),t}function Ya(e,t){const n=no(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function Ka(e,t,n,r,o){const s=it(n),i=s?Ya(s,r):"",l=o?gn(o):"";return`${e}|${t}|${n}|${i}|${l}`}function Co(e,t,n,r,o,s,i,l){const a=it(r);if(!a)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const u=Ao(e),p=l??yt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),g=Ka(s,i,r,o,p),h=u.get(g);if(h)return h;const w=$a(e,t,n,r,o,p),E=p.result.w,v=p.result.h,M={texture:w,width:E,height:v,displayRange:a.displayRange,bytes:E*v*8};return u.set(g,M),M}function qa(e,t,n){return`${e}|${t}|${n?gn(n):""}`}function Za(e,t,n,r,o,s){return za(e,qa(r,o,s),()=>ja(e,t,n,r,o,s))}async function ja(e,t,n,r,o,s){try{const i=Co(e,t,n,"ssim",void 0,r,o,s);return i.ssimMean!==void 0?i.ssimMean:(i.ssimMeanPending||(i.ssimMeanPending=Ro(e,i).then(l=>{const a=Ga(l,i.width,i.height);return i.ssimMean=a,a})),await i.ssimMeanPending)}catch{return Qa(e,t,n,s)}}async function Qa(e,t,n,r){const o=r??yt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),s=o.result.w,i=o.result.h,l=s*i;if(l<=0)return NaN;const a=await e.readback(t),u=await e.readback(n),p=a instanceof Uint8Array?255:1,g=u instanceof Uint8Array?255:1,h=o.fit==="fill",w=It(a,t.width,t.height,p,o.offsetA,h,s,i),E=It(u,n.width,n.height,g,o.offsetB,h,s,i),v=new Float64Array(l),M=new Float64Array(l),m=[0,0,0],f=[0,0,0];for(let b=0;b<i;b++){for(let x=0;x<s;x++){w(x,b,m),E(x,b,f);const _=b*s+x;v[_]=mo(m[0],m[1],m[2]),M[_]=mo(f[0],f[1],f[2])}(b+1)%kn===0&&await xo()}return La(v,M,s,i)}async function Ja(e,t,n,r,o){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=wr(e,n,r,o).then(s=>(t.scalars=s,s))),t.scalarsPending)}async function Ro(e,t){return t.resultSamples?t.resultSamples:(t.resultSamplesPending||(t.resultSamplesPending=e.readback(t.texture).then(n=>{const r=n instanceof Float32Array?n:Float32Array.from(n);return t.resultSamples=r,Ao(e).accountReadbackBytes(t,r.byteLength),r})),t.resultSamplesPending)}const ec=`
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
`,tc={unit:0,signed:1,relative:2},nc={linear:0,signed:1,positive:2};function rc(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function oc(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function sc(e,t,n,r,o){var w,E,v;const s=oc(t),i=Dn(e,"diff-display",ec,s),l=rc(e,o.colormap),a=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),u=new Float32Array([tc[r],nc[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]),p=new Float32Array([o.exposureEV??0,o.offset??0,0,0]),g=new Float32Array([((w=o.sourceDims)==null?void 0:w.w)??0,((E=o.sourceDims)==null?void 0:E.h)??0,0,0]);let h;try{h=e.createBindGroup(i,[{binding:0,resource:n},{binding:1,resource:l},{binding:2,resource:{uniform:a}},{binding:3,resource:{uniform:u}},{binding:4,resource:{uniform:p}},{binding:5,resource:{uniform:g}}]),e.renderFullscreen(t,i,h)}finally{(v=h==null?void 0:h.destroy)==null||v.call(h),l.destroy()}}const ko=.6*.6*2.51,ic=.6*.03,ac=0,Do=.6*.6*2.43,cc=.6*.59,lc=.14;function Lo(e){const t=(ic-cc*e)/(ko-Do*e),n=(ac-lc*e)/(ko-Do*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const uc=.85,fc=.85,Bo=11920928955078125e-23,Ln=[.2126,.7152,.0722];function dc(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function pc(e,t,n,r=3,o={}){const s=t*n,i=Lo(uc),l=Lo(fc),a=new Float64Array(s);let u=0;for(let f=0;f<s;f++){const[b,x,_]=dc(e,f,r),y=b*Ln[0]+x*Ln[1]+_*Ln[2];a[f]=y,y>u&&(u=y)}const p=Float64Array.from(a).sort(),g=s>>1,h=s%2===1?p[g]:p[g-1],w=Math.max(h,Bo),E=Math.max(u,Bo),v=o.startExposure??Math.log2(i/E),M=o.stopExposure??Math.log2(l/w),m=Math.max(2,Math.ceil(M-v));return{startExposure:v,stopExposure:M,numExposures:m}}const hc="absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm pointer-events-none select-none",mc="REF";function Oo(){return d.jsx("span",{className:hc,children:mc})}function Io({splitPosition:e,onChange:t,onReset:n}){return d.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${e*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:r=>{r.stopPropagation(),n==null||n()},onPointerDown:r=>{r.stopPropagation(),r.preventDefault();const o=r.currentTarget;try{o.setPointerCapture(r.pointerId)}catch{}const i=o.parentElement.getBoundingClientRect(),l=u=>{t==null||t(Math.max(0,Math.min(1,(u.clientX-i.left)/i.width)))},a=()=>{window.removeEventListener("pointermove",l),window.removeEventListener("pointerup",a)};window.addEventListener("pointermove",l),window.addEventListener("pointerup",a)},children:d.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})}const gc={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function xc({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:s,zoom:i,pan:l,onViewportChange:a,processing:u=gc,interpolation:p="auto",label:g="",isDraggable:h=!1,onDragStart:w,overlay:E,overlaySettings:v,pixelValueNotation:M="decimal"}){var ee,ue;const m=c.useRef(null),[f,b]=c.useState(null),[x,_]=c.useState(null),[y,C]=c.useState(M),[T,S]=c.useState(!1),P=c.useRef(null),R=c.useRef(null),D=c.useRef(null),A=c.useRef(null),[N,L]=c.useState(0);c.useEffect(()=>{if(!e){D.current=null,L(te=>te+1);return}let W=!1;return lt(e).then(te=>{W||(D.current=te,L(ye=>ye+1))}),()=>{W=!0}},[e]),c.useEffect(()=>{if(!t){A.current=null,L(te=>te+1);return}let W=!1;return lt(t).then(te=>{W||(A.current=te,L(ye=>ye+1))}),()=>{W=!0}},[t]);const B=W=>(te,ye,he)=>{const H=W.current;if(!H||te<0||ye<0||te>=H.width||ye>=H.height)return null;const Ce=(ye*H.width+te)*4,fe=H.data[Ce],Ee=H.data[Ce+1],ae=H.data[Ce+2],Re=bt(fe,Ee,ae);return fe===Ee&&Ee===ae?{lines:[mt(fe,"uint8",he)],luminance:Re}:{lines:[mt(fe,"uint8",he),mt(Ee,"uint8",he),mt(ae,"uint8",he)],luminance:Re,colors:[Bt[0],Bt[1],Bt[2]]}},U=c.useMemo(()=>B(D),[]),I=c.useMemo(()=>B(A),[]),re=!!E&&!!(v!=null&&v.enabled)&&!!f&&!!e&&((((ee=E.boxes)==null?void 0:ee.length)??0)>0||(((ue=E.masks)==null?void 0:ue.length)??0)>0),{gammaFilterId:Z,filterStr:me,gamma:pe,offset:oe}=Tr(u),Ae=`translate(${l.x}px, ${l.y}px) scale(${i})`,V=p==="auto"?void 0:p,{containerProps:$,modifierActive:Q}=ar({containerRef:m,zoom:i,pan:l,onViewportChange:a});return d.jsxs("div",{className:"relative flex flex-col h-full",children:[d.jsx(Ar,{id:Z,gamma:pe,offset:oe}),d.jsxs("div",{ref:m,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...$.style},onPointerDown:$.onPointerDown,onPointerMove:$.onPointerMove,onPointerUp:$.onPointerUp,onPointerCancel:$.onPointerCancel,children:[d.jsxs("div",{className:"relative w-full h-full",children:[d.jsxs("div",{className:"relative w-full h-full",style:{transform:Ae,transformOrigin:"0 0"},children:[d.jsx("img",{ref:P,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:me,imageRendering:V,...n==="blend"?{opacity:o}:{}},onLoad:W=>{const te=W.currentTarget;b({w:te.naturalWidth,h:te.naturalHeight})}}),re&&d.jsx(pn,{data:E,settings:v,naturalWidth:f.w,naturalHeight:f.h})]}),d.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:d.jsx("div",{className:"w-full h-full",style:{transform:Ae,transformOrigin:"0 0"},children:d.jsx("img",{ref:R,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:me,imageRendering:V,...n==="blend"?{opacity:1-o}:{}},onLoad:W=>{const te=W.currentTarget;_({w:te.naturalWidth,h:te.naturalHeight})}})})}),n==="split"&&d.jsx(Io,{splitPosition:r,onChange:s,onReset:()=>s==null?void 0:s(.5)})]}),n==="split"?d.jsxs(d.Fragment,{children:[t&&x&&d.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:d.jsx(dt,{imageElRef:R,naturalWidth:x.w,naturalHeight:x.h,zoom:i,pan:l,sample:I,notation:y,version:N})}),e&&f&&d.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:d.jsx(dt,{imageElRef:P,naturalWidth:f.w,naturalHeight:f.h,zoom:i,pan:l,sample:U,notation:y,version:N,onActiveChange:S})})]}):e&&f&&d.jsx(dt,{imageElRef:P,naturalWidth:f.w,naturalHeight:f.h,zoom:i,pan:l,sample:U,notation:y,version:N,onActiveChange:S}),T&&d.jsx(dr,{notation:y,onChange:C})]}),n==="split"&&d.jsx(Oo,{}),d.jsx(bn,{label:g,corner:"bottom-right",isDraggable:h&&!Q,grip:!0,onDragStart:w})]})}function bc(){return d.jsx(Pr,{title:"GPU compare unavailable",body:"Float image sources need the GPU compare (WebGPU), which isn't available in this browser."})}function vc({mode:e,kernel:t,kernelOptions:n,onSlide:r,onBlend:o,onKernel:s,onSide:i}){return{id:"compare-mode",title:"Compare / diff mode",menu:{options:[...i?[{id:"side",label:"Side"}]:[],{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...n],value:e==="side"?"side":e==="split"?"slide":e==="blend"?"blend":t,onSelect:u=>{u==="side"?i==null||i():u==="slide"?r():u==="blend"?o():s(u)}}}}function wc(e){const t=Jt(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function yc(e){const{width:t,height:n,channels:r}=e,o=t*n;if(e.precision==="f16-bits"){const a=e.data,u=new Uint16Array(o*4);for(let p=0;p<o;p++){const g=p*r,h=p*4;if(r===1){const w=a[g];u[h]=w,u[h+1]=w,u[h+2]=w,u[h+3]=Rt}else u[h]=a[g],u[h+1]=a[g+1],u[h+2]=a[g+2],u[h+3]=r>=4?a[g+3]:Rt}return{data:u,format:"rgba16float"}}const s=e.data,i=new Float32Array(o*4),l=a=>Number.isFinite(a)?a:0;for(let a=0;a<o;a++){const u=a*r;let p,g,h,w=1;r===1?p=g=h=l(s[u]):r===3?(p=l(s[u]),g=l(s[u+1]),h=l(s[u+2])):(p=l(s[u]),g=l(s[u+1]),h=l(s[u+2]),w=l(s[u+3]));const E=a*4;i[E]=p,i[E+1]=g,i[E+2]=h,i[E+3]=w}return{data:i,format:"rgba32float"}}function Ec({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:s,blendAlpha:i,onSplitPositionChange:l,diffSubmode:a,colormap:u="none",align:p="top-left",fit:g="crop",diffKernel:h,onDiffKernelChange:w,onCompareModeChange:E,onRequestSide:v,zoom:M,pan:m,onViewportChange:f,interpolation:b="auto",label:x="",pixelValueNotation:_="decimal"}){var Uo;const y=c.useRef(null),C=c.useRef(null),T=c.useRef(null),S=c.useRef(null),P=c.useRef(null),[R,D]=c.useState(!1),[A,N]=c.useState(!1),[L,B]=c.useState(null),[U,I]=c.useState(null),[re,Z]=c.useState(0),[me,pe]=c.useState(0),[oe,Ae]=c.useState(null),[V,$]=c.useState(null),[Q,ee]=c.useState({x:0,y:0,w:1,h:1}),ue=h??a??"absolute",[W,te,ye]=Qe(ue);c.useEffect(()=>{te(h??a??"absolute")},[h,a,te]);const he=c.useCallback(k=>{te(k),w==null||w(k)},[w,te]);c.useEffect(()=>{const k=y.current;if(k)return k.__cairnDiffKernel={current:W,set:he},()=>{k&&delete k.__cairnDiffKernel}},[W,he]);const[H,Ce,fe]=Qe(o);c.useEffect(()=>{Ce(o)},[o,Ce]);const Ee=c.useCallback(k=>{Ce(k),E==null||E(k)},[E,Ce]),[ae,Re,Ve]=Qe(u);c.useEffect(()=>{Re(u)},[u,Re]);const qe=c.useCallback(()=>{Ee(fe.default),Re(Ve.default),he(ye.default)},[Ee,Re,he,fe.default,Ve.default,ye.default]),Fe=fe.isModified||Ve.isModified||ye.isModified,[Ge,et]=c.useState(0),[G,ge]=c.useState(0),Se=c.useMemo(()=>{const K=[vc({mode:H,kernel:W,kernelOptions:_o().map(q=>({id:q.id,label:q.label})),onSide:v,onSlide:()=>Ee("split"),onBlend:()=>Ee("blend"),onKernel:q=>{Ee("diff"),he(q)}})];return H==="diff"&&K.push(En(ae,q=>Re(q))),K},[H,W,ae,he,Ee,v]),Me=c.useRef(null),ce=c.useRef(null),xe=c.useRef(null),Le=c.useRef(null),[z,F]=c.useState(0),Y=c.useRef(null),O=c.useRef(null),[J,j]=c.useState(0),Pe=dn();c.useEffect(()=>{const k=T.current;if(!k)return;let K=!1;return Pt().then(q=>{if(!K)try{if(yr())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const X=q.createSurface(k,{hdr:!1});S.current={device:q,surface:X,texA:null,texB:null},N(!0)}catch(X){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",X),D(!0)}}).catch(q=>{K||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",q),D(!0))}),()=>{var X,ie;K=!0;const q=S.current;q&&((X=q.texA)==null||X.destroy(),(ie=q.texB)==null||ie.destroy(),S.current=null)}},[]),c.useEffect(()=>{const k=y.current;if(!k)return;const K=new ResizeObserver(()=>pe(q=>q+1));return K.observe(k),()=>K.disconnect()},[]),c.useEffect(()=>{if(!A)return;let k=!1;if(!S.current)return;async function q(X,ie){if(ie){const _e=yc(ie);return{width:ie.width,height:ie.height,imageData:null,make:Te=>{const de=Te.createTexture(ie.width,ie.height,_e.format);return de.write(_e.data),de}}}if(!X)return null;const le=await lt(X);return le?{width:le.width,height:le.height,imageData:le,make:_e=>{const Te=_e.createTexture(le.width,le.height,"rgba8unorm");return Te.write(le.data),Te}}:null}return Promise.all([q(e,n),q(t,r)]).then(([X,ie])=>{var Ne,ze;if(k||!S.current)return;const le=S.current;Me.current=(X==null?void 0:X.imageData)??null,ce.current=(ie==null?void 0:ie.imageData)??null,xe.current=n??null,Le.current=r??null,(Ne=le.texA)==null||Ne.destroy(),(ze=le.texB)==null||ze.destroy(),le.texA=null,le.texB=null;const _e=X??ie;if(!_e){B(null),I(null),F(je=>je+1);return}const Te=ie??_e,de=X??_e;le.texA=Te.make(le.device),le.texB=de.make(le.device),I({a:{w:Te.width,h:Te.height},b:{w:de.width,h:de.height}}),B({w:_e.width,h:_e.height}),F(je=>je+1),Z(je=>je+1)}),()=>{k=!0}},[A,e,t,n,r]);const ve=n!=null||r!=null,ke=c.useMemo(()=>Ua(W,ve),[W,ve]),be=c.useMemo(()=>{if(!ve)return null;const k=r??n;if(!k)return null;const K=k.precision==="f16-bits"?er(k.data):k.data;return pc(K,k.width,k.height,k.channels)},[ve,r,n]),$e=c.useMemo(()=>{var k;return bs(((k=it(ke))==null?void 0:k.displayRange)??"unit",ae==="none"?null:ae)},[ke,ae]),tt=c.useMemo(()=>ae!=="none"?wc(ae):void 0,[ae]),Ie=c.useMemo(()=>U?yt(U.a,U.b,p,g,"b"):null,[U,p,g]),xt=c.useMemo(()=>Ie?gn(Ie):"none",[Ie]),ht=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",nt=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",Be=c.useMemo(()=>L?H==="diff"&&Ie?Ie.result:L:null,[H,Ie,L]),Mt=c.useCallback(()=>{const k=S.current;if(!A||!k||!k.surface||!k.texA||!k.texB||!L)return;const K=Be??L,q=y.current,X=q?q.getBoundingClientRect():{width:K.w,height:K.h},ie=eo({zoom:M,pan:m},X,K.w,K.h);ee(de=>de.x===ie.x&&de.y===ie.y&&de.w===ie.w&&de.h===ie.h?de:ie);const le=T.current;if(X.width>0&&X.height>0&&le&&k.surface){const de=Math.max(1,Math.round(X.width*Pe)),Ne=Math.max(1,Math.round(X.height*Pe));(le.width!==de||le.height!==Ne)&&(le.width=de,le.height=Ne,k.surface.configure(de,Ne))}const _e=to(ie,X,K.w,K.h)>=hn?"nearest":"linear",Te=ie;try{if(H==="diff"){const de=it(ke)?ke:"absolute",Ne=de==="hdr-flip"&&be?{ppd:67,startExposure:be.startExposure,stopExposure:be.stopExposure,numExposures:be.numExposures}:void 0,ze=Co(k.device,k.texA,k.texB,de,Ne,ht,nt,Ie??void 0);P.current=ze,sc(k.device,k.surface,ze.texture,ze.displayRange,{uv:Te,cmapMode:$e,colormap:tt,filter:_e,exposureEV:Ge,offset:G})}else{const de={exposureEV:Ge,offset:G,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:Te,filter:_e,mode:H,split:s,alpha:i};fi(k.device,k.surface,k.texA,k.texB,de)}}catch(de){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",de),D(!0)}},[A,L,Be,Ie,M,m.x,m.y,H,s,i,Ge,G,W,ke,be,$e,tt,e,t,n,r,ht,nt,Pe]);c.useEffect(()=>{Mt()},[Mt,re,me]);const Ze=t!=null||r!=null;c.useEffect(()=>{const k=S.current;if(!A||!k||!k.texA||!k.texB||!Ze){Ae(null);return}let K=!1;const q=k.texA,X=k.texB,ie=P.current,le=H==="diff"?Ie??void 0:void 0;return(H==="diff"&&ie?Ja(k.device,ie,q,X,le):wr(k.device,q,X,le)).then(Te=>{K||Ae(Te)}),()=>{K=!0}},[A,re,Ze,H,W,Ie]),c.useEffect(()=>{const k=S.current;if(!A||!k||!k.texA||!k.texB||!Ze){$(null);return}let K=!1;$(null);const q=H==="diff"?Ie??void 0:void 0;return Za(k.device,k.texA,k.texB,ht,nt,q).then(X=>{K||$(X)}).catch(()=>{K||$(null)}),()=>{K=!0}},[A,re,Ze,H,xt,ht,nt]),c.useEffect(()=>{if(H!=="diff"){Y.current=null,O.current=null;return}const k=S.current,K=P.current;if(!A||!k||!K)return;let q=!1;return Y.current=null,O.current=null,j(X=>X+1),Ro(k.device,K).then(X=>{q||(Y.current=X,O.current={w:K.width,h:K.height},j(ie=>ie+1))}).catch(()=>{}),()=>{q=!0}},[A,H,ke,re,Ie]);const No=(k,K)=>(q,X,ie)=>{const le=K.current;if(le){const{data:Go,width:zo,height:Ac,channels:Vo}=le;if(q<0||X<0||q>=zo||X>=Ac)return null;const Yt=(X*zo+q)*Vo,Kt=le.precision==="f16-bits"?In=>kt(Go[In]??0):In=>Go[In]??0,Cc=.5,Rc=Vo===1?[Kt(Yt)]:[Kt(Yt),Kt(Yt+1),Kt(Yt+2)];return ft(Rc,"unit",ie,Cc)}const _e=k.current;if(!_e||q<0||X<0||q>=_e.width||X>=_e.height)return null;const Te=(X*_e.width+q)*4,de=_e.data[Te],Ne=_e.data[Te+1],ze=_e.data[Te+2],je=bt(de,Ne,ze);return ft(de===Ne&&Ne===ze?[de]:[de,Ne,ze],"uint8",ie,je)},Ht=c.useMemo(()=>No(Me,xe),[]),Bn=c.useMemo(()=>No(ce,Le),[]),On=c.useMemo(()=>(k,K,q)=>{var je;const X=Y.current,ie=O.current;if(!X||!ie)return null;const{w:le,h:_e}=ie;if(k<0||K<0||k>=le||K>=_e)return null;const Te=(K*le+k)*4,de=((je=it(ke))==null?void 0:je.output)??"per-channel",Ne=.5,ze=de==="scalar"?[X[Te]??0]:[X[Te]??0,X[Te+1]??0,X[Te+2]??0];return ft(ze,"unit",q,Ne)},[ke]);c.useEffect(()=>{const k=y.current;if(k)return k.__cairnCompareProbe={sampleDiff:(K,q,X="decimal")=>On(K,q,X),sampleFg:(K,q,X="decimal")=>Ht(K,q,X),sampleRef:(K,q,X="decimal")=>Bn(K,q,X),get diffSamples(){return Y.current},get dims(){return Be},get primaryDims(){return L},get diffResultDims(){return O.current},get align(){return p},get fit(){return g},get resolvedKernelId(){return ke},get compareMode(){return H},get ssimScalar(){return V},get ssimText(){return Mo(V)}},()=>{k&&delete k.__cairnCompareProbe}},[On,Ht,Bn,L,Be,p,g,ke,H,V]);const Sc=b==="auto"?void 0:b;if(R)return n!=null||r!=null?d.jsx(bc,{}):H==="diff"?d.jsx(Mn,{imageUrl:e,baselineUrl:t,diffMode:((Uo=it(ke))==null?void 0:Uo.kind)==="pointwise"?ke:"absolute",interpolation:b,colormap:ae,showAxes:!1,zoom:M,pan:m,onViewportChange:f,label:x,pixelValueNotation:_}):d.jsx(xc,{imageUrl:e,baselineUrl:t,mode:H,splitPosition:s,blendAlpha:i,onSplitPositionChange:l,zoom:M,pan:m,onViewportChange:f,interpolation:b,label:x,pixelValueNotation:_});const Pc=d.jsxs(d.Fragment,{children:[d.jsx("canvas",{ref:T,className:"w-full h-full block",style:{imageRendering:Sc},"data-gpu-compare-canvas":!0}),H==="split"&&d.jsx(Io,{splitPosition:s,onChange:l,onReset:()=>l==null?void 0:l(.5)})]}),Fo=!!x,Tc=Fo?"bottom-7":"bottom-1";return d.jsx(Ft,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":A},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:y,wrapperRef:C,zoom:M,pan:m,onViewportChange:f,naturalDims:Be,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:Pc,showAxes:!1,notationSeed:_,onReset:qe,extraModified:Fe,exportCanvasRef:T,requestRender:Mt,leadingMenus:Se,displayAdjust:{exposureEV:Ge,offset:G,onExposureChange:et,onOffsetChange:ge},label:"",showLabelChip:!1,overlay:{render:({notation:k,setOverlayActive:K})=>H==="split"?d.jsxs(d.Fragment,{children:[Ze&&Be&&d.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-s)*100}% 0 0)`},children:d.jsx(dt,{imageElRef:T,naturalWidth:Be.w,naturalHeight:Be.h,zoom:M,pan:m,sourceWindow:Q,sample:Bn,notation:k,version:z})}),Ze&&Be&&d.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${s*100}%)`},children:d.jsx(dt,{imageElRef:T,naturalWidth:Be.w,naturalHeight:Be.h,zoom:M,pan:m,sourceWindow:Q,sample:Ht,notation:k,version:z,onActiveChange:K})})]}):Be&&d.jsx(dt,{imageElRef:T,naturalWidth:Be.w,naturalHeight:Be.h,zoom:M,pan:m,sourceWindow:Q,sample:H==="diff"?On:Ht,notation:k,version:H==="diff"?J:z,onActiveChange:K})},extraChips:d.jsxs(d.Fragment,{children:[H==="split"&&d.jsx(Oo,{}),Fo?d.jsx(bn,{label:x,corner:"bottom-right"}):null,oe&&d.jsxs("span",{className:`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${Tc}`,"data-gpu-compare-metrics":!0,children:["MSE ",oe.mse.toExponential(2)," · PSNR ",Number.isFinite(oe.psnr)?oe.psnr.toFixed(1):"∞"," dB · MAE"," ",oe.mae.toExponential(2)," · SSIM ",Mo(V)]})]})})}const _c="cairn-plot:gpu-image-ready";async function Mc(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await Pt(),window.__cairnPlotGpuImagePane=da,window.__cairnPlotGpuComparePane=Ec,window.__cairnPlotDiffMenuModes=_o(),window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(_c))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e),Jr("no-webgpu")}}}Mc()})(__cairnPlotJsxRuntime,__cairnPlotReact);
