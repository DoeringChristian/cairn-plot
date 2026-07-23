var Xa=Object.defineProperty;var Wa=(f,a,tt)=>a in f?Xa(f,a,{enumerable:!0,configurable:!0,writable:!0,value:tt}):f[a]=tt;var fe=(f,a,tt)=>Wa(f,typeof a!="symbol"?a+"":a,tt);(function(f,a){"use strict";const tt=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function Tn(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:tt}),{hdr:!1,format:n}}function mo(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:tt}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:tt}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return Tn(e,t)}}}const go=`
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
`,xo=`
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
`;function $t(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Pn(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function bo(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const vo={texture:0,sampler:1,uniform:2};function Xt(e,t){return e*3+vo[t]}const wo={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function yo(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),i=r[2]!==void 0,s=r[3].trim();if(i){const l=wo[s];if(l===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${s}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:l})}else s==="sampler"||s==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class An{constructor(t,n,r,o){fe(this,"width");fe(this,"height");fe(this,"format");fe(this,"gpuTexture");fe(this,"device");fe(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:$t(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*Pn(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class Rn{constructor(t){fe(this,"_s");fe(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class Eo{constructor(t,n,r,o,i){fe(this,"_p");fe(this,"gpuPipeline");fe(this,"bindings");fe(this,"bindGroupLayout");fe(this,"variants");fe(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=i,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function _o(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class Mo{constructor(t){fe(this,"_c");fe(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class So{constructor(t,n,r,o,i){fe(this,"width");fe(this,"height");fe(this,"paramsBuffer");fe(this,"bindGroup");fe(this,"buffers");fe(this,"destroyed",!1);this.width=t,this.height=n,this.buffers=r,this.paramsBuffer=o,this.bindGroup=i}destroy(){if(!this.destroyed){for(const t of this.buffers)t.destroy();this.paramsBuffer.destroy(),this.destroyed=!0}}}class To{constructor(t,n){fe(this,"_b");fe(this,"gpuBindGroup");fe(this,"ownedBuffers");fe(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class Po{constructor(t,n,r,o){fe(this,"canvas");fe(this,"hdr");fe(this,"format");fe(this,"context");fe(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function wt(e){return"canvas"in e}async function Ao(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function i(d){return wt(d)?d.getCurrentTextureView():d.gpuTexture.createView()}function s(d){if(wt(d))return{width:d.canvas.width,height:d.canvas.height};const g=d;return{width:g.width,height:g.height}}let l=!1,c=null;function u(){var g,x;if(c!==null)return c;let d=!1;try{if(typeof document<"u"){const _=document.createElement("canvas");_.width=1,_.height=1;const y=_.getContext("webgpu");if(y)try{y.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:GPUTextureUsage.RENDER_ATTACHMENT});const k=(g=y.getConfiguration)==null?void 0:g.call(y);d=((x=k==null?void 0:k.toneMapping)==null?void 0:x.mode)==="extended"}catch{d=!1}finally{try{y.unconfigure()}catch{}}}}catch{d=!1}return c=d,d}const h=256;let b=null,p=null;function v(){if(!b||!p){const d=t.createShaderModule({code:go});p=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const g=t.createPipelineLayout({bindGroupLayouts:[p]});b=t.createComputePipeline({layout:g,compute:{module:d,entryPoint:"cs_main"}})}return{pipeline:b,layout:p}}let E=null,w=null;function T(){if(!E||!w){const d=t.createShaderModule({code:xo});w=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});const g=t.createPipelineLayout({bindGroupLayouts:[w]});E=t.createRenderPipeline({layout:g,vertex:{module:d,entryPoint:"vs_main"},fragment:{module:d,entryPoint:"fs_main",targets:[{format:"rgba16float"}]},primitive:{topology:"triangle-list"}})}return{pipeline:E,layout:w}}return{backend:"webgpu",capabilities:n,probeExtendedToneMapping:u,createTexture(d,g,x){return new An(t,d,g,x)},createSampler(d){const g=(d==null?void 0:d.filter)==="linear"?"linear":"nearest",x=t.createSampler({magFilter:g,minFilter:g,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new Rn(x)},createRenderPipeline(d){const g=t.createShaderModule({code:d.shaderWGSL}),x=yo(d.shaderWGSL),_=$t(d.targetFormat),y=_o(t,x),k=t.createPipelineLayout({bindGroupLayouts:[y]}),S=P=>t.createRenderPipeline({layout:k,vertex:{module:g,entryPoint:"vs_main"},fragment:{module:g,entryPoint:"fs_main",targets:[{format:P}]},primitive:{topology:"triangle-list"}}),M=S(_);return new Eo(M,x,y,_,S)},createComputePipeline(d){const g=t.createShaderModule({code:d.shaderWGSL}),x=t.createComputePipeline({layout:"auto",compute:{module:g,entryPoint:"cs_main"}});return new Mo(x)},createBindGroup(d,g){const x=d,_=new Map,y=[];for(const[S,M]of x.bindings)if(M.kind==="uniform"){const P=t.createBuffer({size:M.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});y.push(P),_.set(S,{binding:S,resource:{buffer:P}})}else M.kind==="sampler"&&_.set(S,{binding:S,resource:o()});for(const S of g){const M=S.resource;if(M instanceof An){const P=Xt(S.binding,"texture");x.bindings.has(P)&&_.set(P,{binding:P,resource:M.gpuTexture.createView()})}else if(M instanceof Rn){const P=Xt(S.binding,"sampler");x.bindings.has(P)&&_.set(P,{binding:P,resource:M.gpuSampler})}else{const P=Xt(S.binding,"uniform"),D=x.bindings.get(P);if(D&&D.kind==="uniform"){const R=M.uniform,A=t.createBuffer({size:Math.max(D.sizeBytes,R.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(A,0,R.buffer,R.byteOffset,R.byteLength),y.push(A),_.set(P,{binding:P,resource:{buffer:A}})}}}const k=t.createBindGroup({layout:x.bindGroupLayout,entries:Array.from(_.values())});return new To(k,y)},createSurface(d,g){const x=d.getContext("webgpu");if(!x)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const _=g.hdr&&n.hdr,y=()=>_?mo(x,t):Tn(x,t),k=y();return new Po(d,x,k,y)},renderFullscreen(d,g,x){const _=g,y=x,k=i(d),{width:S,height:M}=s(d),P=wt(d)?d.format:$t(d.format),D=_.pipelineFor(P),R=t.createCommandEncoder(),A=R.beginRenderPass({colorAttachments:[{view:k,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});A.setPipeline(D),A.setBindGroup(0,y.gpuBindGroup),A.setViewport(0,0,S,M,0,1),A.draw(3),A.end(),t.queue.submit([R.finish()])},createDeepSampleBuffers(d){const{layout:g}=T(),x=P=>{const D=t.createBuffer({size:P.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});return t.queue.writeBuffer(D,0,P.buffer,P.byteOffset,P.byteLength),D},_=x(d.offsets),y=x(d.colors),k=x(d.zs),S=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),M=t.createBindGroup({layout:g,entries:[{binding:0,resource:{buffer:_}},{binding:1,resource:{buffer:y}},{binding:2,resource:{buffer:k}},{binding:3,resource:{buffer:S}}]});return new So(d.width,d.height,[_,y,k],S,M)},compositeDeep(d,g,x,_){const y=d,k=g,{pipeline:S}=T();t.queue.writeBuffer(y.paramsBuffer,0,new Float32Array([y.width,y.height,_,x]));const M=t.createCommandEncoder(),P=M.beginRenderPass({colorAttachments:[{view:k.gpuTexture.createView(),loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});P.setPipeline(S),P.setBindGroup(0,y.bindGroup),P.setViewport(0,0,k.width,k.height,0,1),P.draw(3),P.end(),t.queue.submit([M.finish()])},async readback(d){const g=wt(d),{width:x,height:_}=s(d),y=g?d.hdr?"rgba16float":"rgba8unorm":d.format,k=g&&d.format==="bgra8unorm",S=g?d.getCurrentGPUTexture():d.gpuTexture,M=Pn(y),P=x*M,D=256,R=Math.ceil(P/D)*D,A=R*_,V=t.createBuffer({size:A,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),L=t.createCommandEncoder();L.copyTextureToBuffer({texture:S},{buffer:V,bytesPerRow:R,rowsPerImage:_},{width:x,height:_,depthOrArrayLayers:1}),t.queue.submit([L.finish()]),await V.mapAsync(GPUMapMode.READ);const B=new Uint8Array(V.getMappedRange()),N=new Uint8Array(P*_);for(let O=0;O<_;O++){const q=O*R,J=O*P;N.set(B.subarray(q,q+P),J)}if(V.unmap(),V.destroy(),y==="rgba8unorm"){if(k)for(let O=0;O<N.length;O+=4){const q=N[O],J=N[O+2];N[O]=J,N[O+2]=q}return N}if(y==="rgba16float"){const O=new Uint16Array(N.buffer,N.byteOffset,N.byteLength/2),q=new Float32Array(O.length);for(let J=0;J<O.length;J++)q[J]=bo(O[J]);return q}return new Float32Array(N.buffer,N.byteOffset,N.byteLength/4)},async reduceDiffSumSquaredAbs(d,g,x,_){const y=d,k=g,S=Math.max(0,x*_),M=Math.max(1,Math.ceil(S/h)),{pipeline:P,layout:D}=v(),R=M*2*4,A=t.createBuffer({size:R,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),V=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(V,0,new Uint32Array([Math.max(1,x),Math.max(1,_),S,0]));const L=t.createBindGroup({layout:D,entries:[{binding:0,resource:y.gpuTexture.createView()},{binding:1,resource:k.gpuTexture.createView()},{binding:2,resource:{buffer:A}},{binding:3,resource:{buffer:V}}]}),B=t.createBuffer({size:R,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),N=t.createCommandEncoder(),O=N.beginComputePass();O.setPipeline(P),O.setBindGroup(0,L),O.dispatchWorkgroups(M),O.end(),N.copyBufferToBuffer(A,0,B,0,R),t.queue.submit([N.finish()]),await B.mapAsync(GPUMapMode.READ);const J=new Float32Array(B.getMappedRange()).slice();B.unmap(),B.destroy(),A.destroy(),V.destroy();let be=0,ge=0;for(let re=0;re<M;re++)be+=J[re*2],ge+=J[re*2+1];return{sumSq:be,sumAbs:ge}},destroy(){l||(t.destroy(),l=!0)},isContextLost(){return!1}}}let Wt=null;async function Ro(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return Ao()}function yt(){return Wt||(Wt=Ro()),Wt}function Co(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function ko(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),i=Math.floor(o),s=Math.min(i+1,e.length-1),l=o-i,[c,u,h]=Co(e[i],e[s],l);t[n*3]=Math.round(c),t[n*3+1]=Math.round(u),t[n*3+2]=Math.round(h)}return t}const Cn={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},Do=new Set(["red-green","red-blue"]),kn=new Map;function Ht(e){let t=kn.get(e);if(!t){const n=Cn[e]??Cn.viridis;t=ko(n),kn.set(e,t)}return t}const Ye=e=>e<0?0:e>1?1:e,Yt=e=>{const t=e<0?0:e;return t/(1+t)},Kt=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return Ye(n/r)},Et=4,Lo=1,Bo=16,Oo=.5,Dn={linear:([e,t,n])=>[Ye(e),Ye(t),Ye(n)],srgb:([e,t,n])=>[Ye(e),Ye(t),Ye(n)],reinhard:([e,t,n])=>[Yt(e),Yt(t),Yt(n)],aces:([e,t,n])=>[Kt(e),Kt(t),Kt(n)],extended:([e,t,n])=>[e,t,n]},Ln="srgb",Io=["linear","srgb","reinhard","aces"],No=["extended","extended-reinhard","extended-aces"],Fo=["extended-reinhard","extended-aces"];function Bn(e){return!!e&&No.includes(e)}function Uo(e){return!!e&&Fo.includes(e)}const On={extended:"linear","extended-reinhard":"reinhard","extended-aces":"aces"};function Go(e){return e&&Dn[e]||Dn[Ln]}function qt(e){return e&&On[e]?On[e]:e&&Io.includes(e)?e:Ln}function zo(e,t){return t?Bn(e)?e:"extended":qt(e)}function _t(e,t,n){return e*2**t+n}function Vo(e){const t=Ye(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function Zt(e,t){return typeof t=="number"&&t>0?Ye(Math.pow(Ye(e),1/t)):Vo(e)}function jt(e,t,n="linear",r=0,o=0){const i=Ht(t),s=new ImageData(e.width,e.height),l=e.data,c=s.data,u=r!==0||o!==0;for(let h=0;h<l.length;h+=4){let b=(l[h]+l[h+1]+l[h+2])/3;u&&(b=Math.max(0,Math.min(255,_t(b/255,r,o)*255)));let p;n==="positive"?p=Math.round(128+b/255*127):p=Math.round(b),p=Math.max(0,Math.min(255,p)),c[h]=i[p*3],c[h+1]=i[p*3+1],c[h+2]=i[p*3+2],c[h+3]=l[h+3]}return s}function $o(e,t){return e==="signed"||e==="relative"?"signed":Qt(t)}function Qt(e){return Do.has(e??"")?"positive":"linear"}function In(e){const t=new Map;return{get(n){return t.get(n)},set(n,r){if(t.size>=e){const o=t.keys().next().value;o!==void 0&&t.delete(o)}t.set(n,r)}}}const Nn=In(50);function Jt(e){return Nn.get(e)}function en(e,t){Nn.set(e,t)}const Fn=In(100);function Xo(e){return Fn.get(e)}function Wo(e,t){Fn.set(e,t)}function Ho(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),i=new ImageData(r,o);for(let s=0;s<o;s++)for(let l=0;l<r;l++){const c=(s*e.width+l)*4,u=(s*t.width+l)*4,h=(s*r+l)*4;for(let b=0;b<3;b++){const p=e.data[c+b],v=t.data[u+b],E=p-v,w=Math.abs(E),T=Math.max(p,1);let m;switch(n){case"signed":m=(E+255)/2;break;case"absolute":m=w;break;case"squared":m=E*E/255;break;case"relative_signed":m=(E/T+1)*127.5;break;case"relative_absolute":m=w/T*255;break;case"relative_squared":m=E*E/(T*T)*255;break}i.data[h+b]=Math.min(255,Math.max(0,Math.round(m)))}i.data[h+3]=255}return i}async function it(e){const t=Xo(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const i=o.getContext("2d");if(!i){n(null);return}i.drawImage(r,0,0);const s=i.getImageData(0,0,o.width,o.height);Wo(e,s),n(s)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const Yo={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},Ko={linear:0,signed:1,positive:2},qo=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,Zo=`#version 300 es
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
}`;let at=null,te=null,Be=null,Mt=null;function jo(){if(te)return te;try{if(typeof OffscreenCanvas<"u"?at=new OffscreenCanvas(1,1):at=document.createElement("canvas"),te=at.getContext("webgl2",{preserveDrawingBuffer:!0}),!te)return console.warn("[cairn] WebGL 2 not available"),null;const e=te.createShader(te.VERTEX_SHADER);if(te.shaderSource(e,qo),te.compileShader(e),!te.getShaderParameter(e,te.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",te.getShaderInfoLog(e)),null;const t=te.createShader(te.FRAGMENT_SHADER);if(te.shaderSource(t,Zo),te.compileShader(t),!te.getShaderParameter(t,te.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",te.getShaderInfoLog(t)),null;if(Be=te.createProgram(),te.attachShader(Be,e),te.attachShader(Be,t),te.linkProgram(Be),!te.getProgramParameter(Be,te.LINK_STATUS))return console.error("[cairn] WebGL program link:",te.getProgramInfoLog(Be)),null;Mt=te.createVertexArray(),te.bindVertexArray(Mt);const n=te.createBuffer();te.bindBuffer(te.ARRAY_BUFFER,n),te.bufferData(te.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),te.STATIC_DRAW);const r=te.getAttribLocation(Be,"a_pos");return te.enableVertexAttribArray(r),te.vertexAttribPointer(r,2,te.FLOAT,!1,0,0),te.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),te}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function Un(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function Qo(e,t,n){const r=new Uint8Array(1024);for(let i=0;i<256;i++)r[i*4]=t[i*3],r[i*4+1]=t[i*3+1],r[i*4+2]=t[i*3+2],r[i*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function Jo(e,t,n,r){const o=jo();if(!o||!Be||!Mt||!at)return null;const i=Math.min(e.width,t.width),s=Math.min(e.height,t.height);at.width=i,at.height=s,o.viewport(0,0,i,s);const l=Un(o,e,0),c=Un(o,t,1);let u=null;n.colormap?u=Qo(o,n.colormap,2):(u=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,u),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(Be),o.uniform1i(o.getUniformLocation(Be,"u_baseline"),0),o.uniform1i(o.getUniformLocation(Be,"u_other"),1),o.uniform1i(o.getUniformLocation(Be,"u_lut"),2),o.uniform1i(o.getUniformLocation(Be,"u_diff_mode"),Yo[n.diffMode]),o.uniform1i(o.getUniformLocation(Be,"u_cmap_mode"),Ko[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(Be,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(Mt),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=i,r.height=s;const h=r.getContext("2d");return h&&(h.save(),h.scale(1,-1),h.drawImage(at,0,0,i,s,0,-s,i,s),h.restore()),o.deleteTexture(l),o.deleteTexture(c),o.deleteTexture(u),{width:i,height:s}}const es="cairn:render-mode";function ts(){try{const e=localStorage.getItem(es);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const St=15360;function Tt(e){const t=e&32768?-1:1,n=e>>10&31,r=e&1023;return n===0?r===0?t*0:t*r*2**-24:n===31?r===0?t*(1/0):NaN:t*2**(n-15)*(1+r/1024)}const Gn=globalThis.Float16Array;function zn(e,t=e.length){if(Gn){const r=new Gn(e.buffer,e.byteOffset,t);return Float32Array.from(r)}const n=new Float32Array(t);for(let r=0;r<t;r++)n[r]=Tt(e[r]);return n}const Ke=new Uint32Array(512),qe=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(Ke[e]=0,Ke[e|256]=32768,qe[e]=24,qe[e|256]=24):t<-14?(Ke[e]=1024>>-t-14,Ke[e|256]=1024>>-t-14|32768,qe[e]=-t-1,qe[e|256]=-t-1):t<=15?(Ke[e]=t+15<<10,Ke[e|256]=t+15<<10|32768,qe[e]=13,qe[e|256]=13):t<128?(Ke[e]=31744,Ke[e|256]=64512,qe[e]=24,qe[e|256]=24):(Ke[e]=31744,Ke[e|256]=64512,qe[e]=13,qe[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var bt=Uint8Array,Vn=Uint16Array,ns=Int32Array,rs=new bt([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),os=new bt([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),$n=function(e,t){for(var n=new Vn(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new ns(n[30]),r=1;r<30;++r)for(var i=n[r];i<n[r+1];++i)o[i]=i-n[r]<<5|r;return{b:n,r:o}},Xn=$n(rs,2),ss=Xn.b,is=Xn.r;ss[28]=258,is[258]=28,$n(os,0);for(var as=new Vn(32768),_e=0;_e<32768;++_e){var nt=(_e&43690)>>1|(_e&21845)<<1;nt=(nt&52428)>>2|(nt&13107)<<2,nt=(nt&61680)>>4|(nt&3855)<<4,as[_e]=((nt&65280)>>8|(nt&255)<<8)>>1}for(var Pt=new bt(288),_e=0;_e<144;++_e)Pt[_e]=8;for(var _e=144;_e<256;++_e)Pt[_e]=9;for(var _e=256;_e<280;++_e)Pt[_e]=7;for(var _e=280;_e<288;++_e)Pt[_e]=8;for(var cs=new bt(32),_e=0;_e<32;++_e)cs[_e]=5;var ls=new bt(0),us=typeof TextDecoder<"u"&&new TextDecoder,fs=0;try{us.decode(ls,{stream:!0}),fs=1}catch{}const Wn=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function tn(e){const t=Wn.length;return Wn[(e%t+t)%t]}function ds(e){const n=a.useRef(null),[r,o]=a.useState({w:0,h:0}),i=a.useRef(null),s=a.useRef(null),l=a.useRef(null),c=a.useCallback((u,h)=>{o(b=>b.w===u&&b.h===h?b:{w:u,h})},[]);return a.useLayoutEffect(()=>{const u=n.current;if(!u||u===l.current)return;const h=u.getBoundingClientRect();(h.width>0||h.height>0)&&(l.current=u,c(h.width,h.height))}),a.useEffect(()=>{var b;const u=n.current;if(u===s.current||((b=i.current)==null||b.disconnect(),i.current=null,s.current=u,!u))return;const h=new ResizeObserver(p=>{for(const v of p)c(v.contentRect.width,v.contentRect.height)});i.current=h,h.observe(u)}),a.useEffect(()=>()=>{var u;return(u=i.current)==null?void 0:u.disconnect()},[]),{ref:n,size:r}}function ps(){const[e,t]=a.useState(!1);return a.useEffect(()=>{const n=i=>{(i.key==="Alt"||i.key==="Control"||i.key==="Meta")&&t(!0)},r=i=>{(i.key==="Alt"||i.key==="Control"||i.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const hs=.001;function ms(e,t=hs){return Math.exp(-e*t)}function Hn(e,t){return Math.hypot(e.x-t.x,e.y-t.y)}function Yn(e,t){return{x:(e.x+t.x)/2,y:(e.y+t.y)/2}}function gs(e,t,n,r,o,i,s){const l=t>0&&r>0?r/t:1,c=Math.max(i,Math.min(s,e.zoom*l)),u=(n.x-e.pan.x)/e.zoom,h=(n.y-e.pan.y)/e.zoom;return{zoom:c,pan:{x:o.x-u*c,y:o.y-h*c}}}const xs=.25,nn=64;function rn(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return nn;const o=Math.min(n/e,r/t);return o<=0?nn:Math.max(Math.max(n,r)/o,8)}function Kn(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:i=xs,maxZoom:s=nn,naturalWidth:l,naturalHeight:c}=e,u=ps(),h=a.useRef(u);h.current=u;const b=a.useRef({zoom:n,pan:r});b.current={zoom:n,pan:r};const p=a.useRef(o);p.current=o,a.useEffect(()=>{const S=t.current;if(!S||!o)return;const M=P=>{var J;if(!P.ctrlKey&&!h.current)return;P.preventDefault(),P.stopPropagation();const D=ms(P.deltaY),R=b.current,A=S.getBoundingClientRect(),V=l&&c?rn(l,c,A.width,A.height):s,L=Math.max(i,Math.min(V,R.zoom*D));if(R.zoom===L)return;const B=P.clientX-A.left,N=P.clientY-A.top,O=B-(B-R.pan.x)/R.zoom*L,q=N-(N-R.pan.y)/R.zoom*L;(J=p.current)==null||J.call(p,{zoom:L,pan:{x:O,y:q}})};return S.addEventListener("wheel",M,{passive:!1}),()=>S.removeEventListener("wheel",M)},[t,!!o,i,s,l,c]);const v=a.useRef(new Map),E=a.useRef(null),w=a.useRef(null),T=a.useCallback((S,M,P)=>{const D=S.getBoundingClientRect();return{x:M-D.left,y:P-D.top}},[]),m=a.useCallback(S=>{if(!l||!c)return s;const M=S.getBoundingClientRect();return rn(l,c,M.width,M.height)},[l,c,s]),d=a.useCallback((S,M)=>{const P=v.current,D=P.get(S),R=P.get(M);!D||!R||(E.current=null,w.current={idA:S,idB:M,startDist:Hn(D,R),startMid:Yn(D,R),startZoom:b.current.zoom,startPan:{...b.current.pan}})},[]),g=a.useCallback(S=>{const M=v.current.get(S);M&&(E.current={pointerId:S,startX:M.x,startY:M.y,panX:b.current.pan.x,panY:b.current.pan.y})},[]),x=a.useCallback(S=>{if(!p.current)return;const M=S.pointerType==="touch";if(!M&&!h.current)return;const P=S.currentTarget;if(P.setPointerCapture(S.pointerId),v.current.set(S.pointerId,T(P,S.clientX,S.clientY)),M&&v.current.size>=2){const D=[...v.current.keys()];d(D[D.length-2],D[D.length-1]);return}g(S.pointerId)},[T,d,g]),_=a.useCallback(S=>{var A,V;const M=S.currentTarget,P=v.current.get(S.pointerId);if(P){const L=T(M,S.clientX,S.clientY);P.x=L.x,P.y=L.y}const D=w.current;if(D){const L=v.current.get(D.idA),B=v.current.get(D.idB);if(!L||!B)return;const N=gs({zoom:D.startZoom,pan:D.startPan},D.startDist,D.startMid,Hn(L,B),Yn(L,B),i,m(M));(A=p.current)==null||A.call(p,N);return}const R=E.current;!R||R.pointerId!==S.pointerId||!P||(V=p.current)==null||V.call(p,{zoom:b.current.zoom,pan:{x:R.panX+(P.x-R.startX),y:R.panY+(P.y-R.startY)}})},[T,i,m]),y=a.useCallback(S=>{var P;try{S.currentTarget.releasePointerCapture(S.pointerId)}catch{}v.current.delete(S.pointerId);const M=w.current;if(M&&(S.pointerId===M.idA||S.pointerId===M.idB)){w.current=null;const D=[...v.current.keys()];D.length===1&&g(D[0]);return}((P=E.current)==null?void 0:P.pointerId)===S.pointerId&&(E.current=null)},[g]);return{containerProps:{onPointerDown:x,onPointerMove:_,onPointerUp:y,onPointerCancel:y,style:{cursor:u&&!!o?"move":void 0,touchAction:o?"none":void 0}},modifierActive:u}}function on(){const[e,t]=a.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return a.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),i())};function i(){if(n)return;const s=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${s}dppx)`),r.addEventListener("change",o,{once:!0})}return i(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function ct(e){const t=a.useRef(e),[n,r]=a.useState(e),o=a.useCallback(()=>r(t.current),[]);return[n,r,{reset:o,isModified:!Object.is(n,t.current),default:t.current}]}function bs(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function qn(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function sn({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:i}=ds(),s=a.useRef(null),l=a.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),c=a.useMemo(()=>{const w=i.w,T=i.h;if(w<=0||T<=0||n<=0||r<=0)return null;const m=Math.min(w/n,T/r),d=n*m,g=r*m;return{left:(w-d)/2,top:(T-g)/2,width:d,height:g}},[i.w,i.h,n,r]),u=e.masks,h=t.showMasks&&!!u&&u.length>0,b=a.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(a.useEffect(()=>{if(!h||!u)return;const w=s.current;if(!w)return;(w.width!==n||w.height!==r)&&(w.width=n,w.height=r);const T=w.getContext("2d");if(!T)return;T.clearRect(0,0,w.width,w.height);let m=!1;const d=T.createImageData(n,r),g=d.data;let x=u.length,_=!1;const y=()=>{m||_&&T.putImageData(d,0,0)},k=document.createElement("canvas");k.width=n,k.height=r;const S=k.getContext("2d",{willReadFrequently:!0});for(const M of u){const P=new Image;P.onload=()=>{if(!m){if(S){S.clearRect(0,0,n,r),S.drawImage(P,0,0,n,r);const D=S.getImageData(0,0,n,r).data;for(let R=0;R<n*r;R++){const A=D[R*4];if(A===0||l.has(A))continue;const[V,L,B]=bs(tn(A));g[R*4]=V,g[R*4+1]=L,g[R*4+2]=B,g[R*4+3]=255,_=!0}}x-=1,x===0&&y()}},P.onerror=()=>{x-=1,x===0&&y()},P.src=`data:image/png;base64,${M.png_b64}`}return()=>{m=!0}},[h,u,n,r,b]),!c)return f.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const p=e.boxes??[],v=t.showBoxes&&p.length>0,E=e.class_labels??{};return f.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[h&&f.jsx("canvas",{ref:s,className:"absolute",style:{left:c.left,top:c.top,width:c.width,height:c.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),v&&f.jsx("svg",{className:"absolute",style:{left:c.left,top:c.top,width:c.width,height:c.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:p.map((w,T)=>{if(!qn(w,t,l))return null;const m=w.domain==="pixel"?1:n,d=w.domain==="pixel"?1:r,g=w.position.minX*m,x=w.position.minY*d,_=(w.position.maxX-w.position.minX)*m,y=(w.position.maxY-w.position.minY)*d;return f.jsx("rect",{x:g,y:x,width:_,height:y,fill:"none",stroke:tn(w.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},T)})}),v&&f.jsx("div",{className:"absolute",style:{left:c.left,top:c.top,width:c.width,height:c.height},children:p.map((w,T)=>{if(!qn(w,t,l))return null;const m=w.domain==="pixel"?1/n:1,d=w.domain==="pixel"?1/r:1,g=w.position.minX*m*100,x=w.position.minY*d*100,_=w.label??E[String(w.class_id)]??`#${w.class_id}`,y=w.score!=null?` ${(w.score*100).toFixed(0)}%`:"";return!_&&!y?null:f.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${g}%`,top:`${x}%`,transform:"translateY(-100%)",backgroundColor:tn(w.class_id)},children:f.jsxs("span",{className:"mono",children:[_,y]})},T)})})]})}const an=30,At=["#ff5a5a","#39d353","#5b9bff"];function cn(e){if(!Number.isFinite(e))return"0";const t=Math.abs(e);return t!==0&&(t<.001||t>=1e4)?e.toExponential(1):String(Number(e.toPrecision(3)))}function ft(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):cn(e/255):cn(n==="int"?e*255:e)}function lt(e,t,n,r){return e.length===1?{lines:[ft(e[0],t,n)],luminance:r}:{lines:e.map(o=>ft(o,t,n)),luminance:r,colors:e.map((o,i)=>At[i]??null)}}const vs={x:0,y:0,w:1,h:1};function ut({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:i,notation:s="decimal",version:l=0,onActiveChange:c,sourceWindow:u=vs}){const h=a.useRef(null),b=a.useRef(!1),p=on(),v=a.useRef(c);v.current=c;const E=a.useCallback(T=>{var m;T!==b.current&&(b.current=T,(m=v.current)==null||m.call(v,T))},[]),w=a.useCallback(()=>{var oe;const T=h.current,m=e.current;if(!T)return;const d=window.devicePixelRatio||1,g=T.clientWidth,x=T.clientHeight;if(g===0||x===0)return;T.width!==Math.round(g*d)&&(T.width=Math.round(g*d)),T.height!==Math.round(x*d)&&(T.height=Math.round(x*d));const _=T.getContext("2d");if(!_)return;if(_.setTransform(d,0,0,d,0,0),_.clearRect(0,0,g,x),!m||t<=0||n<=0){E(!1);return}const y=m.getBoundingClientRect(),k=T.getBoundingClientRect();if(y.width===0||y.height===0){E(!1);return}const S=u.x*t,M=u.y*n,P=u.w*t,D=u.h*n;if(P<=0||D<=0){E(!1);return}const R=Math.min(y.width/P,y.height/D);if(R<an){E(!1);return}const A=P*R,V=D*R,L=y.left+(y.width-A)/2-k.left,B=y.top+(y.height-V)/2-k.top,N=Math.max(Math.floor(S),Math.floor(S+(0-L)/R)),O=Math.min(Math.ceil(S+P),Math.ceil(S+(g-L)/R)),q=Math.max(Math.floor(M),Math.floor(M+(0-B)/R)),J=Math.min(Math.ceil(M+D),Math.ceil(M+(x-B)/R));if(O<=N||J<=q){E(!1);return}E(!0);const be=L+(0-S)*R,ge=B+(0-M)*R,re=L+(t-S)*R,Pe=B+(n-M)*R;_.save(),_.beginPath(),_.rect(be,ge,re-be,Pe-ge),_.clip(),_.textAlign="center",_.textBaseline="middle",_.lineJoin="round";const $=R*.14,F=R-$*2;for(let Z=q;Z<J;Z++)for(let ie=N;ie<O;ie++){if(ie<0||Z<0||ie>=t||Z>=n)continue;const X=i(ie,Z,s);if(!X||X.lines.length===0)continue;const ne=X.lines.length;let W=1;for(const Oe of X.lines)Oe.length>W&&(W=Oe.length);const pe=F/(ne*1.15),xe=F/(W*.62)||pe,de=Math.min(pe,xe,24);if(de<6)continue;const ce=L+(ie-S+.5)*R,Me=B+(Z-M+.5)*R,we=de*1.15,De=X.luminance<=.55,Qe=De?"#ffffff":"#000000";_.font=`${de}px ui-monospace, SFMono-Regular, Menlo, monospace`,_.lineWidth=Math.max(1.4,de*.16),_.strokeStyle=De?"rgba(0,0,0,0.85)":"rgba(255,255,255,0.9)";let Ve=Me-ne*we/2+we/2;for(let Oe=0;Oe<X.lines.length;Oe++){const U=X.lines[Oe];_.strokeText(U,ce,Ve),_.fillStyle=((oe=X.colors)==null?void 0:oe[Oe])??Qe,_.fillText(U,ce,Ve),Ve+=we}}_.restore()},[e,t,n,i,s,E,u]);return a.useEffect(()=>{w()},[w,r,o.x,o.y,l,s,u,p]),a.useEffect(()=>{const T=h.current;if(!T)return;const m=new ResizeObserver(()=>w());return m.observe(T),()=>m.disconnect()},[w]),f.jsx("canvas",{ref:h,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function Zn({notation:e,onChange:t,className:n=""}){return f.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const ws=`
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
`,ys=`
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
`;function jn(e){return`
${ze}
${dt}
${ys}

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
`}const Es=jn("select(colorB, colorA, uv.x < split)"),_s=jn("mix(colorA, colorB, alpha)");function Ms(e){switch(e){case"center":return{v:"center",h:"center"};case"top-right":return{v:"top",h:"right"};case"bottom-left":return{v:"bottom",h:"left"};case"bottom-right":return{v:"bottom",h:"right"};case"top-left":default:return{v:"top",h:"left"}}}function Qn(e,t,n){const{v:r,h:o}=Ms(n),i=e.w-t.w,s=e.h-t.h,l=o==="left"?0:o==="right"?i:Math.floor(i/2),c=r==="top"?0:r==="bottom"?s:Math.floor(s/2);return{x:l,y:c}}function kt(e,t,n,r,o="b"){if(r==="fill"){const s=o==="a"?{w:e.w,h:e.h}:{w:t.w,h:t.h};return{fit:r,result:s,offsetA:{x:0,y:0},offsetB:{x:0,y:0}}}const i={w:Math.min(e.w,t.w),h:Math.min(e.h,t.h)};return{fit:r,result:i,offsetA:Qn(e,i,n),offsetB:Qn(t,i,n)}}function Ss(e){return`${e.fit}:${e.result.w}x${e.result.h}:${e.offsetA.x},${e.offsetA.y}:${e.offsetB.x},${e.offsetB.y}`}const ln={linear:0,srgb:1,reinhard:2,aces:3,extended:4,"extended-reinhard":5,"extended-aces":6},Jn=new WeakMap;function Ts(e,t){let n=Jn.get(e);n||(n=new Map,Jn.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:ws,targetFormat:t}),n.set(t,r)),r}function er(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function tr(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function Ps(e,t,n,r){var T;const o=er(t),i=Ts(e,o),s=tr(e,r.isScalar?r.colormap:void 0),l=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,c=ln[r.operator]??ln.srgb,u=new Float32Array([r.exposureEV,c,l,r.isScalar?1:0]),h=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),b=new Float32Array([r.hdrOut?1:0]),p=new Float32Array([r.filter==="nearest"?0:1]),v=new Float32Array([r.offset??0]),E=new Float32Array([r.peak??Et]);let w;try{w=e.createBindGroup(i,[{binding:0,resource:n},{binding:1,resource:s},{binding:2,resource:{uniform:u}},{binding:3,resource:{uniform:h}},{binding:4,resource:{uniform:b}},{binding:5,resource:{uniform:p}},{binding:6,resource:{uniform:v}},{binding:7,resource:{uniform:E}}]),e.renderFullscreen(t,i,w)}finally{(T=w==null?void 0:w.destroy)==null||T.call(w),s.destroy()}}const nr=new WeakMap;function As(e,t,n){let r=nr.get(e);r||(r=new Map,nr.set(e,r));const o=`${t}:${n}`;let i=r.get(o);return i||(i=e.createRenderPipeline({shaderWGSL:t==="split"?Es:_s,targetFormat:n}),r.set(o,i)),i}function Rs(e,t,n,r,o){var w;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const i=er(t),s=As(e,o.mode,i),l=tr(e,void 0),c=o.gamma,u=ln[o.operator],h=new Float32Array([o.exposureEV,u,c,0]),b=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),p=new Float32Array([o.split,o.alpha,0,o.filter==="nearest"?0:1]),v=new Float32Array([o.offset??0,0,0,0]);let E;try{E=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:l},{binding:3,resource:{uniform:h}},{binding:4,resource:{uniform:b}},{binding:5,resource:{uniform:p}},{binding:6,resource:{uniform:v}}]),e.renderFullscreen(t,s,E)}finally{(w=E==null?void 0:E.destroy)==null||w.call(E),l.destroy()}}function rr(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,i=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:i,mae:o}}async function or(e,t,n,r){const o=r??kt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),i=o.result.w,s=o.result.h,l=i*s*3;if(l<=0)return{mse:0,psnr:1/0,mae:0};if(o.fit==="crop"&&o.offsetA.x===0&&o.offsetA.y===0&&o.offsetB.x===0&&o.offsetB.y===0&&e.reduceDiffSumSquaredAbs){const{sumSq:g,sumAbs:x}=await e.reduceDiffSumSquaredAbs(t,n,i,s);return rr(g,x,l)}const u=await e.readback(t),h=await e.readback(n),b=u instanceof Uint8Array?255:1,p=h instanceof Uint8Array?255:1,v=sr(u,t.width,t.height,b,o.offsetA,o.fit==="fill",i,s),E=sr(h,n.width,n.height,p,o.offsetB,o.fit==="fill",i,s);let w=0,T=0;const m=[0,0,0],d=[0,0,0];for(let g=0;g<s;g++)for(let x=0;x<i;x++){v(x,g,m),E(x,g,d);for(let _=0;_<3;_++){const y=m[_]-d[_];w+=y*y,T+=Math.abs(y)}}return rr(w,T,l)}function sr(e,t,n,r,o,i,s,l){const c=(b,p,v)=>e[(p*t+b)*4+v]??0;if(!i)return(b,p,v)=>{const E=Math.min(Math.max(b+o.x,0),t-1),w=Math.min(Math.max(p+o.y,0),n-1);v[0]=c(E,w,0)/r,v[1]=c(E,w,1)/r,v[2]=c(E,w,2)/r};const u=t-1,h=n-1;return(b,p,v)=>{const E=(b+.5)/s,w=(p+.5)/l,T=E*t-.5,m=w*n-.5,d=Math.floor(T),g=Math.floor(m),x=T-d,_=m-g,y=Math.min(Math.max(d,0),u),k=Math.min(Math.max(d+1,0),u),S=Math.min(Math.max(g,0),h),M=Math.min(Math.max(g+1,0),h);for(let P=0;P<3;P++){const D=c(y,S,P),R=c(k,S,P),A=c(y,M,P),V=c(k,M,P),L=D+(R-D)*x,B=A+(V-A)*x;v[P]=(L+(B-L)*_)/r}}}function ir(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const Cs=12,rt=[];function ar(e){const t=rt.indexOf(e);t!==-1&&rt.splice(t,1),rt.push(e)}function ks(e){const t=rt.indexOf(e);t!==-1&&rt.splice(t,1)}function Dt(e){e.parked||(ks(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),e.surface=null,e.parked=!0)}function cr(e){for(;rt.length>Cs;){const t=rt.find(n=>n!==e&&!n.visible)??rt.find(n=>n!==e);if(!t)break;Dt(t)}}function lr(e){var o,i,s,l;if(e.disposed)return;if(ir())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){ar(e),cr(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||((i=e.deep)==null?void 0:i.width)||1,r=e.backingHeight||((s=e.source)==null?void 0:s.height)||((l=e.deep)==null?void 0:l.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.deep){const c=t.createTexture(e.deep.width,e.deep.height,"rgba16float");e.srcTexture=c,e.deepBuffers=t.createDeepSampleBuffers(e.deep),t.compositeDeep(e.deepBuffers,c,e.deepZNear,e.deepZFar)}else if(e.source){const c=t.createTexture(e.source.width,e.source.height,e.source.format);c.write(e.source.data),e.srcTexture=c}e.parked=!1,ar(e),cr(e)}function Ds(e,t){if(e.disposed||!e.source&&!e.deep)return!0;try{return lr(e),!e.surface||!e.srcTexture?!1:(Ps(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,Dt(e),!1}}function Ls(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,e.deep=null,e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},setDeepSource(t,n,r){if(!e.disposed&&(e.deep=t,e.deepZNear=n,e.deepZFar=r,e.source=null,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy(),e.deepBuffers&&e.deepBuffers.destroy();const o=e.device.createTexture(t.width,t.height,"rgba16float");e.srcTexture=o,e.deepBuffers=e.device.createDeepSampleBuffers(t),e.device.compositeDeep(e.deepBuffers,o,n,r)}},setDeepWindow(t,n){e.disposed||(e.deepZNear=t,e.deepZFar=n,!e.parked&&e.deepBuffers&&e.srcTexture&&e.device.compositeDeep(e.deepBuffers,e.srcTexture,t,n))},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return Ds(e,t)},park(){e.disposed||Dt(e)},restore(){e.disposed||!e.source&&!e.deep||lr(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(Dt(e),e.source=null,e.deep=null,e.disposed=!0)}}}async function Bs(e,t){const n=await yt(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,deep:null,deepZNear:-1/0,deepZFar:1/0,deepBuffers:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return Ls(r)}function ur(e){e.dispose()}function Os(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:i}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...i?["invert(1)"]:[]].join(" ")}function fr(e){const n=`cairn-gamma-${a.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:i,exposure:s,offset:l,flipSign:c}=e,u=a.useMemo(()=>Os(e,n),[n,r,o,s,c]);return{gammaFilterId:n,filterStr:u,gamma:i,offset:l}}function dr({id:e,gamma:t,offset:n}){return f.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:f.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:f.jsxs("feComponentTransfer",{children:[f.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),f.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),f.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}const Is={x:0,y:0,w:1,h:1};function un(e){const t=e.sourceWindow??Is,n=t.x*e.naturalWidth,r=t.y*e.naturalHeight,o=t.w*e.naturalWidth,i=t.h*e.naturalHeight,s=Math.min(e.box.width/o,e.box.height/i),l=o*s,c=i*s;return{scale:s,imgLeft:e.box.left+(e.box.width-l)/2,imgTop:e.box.top+(e.box.height-c)/2,srcOriginX:n,srcOriginY:r}}function Ns(e){return un(e).scale}function pr(e,t,n){const r=un(n);return{x:r.srcOriginX+(e-r.imgLeft)/r.scale,y:r.srcOriginY+(t-r.imgTop)/r.scale}}function hr(e,t,n){const r=un(n);return{x:r.imgLeft+(e-r.srcOriginX)*r.scale,y:r.imgTop+(t-r.srcOriginY)*r.scale}}function Fs(e,t){const n=hr(e.x0,e.y0,t),r=hr(e.x1+1,e.y1+1,t);return{left:n.x,top:n.y,width:r.x-n.x,height:r.y-n.y}}const Lt=(e,t,n)=>Math.max(t,Math.min(n,Math.floor(e)));function mr(e,t,n,r,o){const i=pr(e,t,o),s=pr(n,r,o),l=o.naturalWidth-1,c=o.naturalHeight-1,u=Math.min(i.x,s.x),h=Math.max(i.x,s.x),b=Math.min(i.y,s.y),p=Math.max(i.y,s.y);return h<0||u>l||p<0||b>c?null:{x0:Lt(u,0,l),y0:Lt(b,0,c),x1:Lt(h,0,l),y1:Lt(p,0,c)}}const Us=["nw","n","ne","e","se","s","sw","w"],pt=(e,t,n)=>e<t?t:e>n?n:e;function Gs(e,t,n,r,o,i=1){const s=o.w-1,l=o.h-1,c=Math.round(n),u=Math.round(r);if(t==="move"){const d=e.x1-e.x0,g=e.y1-e.y0,x=pt(e.x0+c,0,s-d),_=pt(e.y0+u,0,l-g);return{x0:x,y0:_,x1:x+d,y1:_+g}}let{x0:h,y0:b,x1:p,y1:v}=e;const E=t==="nw"||t==="w"||t==="sw",w=t==="ne"||t==="e"||t==="se",T=t==="nw"||t==="n"||t==="ne",m=t==="sw"||t==="s"||t==="se";return E&&(h=pt(h+c,0,p-(i-1))),w&&(p=pt(p+c,h+(i-1),s)),T&&(b=pt(b+u,0,v-(i-1))),m&&(v=pt(v+u,b+(i-1),l)),{x0:h,y0:b,x1:p,y1:v}}function gr(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function zs({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=gr(e),i=gr(t),s=[];for(let d=0;d<=e;d+=o)s.push(d);const l=[];for(let d=0;d<=t;d+=i)l.push(d);const c=1/n,u=8*c,h=-12*c,b=-2*c,p=r==null?void 0:r.current;let v=0,E=0,w=0,T=0;if(p){const d=p.clientWidth,g=p.clientHeight,x=d/e,_=g/t,y=Math.min(x,_);w=e*y,T=t*y,v=(d-w)/2,E=(g-T)/2}const m=p&&w>0;return f.jsxs(f.Fragment,{children:[f.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:m?E:0,transform:`translateY(${h}px)`,fontSize:u},children:s.map(d=>f.jsx("span",{className:"mono",style:{position:"absolute",left:m?v+d/e*w:`${d/e*100}%`,transform:"translateX(-50%)"},children:d},d))}),f.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:m?v:0,transform:`translateX(${b}px)`,fontSize:u},children:l.map(d=>f.jsx("span",{className:"mono",style:{position:"absolute",top:m?E+d/t*T:`${d/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*c}px`},children:d},d))})]})}function Vs({label:e,isDraggable:t,onDragStart:n}){return f.jsxs("span",{className:`absolute bottom-1 left-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${t?" cairn-drag-grip":""}`,draggable:t,onDragStart:n,style:{cursor:t?"grab":void 0},children:[t&&f.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const $s=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function xr(e,t){const n=getComputedStyle(e),r=$s.map(c=>`${c}:${n.getPropertyValue(c)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const i=e.children,s=t.children,l=Math.min(i.length,s.length);for(let c=0;c<l;c++)xr(i[c],s[c])}function fn(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function dn(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function pn(e,t,n,r,o){const i=document.createElement("canvas");i.width=Math.max(1,Math.round(e*n)),i.height=Math.max(1,Math.round(t*n));const s=i.getContext("2d");if(!s)throw new Error("plot-to-png: 2D canvas context unavailable");return s.scale(n,n),r&&(s.fillStyle=r,s.fillRect(0,0,e,t)),o(s),await new Promise((l,c)=>i.toBlob(u=>u?l(u):c(new Error("plot-to-png: toBlob returned null")),"image/png"))}function Xs(e,t,n){const r=e.cloneNode(!0);xr(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),i="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((s,l)=>{const c=new Image;c.onload=()=>s(c),c.onerror=()=>l(new Error("plot-to-png: SVG rasterization failed")),c.src=i})}async function br(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,i=(t==null?void 0:t.background)??fn(e);return pn(r,o,dn(t),i,s=>s.drawImage(e,0,0,r,o))}async function Ws(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,i=(t==null?void 0:t.background)??fn(e);try{return await pn(r,o,dn(t),i,s=>s.drawImage(e,0,0,r,o))}catch(s){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${s instanceof Error?s.message:String(s)})`)}}function Hs(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const i=o.getBoundingClientRect(),s=i.width*i.height;s>r&&(r=s,n=o)}return n}async function Ys(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),i=o.width||300,s=o.height||150,l=(t==null?void 0:t.background)??fn(e);if(n){const u=n.getBoundingClientRect(),h=await Xs(n,u.width||i,u.height||s);return pn(i,s,dn(t),l,b=>{for(const p of r){const v=p.getBoundingClientRect();b.drawImage(p,v.left-o.left,v.top-o.top,v.width,v.height)}b.drawImage(h,u.left-o.left,u.top-o.top,u.width,u.height)})}if(r.length)return br(r[0],t);const c=Hs(e);if(c)return Ws(c,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function Ks(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const qs=8;function Zs(e,t,n,r=qs){return!(t>0)||!(e>0)?n:e<t+r}function vr(e,t){return Math.max(0,e.findIndex(n=>n.id===t))}function js(e){const t=e.trim();if(t==="")return null;const n=t.replace(/−/g,"-").replace(",","."),r=Number(n);return Number.isFinite(r)?r:null}function Qs(e,t){const n=js(e);return n===null?t:n}function Js(e){return String(e)}const ei={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},ti={boxZoom:f.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:f.jsxs(f.Fragment,{children:[f.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),f.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),f.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),f.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 2v20M2 12h20"}),f.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),f.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),f.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:f.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:f.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),f.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:f.jsx("path",{d:"M6 9l6 6 6-6"}),ellipsis:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"5",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),f.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),f.jsx("circle",{cx:"19",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"})]}),sun:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"12",cy:"12",r:"4"}),f.jsx("path",{d:"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"})]}),plusminus:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M4 7h6M7 4v6"}),f.jsx("path",{d:"M14 17h6"}),f.jsx("path",{d:"M6 20l12-16"})]}),layers:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 3l9 5-9 5-9-5 9-5z"}),f.jsx("path",{d:"M3 13l9 5 9-5"})]})};function Je({name:e}){return f.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:ti[e]??null})}function wr({icon:e,label:t,title:n,active:r,disabled:o,onClick:i}){return f.jsx("button",{type:"button",disabled:o,onClick:s=>{s.stopPropagation(),!o&&i()},onPointerDown:s=>s.stopPropagation(),onDoubleClick:s=>s.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?f.jsx("span",{"aria-hidden":"true",children:t}):f.jsx(Je,{name:e??""})})}function yr(){return f.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function ni({icon:e,title:t,menu:n}){var T;const{options:r,value:o,onSelect:i}=n,[s,l]=a.useState(!1),[c,u]=a.useState(0),h=a.useRef(null),b=vr(r,o),p=e?void 0:((T=r[b])==null?void 0:T.label)??"",v=a.useCallback(()=>{l(m=>{const d=!m;return d&&u(b),d})},[b]),E=a.useCallback(m=>{i(m),l(!1)},[i]);a.useEffect(()=>{if(!s)return;const m=g=>{h.current&&!h.current.contains(g.target)&&l(!1)},d=g=>{g.key==="Escape"&&(g.stopPropagation(),l(!1))};return document.addEventListener("pointerdown",m,!0),document.addEventListener("keydown",d,!0),()=>{document.removeEventListener("pointerdown",m,!0),document.removeEventListener("keydown",d,!0)}},[s]);const w=m=>{if(!s){(m.key==="ArrowDown"||m.key==="Enter"||m.key===" ")&&(m.preventDefault(),u(b),l(!0));return}if(m.key==="ArrowDown")m.preventDefault(),u(d=>(d+1)%r.length);else if(m.key==="ArrowUp")m.preventDefault(),u(d=>(d-1+r.length)%r.length);else if(m.key==="Enter"||m.key===" "){m.preventDefault();const d=r[c];d&&E(d.id)}};return f.jsxs("div",{ref:h,className:"relative inline-flex",onPointerDown:m=>m.stopPropagation(),children:[f.jsxs("button",{type:"button",onClick:m=>{m.stopPropagation(),v()},onDoubleClick:m=>m.stopPropagation(),onKeyDown:w,"aria-haspopup":"listbox","aria-expanded":s,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",p?"px-1.5 text-[10px] font-mono":"px-1 text-xs",s?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[p?f.jsx("span",{"aria-hidden":"true",children:p}):f.jsx(Je,{name:e??""}),f.jsx(Je,{name:"caret"})]}),s&&f.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((m,d)=>{const g=m.id===o,x=d===c;return f.jsx("li",{role:"option","aria-selected":g,children:f.jsx("button",{type:"button",onClick:_=>{_.stopPropagation(),E(m.id)},onPointerEnter:()=>u(d),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",x?"bg-bg-hover":"",g?"text-accent font-medium":"text-fg"].join(" "),children:m.label})},m.id)})})]})}const ri=e=>e.format?e.format(e.value):String(e.value);function Er({spec:e}){const[t,n]=a.useState(!1),[r,o]=a.useState(""),i=a.useRef(null),s=a.useCallback(()=>{o(Js(e.value)),n(!0)},[e.value]);a.useEffect(()=>{t&&i.current&&(i.current.focus(),i.current.select())},[t]);const l=a.useCallback(()=>{n(u=>(u&&e.onChange(Qs(r,e.value)),!1))},[r,e]),c=a.useCallback(()=>n(!1),[]);return f.jsxs("label",{className:"inline-flex items-center gap-1 text-fg-muted",title:e.title,onPointerDown:u=>u.stopPropagation(),onDoubleClick:u=>{u.stopPropagation(),t||s()},children:[e.icon?f.jsx("span",{"aria-hidden":"true",className:"inline-flex",children:f.jsx(Je,{name:e.icon})}):f.jsx("span",{"aria-hidden":"true",className:"text-[9px] font-mono",children:e.label}),t?f.jsx("input",{ref:i,type:"text",inputMode:"decimal","aria-label":`${e.title} (numeric entry)`,value:r,onChange:u=>o(u.target.value),onPointerDown:u=>u.stopPropagation(),onDoubleClick:u=>u.stopPropagation(),onKeyDown:u=>{u.stopPropagation(),u.key==="Enter"?(u.preventDefault(),l()):u.key==="Escape"&&(u.preventDefault(),c())},onBlur:l,className:"cairn-plot-toolbar-slider-entry h-3.5 w-[6.5rem] rounded border border-border bg-bg px-1 text-[9px] font-mono tabular-nums text-fg outline-none focus:border-accent"}):f.jsxs(f.Fragment,{children:[f.jsx("input",{type:"range","aria-label":e.title,min:e.min,max:e.max,step:e.step,value:e.value,onChange:u=>e.onChange(Number(u.target.value)),onPointerDown:u=>u.stopPropagation(),className:"cairn-plot-toolbar-slider h-1 w-16 cursor-pointer accent-accent"}),f.jsx("span",{"aria-hidden":"true",className:"w-8 text-right text-[9px] font-mono tabular-nums",children:ri(e)})]})]})}function oi({icon:e,title:t,menu:n,onClose:r}){var b;const{options:o,value:i,onSelect:s}=n,[l,c]=a.useState(!1),u=vr(o,i),h=((b=o[u])==null?void 0:b.label)??"";return f.jsxs("div",{children:[f.jsxs("button",{type:"button","aria-haspopup":"menu","aria-expanded":l,"aria-label":t,onClick:p=>{p.stopPropagation(),c(v=>!v)},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",l?"text-accent":"text-fg hover:bg-bg-hover"].join(" "),children:[e?f.jsx(Je,{name:e}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{className:"flex-1",children:t}),f.jsx("span",{className:"font-mono text-[10px] text-fg-muted",children:h}),f.jsx("span",{className:l?"rotate-180 transition-transform":"transition-transform",children:f.jsx(Je,{name:"caret"})})]}),l&&o.map(p=>{const v=p.id===i;return f.jsxs("button",{type:"button",role:"menuitemradio","aria-checked":v,"data-menu-option":"",onClick:E=>{E.stopPropagation(),s(p.id),r()},className:["flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-[11px]",v?"text-accent font-medium bg-bg-hover/40":"text-fg hover:bg-bg-hover"].join(" "),children:[f.jsx("span",{"aria-hidden":"true",className:"w-3 text-center text-accent",children:v?"✓":""}),f.jsx("span",{children:p.label})]},p.id)})]})}function si({actions:e,leading:t,sliders:n}){const[r,o]=a.useState(!1),i=a.useRef(null);return a.useEffect(()=>{if(!r)return;const s=c=>{i.current&&!i.current.contains(c.target)&&o(!1)},l=c=>{c.key==="Escape"&&(c.stopPropagation(),o(!1))};return document.addEventListener("pointerdown",s,!0),document.addEventListener("keydown",l,!0),()=>{document.removeEventListener("pointerdown",s,!0),document.removeEventListener("keydown",l,!0)}},[r]),f.jsxs("div",{ref:i,className:"relative inline-flex",onPointerDown:s=>s.stopPropagation(),children:[f.jsx("button",{type:"button",onClick:s=>{s.stopPropagation(),o(l=>!l)},onDoubleClick:s=>s.stopPropagation(),"aria-haspopup":"menu","aria-expanded":r,"aria-label":"More controls",title:"More controls",className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded text-xs",r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:f.jsx(Je,{name:"ellipsis"})}),r&&f.jsxs("div",{role:"menu",className:["absolute right-0 top-full z-40 mt-1 min-w-[10rem] max-h-80 overflow-auto","rounded border border-border bg-bg-elevated py-1 shadow-md"].join(" "),children:[t.map(s=>s.menu?f.jsx(oi,{icon:s.icon,title:s.title,menu:s.menu,onClose:()=>o(!1)},s.id):f.jsxs("button",{type:"button",disabled:s.disabled,onClick:l=>{var c;l.stopPropagation(),!s.disabled&&((c=s.onClick)==null||c.call(s),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?f.jsx(Je,{name:s.icon}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{children:s.label??s.title})]},s.id)),t.length>0&&e.length>0&&f.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),e.map(s=>f.jsxs("button",{type:"button",role:"menuitem",disabled:s.disabled,onClick:l=>{l.stopPropagation(),!s.disabled&&(s.onClick(),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?f.jsx(Je,{name:s.icon}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{children:s.title})]},s.id)),n.length>0&&(e.length>0||t.length>0)&&f.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),n.map(s=>f.jsx("div",{className:"px-2 py-1",children:f.jsx(Er,{spec:s})},s.id))]})]})}function ii({controller:e,config:t}){var D,R;const n=a.useRef(null),[r,o]=a.useState(!1),i=a.useRef(r);i.current=r;const s=a.useRef(0),l=`${((D=t==null?void 0:t.leadingButtons)==null?void 0:D.length)??0}:${((R=t==null?void 0:t.sliders)==null?void 0:R.length)??0}:${(t==null?void 0:t.visibility)??"hover"}`;if(a.useEffect(()=>{const A=n.current,V=A==null?void 0:A.parentElement;if(!V)return;const L=()=>{const q=V.clientWidth;if(!i.current&&n.current){const J=n.current.scrollWidth;J>0&&(s.current=J)}o(Zs(q,s.current,i.current))};let B=0;const N=()=>{B||(B=requestAnimationFrame(()=>{B=0,L()}))},O=new ResizeObserver(N);return O.observe(V),L(),()=>{O.disconnect(),B&&cancelAnimationFrame(B)}},[l]),(t==null?void 0:t.enabled)===!1)return null;const c=e.capabilities,u=t==null?void 0:t.buttons,h=(A,V)=>V&&(u==null?void 0:u[A])!==!1,b=A=>()=>e.setDragMode(A),p=()=>{e.toPNG({filename:"plot"}).then(A=>Ks(A,"plot.png")).catch(()=>{})},v=[];h("zoom",c.zoom)&&v.push({id:"zoom",icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:b("zoom")}),h("pan",c.pan)&&v.push({id:"pan",icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:b("pan")}),h("select",c.select)&&v.push({id:"select",icon:"select",title:"Box select",active:e.dragMode==="select",onClick:b("select")}),h("lasso",c.lasso)&&v.push({id:"lasso",icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:b("lasso")});const E=[];h("zoomIn",c.zoom)&&E.push({id:"zoomIn",icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),h("zoomOut",c.zoom)&&E.push({id:"zoomOut",icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()});const w=[];h("autoscale",c.autoscale)&&w.push({id:"autoscale",icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),h("reset",c.reset)&&w.push({id:"reset",icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()});const T=[];h("screenshot",c.screenshot)&&T.push({id:"screenshot",icon:"camera",title:"Download plot as PNG",onClick:p});const m=[v,E,w,T].filter(A=>A.length>0),d=m.flat(),g=(t==null?void 0:t.leadingButtons)??[],x=(t==null?void 0:t.sliders)??[];if(!g.length&&d.length===0&&x.length===0)return null;const _=(t==null?void 0:t.position)??"top-right",y=(t==null?void 0:t.visibility)==="always",k=_==="top-right"||_==="bottom-right",M=["cairn-plot-toolbar z-30 rounded border border-border bg-bg-elevated/90 shadow-sm backdrop-blur-sm transition-opacity",y?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),P={position:"absolute",pointerEvents:"auto",...ei[_]};return r?f.jsx("div",{ref:n,style:P,className:`${M} inline-flex px-0.5 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:f.jsx(si,{actions:d,leading:g,sliders:x})}):f.jsxs("div",{ref:n,style:P,className:`${M} flex flex-col gap-0.5 px-1 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:[f.jsxs("div",{className:`flex items-center gap-0.5 ${k?"justify-end":"justify-start"}`,children:[g.length>0&&f.jsxs(f.Fragment,{children:[g.map(A=>A.menu?f.jsx(ni,{icon:A.icon,title:A.title,menu:A.menu},A.id):f.jsx(wr,{icon:A.icon,label:A.label,title:A.title,active:A.active,disabled:A.disabled,onClick:A.onClick??(()=>{})},A.id)),m.length>0&&f.jsx(yr,{})]}),m.map((A,V)=>f.jsxs("span",{className:"inline-flex items-center gap-0.5",children:[V>0&&f.jsx(yr,{}),A.map(L=>f.jsx(wr,{icon:L.icon,title:L.title,active:L.active,disabled:L.disabled,onClick:L.onClick},L.id))]},A[0].id))]}),x.length>0&&f.jsx("div",{className:`flex items-center gap-2 ${k?"justify-end":"justify-start"}`,children:x.map(A=>f.jsx(Er,{spec:A},A.id))})]})}const ai={zoom:1,pan:{x:0,y:0}},_r=1.3,ci=.25,li=64,ui={buttons:{zoom:!1}};function fi(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const di=[{id:"none",label:"None"},{id:"viridis",label:"Viridis"},{id:"plasma",label:"Plasma"},{id:"magma",label:"Magma"},{id:"red-green",label:"Red–Green"},{id:"red-blue",label:"Red–Blue"}];function hn(e,t){return{id:"colormap",title:"Colormap",menu:{options:di,value:e,onSelect:t}}}const Mr=[{id:"linear",label:"Linear"},{id:"srgb",label:"sRGB"},{id:"reinhard",label:"Reinhard"},{id:"aces",label:"ACES"}],pi=[{id:"extended",label:"Extended · Linear"},{id:"extended-reinhard",label:"Extended · Reinhard"},{id:"extended-aces",label:"Extended · ACES"}];function Sr(e,t,n){return{id:"tonemap",title:"Tone-mapping operator",menu:{options:n?[...Mr,...pi]:Mr,value:e,onSelect:t}}}function hi({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:i,naturalHeight:s,minZoom:l=ci,maxZoom:c=li,requestRender:u,onReset:h,extraModified:b=!1}){const p=a.useCallback(y=>{var B;if(!o)return;const k=(B=e.current)==null?void 0:B.getBoundingClientRect(),S=(k==null?void 0:k.width)??0,M=(k==null?void 0:k.height)??0,P=i&&s&&S>0&&M>0?rn(i,s,S,M):c,D=Math.max(l,Math.min(P,n*y));if(D===n)return;const R=S/2,A=M/2,V=R-(R-r.x)/n*D,L=A-(A-r.y)/n*D;o({zoom:D,pan:{x:V,y:L}})},[o,e,i,s,c,l,n,r.x,r.y]),v=a.useCallback(()=>p(_r),[p]),E=a.useCallback(()=>p(1/_r),[p]),w=a.useCallback(()=>{o==null||o(ai),h==null||h()},[o,h]),T=a.useCallback(y=>{const k={scale:y==null?void 0:y.scale,filename:y==null?void 0:y.filename};u==null||u();const S=t==null?void 0:t.current;if(S)return br(S,k);const M=e.current;return M?Ys(M,k):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,u]),m=a.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),d=n!==1||r.x!==0||r.y!==0||b,g=a.useCallback(y=>{},[]),x=a.useCallback(y=>{},[]),_=a.useCallback(()=>{},[]);return a.useMemo(()=>({capabilities:m,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:d,setDragMode:g,setHoverMode:x,toggleSpikelines:_,zoomIn:v,zoomOut:E,autoscale:w,reset:w,toPNG:T}),[m,d,g,x,_,v,E,w,T])}const mi={zoom:1,pan:{x:0,y:0}};function Bt({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:i,pan:s,onViewportChange:l,naturalDims:c,checkerboard:u,wrapperClassName:h,wrapperStyle:b,viewportPadding:p,header:v,surface:E,showAxes:w,overlayNode:T,overlay:m,notationSeed:d,exportCanvasRef:g,requestRender:x,leadingMenus:_,displayAdjust:y,depthSliders:k,extraSliders:S,regionSelect:M,onReset:P,extraModified:D,label:R,showLabelChip:A,isDraggable:V=!1,onDragStart:L,extraChips:B}){const[N,O]=a.useState(d),[q,J]=a.useState(!1),[be,ge]=a.useState(!1),re="render"in m?null:m,Pe=!!M&&!!re,{containerProps:$}=Kn({containerRef:r,zoom:i,pan:s,onViewportChange:l,naturalWidth:c==null?void 0:c.w,naturalHeight:c==null?void 0:c.h}),F=a.useCallback(()=>{y==null||y.onExposureChange(0),y==null||y.onOffsetChange(0),P==null||P()},[y,P]),oe=a.useCallback(()=>{l==null||l(mi),F()},[l,F]),Z=hi({rootRef:r,canvasRef:g,zoom:i,pan:s,onViewportChange:l,naturalWidth:c==null?void 0:c.w,naturalHeight:c==null?void 0:c.h,requestRender:x,onReset:F,extraModified:((y==null?void 0:y.exposureEV)??0)!==0||((y==null?void 0:y.offset)??0)!==0||!!D}),ie=a.useMemo(()=>{const ce=[];if(k&&ce.push(...k),!y)return S&&ce.push(...S),ce.length?ce:void 0;const Me=(we,De)=>`${we>=0?"+":"−"}${Math.abs(we).toFixed(De)}`;return ce.push({id:"exposure",icon:"sun",label:"EV",title:"Exposure (EV stops) — color × 2^EV. Double-click to type a value (may exceed the slider range).",min:-8,max:8,step:.1,value:y.exposureEV,onChange:y.onExposureChange,format:we=>Me(we,1)},{id:"offset",icon:"plusminus",label:"OFF",title:"Offset — added after exposure (before tonemap). Double-click to type a value (may exceed the slider range).",min:-1,max:1,step:.01,value:y.offset,onChange:y.onOffsetChange,format:we=>Me(we,2)}),S&&ce.push(...S),ce},[y,k,S]),X=a.useMemo(()=>Pe?{id:"region-depth",icon:"select",title:"Select depth from region — drag a rectangle to set the Z window to the samples it covers (Esc to cancel)",active:be,onClick:()=>ge(ce=>!ce)}:null,[Pe,be]),ne=a.useMemo(()=>({...ui,leadingButtons:[..._??[],...X?[X]:[],...q?[fi(N,O)]:[]],sliders:ie}),[q,N,_,X,ie]),W=" cairn-checkerboard",pe="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(u==="pane"?W:""),xe=h+(u==="wrapper"?W:""),de="render"in m?m.render({notation:N,setOverlayActive:J}):m.hasSource&&c?f.jsx(ut,{imageElRef:m.displayElRef,naturalWidth:c.w,naturalHeight:c.h,zoom:i,pan:s,sourceWindow:m.sourceWindow,sample:m.sample,notation:N,version:m.version,onActiveChange:J}):null;return f.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[v,n&&f.jsx(ii,{controller:Z,config:ne}),f.jsxs("div",{ref:r,className:pe,style:{padding:p,...$.style},onPointerDown:$.onPointerDown,onPointerMove:$.onPointerMove,onPointerUp:$.onPointerUp,onPointerCancel:$.onPointerCancel,onDoubleClick:oe,...t,children:[f.jsxs("div",{ref:o,className:xe,style:b,children:[E,w&&c&&f.jsx(zs,{naturalWidth:c.w,naturalHeight:c.h,zoom:i,containerRef:o}),T]}),de,!n&&q&&f.jsx(Zn,{notation:N,onChange:O}),be&&M&&re&&c&&f.jsx(gi,{imageElRef:re.displayElRef,naturalDims:c,sourceWindow:re.sourceWindow,onQueryLive:M.queryLive,onSelect:(ce,Me,we,De)=>{ge(!1),M.commit(ce,Me,we,De)},onExit:()=>ge(!1)}),!be&&(M==null?void 0:M.rect)&&re&&c&&f.jsx(bi,{rect:M.rect,imageElRef:re.displayElRef,naturalDims:c,sourceWindow:re.sourceWindow,zoom:i,pan:s,onQueryLive:M.queryLive,onCommit:M.commit,onRemove:M.remove})]}),A&&f.jsx(Vs,{label:R,isDraggable:V,onDragStart:L}),B]})}function gi({imageElRef:e,naturalDims:t,sourceWindow:n,onQueryLive:r,onSelect:o,onExit:i}){var T;const s=a.useRef(null),l=a.useRef(null),[c,u]=a.useState(null),h=a.useCallback((m,d,g,x)=>{const _=e.current;return _?mr(m,d,g,x,{box:_.getBoundingClientRect(),naturalWidth:t.w,naturalHeight:t.h,sourceWindow:n}):null},[e,t,n]);a.useEffect(()=>{const m=d=>{d.key==="Escape"&&i()};return window.addEventListener("keydown",m),()=>window.removeEventListener("keydown",m)},[i]);const b=a.useCallback(m=>{var d,g;(g=(d=m.target).setPointerCapture)==null||g.call(d,m.pointerId),l.current={x:m.clientX,y:m.clientY},u({x0:m.clientX,y0:m.clientY,x1:m.clientX,y1:m.clientY})},[]),p=a.useCallback(m=>{const d=l.current;if(!d)return;u({x0:d.x,y0:d.y,x1:m.clientX,y1:m.clientY});const g=h(d.x,d.y,m.clientX,m.clientY);g&&r(g.x0,g.y0,g.x1,g.y1)},[h,r]),v=a.useCallback(m=>{const d=l.current;l.current=null,u(null);const g=e.current;if(!d||!g){i();return}if(Math.abs(m.clientX-d.x)<3&&Math.abs(m.clientY-d.y)<3){i();return}const x=g.getBoundingClientRect(),_=mr(d.x,d.y,m.clientX,m.clientY,{box:x,naturalWidth:t.w,naturalHeight:t.h,sourceWindow:n});if(!_){i();return}o(_.x0,_.y0,_.x1,_.y1)},[e,t,n,o,i]),E=(T=s.current)==null?void 0:T.getBoundingClientRect(),w=c&&E?{left:Math.min(c.x0,c.x1)-E.left,top:Math.min(c.y0,c.y1)-E.top,width:Math.abs(c.x1-c.x0),height:Math.abs(c.y1-c.y0)}:null;return f.jsx("div",{ref:s,className:"absolute inset-0 z-20",style:{cursor:"crosshair",touchAction:"none"},onPointerDown:b,onPointerMove:p,onPointerUp:v,children:w&&f.jsx("div",{className:"absolute border-2 border-dashed border-sky-400 bg-sky-400/15 pointer-events-none",style:w})})}const xi={nw:{cursor:"nwse-resize",fx:0,fy:0},n:{cursor:"ns-resize",fx:.5,fy:0},ne:{cursor:"nesw-resize",fx:1,fy:0},e:{cursor:"ew-resize",fx:1,fy:.5},se:{cursor:"nwse-resize",fx:1,fy:1},s:{cursor:"ns-resize",fx:.5,fy:1},sw:{cursor:"nesw-resize",fx:0,fy:1},w:{cursor:"ew-resize",fx:0,fy:.5}};function bi({rect:e,imageElRef:t,naturalDims:n,sourceWindow:r,zoom:o,pan:i,onQueryLive:s,onCommit:l,onRemove:c}){const u=a.useRef(null),[h,b]=a.useState(null),p=a.useRef(null),[v,E]=a.useState(null),w=h??e;a.useLayoutEffect(()=>{const g=()=>{const y=t.current,k=u.current;if(!y||!k)return;const S=y.getBoundingClientRect(),M=k.getBoundingClientRect(),P=Fs(w,{box:S,naturalWidth:n.w,naturalHeight:n.h,sourceWindow:r});E({left:P.left-M.left,top:P.top-M.top,width:P.width,height:P.height})};g();const x=t.current;if(!x||typeof ResizeObserver>"u")return;const _=new ResizeObserver(g);return _.observe(x),()=>_.disconnect()},[w,n.w,n.h,r,o,i.x,i.y]);const T=a.useCallback(g=>x=>{var _,y;x.stopPropagation(),(y=(_=x.target).setPointerCapture)==null||y.call(_,x.pointerId),p.current={handle:g,sx:x.clientX,sy:x.clientY,start:w},b(w)},[w]),m=a.useCallback(g=>{const x=p.current,_=t.current;if(!x||!_)return;const y=Ns({box:_.getBoundingClientRect(),naturalWidth:n.w,naturalHeight:n.h,sourceWindow:r}),k=(g.clientX-x.sx)/(y||1),S=(g.clientY-x.sy)/(y||1),M=Gs(x.start,x.handle,k,S,{w:n.w,h:n.h},1);b(M),s(M.x0,M.y0,M.x1,M.y1)},[t,n.w,n.h,r,s]),d=a.useCallback(()=>{const g=p.current;p.current=null;const x=h;b(null),g&&x&&l(x.x0,x.y0,x.x1,x.y1)},[h,l]);return v?f.jsxs("div",{ref:u,className:"absolute inset-0 z-20 pointer-events-none",style:{touchAction:"none"},children:[f.jsx("div",{className:"absolute border-2 border-sky-400 bg-sky-400/10 pointer-events-auto",style:{...v,cursor:"move",touchAction:"none"},onPointerDown:T("move"),onPointerMove:m,onPointerUp:d}),Us.map(g=>{const x=xi[g];return f.jsx("div",{className:"absolute pointer-events-auto flex items-center justify-center",style:{left:v.left+x.fx*v.width-12,top:v.top+x.fy*v.height-12,width:24,height:24,cursor:x.cursor,touchAction:"none"},onPointerDown:T(g),onPointerMove:m,onPointerUp:d,children:f.jsx("div",{className:"w-2.5 h-2.5 rounded-sm bg-sky-400 border border-white/80"})},g)}),f.jsx("button",{type:"button","aria-label":"Remove depth region",title:"Remove region (reset the depth window)",className:"absolute pointer-events-auto flex items-center justify-center rounded-full text-white",style:{left:v.left+v.width-8,top:v.top-32,width:40,height:40},onPointerDown:g=>g.stopPropagation(),onClick:c,children:f.jsx("span",{className:"flex items-center justify-center w-5 h-5 rounded-full bg-slate-800/90 border border-white/70 text-[11px] leading-none",children:"×"})})]}):f.jsx("div",{ref:u,className:"absolute inset-0 z-20 pointer-events-none"})}const mn={inFlight:!1,pending:null};function Tr(e,t){return e.inFlight?{state:{inFlight:!0,pending:t},launch:null}:{state:{inFlight:!0,pending:null},launch:t}}function Pr(e){return e.pending!=null?{state:{inFlight:!0,pending:null},launch:e.pending}:{state:mn,launch:null}}const vi=1e3,wi=typeof requestAnimationFrame=="function"?e=>requestAnimationFrame(()=>e()):e=>setTimeout(e,0),Ar=typeof cancelAnimationFrame=="function"?cancelAnimationFrame:e=>clearTimeout(e);function Rr(e,t){const n=e.deep,r=(n==null?void 0:n.zMin)??0,o=(n==null?void 0:n.zMax)??0,i=t!=null,[s,l,c]=ct(r),[u,h,b]=ct(o),[p,v]=a.useState(null),[E,w]=a.useState(null),T=a.useRef(n);T.current=n;const m=a.useRef(r);m.current=r;const d=a.useRef(o);d.current=o;const g=a.useRef(s);g.current=s;const x=a.useRef(u);x.current=u;const _=a.useRef({near:s,far:u,ver:0}),y=a.useRef(0),k=a.useRef(!0),S=a.useRef(mn),M=a.useRef(null),P=l,D=h,R=a.useCallback(()=>{const $=T.current;if(!$)return;const{near:F,far:oe,ver:Z}=_.current,ie=()=>{const X=Pr(S.current);S.current=X.state,X.launch!=null&&R()};$.flatten(F,oe).then(X=>{_.current.ver===Z&&!k.current&&(M.current!=null&&Ar(M.current),M.current=wi(()=>{M.current=null,v(X)})),ie()}).catch(ie)},[]),A=a.useCallback(()=>{const $=Tr(S.current,1);S.current=$.state,$.launch!=null&&R()},[R]);a.useEffect(()=>()=>{M.current!=null&&Ar(M.current),n==null||n.dispose()},[n]),a.useEffect(()=>{if(!n)return;const $=s<=r&&u>=o;if(k.current=$,y.current+=1,_.current={near:s,far:u,ver:y.current},i){t(s,u);return}if($){v(null);return}A()},[n,s,u,r,o,A,i,t]);const V=a.useMemo(()=>n&&!i&&p!=null?{...e,data:p}:e,[e,n,i,p]),L=n!=null&&r>0&&o/r>vi,B=a.useMemo(()=>{if(!n||!(o>r))return;const $=oe=>Math.abs(oe)>=1e3||Math.abs(oe)<.01&&oe!==0?oe.toExponential(2):oe.toFixed(3),F=(oe,Z,ie,X,ne)=>{if(L){const W=Math.log10(r),pe=Math.log10(o);return{id:oe,icon:"layers",label:Z,title:`${ie} (log scale). Double-click to type a Z.`,min:W,max:pe,step:(pe-W)/200,value:Math.log10(Math.max(r,Math.min(X,o))),onChange:xe=>ne(10**xe),format:xe=>$(10**xe)}}return{id:oe,icon:"layers",label:Z,title:`${ie}. Double-click to type a Z.`,min:r,max:o,step:(o-r)/200,value:X,onChange:ne,format:$}};return[F("depth-near","ZN","Depth window NEAR — composite only samples with Z ≥ this",s,P),F("depth-far","ZF","Depth window FAR — composite only samples with Z ≤ this",u,D)]},[n,r,o,s,u,L,P,D]),N=a.useCallback($=>{if($.count===0){const Z=m.current,ie=d.current,X=ie>Z?0:1;l(ie+X),h(Z-X);return}const F=d.current-m.current,oe=Math.max(Math.abs(F)*1e-4,1e-4);l($.zMin-oe),h($.zMax+oe)},[l,h]),O=a.useRef(null),q=a.useRef(mn),J=a.useCallback(()=>{const $=T.current,F=O.current,oe=()=>{const Z=Pr(q.current);q.current=Z.state,Z.launch!=null&&J()};if(!$||!F){oe();return}$.zRangeInRect(F.x0,F.y0,F.x1,F.y1).then(Z=>{N(Z),oe()}).catch(oe)},[N]),be=a.useCallback(($,F,oe,Z)=>{O.current={x0:$,y0:F,x1:oe,y1:Z};const ie=Tr(q.current,1);q.current=ie.state,ie.launch!=null&&J()},[J]),ge=a.useCallback(($,F,oe,Z)=>{w({x0:$,y0:F,x1:oe,y1:Z}),be($,F,oe,Z)},[be]),re=a.useCallback(()=>{w(null),c.reset(),b.reset(),v(null)},[c,b]),Pe=a.useCallback(()=>{c.reset(),b.reset(),w(null),v(null)},[c,b]);return{hdr:V,sliders:B,hasDeep:n!=null,region:E,queryRegionWindow:be,commitRegion:ge,removeRegion:re,reset:Pe,isModified:c.isModified||b.isModified}}function Cr(e){return"hdr"in e&&e.hdr!=null}function kr(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function ke(e){return Number.isFinite(e)?e:0}const yi={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Ei(e,t,n,r,o=0){const{h:i,w:s,c:l}=kr(e.shape),c=e.precision==="f16-bits"?zn(e.data):e.data,u=Go(t),h=new Uint8ClampedArray(s*i*4);for(let b=0;b<s*i;b++){const p=b*l;let v,E,w,T=1;l===1?v=E=w=ke(c[p]):l===3?(v=ke(c[p]),E=ke(c[p+1]),w=ke(c[p+2])):(v=ke(c[p]),E=ke(c[p+1]),w=ke(c[p+2]),T=ke(c[p+3]));const m=[_t(v,n,o),_t(E,n,o),_t(w,n,o)],[d,g,x]=u(m),_=b*4;h[_]=255*Zt(d,r),h[_+1]=255*Zt(g,r),h[_+2]=255*Zt(x,r),h[_+3]=255*(T<0?0:T>1?1:T)}return new ImageData(h,s,i)}function _i(e){var Ve,Oe;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:i="auto",colormap:s="none",showAxes:l=!1,processing:c=yi,zoom:u=1,pan:h={x:0,y:0},onViewportChange:b,onNaturalSize:p,label:v,isDraggable:E=!1,onDragStart:w,overlay:T,overlaySettings:m,pixelValueNotation:d="decimal",toolbar:g=!0}=e,[x,_,y]=ct(s);a.useEffect(()=>{_(s)},[s,_]);const k=a.useRef(null),S=a.useRef(null),M=a.useRef(null),P=a.useRef(null),D=a.useRef(null),R=a.useRef(null),A=a.useRef(null),[V,L]=a.useState(0),B=a.useCallback(()=>L(U=>U+1),[]),N=a.useMemo(()=>({get current(){const U=D.current;return U instanceof HTMLCanvasElement?U:null}}),[]),O=a.useCallback(U=>{k.current=U,U&&(D.current=U)},[]),q=a.useCallback(U=>{S.current=U,U&&(D.current=U)},[]),J=a.useCallback(U=>{U&&(D.current=U)},[]),[be,ge]=a.useState(!1),[re,Pe]=a.useState(!1),[$,F]=a.useState(null),{flipSign:oe}=c,{gammaFilterId:Z,filterStr:ie,gamma:X,offset:ne}=fr(c),W=!r&&o!=="none"&&n!=null&&t!=null,pe=o!=="none"&&n!=null,xe=x!=="none"&&!W&&!(r&&pe)&&t!=null;a.useEffect(()=>{if(!xe||!t){Pe(!1);return}let U=!1;Pe(!1);const he=`${t}::${x}`,Ae=Jt(he);if(Ae){const le=S.current;if(le){le.width=Ae.width,le.height=Ae.height;const ve=le.getContext("2d");ve&&ve.putImageData(Ae,0,0),A.current=Ae,B(),F({w:Ae.width,h:Ae.height}),p==null||p(Ae.width,Ae.height),Pe(!0)}return}const ye=new Image;return ye.onload=()=>{if(U)return;const le=document.createElement("canvas");le.width=ye.naturalWidth,le.height=ye.naturalHeight;const ve=le.getContext("2d");if(!ve)return;ve.drawImage(ye,0,0);const Ie=ve.getImageData(0,0,le.width,le.height),Ge=Qt(x),Se=jt(Ie,x,Ge);en(he,Se);const Ce=S.current;if(!Ce||U)return;Ce.width=Se.width,Ce.height=Se.height;const Te=Ce.getContext("2d");Te&&Te.putImageData(Se,0,0),A.current=Se,B(),F({w:Se.width,h:Se.height}),p==null||p(Se.width,Se.height),Pe(!0)},ye.src=t,()=>{U=!0}},[xe,t,x]);const de=a.useCallback((U,he)=>{F(Ae=>Ae&&Ae.w===U&&Ae.h===he?Ae:{w:U,h:he}),p==null||p(U,he)},[]);a.useEffect(()=>{if(!t){R.current=null,A.current=null,B();return}let U=!1;return it(t).then(he=>{U||(R.current=he,x==="none"&&(A.current=he),B())}),()=>{U=!0}},[t,x,B]);const ce=a.useCallback((U,he,Ae)=>{const ye=R.current;if(!ye||U<0||he<0||U>=ye.width||he>=ye.height)return null;const le=(he*ye.width+U)*4,ve=ye.data[le],Ie=ye.data[le+1],Ge=ye.data[le+2],Se=A.current;let Ce=ve,Te=Ie,z=Ge;if(Se&&Se.width===ye.width&&Se.height===ye.height){const I=(he*Se.width+U)*4;Ce=Se.data[I],Te=Se.data[I+1],z=Se.data[I+2]}const H=(.299*Ce+.587*Te+.114*z)/255;return lt(x!=="none"||ve===Ie&&Ie===Ge?[ve]:[ve,Ie,Ge],"uint8",Ae,H)},[x]);a.useEffect(()=>{if(!W){ge(!1);return}let U=!1;const he=ts(),Ae=he==="gpu"||he==="auto",ye=`${n}::${t}::${o}::${x}`;if(he!=="gpu"){const le=Jt(ye);if(le){const ve=k.current;if(ve){(ve.width!==le.width||ve.height!==le.height)&&(ve.width=le.width,ve.height=le.height);const Ie=ve.getContext("2d");Ie&&Ie.putImageData(le,0,0),de(le.width,le.height),ge(!0)}return}}return(async()=>{const[le,ve]=await Promise.all([it(n),it(t)]);if(U||!le||!ve)return;const Ge=o.includes("signed")?"signed":"positive",Se=x!=="none"?Ht(x):null,Ce={diffMode:o,colormap:Se,cmapMode:Ge};if(Ae)try{const ee=k.current;if(ee){const I=Jo(le,ve,Ce,ee);if(I){if(U)return;de(I.width,I.height),ge(!0);return}}}catch(ee){console.warn("[cairn] WebGL 2 diff error:",ee)}if(he==="gpu"){console.error("[cairn] WebGL 2 unavailable — set render mode to 'Auto' or 'CPU'");return}let Te=Ho(le,ve,o);x!=="none"&&(Te=jt(Te,x,Ge)),en(ye,Te);const z=k.current;if(!z||U)return;(z.width!==Te.width||z.height!==Te.height)&&(z.width=Te.width,z.height=Te.height);const H=z.getContext("2d");H&&H.putImageData(Te,0,0),de(Te.width,Te.height),ge(!0)})(),()=>{U=!0}},[n,t,o,W,x,p]);const Me=i==="auto"?void 0:i,we=oe?{filter:"invert(1)"}:{},De=T&&(m!=null&&m.enabled)&&$&&t&&((((Ve=T.boxes)==null?void 0:Ve.length)??0)>0||(((Oe=T.masks)==null?void 0:Oe.length)??0)>0)?f.jsx(sn,{data:T,settings:m,naturalWidth:$.w,naturalHeight:$.h}):void 0,Qe=t?W?f.jsxs(f.Fragment,{children:[!be&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),f.jsx("canvas",{ref:O,className:"w-full h-full object-contain block",style:{display:be?"block":"none",imageRendering:Me,...we}})]}):xe?f.jsxs(f.Fragment,{children:[!re&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),f.jsx("canvas",{ref:q,className:"w-full h-full object-contain block",style:{display:re?"block":"none",imageRendering:Me,...we}})]}):f.jsx("img",{ref:J,src:t,alt:v,className:"w-full h-full object-contain block",draggable:!1,style:{filter:ie,imageRendering:Me},onLoad:U=>{const he=U.currentTarget;F({w:he.naturalWidth,h:he.naturalHeight}),p==null||p(he.naturalWidth,he.naturalHeight)}}):f.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return f.jsx(Bt,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:g,paneRef:M,wrapperRef:P,zoom:u,pan:h,onViewportChange:b,naturalDims:$,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${h.x}px, ${h.y}px) scale(${u})`,transformOrigin:"0 0"},viewportPadding:l&&$?"16px 4px 4px 28px":"4px",header:f.jsx(dr,{id:Z,gamma:X,offset:ne}),surface:Qe,showAxes:l,overlayNode:De,overlay:{displayElRef:D,sample:ce,version:V,hasSource:!!t},notationSeed:d,exportCanvasRef:N,leadingMenus:[hn(x,U=>_(U))],onReset:y.reset,extraModified:y.isModified,label:v,showLabelChip:!0,isDraggable:E,onDragStart:w})}function Mi(e){const{tonemap:t="srgb",exposure:n=0,gamma:r,showAxes:o=!1,label:i="",interpolation:s="auto",zoom:l=1,pan:c={x:0,y:0},onViewportChange:u,pixelValueNotation:h="decimal",toolbar:b=!0}=e,p=Rr(e.hdr),v=p.hdr,[E,w,T]=ct(qt(t));a.useEffect(()=>{w(qt(t))},[t,w]);const m=a.useRef(null),d=a.useRef(null),g=a.useRef(null),[x,_]=a.useState(null),y=a.useRef(null),[k,S]=a.useState(0),[M,P]=a.useState(0),[D,R]=a.useState(0);a.useEffect(()=>{const L=m.current;if(!L)return;let B;try{B=Ei(v,E,n+M,r,D)}catch(O){console.error("[cairn] HDR tone-map error:",O);return}(L.width!==B.width||L.height!==B.height)&&(L.width=B.width,L.height=B.height);const N=L.getContext("2d");N&&(N.putImageData(B,0,0),y.current=B,S(O=>O+1),_(O=>O&&O.w===B.width&&O.h===B.height?O:{w:B.width,h:B.height}))},[v,E,n,r,M,D]);const A=a.useCallback((L,B,N)=>{const O=x;if(!O||L<0||B<0||L>=O.w||B>=O.h)return null;const q=v.shape.length===2?1:v.shape[2]??1,J=(B*O.w+L)*q,be=v.data,ge=v.precision==="f16-bits"?F=>Tt(be[F]??0):F=>be[F]??0,re=y.current;let Pe=.5;if(re&&re.width===O.w&&re.height===O.h){const F=(B*O.w+L)*4;Pe=(.299*re.data[F]+.587*re.data[F+1]+.114*re.data[F+2])/255}const $=q===1?[ge(J)]:[ge(J),ge(J+1),ge(J+2)];return lt($,"unit",N,Pe)},[v,x]),V=s==="auto"?void 0:s;return f.jsx(Bt,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:b,paneRef:d,wrapperRef:g,zoom:l,pan:c,onViewportChange:u,naturalDims:x,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${c.x}px, ${c.y}px) scale(${l})`,transformOrigin:"0 0"},viewportPadding:o&&x?"16px 4px 4px 28px":"4px",surface:f.jsx("canvas",{ref:m,className:"w-full h-full object-contain block",style:{imageRendering:V}}),showAxes:o,overlay:{displayElRef:m,sample:A,version:k,hasSource:!0},notationSeed:h,exportCanvasRef:m,leadingMenus:[Sr(E,L=>w(L),!1)],displayAdjust:{exposureEV:M,offset:D,onExposureChange:P,onOffsetChange:R},depthSliders:p.sliders,regionSelect:p.hasDeep?{rect:p.region,queryLive:p.queryRegionWindow,commit:p.commitRegion,remove:p.removeRegion}:void 0,onReset:()=>{p.reset(),T.reset()},extraModified:p.isModified||T.isModified,label:i,showLabelChip:!!i})}function gn(e){return Cr(e)?f.jsx(Mi,{...e}):f.jsx(_i,{...e})}const Dr={"no-webgpu":0,"no-hdr-browser":1,"no-hdr-display":2},Si="https://github.com/doeringchristian/cairn-plot/blob/main/docs/browser-support.md";function Ti(e,t=!1){const n=e||"";return t?"brave":/firefox/i.test(n)?"firefox":/safari/i.test(n)&&!/chrome|chromium|crios|android/i.test(n)?"safari":/linux/i.test(n)&&/chrome|chromium/i.test(n)?"chromium-linux":"chromium"}function Pi(e){const t=e||"";return/mac os x|macintosh/i.test(t)?"macos":/windows/i.test(t)?"windows":"other"}function Ai(e,t){if(e==="no-hdr-display")switch(Pi(t.userAgent)){case"macos":return"macOS: EDR engages automatically on HDR-capable displays — confirm your display supports HDR.";case"windows":return"Windows: turn on Settings → System → Display → Use HDR.";default:return"Enable HDR in your display and OS settings."}const n=Ti(t.userAgent,t.isBrave);if(e==="no-hdr-browser")switch(n){case"firefox":return"Firefox has no extended-tone-mapping canvas path at all — true HDR output is impossible until Firefox implements it (fundamental browser limitation).";case"safari":return"Safari's WebGPU HDR canvas tone-mapping is still maturing — update to the latest Safari 26+.";default:return"Chrome/Edge 129+ is required for HDR canvas output (toneMapping: extended) — update your browser."}switch(n){case"firefox":return"Firefox: about:config → dom.webgpu.enabled (HDR output is not available in Firefox at all — browser limitation).";case"safari":return"Safari: Develop → Feature Flags → WebGPU (Safari 26+ has it by default).";case"brave":return"Brave: check Shields fingerprint blocking + brave://flags.";case"chromium-linux":return"Chromium on Linux: enable chrome://flags/#enable-unsafe-webgpu.";case"chromium":default:return"Chrome/Edge: enable chrome://flags/#enable-unsafe-webgpu and hardware acceleration."}}function Ri(e){switch(e){case"no-webgpu":return"GPU renderer unavailable → CPU fallback active; FLIP kernels + HDR compare disabled.";case"no-hdr-browser":return"True HDR output is unsupported by this browser — a fundamental browser limitation, not a cairn-plot bug → HDR images tone-mapped to SDR.";case"no-hdr-display":return"Your display/OS is not in HDR mode → HDR images tone-mapped to SDR."}}function Lr(e,t){return`cairn-plot:capnotice:${e}:${t}`}const Br=new Set;function Or(e){try{if(window.localStorage.getItem(e)==="1")return!0}catch{}try{if(window.sessionStorage.getItem(e)==="1")return!0}catch{}return Br.has(e)}function Ci(e){try{window.localStorage.setItem(e,"1");return}catch{}try{window.sessionStorage.setItem(e,"1");return}catch{}Br.add(e)}const Ir=new Set;let Ot=null,ht=null;function Nr(){ht&&ht.parentNode&&ht.parentNode.removeChild(ht),ht=null,Ot=null}function ki(e){const t=Lr(e,window.location.pathname),n=Ai(e,{userAgent:navigator.userAgent,isBrave:!!navigator.brave}),r=document.createElement("div");r.setAttribute("role","status"),r.setAttribute("data-cairn-plot-capnotice",e),Object.assign(r.style,{position:"fixed",bottom:"12px",right:"12px",zIndex:"2147483000",maxWidth:"340px",boxSizing:"border-box",padding:"10px 30px 10px 12px",borderRadius:"6px",border:"1px solid var(--color-border, #d0d7de)",background:"rgb(var(--color-bg-elevated-rgb, 246 248 250) / 0.9)",color:"var(--color-fg-muted, #656d76)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",boxShadow:"0 4px 12px rgba(0, 0, 0, 0.18)",font:"12px/1.4 system-ui, sans-serif"});const o=document.createElement("div");o.textContent=Ri(e),Object.assign(o.style,{fontWeight:"600",color:"var(--color-fg, #1f2328)",marginBottom:"4px"});const i=document.createElement("div");i.textContent=n,i.style.marginBottom="4px";const s=document.createElement("a");s.href=Si,s.target="_blank",s.rel="noopener noreferrer",s.textContent="Learn more",Object.assign(s.style,{color:"var(--color-accent, #0969da)",textDecoration:"none"});const l=document.createElement("button");l.type="button",l.textContent="×",l.setAttribute("aria-label","Dismiss browser capability notice"),l.title="Dismiss",Object.assign(l.style,{position:"absolute",top:"4px",right:"6px",padding:"0 4px",border:"0",background:"transparent",color:"var(--color-fg-subtle, #8b949e)",cursor:"pointer",fontSize:"16px",lineHeight:"1"}),l.addEventListener("click",()=>{Ci(t),Nr()}),r.appendChild(o),r.appendChild(i),r.appendChild(s),r.appendChild(l),document.body.appendChild(r),ht=r,Ot=e}function Fr(e){if(typeof document>"u"||typeof window>"u"||Ir.has(e))return;Ir.add(e);const t=Lr(e,window.location.pathname);if(Or(t))return;const n=()=>{if(!Or(t)){if(Ot!==null)if(Dr[e]<Dr[Ot])Nr();else return;ki(e)}};document.body?n():window.addEventListener("DOMContentLoaded",n,{once:!0})}const Di={data:new Float32Array(0),shape:[0,0],dtype:"<f4"};function Li(e){const{h:t,w:n,c:r}=kr(e.shape);if(e.precision==="f16-bits"){const s=e.data,l=new Uint16Array(n*t*4);for(let c=0;c<n*t;c++){const u=c*r,h=c*4;if(r===1){const b=s[u];l[h]=b,l[h+1]=b,l[h+2]=b,l[h+3]=St}else l[h]=s[u],l[h+1]=s[u+1],l[h+2]=s[u+2],l[h+3]=r>=4?s[u+3]:St}return{data:l,width:n,height:t,format:"rgba16float"}}const o=e.data,i=new Float32Array(n*t*4);for(let s=0;s<n*t;s++){const l=s*r;let c,u,h,b=1;r===1?c=u=h=ke(o[l]):r===3?(c=ke(o[l]),u=ke(o[l+1]),h=ke(o[l+2])):(c=ke(o[l]),u=ke(o[l+1]),h=ke(o[l+2]),b=ke(o[l+3]));const p=s*4;i[p]=c,i[p+1]=u,i[p+2]=h,i[p+3]=b}return{data:i,width:n,height:t,format:"rgba32float"}}function Ur(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),i=n*o,s=r*o,l=(t.width-i)/2,c=(t.height-s)/2,u=Math.max(e.zoom,1e-6),h=t.width/(u*i),b=t.height/(u*s),p=-l/i-e.pan.x/(u*i),v=-c/s-e.pan.y/(u*s);return{x:p,y:v,w:h,h:b}}function Gr(e,t,n,r){const o=e.w*n,i=e.h*r;return o<=0||i<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/i)}function Bi(e){var Se,Ce,Te;const t=Cr(e),n=a.useRef(null),r=a.useRef(null),o=a.useRef(null),i=a.useRef(null),s=a.useRef(null),l=t&&!!((Se=e.hdr)!=null&&Se.deep),c=a.useCallback((z,H)=>{var ee,I;(ee=i.current)==null||ee.setDeepWindow(z,H),(I=s.current)==null||I.call(s)},[]),u=Rr(t?e.hdr:Di,l?c:void 0),h=a.useRef(!1),[b,p]=a.useState(!1),[v,E]=a.useState(!1),[w,T]=a.useState(!1),[m,d]=a.useState(null),[g,x]=a.useState(0),[_,y]=a.useState(0),[k,S]=a.useState({x:0,y:0,w:1,h:1}),M=a.useRef(null),P=a.useRef(null),[D,R]=a.useState(0),A=e.zoom??1,V=e.pan??{x:0,y:0},L=e.onViewportChange,B=t?"none":e.colormap??"none",[N,O]=a.useState(B);a.useEffect(()=>{O(B)},[B]);const q=t?"none":N,J=a.useRef(B),be=a.useCallback(()=>{O(J.current)},[]),ge=t?e.tonemap:void 0,[re,Pe]=a.useState(null);a.useEffect(()=>{Pe(null)},[ge]);const $=zo(ge,b),F=re??$,oe=re!==null&&re!==$,Z=a.useCallback(()=>Pe(null),[]),[ie,X]=a.useState(Et),ne=ie!==Et,W=a.useCallback(()=>X(Et),[]),[pe,xe]=a.useState(0),[de,ce]=a.useState(0),Me=on();a.useEffect(()=>{const z=n.current;if(!z)return;let H=!1;return yt().then(ee=>{var Ne;if(H)return;const I=((Ne=ee.probeExtendedToneMapping)==null?void 0:Ne.call(ee))??!1,j=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,Q=I&&j&&t;h.current=Q,p(Q),t&&!Q&&Fr(I?"no-hdr-display":"no-hdr-browser"),Bs(z,{hdr:Q}).then(Le=>{if(H){ur(Le);return}i.current=Le,T(!0)}).catch(Le=>{H||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",Le),E(!0))})}).catch(ee=>{H||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",ee),E(!0))}),()=>{H=!0,i.current&&(ur(i.current),i.current=null)}},[]),a.useEffect(()=>{const z=r.current;if(!z)return;const H=new ResizeObserver(()=>y(ee=>ee+1));return H.observe(z),()=>H.disconnect()},[]),a.useEffect(()=>{const z=r.current;if(!z)return;const H=new IntersectionObserver(ee=>{const I=ee[0];if(!I)return;const j=i.current;j&&(j.setVisible(I.isIntersecting),I.isIntersecting?j.isParked&&(j.restore(),y(Q=>Q+1)):j.park())},{threshold:0});return H.observe(z),()=>H.disconnect()},[]),a.useEffect(()=>{var ee;if(!t||!w||l)return;const z=u.hdr;M.current=z;const H=Li(z);(ee=i.current)==null||ee.setSource(H),d(I=>I&&I.w===H.width&&I.h===H.height?I:{w:H.width,h:H.height}),R(I=>I+1),x(I=>I+1)},[t,w,l,t?u.hdr:null]),a.useEffect(()=>{if(!t||!w||!l)return;const z=e.hdr,H=z.deep;M.current=z;let ee=!1;return H.getGpuCsr().then(I=>{var j;ee||((j=i.current)==null||j.setDeepSource(I,H.zMin,H.zMax),d(Q=>Q&&Q.w===I.width&&Q.h===I.height?Q:{w:I.width,h:I.height}),R(Q=>Q+1),x(Q=>Q+1))}).catch(I=>{ee||console.warn("[cairn] deep GPU CSR upload failed:",I)}),()=>{ee=!0}},[t,w,l,t?e.hdr.deep:null]),a.useEffect(()=>{if(t||!w)return;const z=e,H=z.imageUrl,ee=N;if(!H){P.current=null,d(null),R(j=>j+1);return}let I=!1;return it(H).then(j=>{var Le,Fe;if(I||!j)return;let Q=j;if(ee!=="none"){const ae=`gpu::${H}::${ee}::ev${pe}::off${de}`,$e=Jt(ae);if($e)Q=$e;else{const We=Qt(ee);Q=jt(j,ee,We,pe,de),en(ae,Q)}}P.current=j;const Ne={data:Q.data,width:Q.width,height:Q.height,format:"rgba8unorm"};(Le=i.current)==null||Le.setSource(Ne),d(ae=>ae&&ae.w===Q.width&&ae.h===Q.height?ae:{w:Q.width,h:Q.height}),(Fe=z.onNaturalSize)==null||Fe.call(z,Q.width,Q.height),R(ae=>ae+1),x(ae=>ae+1)}),()=>{I=!0}},[t,w,t?null:e.imageUrl,t?null:N,t?0:pe,t?0:de]);const we=t?e.exposure??0:0,De=t?e.gamma:void 0,Qe=a.useCallback(()=>{const z=i.current;if(!z||!w||!m)return;const H=r.current,ee=o.current,I=ee?ee.getBoundingClientRect():H?H.getBoundingClientRect():{width:m.w,height:m.h},j=Ur({zoom:A,pan:V},I,m.w,m.h);S(ae=>ae.x===j.x&&ae.y===j.y&&ae.w===j.w&&ae.h===j.h?ae:j),I.width>0&&I.height>0&&z.resize(Math.round(I.width*Me),Math.round(I.height*Me));const Q=Gr(j,I,m.w,m.h)>=an?"nearest":"linear",Ne=j,Le=h.current&&Bn(F),Fe=t?{exposureEV:we+pe,offset:de,operator:F,gamma:De,isScalar:!1,hdrOut:Le,peak:ie,uv:Ne,filter:Q}:{exposureEV:q!=="none"?0:pe,offset:q!=="none"?0:de,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:Ne,filter:Q};try{z.render(Fe)||E(!0)}catch(ae){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",ae),E(!0)}},[w,m,A,V.x,V.y,we,pe,de,F,ie,De,t,q,Me]);s.current=Qe,a.useEffect(()=>{Qe()},[Qe,g,_]);const Ve=a.useCallback((z,H,ee)=>{if(t){const $e=M.current,We=m;if(!$e||!We||z<0||H<0||z>=We.w||H>=We.h)return null;const vt=$e.shape.length===2?1:$e.shape[2]??1,et=(H*We.w+z)*vt,mt=$e.data,st=$e.precision==="f16-bits"?gt=>Tt(mt[gt]??0):gt=>mt[gt]??0,_n=.5,Mn=vt===1?[st(et)]:[st(et),st(et+1),st(et+2)];return lt(Mn,"unit",ee,_n)}const I=P.current;if(!I||z<0||H<0||z>=I.width||H>=I.height)return null;const j=(H*I.width+z)*4,Q=I.data[j],Ne=I.data[j+1],Le=I.data[j+2],Fe=(.299*Q+.587*Ne+.114*Le)/255;return lt(q!=="none"||Q===Ne&&Ne===Le?[Q]:[Q,Ne,Le],"uint8",ee,Fe)},[t,m,q]),Oe=e.showAxes??!1,U=t?e.label??"":e.label,he=e.interpolation??"auto",Ae=he==="auto"?void 0:he,ye=t?void 0:e.overlay,le=t?void 0:e.overlaySettings,ve=t?!1:e.isDraggable??!1,Ie=t?void 0:e.onDragStart;if(v)return t?f.jsx(gn,{...e}):f.jsx(gn,{...e});const Ge=ye&&(le!=null&&le.enabled)&&m&&((((Ce=ye.boxes)==null?void 0:Ce.length)??0)>0||(((Te=ye.masks)==null?void 0:Te.length)??0)>0)?f.jsx(sn,{data:ye,settings:le,naturalWidth:m.w,naturalHeight:m.h}):void 0;return f.jsx(Bt,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":w},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:r,wrapperRef:o,zoom:A,pan:V,onViewportChange:L,naturalDims:m,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:Oe&&m?"16px 4px 4px 28px":0,surface:f.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:Ae},"data-gpu-image-canvas":!0}),showAxes:Oe,overlayNode:Ge,overlay:{displayElRef:n,sample:Ve,version:D,hasSource:!0,sourceWindow:k},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:Qe,leadingMenus:t?[Sr(F,z=>Pe(z),b)]:[hn(q,z=>O(z))],displayAdjust:{exposureEV:pe,offset:de,onExposureChange:xe,onOffsetChange:ce},extraSliders:t&&Uo(F)?[{id:"peak",label:"PK",title:"Peak white (×SDR white) — HDR roll-off shoulder for the extended Reinhard/ACES operators. Double-click to type a value.",min:Lo,max:Bo,step:Oo,value:ie,onChange:X,format:z=>`${z.toFixed(1)}×`}]:void 0,depthSliders:u.sliders,regionSelect:l?{rect:u.region,queryLive:u.queryRegionWindow,commit:u.commitRegion,remove:u.removeRegion}:void 0,onReset:()=>{be(),Z(),W(),u.reset()},extraModified:N!==J.current||oe||ne||u.isModified,label:U,showLabelChip:!!U,isDraggable:ve,onDragStart:Ie})}const It=new Map;function Ze(e){if(It.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);It.set(e.id,e)}function ot(e){return It.get(e)}function Oi(){return Array.from(It.values())}function zr(e,t){return{...e.params??{},...t??{}}}const Ii={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",output:"per-channel",source:`
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
`},Vr=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];$i(Vr);const xn=[1.052156925,1,.91835767],Vi=.7;function $i(e){const[t,n,r]=e[0],[o,i,s]=e[1],[l,c,u]=e[2],h=i*u-s*c,b=-(o*u-s*l),p=o*c-i*l,E=1/(t*h+n*b+r*p);return[[h*E,-(n*u-r*c)*E,(n*s-r*i)*E],[b*E,(t*u-r*l)*E,-(t*s-r*o)*E],[p*E,-(t*c-n*l)*E,(t*i-n*o)*E]]}function Xi(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const bn=6/29;function vn(e){return e>bn**3?Math.cbrt(e):e/(3*bn*bn)+4/29}function $r(e,t,n){const[r,o,i]=Xi(Vr,e,t,n),s=vn(r*xn[0]),l=vn(o*xn[1]),c=vn(i*xn[2]),u=116*l-16,h=500*(s-l),b=200*(l-c);return[u,.01*u*h,.01*u*b]}function Wi(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function Hi(){const e=$r(0,1,0),t=$r(0,0,1);return Math.pow(Wi(e,t),Vi)}const Xr=Hi(),Yi=.082;function Wr(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],i=Math.max(...n,...o),s=Math.ceil(3*Math.sqrt(i/(2*Math.PI**2))*e),l=1/e,c=Math.PI**2,u=[0,0,0];for(let h=-s;h<=s;h++)for(let b=-s;b<=s;b++){const p=(b*l)**2+(h*l)**2;for(let v=0;v<3;v++)u[v]+=t[v]*Math.sqrt(Math.PI/n[v])*Math.exp(-c*p/n[v])+r[v]*Math.sqrt(Math.PI/o[v])*Math.exp(-c*p/o[v])}return{r:s,deltaX:l,sums:u}}function Hr(e){const t=.5*Yi*e,n=Math.ceil(3*t);let r=0,o=0,i=0;for(let s=-n;s<=n;s++)for(let l=-n;l<=n;l++){const c=Math.exp(-(l*l+s*s)/(2*t*t)),u=-l*c,h=(l*l/(t*t)-1)*c;u>0&&(r+=u),h>0?o+=h:i-=h}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:i}}const Ki=`
${ze}
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
${ze}
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
${ze}
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
`,Yr=`
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
`;function je(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function Ft(e,t,n){const r=n.sourceMap,o=r?t==="a"?r.offsetA:r.offsetB:{x:0,y:0},i=r!=null&&r.fill?1:0;return[je(e,[o.x,o.y,i,0]),je(e+1,[n.width,n.height,0,0])]}function Ut(e){return[je(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),je(2,[e.sums[2],0,0,0])]}function Kr(e){return[je(4,[Xr,e.sd,e.r,e.edgeNorm]),je(5,[e.pointPos,e.pointNeg,0,0])]}function qr(e,t,n,r,o,i=""){const s=Wr(e),l=Hr(e),c=`ycxczA${i}`,u=`ycxczB${i}`,h=`labA${i}`,b=`labB${i}`,p=`flip${i}`;return{passes:[{name:c,shader:t,inputs:[n],output:c,uniforms:()=>Ft(1,"a",o)},{name:u,shader:t,inputs:[r],output:u,uniforms:()=>Ft(1,"b",o)},{name:h,shader:Nt,inputs:[c],output:h,uniforms:()=>Ut(s)},{name:b,shader:Nt,inputs:[u],output:b,uniforms:()=>Ut(s)},{name:p,shader:Yr,inputs:[h,b,c,u],output:p,uniforms:()=>Kr(l)}],flipRef:p}}const Zi={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=qr(t,Ki,"srcA","srcB",e);return{passes:n,final:r}}},ji={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=qr(t,qi,"srcA","srcB",e);return{passes:n,final:r}}},Zr=`
${ze}
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
`,Ji={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",output:"scalar",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),i=(r-n)/Math.max(o-1,1),s=Wr(t),l=Hr(t),c=[];let u=null;for(let h=0;h<o;h++){const b=n+h*i,p=`_e${h}`,v=`ycxczA${p}`,E=`ycxczB${p}`,w=`labA${p}`,T=`labB${p}`,m=`acc${p}`;c.push({name:v,shader:Zr,inputs:["srcA"],output:v,uniforms:()=>[je(1,[b,0,0,0]),...Ft(2,"a",e)]},{name:E,shader:Zr,inputs:["srcB"],output:E,uniforms:()=>[je(1,[b,0,0,0]),...Ft(2,"b",e)]},{name:w,shader:Nt,inputs:[v],output:w,uniforms:()=>Ut(s)},{name:T,shader:Nt,inputs:[E],output:T,uniforms:()=>Ut(s)}),u===null?c.push({name:m,shader:Yr,inputs:[w,T,v,E],output:m,uniforms:()=>Kr(l)}):c.push({name:m,shader:Qi,inputs:[w,T,v,E,u],output:m,uniforms:()=>[je(5,[Xr,l.sd,l.r,l.edgeNorm]),je(6,[l.pointPos,l.pointNeg,0,0])]}),u=m}return{passes:c,final:u}}},ea=.01,ta=.03,jr=1,Qr=1.5,Jr=5,eo=`
fn ssim_srgb2linear(c: f32) -> f32 {
  if (c <= 0.04045) { return c / 12.92; }
  return pow((c + 0.055) / 1.055, 2.4);
}
fn ssim_luma(srgb: vec3<f32>) -> f32 {
  let lin = vec3<f32>(ssim_srgb2linear(srgb.r), ssim_srgb2linear(srgb.g), ssim_srgb2linear(srgb.b));
  return clamp(dot(lin, vec3<f32>(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
}
`,na=`
${ze}
${eo}
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
${ze}
${eo}
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
`,to=`
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
`,oa=`
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
`;function wn(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function no(e,t){const n=`${t}H`,r=`${t}V`;return{passes:[{name:n,shader:to,inputs:[e],output:n,uniforms:()=>[wn(1,[1,0,Jr,Qr])]},{name:r,shader:to,inputs:[n],output:r,uniforms:()=>[wn(1,[0,1,Jr,Qr])]}],out:r}}const sa={kind:"multipass",id:"ssim",label:"SSIM (1−SSIM)",publicName:"ssim",displayRange:"unit",output:"scalar",buildPasses(e){const t=(ea*jr)**2,n=(ta*jr)**2,r=no("momA","statsA"),o=no("momB","statsB");return{passes:[{name:"momA",shader:na,inputs:["srcA","srcB"],output:"momA"},{name:"momB",shader:ra,inputs:["srcA","srcB"],output:"momB"},...r.passes,...o.passes,{name:"ssim",shader:oa,inputs:[r.out,o.out],output:"ssim",uniforms:()=>[wn(2,[t,n,0,0])]}],final:"ssim"}}};let ro=!1;function ia(){ro||(ro=!0,Ze(Ni),Ze(Ii),Ze(Fi),Ze(Gi),Ze(Ui),Ze(zi),Ze(Zi),Ze(Ji),Ze(ji),Ze(sa))}ia();function oo(){const e=[];for(const n of Oi())n.kind==="pointwise"&&e.push({id:n.id,label:n.label});e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"});const t=ot("ssim");return t&&e.push({id:t.id,label:t.label}),e}function aa(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}const so=new WeakMap;function yn(e,t,n,r){let o=so.get(e);o||(o=new Map,so.set(e,o));const i=`${t}::${r}`;let s=o.get(i);return s||(s=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(i,s)),s}function ca(e){return`
${ze}
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
`}const Gt="rgba16float";function la(e,t,n,r,o,i){var T,m;const s=ot(r);if(!s)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const l=i??kt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),c=l.result.w,u=l.result.h,h=l.fit==="fill"?1:0,b=zr(s,o);if(s.kind==="pointwise"){const d=e.createTexture(c,u,Gt),g=yn(e,`pw:${s.id}`,ca(s.source),Gt),x=new Float32Array([l.offsetA.x,l.offsetA.y,l.offsetB.x,l.offsetB.y]),_=new Float32Array([c,u,h,0]);let y;try{y=e.createBindGroup(g,[{binding:0,resource:t},{binding:1,resource:n},{binding:2,resource:{uniform:x}},{binding:3,resource:{uniform:_}}]),e.renderFullscreen(d,g,y)}finally{(T=y==null?void 0:y.destroy)==null||T.call(y)}return d}const p={width:c,height:u,params:b,sourceMap:{fill:l.fit==="fill",offsetA:l.offsetA,offsetB:l.offsetB}},v=s.buildPasses(p),E=new Map([["srcA",t],["srcB",n]]),w=[];try{for(const g of v.passes){const x=e.createTexture(c,u,Gt);w.push(x),E.set(g.output,x);const _=yn(e,`mp:${s.id}:${g.name}`,g.shader,Gt),y=g.inputs.map((S,M)=>{const P=E.get(S);if(!P)throw new Error(`computeDiff: pass "${g.name}" input "${S}" not produced yet`);return{binding:M,resource:P}});g.uniforms&&y.push(...g.uniforms(p));let k;try{k=e.createBindGroup(_,y),e.renderFullscreen(x,_,k)}finally{(m=k==null?void 0:k.destroy)==null||m.call(k)}}const d=E.get(v.final);if(!d)throw new Error(`computeDiff: final ref "${v.final}" not produced`);for(const g of w)g!==d&&g.destroy();return d}catch(d){for(const g of w)g.destroy();throw d}}const ua=8,fa=256*1024*1024;class da{constructor(t=ua,n=fa){fe(this,"map",new Map);fe(this,"totalBytes",0);this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}accountReadbackBytes(t,n){let r=!1;for(const o of this.map.values())if(o===t){r=!0;break}r&&(t.bytes+=n,this.totalBytes+=n,this.evict())}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const io=new WeakMap;function ao(e){let t=io.get(e);return t||(t=new da,io.set(e,t)),t}function pa(e,t){const n=zr(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function ha(e,t,n,r,o){const i=ot(n),s=i?pa(i,r):"",l=o?Ss(o):"";return`${e}|${t}|${n}|${s}|${l}`}function ma(e,t,n,r,o,i,s,l){const c=ot(r);if(!c)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const u=ao(e),h=l??kt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),b=ha(i,s,r,o,h),p=u.get(b);if(p)return p;const v=la(e,t,n,r,o,h),E=h.result.w,w=h.result.h,T={texture:v,width:E,height:w,displayRange:c.displayRange,bytes:E*w*8};return u.set(b,T),T}async function ga(e,t,n,r,o){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=or(e,n,r,o).then(i=>(t.scalars=i,i))),t.scalarsPending)}async function xa(e,t){return t.resultSamples?t.resultSamples:(t.resultSamplesPending||(t.resultSamplesPending=e.readback(t.texture).then(n=>{const r=n instanceof Float32Array?n:Float32Array.from(n);return t.resultSamples=r,ao(e).accountReadbackBytes(t,r.byteLength),r})),t.resultSamplesPending)}const ba=`
${ze}
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
`,va={unit:0,signed:1,relative:2},wa={linear:0,signed:1,positive:2};function ya(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function Ea(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function _a(e,t,n,r,o){var v,E,w;const i=Ea(t),s=yn(e,"diff-display",ba,i),l=ya(e,o.colormap),c=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),u=new Float32Array([va[r],wa[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]),h=new Float32Array([o.exposureEV??0,o.offset??0,0,0]),b=new Float32Array([((v=o.sourceDims)==null?void 0:v.w)??0,((E=o.sourceDims)==null?void 0:E.h)??0,0,0]);let p;try{p=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:l},{binding:2,resource:{uniform:c}},{binding:3,resource:{uniform:u}},{binding:4,resource:{uniform:h}},{binding:5,resource:{uniform:b}}]),e.renderFullscreen(t,s,p)}finally{(w=p==null?void 0:p.destroy)==null||w.call(p),l.destroy()}}const co=.6*.6*2.51,Ma=.6*.03,Sa=0,lo=.6*.6*2.43,Ta=.6*.59,Pa=.14;function uo(e){const t=(Ma-Ta*e)/(co-lo*e),n=(Sa-Pa*e)/(co-lo*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const Aa=.85,Ra=.85,fo=11920928955078125e-23,En=[.2126,.7152,.0722];function Ca(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function ka(e,t,n,r=3,o={}){const i=t*n,s=uo(Aa),l=uo(Ra),c=new Float64Array(i);let u=0;for(let d=0;d<i;d++){const[g,x,_]=Ca(e,d,r),y=g*En[0]+x*En[1]+_*En[2];c[d]=y,y>u&&(u=y)}const h=Float64Array.from(c).sort(),b=i>>1,p=i%2===1?h[b]:h[b-1],v=Math.max(p,fo),E=Math.max(u,fo),w=o.startExposure??Math.log2(s/E),T=o.stopExposure??Math.log2(l/v),m=Math.max(2,Math.ceil(T-w));return{startExposure:w,stopExposure:T,numExposures:m}}const Da={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function La({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:i,zoom:s,pan:l,onViewportChange:c,processing:u=Da,interpolation:h="auto",label:b="",isDraggable:p=!1,onDragStart:v,overlay:E,overlaySettings:w,pixelValueNotation:T="decimal"}){var Z,ie;const m=a.useRef(null),[d,g]=a.useState(null),[x,_]=a.useState(null),[y,k]=a.useState(T),[S,M]=a.useState(!1),P=a.useRef(null),D=a.useRef(null),R=a.useRef(null),A=a.useRef(null),[V,L]=a.useState(0);a.useEffect(()=>{if(!e){R.current=null,L(ne=>ne+1);return}let X=!1;return it(e).then(ne=>{X||(R.current=ne,L(W=>W+1))}),()=>{X=!0}},[e]),a.useEffect(()=>{if(!t){A.current=null,L(ne=>ne+1);return}let X=!1;return it(t).then(ne=>{X||(A.current=ne,L(W=>W+1))}),()=>{X=!0}},[t]);const B=X=>(ne,W,pe)=>{const xe=X.current;if(!xe||ne<0||W<0||ne>=xe.width||W>=xe.height)return null;const de=(W*xe.width+ne)*4,ce=xe.data[de],Me=xe.data[de+1],we=xe.data[de+2],De=(.299*ce+.587*Me+.114*we)/255;return ce===Me&&Me===we?{lines:[ft(ce,"uint8",pe)],luminance:De}:{lines:[ft(ce,"uint8",pe),ft(Me,"uint8",pe),ft(we,"uint8",pe)],luminance:De,colors:[At[0],At[1],At[2]]}},N=a.useMemo(()=>B(R),[]),O=a.useMemo(()=>B(A),[]),q=!!E&&!!(w!=null&&w.enabled)&&!!d&&!!e&&((((Z=E.boxes)==null?void 0:Z.length)??0)>0||(((ie=E.masks)==null?void 0:ie.length)??0)>0),{gammaFilterId:J,filterStr:be,gamma:ge,offset:re}=fr(u),Pe=`translate(${l.x}px, ${l.y}px) scale(${s})`,$=h==="auto"?void 0:h,{containerProps:F,modifierActive:oe}=Kn({containerRef:m,zoom:s,pan:l,onViewportChange:c});return f.jsxs("div",{className:"relative flex flex-col h-full",children:[f.jsx(dr,{id:J,gamma:ge,offset:re}),f.jsxs("div",{ref:m,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...F.style},onPointerDown:F.onPointerDown,onPointerMove:F.onPointerMove,onPointerUp:F.onPointerUp,onPointerCancel:F.onPointerCancel,children:[f.jsxs("div",{className:"relative w-full h-full",children:[f.jsxs("div",{className:"relative w-full h-full",style:{transform:Pe,transformOrigin:"0 0"},children:[f.jsx("img",{ref:P,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:be,imageRendering:$,...n==="blend"?{opacity:o}:{}},onLoad:X=>{const ne=X.currentTarget;g({w:ne.naturalWidth,h:ne.naturalHeight})}}),q&&f.jsx(sn,{data:E,settings:w,naturalWidth:d.w,naturalHeight:d.h})]}),f.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:f.jsx("div",{className:"w-full h-full",style:{transform:Pe,transformOrigin:"0 0"},children:f.jsx("img",{ref:D,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:be,imageRendering:$,...n==="blend"?{opacity:1-o}:{}},onLoad:X=>{const ne=X.currentTarget;_({w:ne.naturalWidth,h:ne.naturalHeight})}})})}),n==="split"&&f.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${r*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:()=>i==null?void 0:i(.5),onPointerDown:X=>{X.stopPropagation(),X.preventDefault();const ne=X.currentTarget;try{ne.setPointerCapture(X.pointerId)}catch{}const pe=ne.parentElement.getBoundingClientRect(),xe=ce=>{i==null||i(Math.max(0,Math.min(1,(ce.clientX-pe.left)/pe.width)))},de=()=>{window.removeEventListener("pointermove",xe),window.removeEventListener("pointerup",de)};window.addEventListener("pointermove",xe),window.addEventListener("pointerup",de)},children:f.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})]}),n==="split"?f.jsxs(f.Fragment,{children:[t&&x&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:f.jsx(ut,{imageElRef:D,naturalWidth:x.w,naturalHeight:x.h,zoom:s,pan:l,sample:O,notation:y,version:V})}),e&&d&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:f.jsx(ut,{imageElRef:P,naturalWidth:d.w,naturalHeight:d.h,zoom:s,pan:l,sample:N,notation:y,version:V,onActiveChange:M})})]}):e&&d&&f.jsx(ut,{imageElRef:P,naturalWidth:d.w,naturalHeight:d.h,zoom:s,pan:l,sample:N,notation:y,version:V,onActiveChange:M}),S&&f.jsx(Zn,{notation:y,onChange:k})]}),n==="split"&&f.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),f.jsxs("span",{className:`absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${p&&!oe?" cairn-drag-grip":""}`,draggable:p&&!oe,onDragStart:v,style:{cursor:p&&!oe?"grab":void 0},children:[f.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50"}),b]})]})}function Ba(){return f.jsx("div",{className:"card p-4 text-sm text-red-400 h-full flex items-center justify-center text-center",children:"Plot error: float URL sources need the GPU compare (WebGPU) — unavailable here"})}function Oa({mode:e,kernel:t,kernelOptions:n,onSlide:r,onBlend:o,onKernel:i,onSide:s}){return{id:"compare-mode",title:"Compare / diff mode",menu:{options:[...s?[{id:"side",label:"Side"}]:[],{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...n],value:e==="side"?"side":e==="split"?"slide":e==="blend"?"blend":t,onSelect:u=>{u==="side"?s==null||s():u==="slide"?r():u==="blend"?o():i(u)}}}}function Ia(e){const t=Ht(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function Na(e){const{width:t,height:n,channels:r}=e,o=t*n;if(e.precision==="f16-bits"){const c=e.data,u=new Uint16Array(o*4);for(let h=0;h<o;h++){const b=h*r,p=h*4;if(r===1){const v=c[b];u[p]=v,u[p+1]=v,u[p+2]=v,u[p+3]=St}else u[p]=c[b],u[p+1]=c[b+1],u[p+2]=c[b+2],u[p+3]=r>=4?c[b+3]:St}return{data:u,format:"rgba16float"}}const i=e.data,s=new Float32Array(o*4),l=c=>Number.isFinite(c)?c:0;for(let c=0;c<o;c++){const u=c*r;let h,b,p,v=1;r===1?h=b=p=l(i[u]):r===3?(h=l(i[u]),b=l(i[u+1]),p=l(i[u+2])):(h=l(i[u]),b=l(i[u+1]),p=l(i[u+2]),v=l(i[u+3]));const E=c*4;s[E]=h,s[E+1]=b,s[E+2]=p,s[E+3]=v}return{data:s,format:"rgba32float"}}function Fa({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:i,blendAlpha:s,onSplitPositionChange:l,diffSubmode:c,colormap:u="none",align:h="top-left",fit:b="crop",diffKernel:p,onDiffKernelChange:v,onCompareModeChange:E,onRequestSide:w,zoom:T,pan:m,onViewportChange:d,interpolation:g="auto",label:x="",pixelValueNotation:_="decimal"}){var gt;const y=a.useRef(null),k=a.useRef(null),S=a.useRef(null),M=a.useRef(null),P=a.useRef(null),[D,R]=a.useState(!1),[A,V]=a.useState(!1),[L,B]=a.useState(null),[N,O]=a.useState(null),[q,J]=a.useState(0),[be,ge]=a.useState(0),[re,Pe]=a.useState(null),[$,F]=a.useState({x:0,y:0,w:1,h:1}),oe=p??c??"absolute",[Z,ie,X]=ct(oe);a.useEffect(()=>{ie(p??c??"absolute")},[p,c,ie]);const ne=a.useCallback(C=>{ie(C),v==null||v(C)},[v,ie]);a.useEffect(()=>{const C=y.current;if(C)return C.__cairnDiffKernel={current:Z,set:ne},()=>{C&&delete C.__cairnDiffKernel}},[Z,ne]);const[W,pe,xe]=ct(o);a.useEffect(()=>{pe(o)},[o,pe]);const de=a.useCallback(C=>{pe(C),E==null||E(C)},[E,pe]),[ce,Me,we]=ct(u);a.useEffect(()=>{Me(u)},[u,Me]);const De=a.useCallback(()=>{de(xe.default),Me(we.default),ne(X.default)},[de,Me,ne,xe.default,we.default,X.default]),Qe=xe.isModified||we.isModified||X.isModified,[Ve,Oe]=a.useState(0),[U,he]=a.useState(0),Ae=a.useMemo(()=>{const Y=[Oa({mode:W,kernel:Z,kernelOptions:oo().map(K=>({id:K.id,label:K.label})),onSide:w,onSlide:()=>de("split"),onBlend:()=>de("blend"),onKernel:K=>{de("diff"),ne(K)}})];return W==="diff"&&Y.push(hn(ce,K=>Me(K))),Y},[W,Z,ce,ne,de,w]),ye=a.useRef(null),le=a.useRef(null),ve=a.useRef(null),Ie=a.useRef(null),[Ge,Se]=a.useState(0),Ce=a.useRef(null),Te=a.useRef(null),[z,H]=a.useState(0),ee=on();a.useEffect(()=>{const C=S.current;if(!C)return;let Y=!1;return yt().then(K=>{if(!Y)try{if(ir())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const G=K.createSurface(C,{hdr:!1});M.current={device:K,surface:G,texA:null,texB:null},V(!0)}catch(G){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",G),R(!0)}}).catch(K=>{Y||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",K),R(!0))}),()=>{var G,se;Y=!0;const K=M.current;K&&((G=K.texA)==null||G.destroy(),(se=K.texB)==null||se.destroy(),M.current=null)}},[]),a.useEffect(()=>{const C=y.current;if(!C)return;const Y=new ResizeObserver(()=>ge(K=>K+1));return Y.observe(C),()=>Y.disconnect()},[]),a.useEffect(()=>{if(!A)return;let C=!1;if(!M.current)return;async function K(G,se){if(se){const Ee=Na(se);return{width:se.width,height:se.height,imageData:null,make:Re=>{const me=Re.createTexture(se.width,se.height,Ee.format);return me.write(Ee.data),me}}}if(!G)return null;const ue=await it(G);return ue?{width:ue.width,height:ue.height,imageData:ue,make:Ee=>{const Re=Ee.createTexture(ue.width,ue.height,"rgba8unorm");return Re.write(ue.data),Re}}:null}return Promise.all([K(e,n),K(t,r)]).then(([G,se])=>{var Ue,He;if(C||!M.current)return;const ue=M.current;ye.current=(G==null?void 0:G.imageData)??null,le.current=(se==null?void 0:se.imageData)??null,ve.current=n??null,Ie.current=r??null,(Ue=ue.texA)==null||Ue.destroy(),(He=ue.texB)==null||He.destroy(),ue.texA=null,ue.texB=null;const Ee=G??se;if(!Ee){B(null),O(null),Se(Xe=>Xe+1);return}const Re=se??Ee,me=G??Ee;ue.texA=Re.make(ue.device),ue.texB=me.make(ue.device),O({a:{w:Re.width,h:Re.height},b:{w:me.width,h:me.height}}),B({w:Ee.width,h:Ee.height}),Se(Xe=>Xe+1),J(Xe=>Xe+1)}),()=>{C=!0}},[A,e,t,n,r]);const I=n!=null||r!=null,j=a.useMemo(()=>aa(Z,I),[Z,I]),Q=a.useMemo(()=>{if(!I)return null;const C=r??n;if(!C)return null;const Y=C.precision==="f16-bits"?zn(C.data):C.data;return ka(Y,C.width,C.height,C.channels)},[I,r,n]),Ne=a.useMemo(()=>{var C;return $o(((C=ot(j))==null?void 0:C.displayRange)??"unit",ce==="none"?null:ce)},[j,ce]),Le=a.useMemo(()=>ce!=="none"?Ia(ce):void 0,[ce]),Fe=a.useMemo(()=>N?kt(N.a,N.b,h,b,"b"):null,[N,h,b]),ae=a.useMemo(()=>L?W==="diff"&&Fe?Fe.result:L:null,[W,Fe,L]),$e=a.useCallback(()=>{const C=M.current;if(!A||!C||!C.surface||!C.texA||!C.texB||!L)return;const Y=ae??L,K=y.current,G=K?K.getBoundingClientRect():{width:Y.w,height:Y.h},se=Ur({zoom:T,pan:m},G,Y.w,Y.h);F(me=>me.x===se.x&&me.y===se.y&&me.w===se.w&&me.h===se.h?me:se);const ue=S.current;if(G.width>0&&G.height>0&&ue&&C.surface){const me=Math.max(1,Math.round(G.width*ee)),Ue=Math.max(1,Math.round(G.height*ee));(ue.width!==me||ue.height!==Ue)&&(ue.width=me,ue.height=Ue,C.surface.configure(me,Ue))}const Ee=Gr(se,G,Y.w,Y.h)>=an?"nearest":"linear",Re=se;try{if(W==="diff"){const me=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",Ue=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",He=ot(j)?j:"absolute",Xe=He==="hdr-flip"&&Q?{ppd:67,startExposure:Q.startExposure,stopExposure:Q.stopExposure,numExposures:Q.numExposures}:void 0,xt=ma(C.device,C.texA,C.texB,He,Xe,me,Ue,Fe??void 0);P.current=xt,_a(C.device,C.surface,xt.texture,xt.displayRange,{uv:Re,cmapMode:Ne,colormap:Le,filter:Ee,exposureEV:Ve,offset:U})}else{const me={exposureEV:Ve,offset:U,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:Re,filter:Ee,mode:W,split:i,alpha:s};Rs(C.device,C.surface,C.texA,C.texB,me)}}catch(me){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",me),R(!0)}},[A,L,ae,Fe,T,m.x,m.y,W,i,s,Ve,U,Z,j,Q,Ne,Le,e,t,n,r,ee]);a.useEffect(()=>{$e()},[$e,q,be]);const We=t!=null||r!=null;a.useEffect(()=>{const C=M.current;if(!A||!C||!C.texA||!C.texB||!We){Pe(null);return}let Y=!1;const K=C.texA,G=C.texB,se=P.current,ue=W==="diff"?Fe??void 0:void 0;return(W==="diff"&&se?ga(C.device,se,K,G,ue):or(C.device,K,G,ue)).then(Re=>{Y||Pe(Re)}),()=>{Y=!0}},[A,q,We,W,Z,Fe]),a.useEffect(()=>{if(W!=="diff"){Ce.current=null,Te.current=null;return}const C=M.current,Y=P.current;if(!A||!C||!Y)return;let K=!1;return Ce.current=null,Te.current=null,H(G=>G+1),xa(C.device,Y).then(G=>{K||(Ce.current=G,Te.current={w:Y.width,h:Y.height},H(se=>se+1))}).catch(()=>{}),()=>{K=!0}},[A,W,j,q,Fe]);const vt=(C,Y)=>(K,G,se)=>{const ue=Y.current;if(ue){const{data:xt,width:po,height:za,channels:ho}=ue;if(K<0||G<0||K>=po||G>=za)return null;const zt=(G*po+K)*ho,Vt=ue.precision==="f16-bits"?Sn=>Tt(xt[Sn]??0):Sn=>xt[Sn]??0,Va=.5,$a=ho===1?[Vt(zt)]:[Vt(zt),Vt(zt+1),Vt(zt+2)];return lt($a,"unit",se,Va)}const Ee=C.current;if(!Ee||K<0||G<0||K>=Ee.width||G>=Ee.height)return null;const Re=(G*Ee.width+K)*4,me=Ee.data[Re],Ue=Ee.data[Re+1],He=Ee.data[Re+2],Xe=(.299*me+.587*Ue+.114*He)/255;return lt(me===Ue&&Ue===He?[me]:[me,Ue,He],"uint8",se,Xe)},et=a.useMemo(()=>vt(ye,ve),[]),mt=a.useMemo(()=>vt(le,Ie),[]),st=a.useMemo(()=>(C,Y,K)=>{var Xe;const G=Ce.current,se=Te.current;if(!G||!se)return null;const{w:ue,h:Ee}=se;if(C<0||Y<0||C>=ue||Y>=Ee)return null;const Re=(Y*ue+C)*4,me=((Xe=ot(j))==null?void 0:Xe.output)??"per-channel",Ue=.5,He=me==="scalar"?[G[Re]??0]:[G[Re]??0,G[Re+1]??0,G[Re+2]??0];return lt(He,"unit",K,Ue)},[j]);a.useEffect(()=>{const C=y.current;if(C)return C.__cairnCompareProbe={sampleDiff:(Y,K,G="decimal")=>st(Y,K,G),sampleFg:(Y,K,G="decimal")=>et(Y,K,G),sampleRef:(Y,K,G="decimal")=>mt(Y,K,G),get diffSamples(){return Ce.current},get dims(){return ae},get primaryDims(){return L},get diffResultDims(){return Te.current},get align(){return h},get fit(){return b},get resolvedKernelId(){return j},get compareMode(){return W}},()=>{C&&delete C.__cairnCompareProbe}},[st,et,mt,L,ae,h,b,j,W]);const _n=g==="auto"?void 0:g;if(D)return n!=null||r!=null?f.jsx(Ba,{}):W==="diff"?f.jsx(gn,{imageUrl:e,baselineUrl:t,diffMode:((gt=ot(j))==null?void 0:gt.kind)==="pointwise"?j:"absolute",interpolation:g,colormap:ce,showAxes:!1,zoom:T,pan:m,onViewportChange:d,label:x,pixelValueNotation:_}):f.jsx(La,{imageUrl:e,baselineUrl:t,mode:W,splitPosition:i,blendAlpha:s,onSplitPositionChange:l,zoom:T,pan:m,onViewportChange:d,interpolation:g,label:x,pixelValueNotation:_});const Mn=f.jsxs(f.Fragment,{children:[f.jsx("canvas",{ref:S,className:"w-full h-full block",style:{imageRendering:_n},"data-gpu-compare-canvas":!0}),W==="split"&&f.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${i*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:C=>{C.stopPropagation(),l==null||l(.5)},onPointerDown:C=>{C.stopPropagation(),C.preventDefault();const Y=C.currentTarget;try{Y.setPointerCapture(C.pointerId)}catch{}const G=Y.parentElement.getBoundingClientRect(),se=Ee=>{l==null||l(Math.max(0,Math.min(1,(Ee.clientX-G.left)/G.width)))},ue=()=>{window.removeEventListener("pointermove",se),window.removeEventListener("pointerup",ue)};window.addEventListener("pointermove",se),window.addEventListener("pointerup",ue)},children:f.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})]});return f.jsx(Bt,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":A},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:y,wrapperRef:k,zoom:T,pan:m,onViewportChange:d,naturalDims:ae,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:Mn,showAxes:!1,notationSeed:_,onReset:De,extraModified:Qe,exportCanvasRef:S,requestRender:$e,leadingMenus:Ae,displayAdjust:{exposureEV:Ve,offset:U,onExposureChange:Oe,onOffsetChange:he},label:"",showLabelChip:!1,overlay:{render:({notation:C,setOverlayActive:Y})=>W==="split"?f.jsxs(f.Fragment,{children:[We&&ae&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-i)*100}% 0 0)`},children:f.jsx(ut,{imageElRef:S,naturalWidth:ae.w,naturalHeight:ae.h,zoom:T,pan:m,sourceWindow:$,sample:mt,notation:C,version:Ge})}),We&&ae&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${i*100}%)`},children:f.jsx(ut,{imageElRef:S,naturalWidth:ae.w,naturalHeight:ae.h,zoom:T,pan:m,sourceWindow:$,sample:et,notation:C,version:Ge,onActiveChange:Y})})]}):ae&&f.jsx(ut,{imageElRef:S,naturalWidth:ae.w,naturalHeight:ae.h,zoom:T,pan:m,sourceWindow:$,sample:W==="diff"?st:et,notation:C,version:W==="diff"?z:Ge,onActiveChange:Y})},extraChips:f.jsxs(f.Fragment,{children:[W==="split"&&f.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),x?f.jsx("span",{className:"absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm",children:x}):null,re&&f.jsxs("span",{className:`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${x?"bottom-7":"bottom-1"}`,"data-gpu-compare-metrics":!0,children:["MSE ",re.mse.toExponential(2)," · PSNR ",Number.isFinite(re.psnr)?re.psnr.toFixed(1):"∞"," dB · MAE"," ",re.mae.toExponential(2)]})]})})}const Ua="cairn-plot:gpu-image-ready";async function Ga(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await yt(),window.__cairnPlotGpuImagePane=Bi,window.__cairnPlotGpuComparePane=Fa,window.__cairnPlotDiffMenuModes=oo(),window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(Ua))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e),Fr("no-webgpu")}}}Ga()})(__cairnPlotJsxRuntime,__cairnPlotReact);
