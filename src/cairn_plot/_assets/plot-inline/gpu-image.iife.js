var Ra=Object.defineProperty;var Da=(f,a,tt)=>a in f?Ra(f,a,{enumerable:!0,configurable:!0,writable:!0,value:tt}):f[a]=tt;var oe=(f,a,tt)=>Da(f,typeof a!="symbol"?a+"":a,tt);(function(f,a){"use strict";const tt=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function En(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:tt}),{hdr:!1,format:n}}function io(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:tt}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:tt}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return En(e,t)}}}const ao=`
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
`,co=`
struct Params { dims: vec4<f32> }; // x=width, y=height, z=zClip, w=unused

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
  let zClip = params.dims.z;
  // Front-to-back OVER over premultiplied samples: acc += (1 - acc.a) * sample.
  var acc = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  for (var s: u32 = start; s < end; s = s + 1u) {
    if (zs[s] > zClip) { break; } // samples ascending in Z ⇒ the rest are farther
    let c = colors[s];
    let wgt = 1.0 - acc.a;
    acc = acc + wgt * c;
  }
  return acc;
}
`;function zt(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function _n(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function lo(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const uo={texture:0,sampler:1,uniform:2};function Vt(e,t){return e*3+uo[t]}const fo={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function po(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),i=r[2]!==void 0,s=r[3].trim();if(i){const l=fo[s];if(l===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${s}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:l})}else s==="sampler"||s==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class Mn{constructor(t,n,r,o){oe(this,"width");oe(this,"height");oe(this,"format");oe(this,"gpuTexture");oe(this,"device");oe(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:zt(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*_n(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class Sn{constructor(t){oe(this,"_s");oe(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class ho{constructor(t,n,r,o,i){oe(this,"_p");oe(this,"gpuPipeline");oe(this,"bindings");oe(this,"bindGroupLayout");oe(this,"variants");oe(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=i,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function mo(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class go{constructor(t){oe(this,"_c");oe(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class xo{constructor(t,n,r,o,i){oe(this,"width");oe(this,"height");oe(this,"paramsBuffer");oe(this,"bindGroup");oe(this,"buffers");oe(this,"destroyed",!1);this.width=t,this.height=n,this.buffers=r,this.paramsBuffer=o,this.bindGroup=i}destroy(){if(!this.destroyed){for(const t of this.buffers)t.destroy();this.paramsBuffer.destroy(),this.destroyed=!0}}}class bo{constructor(t,n){oe(this,"_b");oe(this,"gpuBindGroup");oe(this,"ownedBuffers");oe(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class vo{constructor(t,n,r,o){oe(this,"canvas");oe(this,"hdr");oe(this,"format");oe(this,"context");oe(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function vt(e){return"canvas"in e}async function wo(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function i(d){return vt(d)?d.getCurrentTextureView():d.gpuTexture.createView()}function s(d){if(vt(d))return{width:d.canvas.width,height:d.canvas.height};const y=d;return{width:y.width,height:y.height}}let l=!1,c=null;function u(){var y,E;if(c!==null)return c;let d=!1;try{if(typeof document<"u"){const S=document.createElement("canvas");S.width=1,S.height=1;const x=S.getContext("webgpu");if(x)try{x.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:GPUTextureUsage.RENDER_ATTACHMENT});const C=(y=x.getConfiguration)==null?void 0:y.call(x);d=((E=C==null?void 0:C.toneMapping)==null?void 0:E.mode)==="extended"}catch{d=!1}finally{try{x.unconfigure()}catch{}}}}catch{d=!1}return c=d,d}const p=256;let b=null,h=null;function v(){if(!b||!h){const d=t.createShaderModule({code:ao});h=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const y=t.createPipelineLayout({bindGroupLayouts:[h]});b=t.createComputePipeline({layout:y,compute:{module:d,entryPoint:"cs_main"}})}return{pipeline:b,layout:h}}let w=null,m=null;function T(){if(!w||!m){const d=t.createShaderModule({code:co});m=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});const y=t.createPipelineLayout({bindGroupLayouts:[m]});w=t.createRenderPipeline({layout:y,vertex:{module:d,entryPoint:"vs_main"},fragment:{module:d,entryPoint:"fs_main",targets:[{format:"rgba16float"}]},primitive:{topology:"triangle-list"}})}return{pipeline:w,layout:m}}return{backend:"webgpu",capabilities:n,probeExtendedToneMapping:u,createTexture(d,y,E){return new Mn(t,d,y,E)},createSampler(d){const y=(d==null?void 0:d.filter)==="linear"?"linear":"nearest",E=t.createSampler({magFilter:y,minFilter:y,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new Sn(E)},createRenderPipeline(d){const y=t.createShaderModule({code:d.shaderWGSL}),E=po(d.shaderWGSL),S=zt(d.targetFormat),x=mo(t,E),C=t.createPipelineLayout({bindGroupLayouts:[x]}),_=P=>t.createRenderPipeline({layout:C,vertex:{module:y,entryPoint:"vs_main"},fragment:{module:y,entryPoint:"fs_main",targets:[{format:P}]},primitive:{topology:"triangle-list"}}),M=_(S);return new ho(M,E,x,S,_)},createComputePipeline(d){const y=t.createShaderModule({code:d.shaderWGSL}),E=t.createComputePipeline({layout:"auto",compute:{module:y,entryPoint:"cs_main"}});return new go(E)},createBindGroup(d,y){const E=d,S=new Map,x=[];for(const[_,M]of E.bindings)if(M.kind==="uniform"){const P=t.createBuffer({size:M.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});x.push(P),S.set(_,{binding:_,resource:{buffer:P}})}else M.kind==="sampler"&&S.set(_,{binding:_,resource:o()});for(const _ of y){const M=_.resource;if(M instanceof Mn){const P=Vt(_.binding,"texture");E.bindings.has(P)&&S.set(P,{binding:P,resource:M.gpuTexture.createView()})}else if(M instanceof Sn){const P=Vt(_.binding,"sampler");E.bindings.has(P)&&S.set(P,{binding:P,resource:M.gpuSampler})}else{const P=Vt(_.binding,"uniform"),k=E.bindings.get(P);if(k&&k.kind==="uniform"){const R=M.uniform,A=t.createBuffer({size:Math.max(k.sizeBytes,R.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(A,0,R.buffer,R.byteOffset,R.byteLength),x.push(A),S.set(P,{binding:P,resource:{buffer:A}})}}}const C=t.createBindGroup({layout:E.bindGroupLayout,entries:Array.from(S.values())});return new bo(C,x)},createSurface(d,y){const E=d.getContext("webgpu");if(!E)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const S=y.hdr&&n.hdr,x=()=>S?io(E,t):En(E,t),C=x();return new vo(d,E,C,x)},renderFullscreen(d,y,E){const S=y,x=E,C=i(d),{width:_,height:M}=s(d),P=vt(d)?d.format:zt(d.format),k=S.pipelineFor(P),R=t.createCommandEncoder(),A=R.beginRenderPass({colorAttachments:[{view:C,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});A.setPipeline(k),A.setBindGroup(0,x.gpuBindGroup),A.setViewport(0,0,_,M,0,1),A.draw(3),A.end(),t.queue.submit([R.finish()])},createDeepSampleBuffers(d){const{layout:y}=T(),E=P=>{const k=t.createBuffer({size:P.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});return t.queue.writeBuffer(k,0,P.buffer,P.byteOffset,P.byteLength),k},S=E(d.offsets),x=E(d.colors),C=E(d.zs),_=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),M=t.createBindGroup({layout:y,entries:[{binding:0,resource:{buffer:S}},{binding:1,resource:{buffer:x}},{binding:2,resource:{buffer:C}},{binding:3,resource:{buffer:_}}]});return new xo(d.width,d.height,[S,x,C],_,M)},compositeDeep(d,y,E){const S=d,x=y,{pipeline:C}=T();t.queue.writeBuffer(S.paramsBuffer,0,new Float32Array([S.width,S.height,E,0]));const _=t.createCommandEncoder(),M=_.beginRenderPass({colorAttachments:[{view:x.gpuTexture.createView(),loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});M.setPipeline(C),M.setBindGroup(0,S.bindGroup),M.setViewport(0,0,x.width,x.height,0,1),M.draw(3),M.end(),t.queue.submit([_.finish()])},async readback(d){const y=vt(d),{width:E,height:S}=s(d),x=y?d.hdr?"rgba16float":"rgba8unorm":d.format,C=y&&d.format==="bgra8unorm",_=y?d.getCurrentGPUTexture():d.gpuTexture,M=_n(x),P=E*M,k=256,R=Math.ceil(P/k)*k,A=R*S,V=t.createBuffer({size:A,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),L=t.createCommandEncoder();L.copyTextureToBuffer({texture:_},{buffer:V,bytesPerRow:R,rowsPerImage:S},{width:E,height:S,depthOrArrayLayers:1}),t.queue.submit([L.finish()]),await V.mapAsync(GPUMapMode.READ);const B=new Uint8Array(V.getMappedRange()),U=new Uint8Array(P*S);for(let O=0;O<S;O++){const ee=O*R,q=O*P;U.set(B.subarray(ee,ee+P),q)}if(V.unmap(),V.destroy(),x==="rgba8unorm"){if(C)for(let O=0;O<U.length;O+=4){const ee=U[O],q=U[O+2];U[O]=q,U[O+2]=ee}return U}if(x==="rgba16float"){const O=new Uint16Array(U.buffer,U.byteOffset,U.byteLength/2),ee=new Float32Array(O.length);for(let q=0;q<O.length;q++)ee[q]=lo(O[q]);return ee}return new Float32Array(U.buffer,U.byteOffset,U.byteLength/4)},async reduceDiffSumSquaredAbs(d,y,E,S){const x=d,C=y,_=Math.max(0,E*S),M=Math.max(1,Math.ceil(_/p)),{pipeline:P,layout:k}=v(),R=M*2*4,A=t.createBuffer({size:R,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),V=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(V,0,new Uint32Array([Math.max(1,E),Math.max(1,S),_,0]));const L=t.createBindGroup({layout:k,entries:[{binding:0,resource:x.gpuTexture.createView()},{binding:1,resource:C.gpuTexture.createView()},{binding:2,resource:{buffer:A}},{binding:3,resource:{buffer:V}}]}),B=t.createBuffer({size:R,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),U=t.createCommandEncoder(),O=U.beginComputePass();O.setPipeline(P),O.setBindGroup(0,L),O.dispatchWorkgroups(M),O.end(),U.copyBufferToBuffer(A,0,B,0,R),t.queue.submit([U.finish()]),await B.mapAsync(GPUMapMode.READ);const q=new Float32Array(B.getMappedRange()).slice();B.unmap(),B.destroy(),A.destroy(),V.destroy();let ye=0,xe=0;for(let ie=0;ie<M;ie++)ye+=q[ie*2],xe+=q[ie*2+1];return{sumSq:ye,sumAbs:xe}},destroy(){l||(t.destroy(),l=!0)},isContextLost(){return!1}}}let $t=null;async function yo(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return wo()}function wt(){return $t||($t=yo()),$t}function Eo(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function _o(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),i=Math.floor(o),s=Math.min(i+1,e.length-1),l=o-i,[c,u,p]=Eo(e[i],e[s],l);t[n*3]=Math.round(c),t[n*3+1]=Math.round(u),t[n*3+2]=Math.round(p)}return t}const Tn={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},Mo=new Set(["red-green","red-blue"]),Pn=new Map;function Xt(e){let t=Pn.get(e);if(!t){const n=Tn[e]??Tn.viridis;t=_o(n),Pn.set(e,t)}return t}const Ye=e=>e<0?0:e>1?1:e,Ht=e=>{const t=e<0?0:e;return t/(1+t)},Wt=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return Ye(n/r)},yt=4,So=1,To=16,Po=.5,An={linear:([e,t,n])=>[Ye(e),Ye(t),Ye(n)],srgb:([e,t,n])=>[Ye(e),Ye(t),Ye(n)],reinhard:([e,t,n])=>[Ht(e),Ht(t),Ht(n)],aces:([e,t,n])=>[Wt(e),Wt(t),Wt(n)],extended:([e,t,n])=>[e,t,n]},Cn="srgb",Ao=["linear","srgb","reinhard","aces"],Co=["extended","extended-reinhard","extended-aces"],Ro=["extended-reinhard","extended-aces"];function Rn(e){return!!e&&Co.includes(e)}function Do(e){return!!e&&Ro.includes(e)}const Dn={extended:"linear","extended-reinhard":"reinhard","extended-aces":"aces"};function ko(e){return e&&An[e]||An[Cn]}function Yt(e){return e&&Dn[e]?Dn[e]:e&&Ao.includes(e)?e:Cn}function Lo(e,t){return t?Rn(e)?e:"extended":Yt(e)}function Et(e,t,n){return e*2**t+n}function Bo(e){const t=Ye(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function Kt(e,t){return typeof t=="number"&&t>0?Ye(Math.pow(Ye(e),1/t)):Bo(e)}function qt(e,t,n="linear",r=0,o=0){const i=Xt(t),s=new ImageData(e.width,e.height),l=e.data,c=s.data,u=r!==0||o!==0;for(let p=0;p<l.length;p+=4){let b=(l[p]+l[p+1]+l[p+2])/3;u&&(b=Math.max(0,Math.min(255,Et(b/255,r,o)*255)));let h;n==="positive"?h=Math.round(128+b/255*127):h=Math.round(b),h=Math.max(0,Math.min(255,h)),c[p]=i[h*3],c[p+1]=i[h*3+1],c[p+2]=i[h*3+2],c[p+3]=l[p+3]}return s}function Oo(e,t){return e==="signed"||e==="relative"?"signed":Zt(t)}function Zt(e){return Mo.has(e??"")?"positive":"linear"}function kn(e){const t=new Map;return{get(n){return t.get(n)},set(n,r){if(t.size>=e){const o=t.keys().next().value;o!==void 0&&t.delete(o)}t.set(n,r)}}}const Ln=kn(50);function Qt(e){return Ln.get(e)}function jt(e,t){Ln.set(e,t)}const Bn=kn(100);function Io(e){return Bn.get(e)}function No(e,t){Bn.set(e,t)}function Fo(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),i=new ImageData(r,o);for(let s=0;s<o;s++)for(let l=0;l<r;l++){const c=(s*e.width+l)*4,u=(s*t.width+l)*4,p=(s*r+l)*4;for(let b=0;b<3;b++){const h=e.data[c+b],v=t.data[u+b],w=h-v,m=Math.abs(w),T=Math.max(h,1);let g;switch(n){case"signed":g=(w+255)/2;break;case"absolute":g=m;break;case"squared":g=w*w/255;break;case"relative_signed":g=(w/T+1)*127.5;break;case"relative_absolute":g=m/T*255;break;case"relative_squared":g=w*w/(T*T)*255;break}i.data[p+b]=Math.min(255,Math.max(0,Math.round(g)))}i.data[p+3]=255}return i}async function it(e){const t=Io(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const i=o.getContext("2d");if(!i){n(null);return}i.drawImage(r,0,0);const s=i.getImageData(0,0,o.width,o.height);No(e,s),n(s)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const Uo={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},Go={linear:0,signed:1,positive:2},zo=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,Vo=`#version 300 es
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
}`;let at=null,Q=null,ke=null,_t=null;function $o(){if(Q)return Q;try{if(typeof OffscreenCanvas<"u"?at=new OffscreenCanvas(1,1):at=document.createElement("canvas"),Q=at.getContext("webgl2",{preserveDrawingBuffer:!0}),!Q)return console.warn("[cairn] WebGL 2 not available"),null;const e=Q.createShader(Q.VERTEX_SHADER);if(Q.shaderSource(e,zo),Q.compileShader(e),!Q.getShaderParameter(e,Q.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",Q.getShaderInfoLog(e)),null;const t=Q.createShader(Q.FRAGMENT_SHADER);if(Q.shaderSource(t,Vo),Q.compileShader(t),!Q.getShaderParameter(t,Q.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",Q.getShaderInfoLog(t)),null;if(ke=Q.createProgram(),Q.attachShader(ke,e),Q.attachShader(ke,t),Q.linkProgram(ke),!Q.getProgramParameter(ke,Q.LINK_STATUS))return console.error("[cairn] WebGL program link:",Q.getProgramInfoLog(ke)),null;_t=Q.createVertexArray(),Q.bindVertexArray(_t);const n=Q.createBuffer();Q.bindBuffer(Q.ARRAY_BUFFER,n),Q.bufferData(Q.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),Q.STATIC_DRAW);const r=Q.getAttribLocation(ke,"a_pos");return Q.enableVertexAttribArray(r),Q.vertexAttribPointer(r,2,Q.FLOAT,!1,0,0),Q.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),Q}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function On(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function Xo(e,t,n){const r=new Uint8Array(1024);for(let i=0;i<256;i++)r[i*4]=t[i*3],r[i*4+1]=t[i*3+1],r[i*4+2]=t[i*3+2],r[i*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function Ho(e,t,n,r){const o=$o();if(!o||!ke||!_t||!at)return null;const i=Math.min(e.width,t.width),s=Math.min(e.height,t.height);at.width=i,at.height=s,o.viewport(0,0,i,s);const l=On(o,e,0),c=On(o,t,1);let u=null;n.colormap?u=Xo(o,n.colormap,2):(u=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,u),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(ke),o.uniform1i(o.getUniformLocation(ke,"u_baseline"),0),o.uniform1i(o.getUniformLocation(ke,"u_other"),1),o.uniform1i(o.getUniformLocation(ke,"u_lut"),2),o.uniform1i(o.getUniformLocation(ke,"u_diff_mode"),Uo[n.diffMode]),o.uniform1i(o.getUniformLocation(ke,"u_cmap_mode"),Go[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(ke,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(_t),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=i,r.height=s;const p=r.getContext("2d");return p&&(p.save(),p.scale(1,-1),p.drawImage(at,0,0,i,s,0,-s,i,s),p.restore()),o.deleteTexture(l),o.deleteTexture(c),o.deleteTexture(u),{width:i,height:s}}const Wo="cairn:render-mode";function Yo(){try{const e=localStorage.getItem(Wo);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const Mt=15360;function St(e){const t=e&32768?-1:1,n=e>>10&31,r=e&1023;return n===0?r===0?t*0:t*r*2**-24:n===31?r===0?t*(1/0):NaN:t*2**(n-15)*(1+r/1024)}const In=globalThis.Float16Array;function Nn(e,t=e.length){if(In){const r=new In(e.buffer,e.byteOffset,t);return Float32Array.from(r)}const n=new Float32Array(t);for(let r=0;r<t;r++)n[r]=St(e[r]);return n}const Ke=new Uint32Array(512),qe=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(Ke[e]=0,Ke[e|256]=32768,qe[e]=24,qe[e|256]=24):t<-14?(Ke[e]=1024>>-t-14,Ke[e|256]=1024>>-t-14|32768,qe[e]=-t-1,qe[e|256]=-t-1):t<=15?(Ke[e]=t+15<<10,Ke[e|256]=t+15<<10|32768,qe[e]=13,qe[e|256]=13):t<128?(Ke[e]=31744,Ke[e|256]=64512,qe[e]=24,qe[e|256]=24):(Ke[e]=31744,Ke[e|256]=64512,qe[e]=13,qe[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var xt=Uint8Array,Fn=Uint16Array,Ko=Int32Array,qo=new xt([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),Zo=new xt([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),Un=function(e,t){for(var n=new Fn(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new Ko(n[30]),r=1;r<30;++r)for(var i=n[r];i<n[r+1];++i)o[i]=i-n[r]<<5|r;return{b:n,r:o}},Gn=Un(qo,2),Qo=Gn.b,jo=Gn.r;Qo[28]=258,jo[258]=28,Un(Zo,0);for(var Jo=new Fn(32768),he=0;he<32768;++he){var nt=(he&43690)>>1|(he&21845)<<1;nt=(nt&52428)>>2|(nt&13107)<<2,nt=(nt&61680)>>4|(nt&3855)<<4,Jo[he]=((nt&65280)>>8|(nt&255)<<8)>>1}for(var Tt=new xt(288),he=0;he<144;++he)Tt[he]=8;for(var he=144;he<256;++he)Tt[he]=9;for(var he=256;he<280;++he)Tt[he]=7;for(var he=280;he<288;++he)Tt[he]=8;for(var es=new xt(32),he=0;he<32;++he)es[he]=5;var ts=new xt(0),ns=typeof TextDecoder<"u"&&new TextDecoder,rs=0;try{ns.decode(ts,{stream:!0}),rs=1}catch{}const zn=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function Jt(e){const t=zn.length;return zn[(e%t+t)%t]}function os(e){const n=a.useRef(null),[r,o]=a.useState({w:0,h:0}),i=a.useRef(null),s=a.useRef(null),l=a.useRef(null),c=a.useCallback((u,p)=>{o(b=>b.w===u&&b.h===p?b:{w:u,h:p})},[]);return a.useLayoutEffect(()=>{const u=n.current;if(!u||u===l.current)return;const p=u.getBoundingClientRect();(p.width>0||p.height>0)&&(l.current=u,c(p.width,p.height))}),a.useEffect(()=>{var b;const u=n.current;if(u===s.current||((b=i.current)==null||b.disconnect(),i.current=null,s.current=u,!u))return;const p=new ResizeObserver(h=>{for(const v of h)c(v.contentRect.width,v.contentRect.height)});i.current=p,p.observe(u)}),a.useEffect(()=>()=>{var u;return(u=i.current)==null?void 0:u.disconnect()},[]),{ref:n,size:r}}function ss(){const[e,t]=a.useState(!1);return a.useEffect(()=>{const n=i=>{(i.key==="Alt"||i.key==="Control"||i.key==="Meta")&&t(!0)},r=i=>{(i.key==="Alt"||i.key==="Control"||i.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const is=.001;function as(e,t=is){return Math.exp(-e*t)}function Vn(e,t){return Math.hypot(e.x-t.x,e.y-t.y)}function $n(e,t){return{x:(e.x+t.x)/2,y:(e.y+t.y)/2}}function cs(e,t,n,r,o,i,s){const l=t>0&&r>0?r/t:1,c=Math.max(i,Math.min(s,e.zoom*l)),u=(n.x-e.pan.x)/e.zoom,p=(n.y-e.pan.y)/e.zoom;return{zoom:c,pan:{x:o.x-u*c,y:o.y-p*c}}}const ls=.25,en=64;function tn(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return en;const o=Math.min(n/e,r/t);return o<=0?en:Math.max(Math.max(n,r)/o,8)}function Xn(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:i=ls,maxZoom:s=en,naturalWidth:l,naturalHeight:c}=e,u=ss(),p=a.useRef(u);p.current=u;const b=a.useRef({zoom:n,pan:r});b.current={zoom:n,pan:r};const h=a.useRef(o);h.current=o,a.useEffect(()=>{const _=t.current;if(!_||!o)return;const M=P=>{var q;if(!P.ctrlKey&&!p.current)return;P.preventDefault(),P.stopPropagation();const k=as(P.deltaY),R=b.current,A=_.getBoundingClientRect(),V=l&&c?tn(l,c,A.width,A.height):s,L=Math.max(i,Math.min(V,R.zoom*k));if(R.zoom===L)return;const B=P.clientX-A.left,U=P.clientY-A.top,O=B-(B-R.pan.x)/R.zoom*L,ee=U-(U-R.pan.y)/R.zoom*L;(q=h.current)==null||q.call(h,{zoom:L,pan:{x:O,y:ee}})};return _.addEventListener("wheel",M,{passive:!1}),()=>_.removeEventListener("wheel",M)},[t,!!o,i,s,l,c]);const v=a.useRef(new Map),w=a.useRef(null),m=a.useRef(null),T=a.useCallback((_,M,P)=>{const k=_.getBoundingClientRect();return{x:M-k.left,y:P-k.top}},[]),g=a.useCallback(_=>{if(!l||!c)return s;const M=_.getBoundingClientRect();return tn(l,c,M.width,M.height)},[l,c,s]),d=a.useCallback((_,M)=>{const P=v.current,k=P.get(_),R=P.get(M);!k||!R||(w.current=null,m.current={idA:_,idB:M,startDist:Vn(k,R),startMid:$n(k,R),startZoom:b.current.zoom,startPan:{...b.current.pan}})},[]),y=a.useCallback(_=>{const M=v.current.get(_);M&&(w.current={pointerId:_,startX:M.x,startY:M.y,panX:b.current.pan.x,panY:b.current.pan.y})},[]),E=a.useCallback(_=>{if(!h.current)return;const M=_.pointerType==="touch";if(!M&&!p.current)return;const P=_.currentTarget;if(P.setPointerCapture(_.pointerId),v.current.set(_.pointerId,T(P,_.clientX,_.clientY)),M&&v.current.size>=2){const k=[...v.current.keys()];d(k[k.length-2],k[k.length-1]);return}y(_.pointerId)},[T,d,y]),S=a.useCallback(_=>{var A,V;const M=_.currentTarget,P=v.current.get(_.pointerId);if(P){const L=T(M,_.clientX,_.clientY);P.x=L.x,P.y=L.y}const k=m.current;if(k){const L=v.current.get(k.idA),B=v.current.get(k.idB);if(!L||!B)return;const U=cs({zoom:k.startZoom,pan:k.startPan},k.startDist,k.startMid,Vn(L,B),$n(L,B),i,g(M));(A=h.current)==null||A.call(h,U);return}const R=w.current;!R||R.pointerId!==_.pointerId||!P||(V=h.current)==null||V.call(h,{zoom:b.current.zoom,pan:{x:R.panX+(P.x-R.startX),y:R.panY+(P.y-R.startY)}})},[T,i,g]),x=a.useCallback(_=>{var P;try{_.currentTarget.releasePointerCapture(_.pointerId)}catch{}v.current.delete(_.pointerId);const M=m.current;if(M&&(_.pointerId===M.idA||_.pointerId===M.idB)){m.current=null;const k=[...v.current.keys()];k.length===1&&y(k[0]);return}((P=w.current)==null?void 0:P.pointerId)===_.pointerId&&(w.current=null)},[y]);return{containerProps:{onPointerDown:E,onPointerMove:S,onPointerUp:x,onPointerCancel:x,style:{cursor:u&&!!o?"move":void 0,touchAction:o?"none":void 0}},modifierActive:u}}function nn(){const[e,t]=a.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return a.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),i())};function i(){if(n)return;const s=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${s}dppx)`),r.addEventListener("change",o,{once:!0})}return i(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function ut(e){const t=a.useRef(e),[n,r]=a.useState(e),o=a.useCallback(()=>r(t.current),[]);return[n,r,{reset:o,isModified:!Object.is(n,t.current),default:t.current}]}function us(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function Hn(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function rn({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:i}=os(),s=a.useRef(null),l=a.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),c=a.useMemo(()=>{const m=i.w,T=i.h;if(m<=0||T<=0||n<=0||r<=0)return null;const g=Math.min(m/n,T/r),d=n*g,y=r*g;return{left:(m-d)/2,top:(T-y)/2,width:d,height:y}},[i.w,i.h,n,r]),u=e.masks,p=t.showMasks&&!!u&&u.length>0,b=a.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(a.useEffect(()=>{if(!p||!u)return;const m=s.current;if(!m)return;(m.width!==n||m.height!==r)&&(m.width=n,m.height=r);const T=m.getContext("2d");if(!T)return;T.clearRect(0,0,m.width,m.height);let g=!1;const d=T.createImageData(n,r),y=d.data;let E=u.length,S=!1;const x=()=>{g||S&&T.putImageData(d,0,0)},C=document.createElement("canvas");C.width=n,C.height=r;const _=C.getContext("2d",{willReadFrequently:!0});for(const M of u){const P=new Image;P.onload=()=>{if(!g){if(_){_.clearRect(0,0,n,r),_.drawImage(P,0,0,n,r);const k=_.getImageData(0,0,n,r).data;for(let R=0;R<n*r;R++){const A=k[R*4];if(A===0||l.has(A))continue;const[V,L,B]=us(Jt(A));y[R*4]=V,y[R*4+1]=L,y[R*4+2]=B,y[R*4+3]=255,S=!0}}E-=1,E===0&&x()}},P.onerror=()=>{E-=1,E===0&&x()},P.src=`data:image/png;base64,${M.png_b64}`}return()=>{g=!0}},[p,u,n,r,b]),!c)return f.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const h=e.boxes??[],v=t.showBoxes&&h.length>0,w=e.class_labels??{};return f.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[p&&f.jsx("canvas",{ref:s,className:"absolute",style:{left:c.left,top:c.top,width:c.width,height:c.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),v&&f.jsx("svg",{className:"absolute",style:{left:c.left,top:c.top,width:c.width,height:c.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:h.map((m,T)=>{if(!Hn(m,t,l))return null;const g=m.domain==="pixel"?1:n,d=m.domain==="pixel"?1:r,y=m.position.minX*g,E=m.position.minY*d,S=(m.position.maxX-m.position.minX)*g,x=(m.position.maxY-m.position.minY)*d;return f.jsx("rect",{x:y,y:E,width:S,height:x,fill:"none",stroke:Jt(m.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},T)})}),v&&f.jsx("div",{className:"absolute",style:{left:c.left,top:c.top,width:c.width,height:c.height},children:h.map((m,T)=>{if(!Hn(m,t,l))return null;const g=m.domain==="pixel"?1/n:1,d=m.domain==="pixel"?1/r:1,y=m.position.minX*g*100,E=m.position.minY*d*100,S=m.label??w[String(m.class_id)]??`#${m.class_id}`,x=m.score!=null?` ${(m.score*100).toFixed(0)}%`:"";return!S&&!x?null:f.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${y}%`,top:`${E}%`,transform:"translateY(-100%)",backgroundColor:Jt(m.class_id)},children:f.jsxs("span",{className:"mono",children:[S,x]})},T)})})]})}const on=30,Pt=["#ff5a5a","#39d353","#5b9bff"];function sn(e){if(!Number.isFinite(e))return"0";const t=Math.abs(e);return t!==0&&(t<.001||t>=1e4)?e.toExponential(1):String(Number(e.toPrecision(3)))}function ft(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):sn(e/255):sn(n==="int"?e*255:e)}function ct(e,t,n,r){return e.length===1?{lines:[ft(e[0],t,n)],luminance:r}:{lines:e.map(o=>ft(o,t,n)),luminance:r,colors:e.map((o,i)=>Pt[i]??null)}}const fs={x:0,y:0,w:1,h:1};function lt({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:i,notation:s="decimal",version:l=0,onActiveChange:c,sourceWindow:u=fs}){const p=a.useRef(null),b=a.useRef(!1),h=nn(),v=a.useRef(c);v.current=c;const w=a.useCallback(T=>{var g;T!==b.current&&(b.current=T,(g=v.current)==null||g.call(v,T))},[]),m=a.useCallback(()=>{var Fe;const T=p.current,g=e.current;if(!T)return;const d=window.devicePixelRatio||1,y=T.clientWidth,E=T.clientHeight;if(y===0||E===0)return;T.width!==Math.round(y*d)&&(T.width=Math.round(y*d)),T.height!==Math.round(E*d)&&(T.height=Math.round(E*d));const S=T.getContext("2d");if(!S)return;if(S.setTransform(d,0,0,d,0,0),S.clearRect(0,0,y,E),!g||t<=0||n<=0){w(!1);return}const x=g.getBoundingClientRect(),C=T.getBoundingClientRect();if(x.width===0||x.height===0){w(!1);return}const _=u.x*t,M=u.y*n,P=u.w*t,k=u.h*n;if(P<=0||k<=0){w(!1);return}const R=Math.min(x.width/P,x.height/k);if(R<on){w(!1);return}const A=P*R,V=k*R,L=x.left+(x.width-A)/2-C.left,B=x.top+(x.height-V)/2-C.top,U=Math.max(Math.floor(_),Math.floor(_+(0-L)/R)),O=Math.min(Math.ceil(_+P),Math.ceil(_+(y-L)/R)),ee=Math.max(Math.floor(M),Math.floor(M+(0-B)/R)),q=Math.min(Math.ceil(M+k),Math.ceil(M+(E-B)/R));if(O<=U||q<=ee){w(!1);return}w(!0);const ye=L+(0-_)*R,xe=B+(0-M)*R,ie=L+(t-_)*R,Ee=B+(n-M)*R;S.save(),S.beginPath(),S.rect(ye,xe,ie-ye,Ee-xe),S.clip(),S.textAlign="center",S.textBaseline="middle",S.lineJoin="round";const Te=R*.14,se=R-Te*2;for(let be=ee;be<q;be++)for(let ve=U;ve<O;ve++){if(ve<0||be<0||ve>=t||be>=n)continue;const W=i(ve,be,s);if(!W||W.lines.length===0)continue;const j=W.lines.length;let z=1;for(const Le of W.lines)Le.length>z&&(z=Le.length);const ue=se/(j*1.15),_e=se/(z*.62)||ue,ae=Math.min(ue,_e,24);if(ae<6)continue;const we=L+(ve-_+.5)*R,Pe=B+(be-M+.5)*R,Ce=ae*1.15,Ve=W.luminance<=.55,je=Ve?"#ffffff":"#000000";S.font=`${ae}px ui-monospace, SFMono-Regular, Menlo, monospace`,S.lineWidth=Math.max(1.4,ae*.16),S.strokeStyle=Ve?"rgba(0,0,0,0.85)":"rgba(255,255,255,0.9)";let ze=Pe-j*Ce/2+Ce/2;for(let Le=0;Le<W.lines.length;Le++){const N=W.lines[Le];S.strokeText(N,we,ze),S.fillStyle=((Fe=W.colors)==null?void 0:Fe[Le])??je,S.fillText(N,we,ze),ze+=Ce}}S.restore()},[e,t,n,i,s,w,u]);return a.useEffect(()=>{m()},[m,r,o.x,o.y,l,s,u,h]),a.useEffect(()=>{const T=p.current;if(!T)return;const g=new ResizeObserver(()=>m());return g.observe(T),()=>g.disconnect()},[m]),f.jsx("canvas",{ref:p,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function Wn({notation:e,onChange:t,className:n=""}){return f.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const ds=`
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

// Extended Reinhard white-point form: y = x*(1 + x/P^2)/(1 + x).
fn extendedReinhardCurve(x: f32, peak: f32) -> f32 {
  let v = max(x, 0.0);
  let p = max(peak, 1e-6);
  return (v * (1.0 + v / (p * p))) / (1.0 + v);
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
`,ps=`
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
`;function Yn(e){return`
${Ge}
${dt}
${ps}

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
`}const hs=Yn("select(colorB, colorA, uv.x < split)"),ms=Yn("mix(colorA, colorB, alpha)");function gs(e){switch(e){case"center":return{v:"center",h:"center"};case"top-right":return{v:"top",h:"right"};case"bottom-left":return{v:"bottom",h:"left"};case"bottom-right":return{v:"bottom",h:"right"};case"top-left":default:return{v:"top",h:"left"}}}function Kn(e,t,n){const{v:r,h:o}=gs(n),i=e.w-t.w,s=e.h-t.h,l=o==="left"?0:o==="right"?i:Math.floor(i/2),c=r==="top"?0:r==="bottom"?s:Math.floor(s/2);return{x:l,y:c}}function Rt(e,t,n,r,o="b"){if(r==="fill"){const s=o==="a"?{w:e.w,h:e.h}:{w:t.w,h:t.h};return{fit:r,result:s,offsetA:{x:0,y:0},offsetB:{x:0,y:0}}}const i={w:Math.min(e.w,t.w),h:Math.min(e.h,t.h)};return{fit:r,result:i,offsetA:Kn(e,i,n),offsetB:Kn(t,i,n)}}function xs(e){return`${e.fit}:${e.result.w}x${e.result.h}:${e.offsetA.x},${e.offsetA.y}:${e.offsetB.x},${e.offsetB.y}`}const an={linear:0,srgb:1,reinhard:2,aces:3,extended:4,"extended-reinhard":5,"extended-aces":6},qn=new WeakMap;function bs(e,t){let n=qn.get(e);n||(n=new Map,qn.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:ds,targetFormat:t}),n.set(t,r)),r}function Zn(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function Qn(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function vs(e,t,n,r){var T;const o=Zn(t),i=bs(e,o),s=Qn(e,r.isScalar?r.colormap:void 0),l=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,c=an[r.operator]??an.srgb,u=new Float32Array([r.exposureEV,c,l,r.isScalar?1:0]),p=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),b=new Float32Array([r.hdrOut?1:0]),h=new Float32Array([r.filter==="nearest"?0:1]),v=new Float32Array([r.offset??0]),w=new Float32Array([r.peak??yt]);let m;try{m=e.createBindGroup(i,[{binding:0,resource:n},{binding:1,resource:s},{binding:2,resource:{uniform:u}},{binding:3,resource:{uniform:p}},{binding:4,resource:{uniform:b}},{binding:5,resource:{uniform:h}},{binding:6,resource:{uniform:v}},{binding:7,resource:{uniform:w}}]),e.renderFullscreen(t,i,m)}finally{(T=m==null?void 0:m.destroy)==null||T.call(m),s.destroy()}}const jn=new WeakMap;function ws(e,t,n){let r=jn.get(e);r||(r=new Map,jn.set(e,r));const o=`${t}:${n}`;let i=r.get(o);return i||(i=e.createRenderPipeline({shaderWGSL:t==="split"?hs:ms,targetFormat:n}),r.set(o,i)),i}function ys(e,t,n,r,o){var m;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const i=Zn(t),s=ws(e,o.mode,i),l=Qn(e,void 0),c=o.gamma,u=an[o.operator],p=new Float32Array([o.exposureEV,u,c,0]),b=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),h=new Float32Array([o.split,o.alpha,0,o.filter==="nearest"?0:1]),v=new Float32Array([o.offset??0,0,0,0]);let w;try{w=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:l},{binding:3,resource:{uniform:p}},{binding:4,resource:{uniform:b}},{binding:5,resource:{uniform:h}},{binding:6,resource:{uniform:v}}]),e.renderFullscreen(t,s,w)}finally{(m=w==null?void 0:w.destroy)==null||m.call(w),l.destroy()}}function Jn(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,i=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:i,mae:o}}async function er(e,t,n,r){const o=r??Rt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),i=o.result.w,s=o.result.h,l=i*s*3;if(l<=0)return{mse:0,psnr:1/0,mae:0};if(o.fit==="crop"&&o.offsetA.x===0&&o.offsetA.y===0&&o.offsetB.x===0&&o.offsetB.y===0&&e.reduceDiffSumSquaredAbs){const{sumSq:y,sumAbs:E}=await e.reduceDiffSumSquaredAbs(t,n,i,s);return Jn(y,E,l)}const u=await e.readback(t),p=await e.readback(n),b=u instanceof Uint8Array?255:1,h=p instanceof Uint8Array?255:1,v=tr(u,t.width,t.height,b,o.offsetA,o.fit==="fill",i,s),w=tr(p,n.width,n.height,h,o.offsetB,o.fit==="fill",i,s);let m=0,T=0;const g=[0,0,0],d=[0,0,0];for(let y=0;y<s;y++)for(let E=0;E<i;E++){v(E,y,g),w(E,y,d);for(let S=0;S<3;S++){const x=g[S]-d[S];m+=x*x,T+=Math.abs(x)}}return Jn(m,T,l)}function tr(e,t,n,r,o,i,s,l){const c=(b,h,v)=>e[(h*t+b)*4+v]??0;if(!i)return(b,h,v)=>{const w=Math.min(Math.max(b+o.x,0),t-1),m=Math.min(Math.max(h+o.y,0),n-1);v[0]=c(w,m,0)/r,v[1]=c(w,m,1)/r,v[2]=c(w,m,2)/r};const u=t-1,p=n-1;return(b,h,v)=>{const w=(b+.5)/s,m=(h+.5)/l,T=w*t-.5,g=m*n-.5,d=Math.floor(T),y=Math.floor(g),E=T-d,S=g-y,x=Math.min(Math.max(d,0),u),C=Math.min(Math.max(d+1,0),u),_=Math.min(Math.max(y,0),p),M=Math.min(Math.max(y+1,0),p);for(let P=0;P<3;P++){const k=c(x,_,P),R=c(C,_,P),A=c(x,M,P),V=c(C,M,P),L=k+(R-k)*E,B=A+(V-A)*E;v[P]=(L+(B-L)*S)/r}}}function nr(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const Es=12,rt=[];function rr(e){const t=rt.indexOf(e);t!==-1&&rt.splice(t,1),rt.push(e)}function _s(e){const t=rt.indexOf(e);t!==-1&&rt.splice(t,1)}function Dt(e){e.parked||(_s(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),e.surface=null,e.parked=!0)}function or(e){for(;rt.length>Es;){const t=rt.find(n=>n!==e&&!n.visible)??rt.find(n=>n!==e);if(!t)break;Dt(t)}}function sr(e){var o,i,s,l;if(e.disposed)return;if(nr())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){rr(e),or(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||((i=e.deep)==null?void 0:i.width)||1,r=e.backingHeight||((s=e.source)==null?void 0:s.height)||((l=e.deep)==null?void 0:l.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.deep){const c=t.createTexture(e.deep.width,e.deep.height,"rgba16float");e.srcTexture=c,e.deepBuffers=t.createDeepSampleBuffers(e.deep),t.compositeDeep(e.deepBuffers,c,e.deepZClip)}else if(e.source){const c=t.createTexture(e.source.width,e.source.height,e.source.format);c.write(e.source.data),e.srcTexture=c}e.parked=!1,rr(e),or(e)}function Ms(e,t){if(e.disposed||!e.source&&!e.deep)return!0;try{return sr(e),!e.surface||!e.srcTexture?!1:(vs(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,Dt(e),!1}}function Ss(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,e.deep=null,e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},setDeepSource(t,n){if(!e.disposed&&(e.deep=t,e.deepZClip=n,e.source=null,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy(),e.deepBuffers&&e.deepBuffers.destroy();const r=e.device.createTexture(t.width,t.height,"rgba16float");e.srcTexture=r,e.deepBuffers=e.device.createDeepSampleBuffers(t),e.device.compositeDeep(e.deepBuffers,r,n)}},setDeepZClip(t){e.disposed||(e.deepZClip=t,!e.parked&&e.deepBuffers&&e.srcTexture&&e.device.compositeDeep(e.deepBuffers,e.srcTexture,t))},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return Ms(e,t)},park(){e.disposed||Dt(e)},restore(){e.disposed||!e.source&&!e.deep||sr(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(Dt(e),e.source=null,e.deep=null,e.disposed=!0)}}}async function Ts(e,t){const n=await wt(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,deep:null,deepZClip:0,deepBuffers:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return Ss(r)}function ir(e){e.dispose()}function Ps(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:i}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...i?["invert(1)"]:[]].join(" ")}function ar(e){const n=`cairn-gamma-${a.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:i,exposure:s,offset:l,flipSign:c}=e,u=a.useMemo(()=>Ps(e,n),[n,r,o,s,c]);return{gammaFilterId:n,filterStr:u,gamma:i,offset:l}}function cr({id:e,gamma:t,offset:n}){return f.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:f.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:f.jsxs("feComponentTransfer",{children:[f.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),f.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),f.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}function lr(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function As({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=lr(e),i=lr(t),s=[];for(let d=0;d<=e;d+=o)s.push(d);const l=[];for(let d=0;d<=t;d+=i)l.push(d);const c=1/n,u=8*c,p=-12*c,b=-2*c,h=r==null?void 0:r.current;let v=0,w=0,m=0,T=0;if(h){const d=h.clientWidth,y=h.clientHeight,E=d/e,S=y/t,x=Math.min(E,S);m=e*x,T=t*x,v=(d-m)/2,w=(y-T)/2}const g=h&&m>0;return f.jsxs(f.Fragment,{children:[f.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:g?w:0,transform:`translateY(${p}px)`,fontSize:u},children:s.map(d=>f.jsx("span",{className:"mono",style:{position:"absolute",left:g?v+d/e*m:`${d/e*100}%`,transform:"translateX(-50%)"},children:d},d))}),f.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:g?v:0,transform:`translateX(${b}px)`,fontSize:u},children:l.map(d=>f.jsx("span",{className:"mono",style:{position:"absolute",top:g?w+d/t*T:`${d/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*c}px`},children:d},d))})]})}function Cs({label:e,isDraggable:t,onDragStart:n}){return f.jsxs("span",{className:`absolute bottom-1 left-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${t?" cairn-drag-grip":""}`,draggable:t,onDragStart:n,style:{cursor:t?"grab":void 0},children:[t&&f.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const Rs=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function ur(e,t){const n=getComputedStyle(e),r=Rs.map(c=>`${c}:${n.getPropertyValue(c)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const i=e.children,s=t.children,l=Math.min(i.length,s.length);for(let c=0;c<l;c++)ur(i[c],s[c])}function cn(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function ln(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function un(e,t,n,r,o){const i=document.createElement("canvas");i.width=Math.max(1,Math.round(e*n)),i.height=Math.max(1,Math.round(t*n));const s=i.getContext("2d");if(!s)throw new Error("plot-to-png: 2D canvas context unavailable");return s.scale(n,n),r&&(s.fillStyle=r,s.fillRect(0,0,e,t)),o(s),await new Promise((l,c)=>i.toBlob(u=>u?l(u):c(new Error("plot-to-png: toBlob returned null")),"image/png"))}function Ds(e,t,n){const r=e.cloneNode(!0);ur(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),i="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((s,l)=>{const c=new Image;c.onload=()=>s(c),c.onerror=()=>l(new Error("plot-to-png: SVG rasterization failed")),c.src=i})}async function fr(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,i=(t==null?void 0:t.background)??cn(e);return un(r,o,ln(t),i,s=>s.drawImage(e,0,0,r,o))}async function ks(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,i=(t==null?void 0:t.background)??cn(e);try{return await un(r,o,ln(t),i,s=>s.drawImage(e,0,0,r,o))}catch(s){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${s instanceof Error?s.message:String(s)})`)}}function Ls(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const i=o.getBoundingClientRect(),s=i.width*i.height;s>r&&(r=s,n=o)}return n}async function Bs(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),i=o.width||300,s=o.height||150,l=(t==null?void 0:t.background)??cn(e);if(n){const u=n.getBoundingClientRect(),p=await Ds(n,u.width||i,u.height||s);return un(i,s,ln(t),l,b=>{for(const h of r){const v=h.getBoundingClientRect();b.drawImage(h,v.left-o.left,v.top-o.top,v.width,v.height)}b.drawImage(p,u.left-o.left,u.top-o.top,u.width,u.height)})}if(r.length)return fr(r[0],t);const c=Ls(e);if(c)return ks(c,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function Os(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const Is=8;function Ns(e,t,n,r=Is){return!(t>0)||!(e>0)?n:e<t+r}function dr(e,t){return Math.max(0,e.findIndex(n=>n.id===t))}function Fs(e){const t=e.trim();if(t==="")return null;const n=t.replace(/−/g,"-").replace(",","."),r=Number(n);return Number.isFinite(r)?r:null}function Us(e,t){const n=Fs(e);return n===null?t:n}function Gs(e){return String(e)}const zs={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},Vs={boxZoom:f.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:f.jsxs(f.Fragment,{children:[f.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),f.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),f.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),f.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 2v20M2 12h20"}),f.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),f.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),f.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:f.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:f.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),f.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:f.jsx("path",{d:"M6 9l6 6 6-6"}),ellipsis:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"5",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),f.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),f.jsx("circle",{cx:"19",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"})]}),sun:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"12",cy:"12",r:"4"}),f.jsx("path",{d:"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"})]}),plusminus:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M4 7h6M7 4v6"}),f.jsx("path",{d:"M14 17h6"}),f.jsx("path",{d:"M6 20l12-16"})]}),layers:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 3l9 5-9 5-9-5 9-5z"}),f.jsx("path",{d:"M3 13l9 5 9-5"})]})};function Je({name:e}){return f.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:Vs[e]??null})}function pr({icon:e,label:t,title:n,active:r,disabled:o,onClick:i}){return f.jsx("button",{type:"button",disabled:o,onClick:s=>{s.stopPropagation(),!o&&i()},onPointerDown:s=>s.stopPropagation(),onDoubleClick:s=>s.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?f.jsx("span",{"aria-hidden":"true",children:t}):f.jsx(Je,{name:e??""})})}function hr(){return f.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function $s({icon:e,title:t,menu:n}){var T;const{options:r,value:o,onSelect:i}=n,[s,l]=a.useState(!1),[c,u]=a.useState(0),p=a.useRef(null),b=dr(r,o),h=e?void 0:((T=r[b])==null?void 0:T.label)??"",v=a.useCallback(()=>{l(g=>{const d=!g;return d&&u(b),d})},[b]),w=a.useCallback(g=>{i(g),l(!1)},[i]);a.useEffect(()=>{if(!s)return;const g=y=>{p.current&&!p.current.contains(y.target)&&l(!1)},d=y=>{y.key==="Escape"&&(y.stopPropagation(),l(!1))};return document.addEventListener("pointerdown",g,!0),document.addEventListener("keydown",d,!0),()=>{document.removeEventListener("pointerdown",g,!0),document.removeEventListener("keydown",d,!0)}},[s]);const m=g=>{if(!s){(g.key==="ArrowDown"||g.key==="Enter"||g.key===" ")&&(g.preventDefault(),u(b),l(!0));return}if(g.key==="ArrowDown")g.preventDefault(),u(d=>(d+1)%r.length);else if(g.key==="ArrowUp")g.preventDefault(),u(d=>(d-1+r.length)%r.length);else if(g.key==="Enter"||g.key===" "){g.preventDefault();const d=r[c];d&&w(d.id)}};return f.jsxs("div",{ref:p,className:"relative inline-flex",onPointerDown:g=>g.stopPropagation(),children:[f.jsxs("button",{type:"button",onClick:g=>{g.stopPropagation(),v()},onDoubleClick:g=>g.stopPropagation(),onKeyDown:m,"aria-haspopup":"listbox","aria-expanded":s,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",h?"px-1.5 text-[10px] font-mono":"px-1 text-xs",s?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[h?f.jsx("span",{"aria-hidden":"true",children:h}):f.jsx(Je,{name:e??""}),f.jsx(Je,{name:"caret"})]}),s&&f.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((g,d)=>{const y=g.id===o,E=d===c;return f.jsx("li",{role:"option","aria-selected":y,children:f.jsx("button",{type:"button",onClick:S=>{S.stopPropagation(),w(g.id)},onPointerEnter:()=>u(d),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",E?"bg-bg-hover":"",y?"text-accent font-medium":"text-fg"].join(" "),children:g.label})},g.id)})})]})}const Xs=e=>e.format?e.format(e.value):String(e.value);function mr({spec:e}){const[t,n]=a.useState(!1),[r,o]=a.useState(""),i=a.useRef(null),s=a.useCallback(()=>{o(Gs(e.value)),n(!0)},[e.value]);a.useEffect(()=>{t&&i.current&&(i.current.focus(),i.current.select())},[t]);const l=a.useCallback(()=>{n(u=>(u&&e.onChange(Us(r,e.value)),!1))},[r,e]),c=a.useCallback(()=>n(!1),[]);return f.jsxs("label",{className:"inline-flex items-center gap-1 text-fg-muted",title:e.title,onPointerDown:u=>u.stopPropagation(),onDoubleClick:u=>{u.stopPropagation(),t||s()},children:[e.icon?f.jsx("span",{"aria-hidden":"true",className:"inline-flex",children:f.jsx(Je,{name:e.icon})}):f.jsx("span",{"aria-hidden":"true",className:"text-[9px] font-mono",children:e.label}),t?f.jsx("input",{ref:i,type:"text",inputMode:"decimal","aria-label":`${e.title} (numeric entry)`,value:r,onChange:u=>o(u.target.value),onPointerDown:u=>u.stopPropagation(),onDoubleClick:u=>u.stopPropagation(),onKeyDown:u=>{u.stopPropagation(),u.key==="Enter"?(u.preventDefault(),l()):u.key==="Escape"&&(u.preventDefault(),c())},onBlur:l,className:"cairn-plot-toolbar-slider-entry h-3.5 w-[6.5rem] rounded border border-border bg-bg px-1 text-[9px] font-mono tabular-nums text-fg outline-none focus:border-accent"}):f.jsxs(f.Fragment,{children:[f.jsx("input",{type:"range","aria-label":e.title,min:e.min,max:e.max,step:e.step,value:e.value,onChange:u=>e.onChange(Number(u.target.value)),onPointerDown:u=>u.stopPropagation(),className:"cairn-plot-toolbar-slider h-1 w-16 cursor-pointer accent-accent"}),f.jsx("span",{"aria-hidden":"true",className:"w-8 text-right text-[9px] font-mono tabular-nums",children:Xs(e)})]})]})}function Hs({icon:e,title:t,menu:n,onClose:r}){var b;const{options:o,value:i,onSelect:s}=n,[l,c]=a.useState(!1),u=dr(o,i),p=((b=o[u])==null?void 0:b.label)??"";return f.jsxs("div",{children:[f.jsxs("button",{type:"button","aria-haspopup":"menu","aria-expanded":l,"aria-label":t,onClick:h=>{h.stopPropagation(),c(v=>!v)},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",l?"text-accent":"text-fg hover:bg-bg-hover"].join(" "),children:[e?f.jsx(Je,{name:e}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{className:"flex-1",children:t}),f.jsx("span",{className:"font-mono text-[10px] text-fg-muted",children:p}),f.jsx("span",{className:l?"rotate-180 transition-transform":"transition-transform",children:f.jsx(Je,{name:"caret"})})]}),l&&o.map(h=>{const v=h.id===i;return f.jsxs("button",{type:"button",role:"menuitemradio","aria-checked":v,"data-menu-option":"",onClick:w=>{w.stopPropagation(),s(h.id),r()},className:["flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-[11px]",v?"text-accent font-medium bg-bg-hover/40":"text-fg hover:bg-bg-hover"].join(" "),children:[f.jsx("span",{"aria-hidden":"true",className:"w-3 text-center text-accent",children:v?"✓":""}),f.jsx("span",{children:h.label})]},h.id)})]})}function Ws({actions:e,leading:t,sliders:n}){const[r,o]=a.useState(!1),i=a.useRef(null);return a.useEffect(()=>{if(!r)return;const s=c=>{i.current&&!i.current.contains(c.target)&&o(!1)},l=c=>{c.key==="Escape"&&(c.stopPropagation(),o(!1))};return document.addEventListener("pointerdown",s,!0),document.addEventListener("keydown",l,!0),()=>{document.removeEventListener("pointerdown",s,!0),document.removeEventListener("keydown",l,!0)}},[r]),f.jsxs("div",{ref:i,className:"relative inline-flex",onPointerDown:s=>s.stopPropagation(),children:[f.jsx("button",{type:"button",onClick:s=>{s.stopPropagation(),o(l=>!l)},onDoubleClick:s=>s.stopPropagation(),"aria-haspopup":"menu","aria-expanded":r,"aria-label":"More controls",title:"More controls",className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded text-xs",r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:f.jsx(Je,{name:"ellipsis"})}),r&&f.jsxs("div",{role:"menu",className:["absolute right-0 top-full z-40 mt-1 min-w-[10rem] max-h-80 overflow-auto","rounded border border-border bg-bg-elevated py-1 shadow-md"].join(" "),children:[t.map(s=>s.menu?f.jsx(Hs,{icon:s.icon,title:s.title,menu:s.menu,onClose:()=>o(!1)},s.id):f.jsxs("button",{type:"button",disabled:s.disabled,onClick:l=>{var c;l.stopPropagation(),!s.disabled&&((c=s.onClick)==null||c.call(s),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?f.jsx(Je,{name:s.icon}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{children:s.label??s.title})]},s.id)),t.length>0&&e.length>0&&f.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),e.map(s=>f.jsxs("button",{type:"button",role:"menuitem",disabled:s.disabled,onClick:l=>{l.stopPropagation(),!s.disabled&&(s.onClick(),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?f.jsx(Je,{name:s.icon}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{children:s.title})]},s.id)),n.length>0&&(e.length>0||t.length>0)&&f.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),n.map(s=>f.jsx("div",{className:"px-2 py-1",children:f.jsx(mr,{spec:s})},s.id))]})]})}function Ys({controller:e,config:t}){var k,R;const n=a.useRef(null),[r,o]=a.useState(!1),i=a.useRef(r);i.current=r;const s=a.useRef(0),l=`${((k=t==null?void 0:t.leadingButtons)==null?void 0:k.length)??0}:${((R=t==null?void 0:t.sliders)==null?void 0:R.length)??0}:${(t==null?void 0:t.visibility)??"hover"}`;if(a.useEffect(()=>{const A=n.current,V=A==null?void 0:A.parentElement;if(!V)return;const L=()=>{const ee=V.clientWidth;if(!i.current&&n.current){const q=n.current.scrollWidth;q>0&&(s.current=q)}o(Ns(ee,s.current,i.current))};let B=0;const U=()=>{B||(B=requestAnimationFrame(()=>{B=0,L()}))},O=new ResizeObserver(U);return O.observe(V),L(),()=>{O.disconnect(),B&&cancelAnimationFrame(B)}},[l]),(t==null?void 0:t.enabled)===!1)return null;const c=e.capabilities,u=t==null?void 0:t.buttons,p=(A,V)=>V&&(u==null?void 0:u[A])!==!1,b=A=>()=>e.setDragMode(A),h=()=>{e.toPNG({filename:"plot"}).then(A=>Os(A,"plot.png")).catch(()=>{})},v=[];p("zoom",c.zoom)&&v.push({id:"zoom",icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:b("zoom")}),p("pan",c.pan)&&v.push({id:"pan",icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:b("pan")}),p("select",c.select)&&v.push({id:"select",icon:"select",title:"Box select",active:e.dragMode==="select",onClick:b("select")}),p("lasso",c.lasso)&&v.push({id:"lasso",icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:b("lasso")});const w=[];p("zoomIn",c.zoom)&&w.push({id:"zoomIn",icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),p("zoomOut",c.zoom)&&w.push({id:"zoomOut",icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()});const m=[];p("autoscale",c.autoscale)&&m.push({id:"autoscale",icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),p("reset",c.reset)&&m.push({id:"reset",icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()});const T=[];p("screenshot",c.screenshot)&&T.push({id:"screenshot",icon:"camera",title:"Download plot as PNG",onClick:h});const g=[v,w,m,T].filter(A=>A.length>0),d=g.flat(),y=(t==null?void 0:t.leadingButtons)??[],E=(t==null?void 0:t.sliders)??[];if(!y.length&&d.length===0&&E.length===0)return null;const S=(t==null?void 0:t.position)??"top-right",x=(t==null?void 0:t.visibility)==="always",C=S==="top-right"||S==="bottom-right",M=["cairn-plot-toolbar z-30 rounded border border-border bg-bg-elevated/90 shadow-sm backdrop-blur-sm transition-opacity",x?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),P={position:"absolute",pointerEvents:"auto",...zs[S]};return r?f.jsx("div",{ref:n,style:P,className:`${M} inline-flex px-0.5 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:f.jsx(Ws,{actions:d,leading:y,sliders:E})}):f.jsxs("div",{ref:n,style:P,className:`${M} flex flex-col gap-0.5 px-1 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:[f.jsxs("div",{className:`flex items-center gap-0.5 ${C?"justify-end":"justify-start"}`,children:[y.length>0&&f.jsxs(f.Fragment,{children:[y.map(A=>A.menu?f.jsx($s,{icon:A.icon,title:A.title,menu:A.menu},A.id):f.jsx(pr,{icon:A.icon,label:A.label,title:A.title,active:A.active,disabled:A.disabled,onClick:A.onClick??(()=>{})},A.id)),g.length>0&&f.jsx(hr,{})]}),g.map((A,V)=>f.jsxs("span",{className:"inline-flex items-center gap-0.5",children:[V>0&&f.jsx(hr,{}),A.map(L=>f.jsx(pr,{icon:L.icon,title:L.title,active:L.active,disabled:L.disabled,onClick:L.onClick},L.id))]},A[0].id))]}),E.length>0&&f.jsx("div",{className:`flex items-center gap-2 ${C?"justify-end":"justify-start"}`,children:E.map(A=>f.jsx(mr,{spec:A},A.id))})]})}const Ks={zoom:1,pan:{x:0,y:0}},gr=1.3,qs=.25,Zs=64,Qs={buttons:{zoom:!1}};function js(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const Js=[{id:"none",label:"None"},{id:"viridis",label:"Viridis"},{id:"plasma",label:"Plasma"},{id:"magma",label:"Magma"},{id:"red-green",label:"Red–Green"},{id:"red-blue",label:"Red–Blue"}];function fn(e,t){return{id:"colormap",title:"Colormap",menu:{options:Js,value:e,onSelect:t}}}const xr=[{id:"linear",label:"Linear"},{id:"srgb",label:"sRGB"},{id:"reinhard",label:"Reinhard"},{id:"aces",label:"ACES"}],ei=[{id:"extended",label:"Extended · Linear"},{id:"extended-reinhard",label:"Extended · Reinhard"},{id:"extended-aces",label:"Extended · ACES"}];function br(e,t,n){return{id:"tonemap",title:"Tone-mapping operator",menu:{options:n?[...xr,...ei]:xr,value:e,onSelect:t}}}function ti({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:i,naturalHeight:s,minZoom:l=qs,maxZoom:c=Zs,requestRender:u,onReset:p,extraModified:b=!1}){const h=a.useCallback(x=>{var B;if(!o)return;const C=(B=e.current)==null?void 0:B.getBoundingClientRect(),_=(C==null?void 0:C.width)??0,M=(C==null?void 0:C.height)??0,P=i&&s&&_>0&&M>0?tn(i,s,_,M):c,k=Math.max(l,Math.min(P,n*x));if(k===n)return;const R=_/2,A=M/2,V=R-(R-r.x)/n*k,L=A-(A-r.y)/n*k;o({zoom:k,pan:{x:V,y:L}})},[o,e,i,s,c,l,n,r.x,r.y]),v=a.useCallback(()=>h(gr),[h]),w=a.useCallback(()=>h(1/gr),[h]),m=a.useCallback(()=>{o==null||o(Ks),p==null||p()},[o,p]),T=a.useCallback(x=>{const C={scale:x==null?void 0:x.scale,filename:x==null?void 0:x.filename};u==null||u();const _=t==null?void 0:t.current;if(_)return fr(_,C);const M=e.current;return M?Bs(M,C):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,u]),g=a.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),d=n!==1||r.x!==0||r.y!==0||b,y=a.useCallback(x=>{},[]),E=a.useCallback(x=>{},[]),S=a.useCallback(()=>{},[]);return a.useMemo(()=>({capabilities:g,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:d,setDragMode:y,setHoverMode:E,toggleSpikelines:S,zoomIn:v,zoomOut:w,autoscale:m,reset:m,toPNG:T}),[g,d,y,E,S,v,w,m,T])}const ni={zoom:1,pan:{x:0,y:0}};function kt({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:i,pan:s,onViewportChange:l,naturalDims:c,checkerboard:u,wrapperClassName:p,wrapperStyle:b,viewportPadding:h,header:v,surface:w,showAxes:m,overlayNode:T,overlay:g,notationSeed:d,exportCanvasRef:y,requestRender:E,leadingMenus:S,displayAdjust:x,depthSlider:C,extraSliders:_,onReset:M,extraModified:P,label:k,showLabelChip:R,isDraggable:A=!1,onDragStart:V,extraChips:L}){const[B,U]=a.useState(d),[O,ee]=a.useState(!1),{containerProps:q}=Xn({containerRef:r,zoom:i,pan:s,onViewportChange:l,naturalWidth:c==null?void 0:c.w,naturalHeight:c==null?void 0:c.h}),ye=a.useCallback(()=>{x==null||x.onExposureChange(0),x==null||x.onOffsetChange(0),M==null||M()},[x,M]),xe=a.useCallback(()=>{l==null||l(ni),ye()},[l,ye]),ie=ti({rootRef:r,canvasRef:y,zoom:i,pan:s,onViewportChange:l,naturalWidth:c==null?void 0:c.w,naturalHeight:c==null?void 0:c.h,requestRender:E,onReset:ye,extraModified:((x==null?void 0:x.exposureEV)??0)!==0||((x==null?void 0:x.offset)??0)!==0||!!P}),Ee=a.useMemo(()=>{const W=[];if(C&&W.push(C),!x)return _&&W.push(..._),W.length?W:void 0;const j=(z,ue)=>`${z>=0?"+":"−"}${Math.abs(z).toFixed(ue)}`;return W.push({id:"exposure",icon:"sun",label:"EV",title:"Exposure (EV stops) — color × 2^EV. Double-click to type a value (may exceed the slider range).",min:-8,max:8,step:.1,value:x.exposureEV,onChange:x.onExposureChange,format:z=>j(z,1)},{id:"offset",icon:"plusminus",label:"OFF",title:"Offset — added after exposure (before tonemap). Double-click to type a value (may exceed the slider range).",min:-1,max:1,step:.01,value:x.offset,onChange:x.onOffsetChange,format:z=>j(z,2)}),_&&W.push(..._),W},[x,C,_]),Te=a.useMemo(()=>({...Qs,leadingButtons:[...S??[],...O?[js(B,U)]:[]],sliders:Ee}),[O,B,S,Ee]),se=" cairn-checkerboard",Fe="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(u==="pane"?se:""),be=p+(u==="wrapper"?se:""),ve="render"in g?g.render({notation:B,setOverlayActive:ee}):g.hasSource&&c?f.jsx(lt,{imageElRef:g.displayElRef,naturalWidth:c.w,naturalHeight:c.h,zoom:i,pan:s,sourceWindow:g.sourceWindow,sample:g.sample,notation:B,version:g.version,onActiveChange:ee}):null;return f.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[v,n&&f.jsx(Ys,{controller:ie,config:Te}),f.jsxs("div",{ref:r,className:Fe,style:{padding:h,...q.style},onPointerDown:q.onPointerDown,onPointerMove:q.onPointerMove,onPointerUp:q.onPointerUp,onPointerCancel:q.onPointerCancel,onDoubleClick:xe,...t,children:[f.jsxs("div",{ref:o,className:be,style:b,children:[w,m&&c&&f.jsx(As,{naturalWidth:c.w,naturalHeight:c.h,zoom:i,containerRef:o}),T]}),ve,!n&&O&&f.jsx(Wn,{notation:B,onChange:U})]}),R&&f.jsx(Cs,{label:k,isDraggable:A,onDragStart:V}),L]})}const vr={inFlight:!1,pending:null};function ri(e,t){return e.inFlight?{state:{inFlight:!0,pending:t},launch:null}:{state:{inFlight:!0,pending:null},launch:t}}function oi(e){return e.pending!=null?{state:{inFlight:!0,pending:null},launch:e.pending}:{state:vr,launch:null}}const si=1e3,ii=typeof requestAnimationFrame=="function"?e=>requestAnimationFrame(()=>e()):e=>setTimeout(e,0),wr=typeof cancelAnimationFrame=="function"?cancelAnimationFrame:e=>clearTimeout(e);function yr(e,t){const n=e.deep,r=(n==null?void 0:n.zMin)??0,o=(n==null?void 0:n.zMax)??0,i=t!=null,[s,l,c]=ut(o),[u,p]=a.useState(null),b=a.useRef(n);b.current=n;const h=a.useRef(o);h.current=o;const v=a.useRef(s),w=a.useRef(vr),m=a.useRef(null),T=a.useCallback(x=>{const C=b.current;if(!C)return;const _=()=>{const M=oi(w.current);w.current=M.state,M.launch!=null&&T(M.launch)};C.flatten(x).then(M=>{v.current===x&&x<h.current&&(m.current!=null&&wr(m.current),m.current=ii(()=>{m.current=null,p(M)})),_()}).catch(_)},[]),g=a.useCallback(x=>{const C=ri(w.current,x);w.current=C.state,C.launch!=null&&T(C.launch)},[T]);a.useEffect(()=>()=>{m.current!=null&&wr(m.current),n==null||n.dispose()},[n]),a.useEffect(()=>{if(n){if(v.current=s,i){t(s);return}if(s>=o){p(null);return}g(s)}},[n,s,o,g,i,t]);const d=a.useMemo(()=>n&&!i&&u!=null?{...e,data:u}:e,[e,n,i,u]),y=n!=null&&r>0&&o/r>si,E=a.useMemo(()=>{if(!n||!(o>r))return;const x=C=>Math.abs(C)>=1e3||Math.abs(C)<.01?C.toExponential(2):C.toFixed(3);if(y){const C=Math.log10(r),_=Math.log10(o);return{id:"depth",icon:"layers",label:"Z",title:"Depth cutoff — composite only samples with Z ≤ this (log scale). Double-click to type a Z.",min:C,max:_,step:(_-C)/200,value:Math.log10(Math.max(r,Math.min(s,o))),onChange:M=>l(10**M),format:M=>x(10**M)}}return{id:"depth",icon:"layers",label:"Z",title:"Depth cutoff — composite only samples with Z ≤ this. Double-click to type a Z.",min:r,max:o,step:(o-r)/200,value:s,onChange:C=>l(C),format:C=>x(C)}},[n,r,o,s,y,l]),S=a.useCallback(()=>{c.reset(),p(null)},[c]);return{hdr:d,slider:E,reset:S,isModified:c.isModified}}function Er(e){return"hdr"in e&&e.hdr!=null}function _r(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function Re(e){return Number.isFinite(e)?e:0}const ai={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function ci(e,t,n,r,o=0){const{h:i,w:s,c:l}=_r(e.shape),c=e.precision==="f16-bits"?Nn(e.data):e.data,u=ko(t),p=new Uint8ClampedArray(s*i*4);for(let b=0;b<s*i;b++){const h=b*l;let v,w,m,T=1;l===1?v=w=m=Re(c[h]):l===3?(v=Re(c[h]),w=Re(c[h+1]),m=Re(c[h+2])):(v=Re(c[h]),w=Re(c[h+1]),m=Re(c[h+2]),T=Re(c[h+3]));const g=[Et(v,n,o),Et(w,n,o),Et(m,n,o)],[d,y,E]=u(g),S=b*4;p[S]=255*Kt(d,r),p[S+1]=255*Kt(y,r),p[S+2]=255*Kt(E,r),p[S+3]=255*(T<0?0:T>1?1:T)}return new ImageData(p,s,i)}function li(e){var ze,Le;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:i="auto",colormap:s="none",showAxes:l=!1,processing:c=ai,zoom:u=1,pan:p={x:0,y:0},onViewportChange:b,onNaturalSize:h,label:v,isDraggable:w=!1,onDragStart:m,overlay:T,overlaySettings:g,pixelValueNotation:d="decimal",toolbar:y=!0}=e,[E,S,x]=ut(s);a.useEffect(()=>{S(s)},[s,S]);const C=a.useRef(null),_=a.useRef(null),M=a.useRef(null),P=a.useRef(null),k=a.useRef(null),R=a.useRef(null),A=a.useRef(null),[V,L]=a.useState(0),B=a.useCallback(()=>L(N=>N+1),[]),U=a.useMemo(()=>({get current(){const N=k.current;return N instanceof HTMLCanvasElement?N:null}}),[]),O=a.useCallback(N=>{C.current=N,N&&(k.current=N)},[]),ee=a.useCallback(N=>{_.current=N,N&&(k.current=N)},[]),q=a.useCallback(N=>{N&&(k.current=N)},[]),[ye,xe]=a.useState(!1),[ie,Ee]=a.useState(!1),[Te,se]=a.useState(null),{flipSign:Fe}=c,{gammaFilterId:be,filterStr:ve,gamma:W,offset:j}=ar(c),z=!r&&o!=="none"&&n!=null&&t!=null,ue=o!=="none"&&n!=null,_e=E!=="none"&&!z&&!(r&&ue)&&t!=null;a.useEffect(()=>{if(!_e||!t){Ee(!1);return}let N=!1;Ee(!1);const ce=`${t}::${E}`,Me=Qt(ce);if(Me){const ne=_.current;if(ne){ne.width=Me.width,ne.height=Me.height;const fe=ne.getContext("2d");fe&&fe.putImageData(Me,0,0),A.current=Me,B(),se({w:Me.width,h:Me.height}),h==null||h(Me.width,Me.height),Ee(!0)}return}const de=new Image;return de.onload=()=>{if(N)return;const ne=document.createElement("canvas");ne.width=de.naturalWidth,ne.height=de.naturalHeight;const fe=ne.getContext("2d");if(!fe)return;fe.drawImage(de,0,0);const Be=fe.getImageData(0,0,ne.width,ne.height),Ue=Zt(E),me=qt(Be,E,Ue);jt(ce,me);const Ae=_.current;if(!Ae||N)return;Ae.width=me.width,Ae.height=me.height;const ge=Ae.getContext("2d");ge&&ge.putImageData(me,0,0),A.current=me,B(),se({w:me.width,h:me.height}),h==null||h(me.width,me.height),Ee(!0)},de.src=t,()=>{N=!0}},[_e,t,E]);const ae=a.useCallback((N,ce)=>{se(Me=>Me&&Me.w===N&&Me.h===ce?Me:{w:N,h:ce}),h==null||h(N,ce)},[]);a.useEffect(()=>{if(!t){R.current=null,A.current=null,B();return}let N=!1;return it(t).then(ce=>{N||(R.current=ce,E==="none"&&(A.current=ce),B())}),()=>{N=!0}},[t,E,B]);const we=a.useCallback((N,ce,Me)=>{const de=R.current;if(!de||N<0||ce<0||N>=de.width||ce>=de.height)return null;const ne=(ce*de.width+N)*4,fe=de.data[ne],Be=de.data[ne+1],Ue=de.data[ne+2],me=A.current;let Ae=fe,ge=Be,G=Ue;if(me&&me.width===de.width&&me.height===de.height){const I=(ce*me.width+N)*4;Ae=me.data[I],ge=me.data[I+1],G=me.data[I+2]}const $=(.299*Ae+.587*ge+.114*G)/255;return ct(E!=="none"||fe===Be&&Be===Ue?[fe]:[fe,Be,Ue],"uint8",Me,$)},[E]);a.useEffect(()=>{if(!z){xe(!1);return}let N=!1;const ce=Yo(),Me=ce==="gpu"||ce==="auto",de=`${n}::${t}::${o}::${E}`;if(ce!=="gpu"){const ne=Qt(de);if(ne){const fe=C.current;if(fe){(fe.width!==ne.width||fe.height!==ne.height)&&(fe.width=ne.width,fe.height=ne.height);const Be=fe.getContext("2d");Be&&Be.putImageData(ne,0,0),ae(ne.width,ne.height),xe(!0)}return}}return(async()=>{const[ne,fe]=await Promise.all([it(n),it(t)]);if(N||!ne||!fe)return;const Ue=o.includes("signed")?"signed":"positive",me=E!=="none"?Xt(E):null,Ae={diffMode:o,colormap:me,cmapMode:Ue};if(Me)try{const Z=C.current;if(Z){const I=Ho(ne,fe,Ae,Z);if(I){if(N)return;ae(I.width,I.height),xe(!0);return}}}catch(Z){console.warn("[cairn] WebGL 2 diff error:",Z)}if(ce==="gpu"){console.error("[cairn] WebGL 2 unavailable — set render mode to 'Auto' or 'CPU'");return}let ge=Fo(ne,fe,o);E!=="none"&&(ge=qt(ge,E,Ue)),jt(de,ge);const G=C.current;if(!G||N)return;(G.width!==ge.width||G.height!==ge.height)&&(G.width=ge.width,G.height=ge.height);const $=G.getContext("2d");$&&$.putImageData(ge,0,0),ae(ge.width,ge.height),xe(!0)})(),()=>{N=!0}},[n,t,o,z,E,h]);const Pe=i==="auto"?void 0:i,Ce=Fe?{filter:"invert(1)"}:{},Ve=T&&(g!=null&&g.enabled)&&Te&&t&&((((ze=T.boxes)==null?void 0:ze.length)??0)>0||(((Le=T.masks)==null?void 0:Le.length)??0)>0)?f.jsx(rn,{data:T,settings:g,naturalWidth:Te.w,naturalHeight:Te.h}):void 0,je=t?z?f.jsxs(f.Fragment,{children:[!ye&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),f.jsx("canvas",{ref:O,className:"w-full h-full object-contain block",style:{display:ye?"block":"none",imageRendering:Pe,...Ce}})]}):_e?f.jsxs(f.Fragment,{children:[!ie&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),f.jsx("canvas",{ref:ee,className:"w-full h-full object-contain block",style:{display:ie?"block":"none",imageRendering:Pe,...Ce}})]}):f.jsx("img",{ref:q,src:t,alt:v,className:"w-full h-full object-contain block",draggable:!1,style:{filter:ve,imageRendering:Pe},onLoad:N=>{const ce=N.currentTarget;se({w:ce.naturalWidth,h:ce.naturalHeight}),h==null||h(ce.naturalWidth,ce.naturalHeight)}}):f.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return f.jsx(kt,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:y,paneRef:M,wrapperRef:P,zoom:u,pan:p,onViewportChange:b,naturalDims:Te,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${p.x}px, ${p.y}px) scale(${u})`,transformOrigin:"0 0"},viewportPadding:l&&Te?"16px 4px 4px 28px":"4px",header:f.jsx(cr,{id:be,gamma:W,offset:j}),surface:je,showAxes:l,overlayNode:Ve,overlay:{displayElRef:k,sample:we,version:V,hasSource:!!t},notationSeed:d,exportCanvasRef:U,leadingMenus:[fn(E,N=>S(N))],onReset:x.reset,extraModified:x.isModified,label:v,showLabelChip:!0,isDraggable:w,onDragStart:m})}function ui(e){const{tonemap:t="srgb",exposure:n=0,gamma:r,showAxes:o=!1,label:i="",interpolation:s="auto",zoom:l=1,pan:c={x:0,y:0},onViewportChange:u,pixelValueNotation:p="decimal",toolbar:b=!0}=e,h=yr(e.hdr),v=h.hdr,[w,m,T]=ut(Yt(t));a.useEffect(()=>{m(Yt(t))},[t,m]);const g=a.useRef(null),d=a.useRef(null),y=a.useRef(null),[E,S]=a.useState(null),x=a.useRef(null),[C,_]=a.useState(0),[M,P]=a.useState(0),[k,R]=a.useState(0);a.useEffect(()=>{const L=g.current;if(!L)return;let B;try{B=ci(v,w,n+M,r,k)}catch(O){console.error("[cairn] HDR tone-map error:",O);return}(L.width!==B.width||L.height!==B.height)&&(L.width=B.width,L.height=B.height);const U=L.getContext("2d");U&&(U.putImageData(B,0,0),x.current=B,_(O=>O+1),S(O=>O&&O.w===B.width&&O.h===B.height?O:{w:B.width,h:B.height}))},[v,w,n,r,M,k]);const A=a.useCallback((L,B,U)=>{const O=E;if(!O||L<0||B<0||L>=O.w||B>=O.h)return null;const ee=v.shape.length===2?1:v.shape[2]??1,q=(B*O.w+L)*ee,ye=v.data,xe=v.precision==="f16-bits"?se=>St(ye[se]??0):se=>ye[se]??0,ie=x.current;let Ee=.5;if(ie&&ie.width===O.w&&ie.height===O.h){const se=(B*O.w+L)*4;Ee=(.299*ie.data[se]+.587*ie.data[se+1]+.114*ie.data[se+2])/255}const Te=ee===1?[xe(q)]:[xe(q),xe(q+1),xe(q+2)];return ct(Te,"unit",U,Ee)},[v,E]),V=s==="auto"?void 0:s;return f.jsx(kt,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:b,paneRef:d,wrapperRef:y,zoom:l,pan:c,onViewportChange:u,naturalDims:E,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${c.x}px, ${c.y}px) scale(${l})`,transformOrigin:"0 0"},viewportPadding:o&&E?"16px 4px 4px 28px":"4px",surface:f.jsx("canvas",{ref:g,className:"w-full h-full object-contain block",style:{imageRendering:V}}),showAxes:o,overlay:{displayElRef:g,sample:A,version:C,hasSource:!0},notationSeed:p,exportCanvasRef:g,leadingMenus:[br(w,L=>m(L),!1)],displayAdjust:{exposureEV:M,offset:k,onExposureChange:P,onOffsetChange:R},depthSlider:h.slider,onReset:()=>{h.reset(),T.reset()},extraModified:h.isModified||T.isModified,label:i,showLabelChip:!!i})}function dn(e){return Er(e)?f.jsx(ui,{...e}):f.jsx(li,{...e})}const Mr={"no-webgpu":0,"no-hdr-browser":1,"no-hdr-display":2},fi="https://github.com/doeringchristian/cairn-plot/blob/main/docs/browser-support.md";function di(e,t=!1){const n=e||"";return t?"brave":/firefox/i.test(n)?"firefox":/safari/i.test(n)&&!/chrome|chromium|crios|android/i.test(n)?"safari":/linux/i.test(n)&&/chrome|chromium/i.test(n)?"chromium-linux":"chromium"}function pi(e){const t=e||"";return/mac os x|macintosh/i.test(t)?"macos":/windows/i.test(t)?"windows":"other"}function hi(e,t){if(e==="no-hdr-display")switch(pi(t.userAgent)){case"macos":return"macOS: EDR engages automatically on HDR-capable displays — confirm your display supports HDR.";case"windows":return"Windows: turn on Settings → System → Display → Use HDR.";default:return"Enable HDR in your display and OS settings."}const n=di(t.userAgent,t.isBrave);if(e==="no-hdr-browser")switch(n){case"firefox":return"Firefox has no extended-tone-mapping canvas path at all — true HDR output is impossible until Firefox implements it (fundamental browser limitation).";case"safari":return"Safari's WebGPU HDR canvas tone-mapping is still maturing — update to the latest Safari 26+.";default:return"Chrome/Edge 129+ is required for HDR canvas output (toneMapping: extended) — update your browser."}switch(n){case"firefox":return"Firefox: about:config → dom.webgpu.enabled (HDR output is not available in Firefox at all — browser limitation).";case"safari":return"Safari: Develop → Feature Flags → WebGPU (Safari 26+ has it by default).";case"brave":return"Brave: check Shields fingerprint blocking + brave://flags.";case"chromium-linux":return"Chromium on Linux: enable chrome://flags/#enable-unsafe-webgpu.";case"chromium":default:return"Chrome/Edge: enable chrome://flags/#enable-unsafe-webgpu and hardware acceleration."}}function mi(e){switch(e){case"no-webgpu":return"GPU renderer unavailable → CPU fallback active; FLIP kernels + HDR compare disabled.";case"no-hdr-browser":return"True HDR output is unsupported by this browser — a fundamental browser limitation, not a cairn-plot bug → HDR images tone-mapped to SDR.";case"no-hdr-display":return"Your display/OS is not in HDR mode → HDR images tone-mapped to SDR."}}function Sr(e,t){return`cairn-plot:capnotice:${e}:${t}`}const Tr=new Set;function Pr(e){try{if(window.localStorage.getItem(e)==="1")return!0}catch{}try{if(window.sessionStorage.getItem(e)==="1")return!0}catch{}return Tr.has(e)}function gi(e){try{window.localStorage.setItem(e,"1");return}catch{}try{window.sessionStorage.setItem(e,"1");return}catch{}Tr.add(e)}const Ar=new Set;let Lt=null,pt=null;function Cr(){pt&&pt.parentNode&&pt.parentNode.removeChild(pt),pt=null,Lt=null}function xi(e){const t=Sr(e,window.location.pathname),n=hi(e,{userAgent:navigator.userAgent,isBrave:!!navigator.brave}),r=document.createElement("div");r.setAttribute("role","status"),r.setAttribute("data-cairn-plot-capnotice",e),Object.assign(r.style,{position:"fixed",bottom:"12px",right:"12px",zIndex:"2147483000",maxWidth:"340px",boxSizing:"border-box",padding:"10px 30px 10px 12px",borderRadius:"6px",border:"1px solid var(--color-border, #d0d7de)",background:"rgb(var(--color-bg-elevated-rgb, 246 248 250) / 0.9)",color:"var(--color-fg-muted, #656d76)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",boxShadow:"0 4px 12px rgba(0, 0, 0, 0.18)",font:"12px/1.4 system-ui, sans-serif"});const o=document.createElement("div");o.textContent=mi(e),Object.assign(o.style,{fontWeight:"600",color:"var(--color-fg, #1f2328)",marginBottom:"4px"});const i=document.createElement("div");i.textContent=n,i.style.marginBottom="4px";const s=document.createElement("a");s.href=fi,s.target="_blank",s.rel="noopener noreferrer",s.textContent="Learn more",Object.assign(s.style,{color:"var(--color-accent, #0969da)",textDecoration:"none"});const l=document.createElement("button");l.type="button",l.textContent="×",l.setAttribute("aria-label","Dismiss browser capability notice"),l.title="Dismiss",Object.assign(l.style,{position:"absolute",top:"4px",right:"6px",padding:"0 4px",border:"0",background:"transparent",color:"var(--color-fg-subtle, #8b949e)",cursor:"pointer",fontSize:"16px",lineHeight:"1"}),l.addEventListener("click",()=>{gi(t),Cr()}),r.appendChild(o),r.appendChild(i),r.appendChild(s),r.appendChild(l),document.body.appendChild(r),pt=r,Lt=e}function Rr(e){if(typeof document>"u"||typeof window>"u"||Ar.has(e))return;Ar.add(e);const t=Sr(e,window.location.pathname);if(Pr(t))return;const n=()=>{if(!Pr(t)){if(Lt!==null)if(Mr[e]<Mr[Lt])Cr();else return;xi(e)}};document.body?n():window.addEventListener("DOMContentLoaded",n,{once:!0})}const bi={data:new Float32Array(0),shape:[0,0],dtype:"<f4"};function vi(e){const{h:t,w:n,c:r}=_r(e.shape);if(e.precision==="f16-bits"){const s=e.data,l=new Uint16Array(n*t*4);for(let c=0;c<n*t;c++){const u=c*r,p=c*4;if(r===1){const b=s[u];l[p]=b,l[p+1]=b,l[p+2]=b,l[p+3]=Mt}else l[p]=s[u],l[p+1]=s[u+1],l[p+2]=s[u+2],l[p+3]=r>=4?s[u+3]:Mt}return{data:l,width:n,height:t,format:"rgba16float"}}const o=e.data,i=new Float32Array(n*t*4);for(let s=0;s<n*t;s++){const l=s*r;let c,u,p,b=1;r===1?c=u=p=Re(o[l]):r===3?(c=Re(o[l]),u=Re(o[l+1]),p=Re(o[l+2])):(c=Re(o[l]),u=Re(o[l+1]),p=Re(o[l+2]),b=Re(o[l+3]));const h=s*4;i[h]=c,i[h+1]=u,i[h+2]=p,i[h+3]=b}return{data:i,width:n,height:t,format:"rgba32float"}}function Dr(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),i=n*o,s=r*o,l=(t.width-i)/2,c=(t.height-s)/2,u=Math.max(e.zoom,1e-6),p=t.width/(u*i),b=t.height/(u*s),h=-l/i-e.pan.x/(u*i),v=-c/s-e.pan.y/(u*s);return{x:h,y:v,w:p,h:b}}function kr(e,t,n,r){const o=e.w*n,i=e.h*r;return o<=0||i<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/i)}function wi(e){var me,Ae,ge;const t=Er(e),n=a.useRef(null),r=a.useRef(null),o=a.useRef(null),i=a.useRef(null),s=a.useRef(null),l=t&&!!((me=e.hdr)!=null&&me.deep),c=a.useCallback(G=>{var $,Z;($=i.current)==null||$.setDeepZClip(G),(Z=s.current)==null||Z.call(s)},[]),u=yr(t?e.hdr:bi,l?c:void 0),p=a.useRef(!1),[b,h]=a.useState(!1),[v,w]=a.useState(!1),[m,T]=a.useState(!1),[g,d]=a.useState(null),[y,E]=a.useState(0),[S,x]=a.useState(0),[C,_]=a.useState({x:0,y:0,w:1,h:1}),M=a.useRef(null),P=a.useRef(null),[k,R]=a.useState(0),A=e.zoom??1,V=e.pan??{x:0,y:0},L=e.onViewportChange,B=t?"none":e.colormap??"none",[U,O]=a.useState(B);a.useEffect(()=>{O(B)},[B]);const ee=t?"none":U,q=a.useRef(B),ye=a.useCallback(()=>{O(q.current)},[]),xe=t?e.tonemap:void 0,[ie,Ee]=a.useState(null);a.useEffect(()=>{Ee(null)},[xe]);const Te=Lo(xe,b),se=ie??Te,Fe=ie!==null&&ie!==Te,be=a.useCallback(()=>Ee(null),[]),[ve,W]=a.useState(yt),j=ve!==yt,z=a.useCallback(()=>W(yt),[]),[ue,_e]=a.useState(0),[ae,we]=a.useState(0),Pe=nn();a.useEffect(()=>{const G=n.current;if(!G)return;let $=!1;return wt().then(Z=>{var Oe;if($)return;const I=((Oe=Z.probeExtendedToneMapping)==null?void 0:Oe.call(Z))??!1,Y=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,K=I&&Y&&t;p.current=K,h(K),t&&!K&&Rr(I?"no-hdr-display":"no-hdr-browser"),Ts(G,{hdr:K}).then(De=>{if($){ir(De);return}i.current=De,T(!0)}).catch(De=>{$||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",De),w(!0))})}).catch(Z=>{$||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",Z),w(!0))}),()=>{$=!0,i.current&&(ir(i.current),i.current=null)}},[]),a.useEffect(()=>{const G=r.current;if(!G)return;const $=new ResizeObserver(()=>x(Z=>Z+1));return $.observe(G),()=>$.disconnect()},[]),a.useEffect(()=>{const G=r.current;if(!G)return;const $=new IntersectionObserver(Z=>{const I=Z[0];if(!I)return;const Y=i.current;Y&&(Y.setVisible(I.isIntersecting),I.isIntersecting?Y.isParked&&(Y.restore(),x(K=>K+1)):Y.park())},{threshold:0});return $.observe(G),()=>$.disconnect()},[]),a.useEffect(()=>{var Z;if(!t||!m||l)return;const G=u.hdr;M.current=G;const $=vi(G);(Z=i.current)==null||Z.setSource($),d(I=>I&&I.w===$.width&&I.h===$.height?I:{w:$.width,h:$.height}),R(I=>I+1),E(I=>I+1)},[t,m,l,t?u.hdr:null]),a.useEffect(()=>{if(!t||!m||!l)return;const G=e.hdr,$=G.deep;M.current=G;let Z=!1;return $.getGpuCsr().then(I=>{var Y;Z||((Y=i.current)==null||Y.setDeepSource(I,$.zMax),d(K=>K&&K.w===I.width&&K.h===I.height?K:{w:I.width,h:I.height}),R(K=>K+1),E(K=>K+1))}).catch(I=>{Z||console.warn("[cairn] deep GPU CSR upload failed:",I)}),()=>{Z=!0}},[t,m,l,t?e.hdr.deep:null]),a.useEffect(()=>{if(t||!m)return;const G=e,$=G.imageUrl,Z=U;if(!$){P.current=null,d(null),R(Y=>Y+1);return}let I=!1;return it($).then(Y=>{var De,Ie;if(I||!Y)return;let K=Y;if(Z!=="none"){const te=`gpu::${$}::${Z}::ev${ue}::off${ae}`,$e=Qt(te);if($e)K=$e;else{const He=Zt(Z);K=qt(Y,Z,He,ue,ae),jt(te,K)}}P.current=Y;const Oe={data:K.data,width:K.width,height:K.height,format:"rgba8unorm"};(De=i.current)==null||De.setSource(Oe),d(te=>te&&te.w===K.width&&te.h===K.height?te:{w:K.width,h:K.height}),(Ie=G.onNaturalSize)==null||Ie.call(G,K.width,K.height),R(te=>te+1),E(te=>te+1)}),()=>{I=!0}},[t,m,t?null:e.imageUrl,t?null:U,t?0:ue,t?0:ae]);const Ce=t?e.exposure??0:0,Ve=t?e.gamma:void 0,je=a.useCallback(()=>{const G=i.current;if(!G||!m||!g)return;const $=r.current,Z=o.current,I=Z?Z.getBoundingClientRect():$?$.getBoundingClientRect():{width:g.w,height:g.h},Y=Dr({zoom:A,pan:V},I,g.w,g.h);_(te=>te.x===Y.x&&te.y===Y.y&&te.w===Y.w&&te.h===Y.h?te:Y),I.width>0&&I.height>0&&G.resize(Math.round(I.width*Pe),Math.round(I.height*Pe));const K=kr(Y,I,g.w,g.h)>=on?"nearest":"linear",Oe=Y,De=p.current&&Rn(se),Ie=t?{exposureEV:Ce+ue,offset:ae,operator:se,gamma:Ve,isScalar:!1,hdrOut:De,peak:ve,uv:Oe,filter:K}:{exposureEV:ee!=="none"?0:ue,offset:ee!=="none"?0:ae,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:Oe,filter:K};try{G.render(Ie)||w(!0)}catch(te){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",te),w(!0)}},[m,g,A,V.x,V.y,Ce,ue,ae,se,ve,Ve,t,ee,Pe]);s.current=je,a.useEffect(()=>{je()},[je,y,S]);const ze=a.useCallback((G,$,Z)=>{if(t){const $e=M.current,He=g;if(!$e||!He||G<0||$<0||G>=He.w||$>=He.h)return null;const bt=$e.shape.length===2?1:$e.shape[2]??1,et=($*He.w+G)*bt,ht=$e.data,st=$e.precision==="f16-bits"?mt=>St(ht[mt]??0):mt=>ht[mt]??0,vn=.5,wn=bt===1?[st(et)]:[st(et),st(et+1),st(et+2)];return ct(wn,"unit",Z,vn)}const I=P.current;if(!I||G<0||$<0||G>=I.width||$>=I.height)return null;const Y=($*I.width+G)*4,K=I.data[Y],Oe=I.data[Y+1],De=I.data[Y+2],Ie=(.299*K+.587*Oe+.114*De)/255;return ct(ee!=="none"||K===Oe&&Oe===De?[K]:[K,Oe,De],"uint8",Z,Ie)},[t,g,ee]),Le=e.showAxes??!1,N=t?e.label??"":e.label,ce=e.interpolation??"auto",Me=ce==="auto"?void 0:ce,de=t?void 0:e.overlay,ne=t?void 0:e.overlaySettings,fe=t?!1:e.isDraggable??!1,Be=t?void 0:e.onDragStart;if(v)return t?f.jsx(dn,{...e}):f.jsx(dn,{...e});const Ue=de&&(ne!=null&&ne.enabled)&&g&&((((Ae=de.boxes)==null?void 0:Ae.length)??0)>0||(((ge=de.masks)==null?void 0:ge.length)??0)>0)?f.jsx(rn,{data:de,settings:ne,naturalWidth:g.w,naturalHeight:g.h}):void 0;return f.jsx(kt,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":m},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:r,wrapperRef:o,zoom:A,pan:V,onViewportChange:L,naturalDims:g,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:Le&&g?"16px 4px 4px 28px":0,surface:f.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:Me},"data-gpu-image-canvas":!0}),showAxes:Le,overlayNode:Ue,overlay:{displayElRef:n,sample:ze,version:k,hasSource:!0,sourceWindow:C},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:je,leadingMenus:t?[br(se,G=>Ee(G),b)]:[fn(ee,G=>O(G))],displayAdjust:{exposureEV:ue,offset:ae,onExposureChange:_e,onOffsetChange:we},extraSliders:t&&Do(se)?[{id:"peak",label:"PK",title:"Peak white (×SDR white) — HDR roll-off shoulder for the extended Reinhard/ACES operators. Double-click to type a value.",min:So,max:To,step:Po,value:ve,onChange:W,format:G=>`${G.toFixed(1)}×`}]:void 0,depthSlider:u.slider,onReset:()=>{ye(),be(),z(),u.reset()},extraModified:U!==q.current||Fe||j||u.isModified,label:N,showLabelChip:!!N,isDraggable:fe,onDragStart:Be})}const Bt=new Map;function Ze(e){if(Bt.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);Bt.set(e.id,e)}function ot(e){return Bt.get(e)}function yi(){return Array.from(Bt.values())}function Lr(e,t){return{...e.params??{},...t??{}}}const Ei={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},_i={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},Mi={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},Si={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},Ti={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},Pi={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},Br=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];Ci(Br);const pn=[1.052156925,1,.91835767],Ai=.7;function Ci(e){const[t,n,r]=e[0],[o,i,s]=e[1],[l,c,u]=e[2],p=i*u-s*c,b=-(o*u-s*l),h=o*c-i*l,w=1/(t*p+n*b+r*h);return[[p*w,-(n*u-r*c)*w,(n*s-r*i)*w],[b*w,(t*u-r*l)*w,-(t*s-r*o)*w],[h*w,-(t*c-n*l)*w,(t*i-n*o)*w]]}function Ri(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const hn=6/29;function mn(e){return e>hn**3?Math.cbrt(e):e/(3*hn*hn)+4/29}function Or(e,t,n){const[r,o,i]=Ri(Br,e,t,n),s=mn(r*pn[0]),l=mn(o*pn[1]),c=mn(i*pn[2]),u=116*l-16,p=500*(s-l),b=200*(l-c);return[u,.01*u*p,.01*u*b]}function Di(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function ki(){const e=Or(0,1,0),t=Or(0,0,1);return Math.pow(Di(e,t),Ai)}const Ir=ki(),Li=.082;function Nr(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],i=Math.max(...n,...o),s=Math.ceil(3*Math.sqrt(i/(2*Math.PI**2))*e),l=1/e,c=Math.PI**2,u=[0,0,0];for(let p=-s;p<=s;p++)for(let b=-s;b<=s;b++){const h=(b*l)**2+(p*l)**2;for(let v=0;v<3;v++)u[v]+=t[v]*Math.sqrt(Math.PI/n[v])*Math.exp(-c*h/n[v])+r[v]*Math.sqrt(Math.PI/o[v])*Math.exp(-c*h/o[v])}return{r:s,deltaX:l,sums:u}}function Fr(e){const t=.5*Li*e,n=Math.ceil(3*t);let r=0,o=0,i=0;for(let s=-n;s<=n;s++)for(let l=-n;l<=n;l++){const c=Math.exp(-(l*l+s*s)/(2*t*t)),u=-l*c,p=(l*l/(t*t)-1)*c;u>0&&(r+=u),p>0?o+=p:i-=p}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:i}}const Bi=`
${Ge}
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
`,Oi=`
${Ge}
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
`,Ot=`
${Ge}
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
`,Ur=`
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
`;function Qe(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function It(e,t,n){const r=n.sourceMap,o=r?t==="a"?r.offsetA:r.offsetB:{x:0,y:0},i=r!=null&&r.fill?1:0;return[Qe(e,[o.x,o.y,i,0]),Qe(e+1,[n.width,n.height,0,0])]}function Nt(e){return[Qe(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),Qe(2,[e.sums[2],0,0,0])]}function Gr(e){return[Qe(4,[Ir,e.sd,e.r,e.edgeNorm]),Qe(5,[e.pointPos,e.pointNeg,0,0])]}function zr(e,t,n,r,o,i=""){const s=Nr(e),l=Fr(e),c=`ycxczA${i}`,u=`ycxczB${i}`,p=`labA${i}`,b=`labB${i}`,h=`flip${i}`;return{passes:[{name:c,shader:t,inputs:[n],output:c,uniforms:()=>It(1,"a",o)},{name:u,shader:t,inputs:[r],output:u,uniforms:()=>It(1,"b",o)},{name:p,shader:Ot,inputs:[c],output:p,uniforms:()=>Nt(s)},{name:b,shader:Ot,inputs:[u],output:b,uniforms:()=>Nt(s)},{name:h,shader:Ur,inputs:[p,b,c,u],output:h,uniforms:()=>Gr(l)}],flipRef:h}}const Ii={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=zr(t,Bi,"srcA","srcB",e);return{passes:n,final:r}}},Ni={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=zr(t,Oi,"srcA","srcB",e);return{passes:n,final:r}}},Vr=`
${Ge}
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
`,Fi=`
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
`,Ui={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",output:"scalar",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),i=(r-n)/Math.max(o-1,1),s=Nr(t),l=Fr(t),c=[];let u=null;for(let p=0;p<o;p++){const b=n+p*i,h=`_e${p}`,v=`ycxczA${h}`,w=`ycxczB${h}`,m=`labA${h}`,T=`labB${h}`,g=`acc${h}`;c.push({name:v,shader:Vr,inputs:["srcA"],output:v,uniforms:()=>[Qe(1,[b,0,0,0]),...It(2,"a",e)]},{name:w,shader:Vr,inputs:["srcB"],output:w,uniforms:()=>[Qe(1,[b,0,0,0]),...It(2,"b",e)]},{name:m,shader:Ot,inputs:[v],output:m,uniforms:()=>Nt(s)},{name:T,shader:Ot,inputs:[w],output:T,uniforms:()=>Nt(s)}),u===null?c.push({name:g,shader:Ur,inputs:[m,T,v,w],output:g,uniforms:()=>Gr(l)}):c.push({name:g,shader:Fi,inputs:[m,T,v,w,u],output:g,uniforms:()=>[Qe(5,[Ir,l.sd,l.r,l.edgeNorm]),Qe(6,[l.pointPos,l.pointNeg,0,0])]}),u=g}return{passes:c,final:u}}},Gi=.01,zi=.03,$r=1,Xr=1.5,Hr=5,Wr=`
fn ssim_srgb2linear(c: f32) -> f32 {
  if (c <= 0.04045) { return c / 12.92; }
  return pow((c + 0.055) / 1.055, 2.4);
}
fn ssim_luma(srgb: vec3<f32>) -> f32 {
  let lin = vec3<f32>(ssim_srgb2linear(srgb.r), ssim_srgb2linear(srgb.g), ssim_srgb2linear(srgb.b));
  return clamp(dot(lin, vec3<f32>(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
}
`,Vi=`
${Ge}
${Wr}
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
`,$i=`
${Ge}
${Wr}
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
`,Yr=`
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
`,Xi=`
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
`;function gn(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function Kr(e,t){const n=`${t}H`,r=`${t}V`;return{passes:[{name:n,shader:Yr,inputs:[e],output:n,uniforms:()=>[gn(1,[1,0,Hr,Xr])]},{name:r,shader:Yr,inputs:[n],output:r,uniforms:()=>[gn(1,[0,1,Hr,Xr])]}],out:r}}const Hi={kind:"multipass",id:"ssim",label:"SSIM (1−SSIM)",publicName:"ssim",displayRange:"unit",output:"scalar",buildPasses(e){const t=(Gi*$r)**2,n=(zi*$r)**2,r=Kr("momA","statsA"),o=Kr("momB","statsB");return{passes:[{name:"momA",shader:Vi,inputs:["srcA","srcB"],output:"momA"},{name:"momB",shader:$i,inputs:["srcA","srcB"],output:"momB"},...r.passes,...o.passes,{name:"ssim",shader:Xi,inputs:[r.out,o.out],output:"ssim",uniforms:()=>[gn(2,[t,n,0,0])]}],final:"ssim"}}};let qr=!1;function Wi(){qr||(qr=!0,Ze(_i),Ze(Ei),Ze(Mi),Ze(Ti),Ze(Si),Ze(Pi),Ze(Ii),Ze(Ui),Ze(Ni),Ze(Hi))}Wi();function Zr(){const e=[];for(const n of yi())n.kind==="pointwise"&&e.push({id:n.id,label:n.label});e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"});const t=ot("ssim");return t&&e.push({id:t.id,label:t.label}),e}function Yi(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}const Qr=new WeakMap;function xn(e,t,n,r){let o=Qr.get(e);o||(o=new Map,Qr.set(e,o));const i=`${t}::${r}`;let s=o.get(i);return s||(s=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(i,s)),s}function Ki(e){return`
${Ge}
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
`}const Ft="rgba16float";function qi(e,t,n,r,o,i){var T,g;const s=ot(r);if(!s)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const l=i??Rt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),c=l.result.w,u=l.result.h,p=l.fit==="fill"?1:0,b=Lr(s,o);if(s.kind==="pointwise"){const d=e.createTexture(c,u,Ft),y=xn(e,`pw:${s.id}`,Ki(s.source),Ft),E=new Float32Array([l.offsetA.x,l.offsetA.y,l.offsetB.x,l.offsetB.y]),S=new Float32Array([c,u,p,0]);let x;try{x=e.createBindGroup(y,[{binding:0,resource:t},{binding:1,resource:n},{binding:2,resource:{uniform:E}},{binding:3,resource:{uniform:S}}]),e.renderFullscreen(d,y,x)}finally{(T=x==null?void 0:x.destroy)==null||T.call(x)}return d}const h={width:c,height:u,params:b,sourceMap:{fill:l.fit==="fill",offsetA:l.offsetA,offsetB:l.offsetB}},v=s.buildPasses(h),w=new Map([["srcA",t],["srcB",n]]),m=[];try{for(const y of v.passes){const E=e.createTexture(c,u,Ft);m.push(E),w.set(y.output,E);const S=xn(e,`mp:${s.id}:${y.name}`,y.shader,Ft),x=y.inputs.map((_,M)=>{const P=w.get(_);if(!P)throw new Error(`computeDiff: pass "${y.name}" input "${_}" not produced yet`);return{binding:M,resource:P}});y.uniforms&&x.push(...y.uniforms(h));let C;try{C=e.createBindGroup(S,x),e.renderFullscreen(E,S,C)}finally{(g=C==null?void 0:C.destroy)==null||g.call(C)}}const d=w.get(v.final);if(!d)throw new Error(`computeDiff: final ref "${v.final}" not produced`);for(const y of m)y!==d&&y.destroy();return d}catch(d){for(const y of m)y.destroy();throw d}}const Zi=8,Qi=256*1024*1024;class ji{constructor(t=Zi,n=Qi){oe(this,"map",new Map);oe(this,"totalBytes",0);this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}accountReadbackBytes(t,n){let r=!1;for(const o of this.map.values())if(o===t){r=!0;break}r&&(t.bytes+=n,this.totalBytes+=n,this.evict())}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const jr=new WeakMap;function Jr(e){let t=jr.get(e);return t||(t=new ji,jr.set(e,t)),t}function Ji(e,t){const n=Lr(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function ea(e,t,n,r,o){const i=ot(n),s=i?Ji(i,r):"",l=o?xs(o):"";return`${e}|${t}|${n}|${s}|${l}`}function ta(e,t,n,r,o,i,s,l){const c=ot(r);if(!c)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const u=Jr(e),p=l??Rt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),b=ea(i,s,r,o,p),h=u.get(b);if(h)return h;const v=qi(e,t,n,r,o,p),w=p.result.w,m=p.result.h,T={texture:v,width:w,height:m,displayRange:c.displayRange,bytes:w*m*8};return u.set(b,T),T}async function na(e,t,n,r,o){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=er(e,n,r,o).then(i=>(t.scalars=i,i))),t.scalarsPending)}async function ra(e,t){return t.resultSamples?t.resultSamples:(t.resultSamplesPending||(t.resultSamplesPending=e.readback(t.texture).then(n=>{const r=n instanceof Float32Array?n:Float32Array.from(n);return t.resultSamples=r,Jr(e).accountReadbackBytes(t,r.byteLength),r})),t.resultSamplesPending)}const oa=`
${Ge}
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
`,sa={unit:0,signed:1,relative:2},ia={linear:0,signed:1,positive:2};function aa(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function ca(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function la(e,t,n,r,o){var v,w,m;const i=ca(t),s=xn(e,"diff-display",oa,i),l=aa(e,o.colormap),c=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),u=new Float32Array([sa[r],ia[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]),p=new Float32Array([o.exposureEV??0,o.offset??0,0,0]),b=new Float32Array([((v=o.sourceDims)==null?void 0:v.w)??0,((w=o.sourceDims)==null?void 0:w.h)??0,0,0]);let h;try{h=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:l},{binding:2,resource:{uniform:c}},{binding:3,resource:{uniform:u}},{binding:4,resource:{uniform:p}},{binding:5,resource:{uniform:b}}]),e.renderFullscreen(t,s,h)}finally{(m=h==null?void 0:h.destroy)==null||m.call(h),l.destroy()}}const eo=.6*.6*2.51,ua=.6*.03,fa=0,to=.6*.6*2.43,da=.6*.59,pa=.14;function no(e){const t=(ua-da*e)/(eo-to*e),n=(fa-pa*e)/(eo-to*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const ha=.85,ma=.85,ro=11920928955078125e-23,bn=[.2126,.7152,.0722];function ga(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function xa(e,t,n,r=3,o={}){const i=t*n,s=no(ha),l=no(ma),c=new Float64Array(i);let u=0;for(let d=0;d<i;d++){const[y,E,S]=ga(e,d,r),x=y*bn[0]+E*bn[1]+S*bn[2];c[d]=x,x>u&&(u=x)}const p=Float64Array.from(c).sort(),b=i>>1,h=i%2===1?p[b]:p[b-1],v=Math.max(h,ro),w=Math.max(u,ro),m=o.startExposure??Math.log2(s/w),T=o.stopExposure??Math.log2(l/v),g=Math.max(2,Math.ceil(T-m));return{startExposure:m,stopExposure:T,numExposures:g}}const ba={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function va({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:i,zoom:s,pan:l,onViewportChange:c,processing:u=ba,interpolation:p="auto",label:b="",isDraggable:h=!1,onDragStart:v,overlay:w,overlaySettings:m,pixelValueNotation:T="decimal"}){var be,ve;const g=a.useRef(null),[d,y]=a.useState(null),[E,S]=a.useState(null),[x,C]=a.useState(T),[_,M]=a.useState(!1),P=a.useRef(null),k=a.useRef(null),R=a.useRef(null),A=a.useRef(null),[V,L]=a.useState(0);a.useEffect(()=>{if(!e){R.current=null,L(j=>j+1);return}let W=!1;return it(e).then(j=>{W||(R.current=j,L(z=>z+1))}),()=>{W=!0}},[e]),a.useEffect(()=>{if(!t){A.current=null,L(j=>j+1);return}let W=!1;return it(t).then(j=>{W||(A.current=j,L(z=>z+1))}),()=>{W=!0}},[t]);const B=W=>(j,z,ue)=>{const _e=W.current;if(!_e||j<0||z<0||j>=_e.width||z>=_e.height)return null;const ae=(z*_e.width+j)*4,we=_e.data[ae],Pe=_e.data[ae+1],Ce=_e.data[ae+2],Ve=(.299*we+.587*Pe+.114*Ce)/255;return we===Pe&&Pe===Ce?{lines:[ft(we,"uint8",ue)],luminance:Ve}:{lines:[ft(we,"uint8",ue),ft(Pe,"uint8",ue),ft(Ce,"uint8",ue)],luminance:Ve,colors:[Pt[0],Pt[1],Pt[2]]}},U=a.useMemo(()=>B(R),[]),O=a.useMemo(()=>B(A),[]),ee=!!w&&!!(m!=null&&m.enabled)&&!!d&&!!e&&((((be=w.boxes)==null?void 0:be.length)??0)>0||(((ve=w.masks)==null?void 0:ve.length)??0)>0),{gammaFilterId:q,filterStr:ye,gamma:xe,offset:ie}=ar(u),Ee=`translate(${l.x}px, ${l.y}px) scale(${s})`,Te=p==="auto"?void 0:p,{containerProps:se,modifierActive:Fe}=Xn({containerRef:g,zoom:s,pan:l,onViewportChange:c});return f.jsxs("div",{className:"relative flex flex-col h-full",children:[f.jsx(cr,{id:q,gamma:xe,offset:ie}),f.jsxs("div",{ref:g,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...se.style},onPointerDown:se.onPointerDown,onPointerMove:se.onPointerMove,onPointerUp:se.onPointerUp,onPointerCancel:se.onPointerCancel,children:[f.jsxs("div",{className:"relative w-full h-full",children:[f.jsxs("div",{className:"relative w-full h-full",style:{transform:Ee,transformOrigin:"0 0"},children:[f.jsx("img",{ref:P,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:ye,imageRendering:Te,...n==="blend"?{opacity:o}:{}},onLoad:W=>{const j=W.currentTarget;y({w:j.naturalWidth,h:j.naturalHeight})}}),ee&&f.jsx(rn,{data:w,settings:m,naturalWidth:d.w,naturalHeight:d.h})]}),f.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:f.jsx("div",{className:"w-full h-full",style:{transform:Ee,transformOrigin:"0 0"},children:f.jsx("img",{ref:k,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:ye,imageRendering:Te,...n==="blend"?{opacity:1-o}:{}},onLoad:W=>{const j=W.currentTarget;S({w:j.naturalWidth,h:j.naturalHeight})}})})}),n==="split"&&f.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${r*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:()=>i==null?void 0:i(.5),onPointerDown:W=>{W.stopPropagation(),W.preventDefault();const j=W.currentTarget;try{j.setPointerCapture(W.pointerId)}catch{}const ue=j.parentElement.getBoundingClientRect(),_e=we=>{i==null||i(Math.max(0,Math.min(1,(we.clientX-ue.left)/ue.width)))},ae=()=>{window.removeEventListener("pointermove",_e),window.removeEventListener("pointerup",ae)};window.addEventListener("pointermove",_e),window.addEventListener("pointerup",ae)},children:f.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})]}),n==="split"?f.jsxs(f.Fragment,{children:[t&&E&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:f.jsx(lt,{imageElRef:k,naturalWidth:E.w,naturalHeight:E.h,zoom:s,pan:l,sample:O,notation:x,version:V})}),e&&d&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:f.jsx(lt,{imageElRef:P,naturalWidth:d.w,naturalHeight:d.h,zoom:s,pan:l,sample:U,notation:x,version:V,onActiveChange:M})})]}):e&&d&&f.jsx(lt,{imageElRef:P,naturalWidth:d.w,naturalHeight:d.h,zoom:s,pan:l,sample:U,notation:x,version:V,onActiveChange:M}),_&&f.jsx(Wn,{notation:x,onChange:C})]}),n==="split"&&f.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),f.jsxs("span",{className:`absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${h&&!Fe?" cairn-drag-grip":""}`,draggable:h&&!Fe,onDragStart:v,style:{cursor:h&&!Fe?"grab":void 0},children:[f.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50"}),b]})]})}function wa(){return f.jsx("div",{className:"card p-4 text-sm text-red-400 h-full flex items-center justify-center text-center",children:"Plot error: float URL sources need the GPU compare (WebGPU) — unavailable here"})}function ya({mode:e,kernel:t,kernelOptions:n,onSlide:r,onBlend:o,onKernel:i,onSide:s}){return{id:"compare-mode",title:"Compare / diff mode",menu:{options:[...s?[{id:"side",label:"Side"}]:[],{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...n],value:e==="side"?"side":e==="split"?"slide":e==="blend"?"blend":t,onSelect:u=>{u==="side"?s==null||s():u==="slide"?r():u==="blend"?o():i(u)}}}}function Ea(e){const t=Xt(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function _a(e){const{width:t,height:n,channels:r}=e,o=t*n;if(e.precision==="f16-bits"){const c=e.data,u=new Uint16Array(o*4);for(let p=0;p<o;p++){const b=p*r,h=p*4;if(r===1){const v=c[b];u[h]=v,u[h+1]=v,u[h+2]=v,u[h+3]=Mt}else u[h]=c[b],u[h+1]=c[b+1],u[h+2]=c[b+2],u[h+3]=r>=4?c[b+3]:Mt}return{data:u,format:"rgba16float"}}const i=e.data,s=new Float32Array(o*4),l=c=>Number.isFinite(c)?c:0;for(let c=0;c<o;c++){const u=c*r;let p,b,h,v=1;r===1?p=b=h=l(i[u]):r===3?(p=l(i[u]),b=l(i[u+1]),h=l(i[u+2])):(p=l(i[u]),b=l(i[u+1]),h=l(i[u+2]),v=l(i[u+3]));const w=c*4;s[w]=p,s[w+1]=b,s[w+2]=h,s[w+3]=v}return{data:s,format:"rgba32float"}}function Ma({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:i,blendAlpha:s,onSplitPositionChange:l,diffSubmode:c,colormap:u="none",align:p="top-left",fit:b="crop",diffKernel:h,onDiffKernelChange:v,onCompareModeChange:w,onRequestSide:m,zoom:T,pan:g,onViewportChange:d,interpolation:y="auto",label:E="",pixelValueNotation:S="decimal"}){var mt;const x=a.useRef(null),C=a.useRef(null),_=a.useRef(null),M=a.useRef(null),P=a.useRef(null),[k,R]=a.useState(!1),[A,V]=a.useState(!1),[L,B]=a.useState(null),[U,O]=a.useState(null),[ee,q]=a.useState(0),[ye,xe]=a.useState(0),[ie,Ee]=a.useState(null),[Te,se]=a.useState({x:0,y:0,w:1,h:1}),Fe=h??c??"absolute",[be,ve,W]=ut(Fe);a.useEffect(()=>{ve(h??c??"absolute")},[h,c,ve]);const j=a.useCallback(D=>{ve(D),v==null||v(D)},[v,ve]);a.useEffect(()=>{const D=x.current;if(D)return D.__cairnDiffKernel={current:be,set:j},()=>{D&&delete D.__cairnDiffKernel}},[be,j]);const[z,ue,_e]=ut(o);a.useEffect(()=>{ue(o)},[o,ue]);const ae=a.useCallback(D=>{ue(D),w==null||w(D)},[w,ue]),[we,Pe,Ce]=ut(u);a.useEffect(()=>{Pe(u)},[u,Pe]);const Ve=a.useCallback(()=>{ae(_e.default),Pe(Ce.default),j(W.default)},[ae,Pe,j,_e.default,Ce.default,W.default]),je=_e.isModified||Ce.isModified||W.isModified,[ze,Le]=a.useState(0),[N,ce]=a.useState(0),Me=a.useMemo(()=>{const X=[ya({mode:z,kernel:be,kernelOptions:Zr().map(H=>({id:H.id,label:H.label})),onSide:m,onSlide:()=>ae("split"),onBlend:()=>ae("blend"),onKernel:H=>{ae("diff"),j(H)}})];return z==="diff"&&X.push(fn(we,H=>Pe(H))),X},[z,be,we,j,ae,m]),de=a.useRef(null),ne=a.useRef(null),fe=a.useRef(null),Be=a.useRef(null),[Ue,me]=a.useState(0),Ae=a.useRef(null),ge=a.useRef(null),[G,$]=a.useState(0),Z=nn();a.useEffect(()=>{const D=_.current;if(!D)return;let X=!1;return wt().then(H=>{if(!X)try{if(nr())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const F=H.createSurface(D,{hdr:!1});M.current={device:H,surface:F,texA:null,texB:null},V(!0)}catch(F){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",F),R(!0)}}).catch(H=>{X||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",H),R(!0))}),()=>{var F,J;X=!0;const H=M.current;H&&((F=H.texA)==null||F.destroy(),(J=H.texB)==null||J.destroy(),M.current=null)}},[]),a.useEffect(()=>{const D=x.current;if(!D)return;const X=new ResizeObserver(()=>xe(H=>H+1));return X.observe(D),()=>X.disconnect()},[]),a.useEffect(()=>{if(!A)return;let D=!1;if(!M.current)return;async function H(F,J){if(J){const pe=_a(J);return{width:J.width,height:J.height,imageData:null,make:Se=>{const le=Se.createTexture(J.width,J.height,pe.format);return le.write(pe.data),le}}}if(!F)return null;const re=await it(F);return re?{width:re.width,height:re.height,imageData:re,make:pe=>{const Se=pe.createTexture(re.width,re.height,"rgba8unorm");return Se.write(re.data),Se}}:null}return Promise.all([H(e,n),H(t,r)]).then(([F,J])=>{var Ne,We;if(D||!M.current)return;const re=M.current;de.current=(F==null?void 0:F.imageData)??null,ne.current=(J==null?void 0:J.imageData)??null,fe.current=n??null,Be.current=r??null,(Ne=re.texA)==null||Ne.destroy(),(We=re.texB)==null||We.destroy(),re.texA=null,re.texB=null;const pe=F??J;if(!pe){B(null),O(null),me(Xe=>Xe+1);return}const Se=J??pe,le=F??pe;re.texA=Se.make(re.device),re.texB=le.make(re.device),O({a:{w:Se.width,h:Se.height},b:{w:le.width,h:le.height}}),B({w:pe.width,h:pe.height}),me(Xe=>Xe+1),q(Xe=>Xe+1)}),()=>{D=!0}},[A,e,t,n,r]);const I=n!=null||r!=null,Y=a.useMemo(()=>Yi(be,I),[be,I]),K=a.useMemo(()=>{if(!I)return null;const D=r??n;if(!D)return null;const X=D.precision==="f16-bits"?Nn(D.data):D.data;return xa(X,D.width,D.height,D.channels)},[I,r,n]),Oe=a.useMemo(()=>{var D;return Oo(((D=ot(Y))==null?void 0:D.displayRange)??"unit",we==="none"?null:we)},[Y,we]),De=a.useMemo(()=>we!=="none"?Ea(we):void 0,[we]),Ie=a.useMemo(()=>U?Rt(U.a,U.b,p,b,"b"):null,[U,p,b]),te=a.useMemo(()=>L?z==="diff"&&Ie?Ie.result:L:null,[z,Ie,L]),$e=a.useCallback(()=>{const D=M.current;if(!A||!D||!D.surface||!D.texA||!D.texB||!L)return;const X=te??L,H=x.current,F=H?H.getBoundingClientRect():{width:X.w,height:X.h},J=Dr({zoom:T,pan:g},F,X.w,X.h);se(le=>le.x===J.x&&le.y===J.y&&le.w===J.w&&le.h===J.h?le:J);const re=_.current;if(F.width>0&&F.height>0&&re&&D.surface){const le=Math.max(1,Math.round(F.width*Z)),Ne=Math.max(1,Math.round(F.height*Z));(re.width!==le||re.height!==Ne)&&(re.width=le,re.height=Ne,D.surface.configure(le,Ne))}const pe=kr(J,F,X.w,X.h)>=on?"nearest":"linear",Se=J;try{if(z==="diff"){const le=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",Ne=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",We=ot(Y)?Y:"absolute",Xe=We==="hdr-flip"&&K?{ppd:67,startExposure:K.startExposure,stopExposure:K.stopExposure,numExposures:K.numExposures}:void 0,gt=ta(D.device,D.texA,D.texB,We,Xe,le,Ne,Ie??void 0);P.current=gt,la(D.device,D.surface,gt.texture,gt.displayRange,{uv:Se,cmapMode:Oe,colormap:De,filter:pe,exposureEV:ze,offset:N})}else{const le={exposureEV:ze,offset:N,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:Se,filter:pe,mode:z,split:i,alpha:s};ys(D.device,D.surface,D.texA,D.texB,le)}}catch(le){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",le),R(!0)}},[A,L,te,Ie,T,g.x,g.y,z,i,s,ze,N,be,Y,K,Oe,De,e,t,n,r,Z]);a.useEffect(()=>{$e()},[$e,ee,ye]);const He=t!=null||r!=null;a.useEffect(()=>{const D=M.current;if(!A||!D||!D.texA||!D.texB||!He){Ee(null);return}let X=!1;const H=D.texA,F=D.texB,J=P.current,re=z==="diff"?Ie??void 0:void 0;return(z==="diff"&&J?na(D.device,J,H,F,re):er(D.device,H,F,re)).then(Se=>{X||Ee(Se)}),()=>{X=!0}},[A,ee,He,z,be,Ie]),a.useEffect(()=>{if(z!=="diff"){Ae.current=null,ge.current=null;return}const D=M.current,X=P.current;if(!A||!D||!X)return;let H=!1;return Ae.current=null,ge.current=null,$(F=>F+1),ra(D.device,X).then(F=>{H||(Ae.current=F,ge.current={w:X.width,h:X.height},$(J=>J+1))}).catch(()=>{}),()=>{H=!0}},[A,z,Y,ee,Ie]);const bt=(D,X)=>(H,F,J)=>{const re=X.current;if(re){const{data:gt,width:oo,height:Pa,channels:so}=re;if(H<0||F<0||H>=oo||F>=Pa)return null;const Ut=(F*oo+H)*so,Gt=re.precision==="f16-bits"?yn=>St(gt[yn]??0):yn=>gt[yn]??0,Aa=.5,Ca=so===1?[Gt(Ut)]:[Gt(Ut),Gt(Ut+1),Gt(Ut+2)];return ct(Ca,"unit",J,Aa)}const pe=D.current;if(!pe||H<0||F<0||H>=pe.width||F>=pe.height)return null;const Se=(F*pe.width+H)*4,le=pe.data[Se],Ne=pe.data[Se+1],We=pe.data[Se+2],Xe=(.299*le+.587*Ne+.114*We)/255;return ct(le===Ne&&Ne===We?[le]:[le,Ne,We],"uint8",J,Xe)},et=a.useMemo(()=>bt(de,fe),[]),ht=a.useMemo(()=>bt(ne,Be),[]),st=a.useMemo(()=>(D,X,H)=>{var Xe;const F=Ae.current,J=ge.current;if(!F||!J)return null;const{w:re,h:pe}=J;if(D<0||X<0||D>=re||X>=pe)return null;const Se=(X*re+D)*4,le=((Xe=ot(Y))==null?void 0:Xe.output)??"per-channel",Ne=.5,We=le==="scalar"?[F[Se]??0]:[F[Se]??0,F[Se+1]??0,F[Se+2]??0];return ct(We,"unit",H,Ne)},[Y]);a.useEffect(()=>{const D=x.current;if(D)return D.__cairnCompareProbe={sampleDiff:(X,H,F="decimal")=>st(X,H,F),sampleFg:(X,H,F="decimal")=>et(X,H,F),sampleRef:(X,H,F="decimal")=>ht(X,H,F),get diffSamples(){return Ae.current},get dims(){return te},get primaryDims(){return L},get diffResultDims(){return ge.current},get align(){return p},get fit(){return b},get resolvedKernelId(){return Y},get compareMode(){return z}},()=>{D&&delete D.__cairnCompareProbe}},[st,et,ht,L,te,p,b,Y,z]);const vn=y==="auto"?void 0:y;if(k)return n!=null||r!=null?f.jsx(wa,{}):z==="diff"?f.jsx(dn,{imageUrl:e,baselineUrl:t,diffMode:((mt=ot(Y))==null?void 0:mt.kind)==="pointwise"?Y:"absolute",interpolation:y,colormap:we,showAxes:!1,zoom:T,pan:g,onViewportChange:d,label:E,pixelValueNotation:S}):f.jsx(va,{imageUrl:e,baselineUrl:t,mode:z,splitPosition:i,blendAlpha:s,onSplitPositionChange:l,zoom:T,pan:g,onViewportChange:d,interpolation:y,label:E,pixelValueNotation:S});const wn=f.jsxs(f.Fragment,{children:[f.jsx("canvas",{ref:_,className:"w-full h-full block",style:{imageRendering:vn},"data-gpu-compare-canvas":!0}),z==="split"&&f.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${i*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:D=>{D.stopPropagation(),l==null||l(.5)},onPointerDown:D=>{D.stopPropagation(),D.preventDefault();const X=D.currentTarget;try{X.setPointerCapture(D.pointerId)}catch{}const F=X.parentElement.getBoundingClientRect(),J=pe=>{l==null||l(Math.max(0,Math.min(1,(pe.clientX-F.left)/F.width)))},re=()=>{window.removeEventListener("pointermove",J),window.removeEventListener("pointerup",re)};window.addEventListener("pointermove",J),window.addEventListener("pointerup",re)},children:f.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})]});return f.jsx(kt,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":A},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:x,wrapperRef:C,zoom:T,pan:g,onViewportChange:d,naturalDims:te,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:wn,showAxes:!1,notationSeed:S,onReset:Ve,extraModified:je,exportCanvasRef:_,requestRender:$e,leadingMenus:Me,displayAdjust:{exposureEV:ze,offset:N,onExposureChange:Le,onOffsetChange:ce},label:"",showLabelChip:!1,overlay:{render:({notation:D,setOverlayActive:X})=>z==="split"?f.jsxs(f.Fragment,{children:[He&&te&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-i)*100}% 0 0)`},children:f.jsx(lt,{imageElRef:_,naturalWidth:te.w,naturalHeight:te.h,zoom:T,pan:g,sourceWindow:Te,sample:ht,notation:D,version:Ue})}),He&&te&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${i*100}%)`},children:f.jsx(lt,{imageElRef:_,naturalWidth:te.w,naturalHeight:te.h,zoom:T,pan:g,sourceWindow:Te,sample:et,notation:D,version:Ue,onActiveChange:X})})]}):te&&f.jsx(lt,{imageElRef:_,naturalWidth:te.w,naturalHeight:te.h,zoom:T,pan:g,sourceWindow:Te,sample:z==="diff"?st:et,notation:D,version:z==="diff"?G:Ue,onActiveChange:X})},extraChips:f.jsxs(f.Fragment,{children:[z==="split"&&f.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),E?f.jsx("span",{className:"absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm",children:E}):null,ie&&f.jsxs("span",{className:`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${E?"bottom-7":"bottom-1"}`,"data-gpu-compare-metrics":!0,children:["MSE ",ie.mse.toExponential(2)," · PSNR ",Number.isFinite(ie.psnr)?ie.psnr.toFixed(1):"∞"," dB · MAE"," ",ie.mae.toExponential(2)]})]})})}const Sa="cairn-plot:gpu-image-ready";async function Ta(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await wt(),window.__cairnPlotGpuImagePane=wi,window.__cairnPlotGpuComparePane=Ma,window.__cairnPlotDiffMenuModes=Zr(),window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(Sa))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e),Rr("no-webgpu")}}}Ta()})(__cairnPlotJsxRuntime,__cairnPlotReact);
