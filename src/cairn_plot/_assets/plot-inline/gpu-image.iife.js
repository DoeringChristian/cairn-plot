var ya=Object.defineProperty;var Ea=(f,a,je)=>a in f?ya(f,a,{enumerable:!0,configurable:!0,writable:!0,value:je}):f[a]=je;var ne=(f,a,je)=>Ea(f,typeof a!="symbol"?a+"":a,je);(function(f,a){"use strict";const je=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function bn(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:je}),{hdr:!1,format:n}}function to(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:je}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:je}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return bn(e,t)}}}const no=`
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
`,ro=`
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
`;function Ft(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function vn(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function oo(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const so={texture:0,sampler:1,uniform:2};function Nt(e,t){return e*3+so[t]}const io={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function ao(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),i=r[2]!==void 0,s=r[3].trim();if(i){const l=io[s];if(l===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${s}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:l})}else s==="sampler"||s==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class wn{constructor(t,n,r,o){ne(this,"width");ne(this,"height");ne(this,"format");ne(this,"gpuTexture");ne(this,"device");ne(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:Ft(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*vn(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class yn{constructor(t){ne(this,"_s");ne(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class co{constructor(t,n,r,o,i){ne(this,"_p");ne(this,"gpuPipeline");ne(this,"bindings");ne(this,"bindGroupLayout");ne(this,"variants");ne(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=i,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function lo(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class uo{constructor(t){ne(this,"_c");ne(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class fo{constructor(t,n,r,o,i){ne(this,"width");ne(this,"height");ne(this,"paramsBuffer");ne(this,"bindGroup");ne(this,"buffers");ne(this,"destroyed",!1);this.width=t,this.height=n,this.buffers=r,this.paramsBuffer=o,this.bindGroup=i}destroy(){if(!this.destroyed){for(const t of this.buffers)t.destroy();this.paramsBuffer.destroy(),this.destroyed=!0}}}class po{constructor(t,n){ne(this,"_b");ne(this,"gpuBindGroup");ne(this,"ownedBuffers");ne(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class ho{constructor(t,n,r,o){ne(this,"canvas");ne(this,"hdr");ne(this,"format");ne(this,"context");ne(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function gt(e){return"canvas"in e}async function mo(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function i(d){return gt(d)?d.getCurrentTextureView():d.gpuTexture.createView()}function s(d){if(gt(d))return{width:d.canvas.width,height:d.canvas.height};const y=d;return{width:y.width,height:y.height}}let l=!1,c=null;function u(){var y,E;if(c!==null)return c;let d=!1;try{if(typeof document<"u"){const S=document.createElement("canvas");S.width=1,S.height=1;const x=S.getContext("webgpu");if(x)try{x.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:GPUTextureUsage.RENDER_ATTACHMENT});const C=(y=x.getConfiguration)==null?void 0:y.call(x);d=((E=C==null?void 0:C.toneMapping)==null?void 0:E.mode)==="extended"}catch{d=!1}finally{try{x.unconfigure()}catch{}}}}catch{d=!1}return c=d,d}const p=256;let b=null,h=null;function v(){if(!b||!h){const d=t.createShaderModule({code:no});h=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const y=t.createPipelineLayout({bindGroupLayouts:[h]});b=t.createComputePipeline({layout:y,compute:{module:d,entryPoint:"cs_main"}})}return{pipeline:b,layout:h}}let w=null,g=null;function T(){if(!w||!g){const d=t.createShaderModule({code:ro});g=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});const y=t.createPipelineLayout({bindGroupLayouts:[g]});w=t.createRenderPipeline({layout:y,vertex:{module:d,entryPoint:"vs_main"},fragment:{module:d,entryPoint:"fs_main",targets:[{format:"rgba16float"}]},primitive:{topology:"triangle-list"}})}return{pipeline:w,layout:g}}return{backend:"webgpu",capabilities:n,probeExtendedToneMapping:u,createTexture(d,y,E){return new wn(t,d,y,E)},createSampler(d){const y=(d==null?void 0:d.filter)==="linear"?"linear":"nearest",E=t.createSampler({magFilter:y,minFilter:y,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new yn(E)},createRenderPipeline(d){const y=t.createShaderModule({code:d.shaderWGSL}),E=ao(d.shaderWGSL),S=Ft(d.targetFormat),x=lo(t,E),C=t.createPipelineLayout({bindGroupLayouts:[x]}),_=P=>t.createRenderPipeline({layout:C,vertex:{module:y,entryPoint:"vs_main"},fragment:{module:y,entryPoint:"fs_main",targets:[{format:P}]},primitive:{topology:"triangle-list"}}),M=_(S);return new co(M,E,x,S,_)},createComputePipeline(d){const y=t.createShaderModule({code:d.shaderWGSL}),E=t.createComputePipeline({layout:"auto",compute:{module:y,entryPoint:"cs_main"}});return new uo(E)},createBindGroup(d,y){const E=d,S=new Map,x=[];for(const[_,M]of E.bindings)if(M.kind==="uniform"){const P=t.createBuffer({size:M.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});x.push(P),S.set(_,{binding:_,resource:{buffer:P}})}else M.kind==="sampler"&&S.set(_,{binding:_,resource:o()});for(const _ of y){const M=_.resource;if(M instanceof wn){const P=Nt(_.binding,"texture");E.bindings.has(P)&&S.set(P,{binding:P,resource:M.gpuTexture.createView()})}else if(M instanceof yn){const P=Nt(_.binding,"sampler");E.bindings.has(P)&&S.set(P,{binding:P,resource:M.gpuSampler})}else{const P=Nt(_.binding,"uniform"),L=E.bindings.get(P);if(L&&L.kind==="uniform"){const R=M.uniform,A=t.createBuffer({size:Math.max(L.sizeBytes,R.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(A,0,R.buffer,R.byteOffset,R.byteLength),x.push(A),S.set(P,{binding:P,resource:{buffer:A}})}}}const C=t.createBindGroup({layout:E.bindGroupLayout,entries:Array.from(S.values())});return new po(C,x)},createSurface(d,y){const E=d.getContext("webgpu");if(!E)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const S=y.hdr&&n.hdr,x=()=>S?to(E,t):bn(E,t),C=x();return new ho(d,E,C,x)},renderFullscreen(d,y,E){const S=y,x=E,C=i(d),{width:_,height:M}=s(d),P=gt(d)?d.format:Ft(d.format),L=S.pipelineFor(P),R=t.createCommandEncoder(),A=R.beginRenderPass({colorAttachments:[{view:C,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});A.setPipeline(L),A.setBindGroup(0,x.gpuBindGroup),A.setViewport(0,0,_,M,0,1),A.draw(3),A.end(),t.queue.submit([R.finish()])},createDeepSampleBuffers(d){const{layout:y}=T(),E=P=>{const L=t.createBuffer({size:P.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});return t.queue.writeBuffer(L,0,P.buffer,P.byteOffset,P.byteLength),L},S=E(d.offsets),x=E(d.colors),C=E(d.zs),_=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),M=t.createBindGroup({layout:y,entries:[{binding:0,resource:{buffer:S}},{binding:1,resource:{buffer:x}},{binding:2,resource:{buffer:C}},{binding:3,resource:{buffer:_}}]});return new fo(d.width,d.height,[S,x,C],_,M)},compositeDeep(d,y,E){const S=d,x=y,{pipeline:C}=T();t.queue.writeBuffer(S.paramsBuffer,0,new Float32Array([S.width,S.height,E,0]));const _=t.createCommandEncoder(),M=_.beginRenderPass({colorAttachments:[{view:x.gpuTexture.createView(),loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});M.setPipeline(C),M.setBindGroup(0,S.bindGroup),M.setViewport(0,0,x.width,x.height,0,1),M.draw(3),M.end(),t.queue.submit([_.finish()])},async readback(d){const y=gt(d),{width:E,height:S}=s(d),x=y?d.hdr?"rgba16float":"rgba8unorm":d.format,C=y&&d.format==="bgra8unorm",_=y?d.getCurrentGPUTexture():d.gpuTexture,M=vn(x),P=E*M,L=256,R=Math.ceil(P/L)*L,A=R*S,V=t.createBuffer({size:A,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),k=t.createCommandEncoder();k.copyTextureToBuffer({texture:_},{buffer:V,bytesPerRow:R,rowsPerImage:S},{width:E,height:S,depthOrArrayLayers:1}),t.queue.submit([k.finish()]),await V.mapAsync(GPUMapMode.READ);const B=new Uint8Array(V.getMappedRange()),N=new Uint8Array(P*S);for(let U=0;U<S;U++){const Q=U*R,j=U*P;N.set(B.subarray(Q,Q+P),j)}if(V.unmap(),V.destroy(),x==="rgba8unorm"){if(C)for(let U=0;U<N.length;U+=4){const Q=N[U],j=N[U+2];N[U]=j,N[U+2]=Q}return N}if(x==="rgba16float"){const U=new Uint16Array(N.buffer,N.byteOffset,N.byteLength/2),Q=new Float32Array(U.length);for(let j=0;j<U.length;j++)Q[j]=oo(U[j]);return Q}return new Float32Array(N.buffer,N.byteOffset,N.byteLength/4)},async reduceDiffSumSquaredAbs(d,y,E,S){const x=d,C=y,_=Math.max(0,E*S),M=Math.max(1,Math.ceil(_/p)),{pipeline:P,layout:L}=v(),R=M*2*4,A=t.createBuffer({size:R,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),V=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(V,0,new Uint32Array([Math.max(1,E),Math.max(1,S),_,0]));const k=t.createBindGroup({layout:L,entries:[{binding:0,resource:x.gpuTexture.createView()},{binding:1,resource:C.gpuTexture.createView()},{binding:2,resource:{buffer:A}},{binding:3,resource:{buffer:V}}]}),B=t.createBuffer({size:R,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),N=t.createCommandEncoder(),U=N.beginComputePass();U.setPipeline(P),U.setBindGroup(0,k),U.dispatchWorkgroups(M),U.end(),N.copyBufferToBuffer(A,0,B,0,R),t.queue.submit([N.finish()]),await B.mapAsync(GPUMapMode.READ);const j=new Float32Array(B.getMappedRange()).slice();B.unmap(),B.destroy(),A.destroy(),V.destroy();let Te=0,ge=0;for(let oe=0;oe<M;oe++)Te+=j[oe*2],ge+=j[oe*2+1];return{sumSq:Te,sumAbs:ge}},destroy(){l||(t.destroy(),l=!0)},isContextLost(){return!1}}}let Gt=null;async function go(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return mo()}function xt(){return Gt||(Gt=go()),Gt}function xo(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function bo(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),i=Math.floor(o),s=Math.min(i+1,e.length-1),l=o-i,[c,u,p]=xo(e[i],e[s],l);t[n*3]=Math.round(c),t[n*3+1]=Math.round(u),t[n*3+2]=Math.round(p)}return t}const En={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},vo=new Set(["red-green","red-blue"]),_n=new Map;function zt(e){let t=_n.get(e);if(!t){const n=En[e]??En.viridis;t=bo(n),_n.set(e,t)}return t}const Xe=e=>e<0?0:e>1?1:e,Vt=e=>{const t=e<0?0:e;return t/(1+t)},$t=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return Xe(n/r)},Mn={linear:([e,t,n])=>[Xe(e),Xe(t),Xe(n)],srgb:([e,t,n])=>[Xe(e),Xe(t),Xe(n)],reinhard:([e,t,n])=>[Vt(e),Vt(t),Vt(n)],aces:([e,t,n])=>[$t(e),$t(t),$t(n)],extended:([e,t,n])=>[e,t,n]},Sn="srgb",wo=["linear","srgb","reinhard","aces"];function yo(e){return e&&Mn[e]||Mn[Sn]}function Xt(e){return e&&wo.includes(e)?e:Sn}function Eo(e,t){return t?"extended":Xt(e)}function bt(e,t,n){return e*2**t+n}function _o(e){const t=Xe(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function Wt(e,t){return typeof t=="number"&&t>0?Xe(Math.pow(Xe(e),1/t)):_o(e)}function Ht(e,t,n="linear",r=0,o=0){const i=zt(t),s=new ImageData(e.width,e.height),l=e.data,c=s.data,u=r!==0||o!==0;for(let p=0;p<l.length;p+=4){let b=(l[p]+l[p+1]+l[p+2])/3;u&&(b=Math.max(0,Math.min(255,bt(b/255,r,o)*255)));let h;n==="positive"?h=Math.round(128+b/255*127):h=Math.round(b),h=Math.max(0,Math.min(255,h)),c[p]=i[h*3],c[p+1]=i[h*3+1],c[p+2]=i[h*3+2],c[p+3]=l[p+3]}return s}function Mo(e,t){return e==="signed"||e==="relative"?"signed":Yt(t)}function Yt(e){return vo.has(e??"")?"positive":"linear"}function Tn(e){const t=new Map;return{get(n){return t.get(n)},set(n,r){if(t.size>=e){const o=t.keys().next().value;o!==void 0&&t.delete(o)}t.set(n,r)}}}const Pn=Tn(50);function Kt(e){return Pn.get(e)}function qt(e,t){Pn.set(e,t)}const An=Tn(100);function So(e){return An.get(e)}function To(e,t){An.set(e,t)}function Po(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),i=new ImageData(r,o);for(let s=0;s<o;s++)for(let l=0;l<r;l++){const c=(s*e.width+l)*4,u=(s*t.width+l)*4,p=(s*r+l)*4;for(let b=0;b<3;b++){const h=e.data[c+b],v=t.data[u+b],w=h-v,g=Math.abs(w),T=Math.max(h,1);let m;switch(n){case"signed":m=(w+255)/2;break;case"absolute":m=g;break;case"squared":m=w*w/255;break;case"relative_signed":m=(w/T+1)*127.5;break;case"relative_absolute":m=g/T*255;break;case"relative_squared":m=w*w/(T*T)*255;break}i.data[p+b]=Math.min(255,Math.max(0,Math.round(m)))}i.data[p+3]=255}return i}async function rt(e){const t=So(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const i=o.getContext("2d");if(!i){n(null);return}i.drawImage(r,0,0);const s=i.getImageData(0,0,o.width,o.height);To(e,s),n(s)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const Ao={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},Co={linear:0,signed:1,positive:2},Ro=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,Do=`#version 300 es
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
}`;let ot=null,Z=null,Be=null,vt=null;function ko(){if(Z)return Z;try{if(typeof OffscreenCanvas<"u"?ot=new OffscreenCanvas(1,1):ot=document.createElement("canvas"),Z=ot.getContext("webgl2",{preserveDrawingBuffer:!0}),!Z)return console.warn("[cairn] WebGL 2 not available"),null;const e=Z.createShader(Z.VERTEX_SHADER);if(Z.shaderSource(e,Ro),Z.compileShader(e),!Z.getShaderParameter(e,Z.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",Z.getShaderInfoLog(e)),null;const t=Z.createShader(Z.FRAGMENT_SHADER);if(Z.shaderSource(t,Do),Z.compileShader(t),!Z.getShaderParameter(t,Z.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",Z.getShaderInfoLog(t)),null;if(Be=Z.createProgram(),Z.attachShader(Be,e),Z.attachShader(Be,t),Z.linkProgram(Be),!Z.getProgramParameter(Be,Z.LINK_STATUS))return console.error("[cairn] WebGL program link:",Z.getProgramInfoLog(Be)),null;vt=Z.createVertexArray(),Z.bindVertexArray(vt);const n=Z.createBuffer();Z.bindBuffer(Z.ARRAY_BUFFER,n),Z.bufferData(Z.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),Z.STATIC_DRAW);const r=Z.getAttribLocation(Be,"a_pos");return Z.enableVertexAttribArray(r),Z.vertexAttribPointer(r,2,Z.FLOAT,!1,0,0),Z.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),Z}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function Cn(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function Lo(e,t,n){const r=new Uint8Array(1024);for(let i=0;i<256;i++)r[i*4]=t[i*3],r[i*4+1]=t[i*3+1],r[i*4+2]=t[i*3+2],r[i*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function Bo(e,t,n,r){const o=ko();if(!o||!Be||!vt||!ot)return null;const i=Math.min(e.width,t.width),s=Math.min(e.height,t.height);ot.width=i,ot.height=s,o.viewport(0,0,i,s);const l=Cn(o,e,0),c=Cn(o,t,1);let u=null;n.colormap?u=Lo(o,n.colormap,2):(u=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,u),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(Be),o.uniform1i(o.getUniformLocation(Be,"u_baseline"),0),o.uniform1i(o.getUniformLocation(Be,"u_other"),1),o.uniform1i(o.getUniformLocation(Be,"u_lut"),2),o.uniform1i(o.getUniformLocation(Be,"u_diff_mode"),Ao[n.diffMode]),o.uniform1i(o.getUniformLocation(Be,"u_cmap_mode"),Co[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(Be,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(vt),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=i,r.height=s;const p=r.getContext("2d");return p&&(p.save(),p.scale(1,-1),p.drawImage(ot,0,0,i,s,0,-s,i,s),p.restore()),o.deleteTexture(l),o.deleteTexture(c),o.deleteTexture(u),{width:i,height:s}}const Io="cairn:render-mode";function Oo(){try{const e=localStorage.getItem(Io);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const wt=15360;function yt(e){const t=e&32768?-1:1,n=e>>10&31,r=e&1023;return n===0?r===0?t*0:t*r*2**-24:n===31?r===0?t*(1/0):NaN:t*2**(n-15)*(1+r/1024)}const Rn=globalThis.Float16Array;function Dn(e,t=e.length){if(Rn){const r=new Rn(e.buffer,e.byteOffset,t);return Float32Array.from(r)}const n=new Float32Array(t);for(let r=0;r<t;r++)n[r]=yt(e[r]);return n}const We=new Uint32Array(512),He=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(We[e]=0,We[e|256]=32768,He[e]=24,He[e|256]=24):t<-14?(We[e]=1024>>-t-14,We[e|256]=1024>>-t-14|32768,He[e]=-t-1,He[e|256]=-t-1):t<=15?(We[e]=t+15<<10,We[e|256]=t+15<<10|32768,He[e]=13,He[e|256]=13):t<128?(We[e]=31744,We[e|256]=64512,He[e]=24,He[e|256]=24):(We[e]=31744,We[e|256]=64512,He[e]=13,He[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var mt=Uint8Array,kn=Uint16Array,Uo=Int32Array,Fo=new mt([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),No=new mt([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),Ln=function(e,t){for(var n=new kn(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new Uo(n[30]),r=1;r<30;++r)for(var i=n[r];i<n[r+1];++i)o[i]=i-n[r]<<5|r;return{b:n,r:o}},Bn=Ln(Fo,2),Go=Bn.b,zo=Bn.r;Go[28]=258,zo[258]=28,Ln(No,0);for(var Vo=new kn(32768),he=0;he<32768;++he){var Je=(he&43690)>>1|(he&21845)<<1;Je=(Je&52428)>>2|(Je&13107)<<2,Je=(Je&61680)>>4|(Je&3855)<<4,Vo[he]=((Je&65280)>>8|(Je&255)<<8)>>1}for(var Et=new mt(288),he=0;he<144;++he)Et[he]=8;for(var he=144;he<256;++he)Et[he]=9;for(var he=256;he<280;++he)Et[he]=7;for(var he=280;he<288;++he)Et[he]=8;for(var $o=new mt(32),he=0;he<32;++he)$o[he]=5;var Xo=new mt(0),Wo=typeof TextDecoder<"u"&&new TextDecoder,Ho=0;try{Wo.decode(Xo,{stream:!0}),Ho=1}catch{}const In=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function Zt(e){const t=In.length;return In[(e%t+t)%t]}function Yo(e){const n=a.useRef(null),[r,o]=a.useState({w:0,h:0}),i=a.useRef(null),s=a.useRef(null),l=a.useRef(null),c=a.useCallback((u,p)=>{o(b=>b.w===u&&b.h===p?b:{w:u,h:p})},[]);return a.useLayoutEffect(()=>{const u=n.current;if(!u||u===l.current)return;const p=u.getBoundingClientRect();(p.width>0||p.height>0)&&(l.current=u,c(p.width,p.height))}),a.useEffect(()=>{var b;const u=n.current;if(u===s.current||((b=i.current)==null||b.disconnect(),i.current=null,s.current=u,!u))return;const p=new ResizeObserver(h=>{for(const v of h)c(v.contentRect.width,v.contentRect.height)});i.current=p,p.observe(u)}),a.useEffect(()=>()=>{var u;return(u=i.current)==null?void 0:u.disconnect()},[]),{ref:n,size:r}}function Ko(){const[e,t]=a.useState(!1);return a.useEffect(()=>{const n=i=>{(i.key==="Alt"||i.key==="Control"||i.key==="Meta")&&t(!0)},r=i=>{(i.key==="Alt"||i.key==="Control"||i.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const qo=.001;function Zo(e,t=qo){return Math.exp(-e*t)}function On(e,t){return Math.hypot(e.x-t.x,e.y-t.y)}function Un(e,t){return{x:(e.x+t.x)/2,y:(e.y+t.y)/2}}function Qo(e,t,n,r,o,i,s){const l=t>0&&r>0?r/t:1,c=Math.max(i,Math.min(s,e.zoom*l)),u=(n.x-e.pan.x)/e.zoom,p=(n.y-e.pan.y)/e.zoom;return{zoom:c,pan:{x:o.x-u*c,y:o.y-p*c}}}const jo=.25,Qt=64;function jt(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return Qt;const o=Math.min(n/e,r/t);return o<=0?Qt:Math.max(Math.max(n,r)/o,8)}function Fn(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:i=jo,maxZoom:s=Qt,naturalWidth:l,naturalHeight:c}=e,u=Ko(),p=a.useRef(u);p.current=u;const b=a.useRef({zoom:n,pan:r});b.current={zoom:n,pan:r};const h=a.useRef(o);h.current=o,a.useEffect(()=>{const _=t.current;if(!_||!o)return;const M=P=>{var j;if(!P.ctrlKey&&!p.current)return;P.preventDefault(),P.stopPropagation();const L=Zo(P.deltaY),R=b.current,A=_.getBoundingClientRect(),V=l&&c?jt(l,c,A.width,A.height):s,k=Math.max(i,Math.min(V,R.zoom*L));if(R.zoom===k)return;const B=P.clientX-A.left,N=P.clientY-A.top,U=B-(B-R.pan.x)/R.zoom*k,Q=N-(N-R.pan.y)/R.zoom*k;(j=h.current)==null||j.call(h,{zoom:k,pan:{x:U,y:Q}})};return _.addEventListener("wheel",M,{passive:!1}),()=>_.removeEventListener("wheel",M)},[t,!!o,i,s,l,c]);const v=a.useRef(new Map),w=a.useRef(null),g=a.useRef(null),T=a.useCallback((_,M,P)=>{const L=_.getBoundingClientRect();return{x:M-L.left,y:P-L.top}},[]),m=a.useCallback(_=>{if(!l||!c)return s;const M=_.getBoundingClientRect();return jt(l,c,M.width,M.height)},[l,c,s]),d=a.useCallback((_,M)=>{const P=v.current,L=P.get(_),R=P.get(M);!L||!R||(w.current=null,g.current={idA:_,idB:M,startDist:On(L,R),startMid:Un(L,R),startZoom:b.current.zoom,startPan:{...b.current.pan}})},[]),y=a.useCallback(_=>{const M=v.current.get(_);M&&(w.current={pointerId:_,startX:M.x,startY:M.y,panX:b.current.pan.x,panY:b.current.pan.y})},[]),E=a.useCallback(_=>{if(!h.current)return;const M=_.pointerType==="touch";if(!M&&!p.current)return;const P=_.currentTarget;if(P.setPointerCapture(_.pointerId),v.current.set(_.pointerId,T(P,_.clientX,_.clientY)),M&&v.current.size>=2){const L=[...v.current.keys()];d(L[L.length-2],L[L.length-1]);return}y(_.pointerId)},[T,d,y]),S=a.useCallback(_=>{var A,V;const M=_.currentTarget,P=v.current.get(_.pointerId);if(P){const k=T(M,_.clientX,_.clientY);P.x=k.x,P.y=k.y}const L=g.current;if(L){const k=v.current.get(L.idA),B=v.current.get(L.idB);if(!k||!B)return;const N=Qo({zoom:L.startZoom,pan:L.startPan},L.startDist,L.startMid,On(k,B),Un(k,B),i,m(M));(A=h.current)==null||A.call(h,N);return}const R=w.current;!R||R.pointerId!==_.pointerId||!P||(V=h.current)==null||V.call(h,{zoom:b.current.zoom,pan:{x:R.panX+(P.x-R.startX),y:R.panY+(P.y-R.startY)}})},[T,i,m]),x=a.useCallback(_=>{var P;try{_.currentTarget.releasePointerCapture(_.pointerId)}catch{}v.current.delete(_.pointerId);const M=g.current;if(M&&(_.pointerId===M.idA||_.pointerId===M.idB)){g.current=null;const L=[...v.current.keys()];L.length===1&&y(L[0]);return}((P=w.current)==null?void 0:P.pointerId)===_.pointerId&&(w.current=null)},[y]);return{containerProps:{onPointerDown:E,onPointerMove:S,onPointerUp:x,onPointerCancel:x,style:{cursor:u&&!!o?"move":void 0,touchAction:o?"none":void 0}},modifierActive:u}}function Jt(){const[e,t]=a.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return a.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),i())};function i(){if(n)return;const s=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${s}dppx)`),r.addEventListener("change",o,{once:!0})}return i(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function ct(e){const t=a.useRef(e),[n,r]=a.useState(e),o=a.useCallback(()=>r(t.current),[]);return[n,r,{reset:o,isModified:!Object.is(n,t.current),default:t.current}]}function Jo(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function Nn(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function en({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:i}=Yo(),s=a.useRef(null),l=a.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),c=a.useMemo(()=>{const g=i.w,T=i.h;if(g<=0||T<=0||n<=0||r<=0)return null;const m=Math.min(g/n,T/r),d=n*m,y=r*m;return{left:(g-d)/2,top:(T-y)/2,width:d,height:y}},[i.w,i.h,n,r]),u=e.masks,p=t.showMasks&&!!u&&u.length>0,b=a.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(a.useEffect(()=>{if(!p||!u)return;const g=s.current;if(!g)return;(g.width!==n||g.height!==r)&&(g.width=n,g.height=r);const T=g.getContext("2d");if(!T)return;T.clearRect(0,0,g.width,g.height);let m=!1;const d=T.createImageData(n,r),y=d.data;let E=u.length,S=!1;const x=()=>{m||S&&T.putImageData(d,0,0)},C=document.createElement("canvas");C.width=n,C.height=r;const _=C.getContext("2d",{willReadFrequently:!0});for(const M of u){const P=new Image;P.onload=()=>{if(!m){if(_){_.clearRect(0,0,n,r),_.drawImage(P,0,0,n,r);const L=_.getImageData(0,0,n,r).data;for(let R=0;R<n*r;R++){const A=L[R*4];if(A===0||l.has(A))continue;const[V,k,B]=Jo(Zt(A));y[R*4]=V,y[R*4+1]=k,y[R*4+2]=B,y[R*4+3]=255,S=!0}}E-=1,E===0&&x()}},P.onerror=()=>{E-=1,E===0&&x()},P.src=`data:image/png;base64,${M.png_b64}`}return()=>{m=!0}},[p,u,n,r,b]),!c)return f.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const h=e.boxes??[],v=t.showBoxes&&h.length>0,w=e.class_labels??{};return f.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[p&&f.jsx("canvas",{ref:s,className:"absolute",style:{left:c.left,top:c.top,width:c.width,height:c.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),v&&f.jsx("svg",{className:"absolute",style:{left:c.left,top:c.top,width:c.width,height:c.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:h.map((g,T)=>{if(!Nn(g,t,l))return null;const m=g.domain==="pixel"?1:n,d=g.domain==="pixel"?1:r,y=g.position.minX*m,E=g.position.minY*d,S=(g.position.maxX-g.position.minX)*m,x=(g.position.maxY-g.position.minY)*d;return f.jsx("rect",{x:y,y:E,width:S,height:x,fill:"none",stroke:Zt(g.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},T)})}),v&&f.jsx("div",{className:"absolute",style:{left:c.left,top:c.top,width:c.width,height:c.height},children:h.map((g,T)=>{if(!Nn(g,t,l))return null;const m=g.domain==="pixel"?1/n:1,d=g.domain==="pixel"?1/r:1,y=g.position.minX*m*100,E=g.position.minY*d*100,S=g.label??w[String(g.class_id)]??`#${g.class_id}`,x=g.score!=null?` ${(g.score*100).toFixed(0)}%`:"";return!S&&!x?null:f.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${y}%`,top:`${E}%`,transform:"translateY(-100%)",backgroundColor:Zt(g.class_id)},children:f.jsxs("span",{className:"mono",children:[S,x]})},T)})})]})}const tn=30,_t=["#ff5a5a","#39d353","#5b9bff"];function nn(e){if(!Number.isFinite(e))return"0";const t=Math.abs(e);return t!==0&&(t<.001||t>=1e4)?e.toExponential(1):String(Number(e.toPrecision(3)))}function lt(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):nn(e/255):nn(n==="int"?e*255:e)}function st(e,t,n,r){return e.length===1?{lines:[lt(e[0],t,n)],luminance:r}:{lines:e.map(o=>lt(o,t,n)),luminance:r,colors:e.map((o,i)=>_t[i]??null)}}const es={x:0,y:0,w:1,h:1};function it({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:i,notation:s="decimal",version:l=0,onActiveChange:c,sourceWindow:u=es}){const p=a.useRef(null),b=a.useRef(!1),h=Jt(),v=a.useRef(c);v.current=c;const w=a.useCallback(T=>{var m;T!==b.current&&(b.current=T,(m=v.current)==null||m.call(v,T))},[]),g=a.useCallback(()=>{var Oe;const T=p.current,m=e.current;if(!T)return;const d=window.devicePixelRatio||1,y=T.clientWidth,E=T.clientHeight;if(y===0||E===0)return;T.width!==Math.round(y*d)&&(T.width=Math.round(y*d)),T.height!==Math.round(E*d)&&(T.height=Math.round(E*d));const S=T.getContext("2d");if(!S)return;if(S.setTransform(d,0,0,d,0,0),S.clearRect(0,0,y,E),!m||t<=0||n<=0){w(!1);return}const x=m.getBoundingClientRect(),C=T.getBoundingClientRect();if(x.width===0||x.height===0){w(!1);return}const _=u.x*t,M=u.y*n,P=u.w*t,L=u.h*n;if(P<=0||L<=0){w(!1);return}const R=Math.min(x.width/P,x.height/L);if(R<tn){w(!1);return}const A=P*R,V=L*R,k=x.left+(x.width-A)/2-C.left,B=x.top+(x.height-V)/2-C.top,N=Math.max(Math.floor(_),Math.floor(_+(0-k)/R)),U=Math.min(Math.ceil(_+P),Math.ceil(_+(y-k)/R)),Q=Math.max(Math.floor(M),Math.floor(M+(0-B)/R)),j=Math.min(Math.ceil(M+L),Math.ceil(M+(E-B)/R));if(U<=N||j<=Q){w(!1);return}w(!0);const Te=k+(0-_)*R,ge=B+(0-M)*R,oe=k+(t-_)*R,Me=B+(n-M)*R;S.save(),S.beginPath(),S.rect(Te,ge,oe-Te,Me-ge),S.clip(),S.textAlign="center",S.textBaseline="middle",S.lineJoin="round";const we=R*.14,se=R-we*2;for(let xe=Q;xe<j;xe++)for(let ie=N;ie<U;ie++){if(ie<0||xe<0||ie>=t||xe>=n)continue;const ee=i(ie,xe,s);if(!ee||ee.lines.length===0)continue;const $=ee.lines.length;let Y=1;for(const De of ee.lines)De.length>Y&&(Y=De.length);const Se=se/($*1.15),be=se/(Y*.62)||Se,me=Math.min(Se,be,24);if(me<6)continue;const fe=k+(ie-_+.5)*R,Ce=B+(xe-M+.5)*R,Re=me*1.15,Ne=ee.luminance<=.55,nt=Ne?"#ffffff":"#000000";S.font=`${me}px ui-monospace, SFMono-Regular, Menlo, monospace`,S.lineWidth=Math.max(1.4,me*.16),S.strokeStyle=Ne?"rgba(0,0,0,0.85)":"rgba(255,255,255,0.9)";let Fe=Ce-$*Re/2+Re/2;for(let De=0;De<ee.lines.length;De++){const F=ee.lines[De];S.strokeText(F,fe,Fe),S.fillStyle=((Oe=ee.colors)==null?void 0:Oe[De])??nt,S.fillText(F,fe,Fe),Fe+=Re}}S.restore()},[e,t,n,i,s,w,u]);return a.useEffect(()=>{g()},[g,r,o.x,o.y,l,s,u,h]),a.useEffect(()=>{const T=p.current;if(!T)return;const m=new ResizeObserver(()=>g());return m.observe(T),()=>m.disconnect()},[g]),f.jsx("canvas",{ref:p,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function Gn({notation:e,onChange:t,className:n=""}){return f.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const ts=`
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

// operatorId: 0=linear, 1=srgb, 2=reinhard, 3=aces, 4=extended (matches
// TONEMAP_OPERATORS key order in image/tonemap.ts). linear/srgb are the SAME
// clamp — the sRGB OETF lives in outputEncodeF, not here. 4 (extended) is a
// pure identity — no compression, no clamp — deliberately preserving values
// above 1.0 for a real HDR (hdrOut) target; see image/tonemap.ts's doc
// comment on the "extended" entry for why.
fn applyOperator(rgb: vec3<f32>, operatorId: i32) -> vec3<f32> {
  if (operatorId == 2) {
    return vec3<f32>(reinhardCurve(rgb.x), reinhardCurve(rgb.y), reinhardCurve(rgb.z));
  }
  if (operatorId == 3) {
    return vec3<f32>(acesCurve(rgb.x), acesCurve(rgb.y), acesCurve(rgb.z));
  }
  if (operatorId == 4) {
    return rgb;
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

  // 3) tone-map operator: HDR [0,inf) -> display-linear [0,1].
  rgb = applyOperator(rgb, operatorId);

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
`,ut=`
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
`,Mt=`
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
`,ns=`
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
`,St=`
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
`;function zn(e){return`
${Ue}
${ut}
${ns}

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
`}const rs=zn("select(colorB, colorA, uv.x < split)"),os=zn("mix(colorA, colorB, alpha)");function ss(e){switch(e){case"center":return{v:"center",h:"center"};case"top-right":return{v:"top",h:"right"};case"bottom-left":return{v:"bottom",h:"left"};case"bottom-right":return{v:"bottom",h:"right"};case"top-left":default:return{v:"top",h:"left"}}}function Vn(e,t,n){const{v:r,h:o}=ss(n),i=e.w-t.w,s=e.h-t.h,l=o==="left"?0:o==="right"?i:Math.floor(i/2),c=r==="top"?0:r==="bottom"?s:Math.floor(s/2);return{x:l,y:c}}function Tt(e,t,n,r,o="b"){if(r==="fill"){const s=o==="a"?{w:e.w,h:e.h}:{w:t.w,h:t.h};return{fit:r,result:s,offsetA:{x:0,y:0},offsetB:{x:0,y:0}}}const i={w:Math.min(e.w,t.w),h:Math.min(e.h,t.h)};return{fit:r,result:i,offsetA:Vn(e,i,n),offsetB:Vn(t,i,n)}}function is(e){return`${e.fit}:${e.result.w}x${e.result.h}:${e.offsetA.x},${e.offsetA.y}:${e.offsetB.x},${e.offsetB.y}`}const rn={linear:0,srgb:1,reinhard:2,aces:3,extended:4},$n=new WeakMap;function as(e,t){let n=$n.get(e);n||(n=new Map,$n.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:ts,targetFormat:t}),n.set(t,r)),r}function Xn(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function Wn(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function cs(e,t,n,r){var g;const o=Xn(t),i=as(e,o),s=Wn(e,r.isScalar?r.colormap:void 0),l=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,c=rn[r.operator]??rn.srgb,u=new Float32Array([r.exposureEV,c,l,r.isScalar?1:0]),p=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),b=new Float32Array([r.hdrOut?1:0]),h=new Float32Array([r.filter==="nearest"?0:1]),v=new Float32Array([r.offset??0]);let w;try{w=e.createBindGroup(i,[{binding:0,resource:n},{binding:1,resource:s},{binding:2,resource:{uniform:u}},{binding:3,resource:{uniform:p}},{binding:4,resource:{uniform:b}},{binding:5,resource:{uniform:h}},{binding:6,resource:{uniform:v}}]),e.renderFullscreen(t,i,w)}finally{(g=w==null?void 0:w.destroy)==null||g.call(w),s.destroy()}}const Hn=new WeakMap;function ls(e,t,n){let r=Hn.get(e);r||(r=new Map,Hn.set(e,r));const o=`${t}:${n}`;let i=r.get(o);return i||(i=e.createRenderPipeline({shaderWGSL:t==="split"?rs:os,targetFormat:n}),r.set(o,i)),i}function us(e,t,n,r,o){var g;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const i=Xn(t),s=ls(e,o.mode,i),l=Wn(e,void 0),c=o.gamma,u=rn[o.operator],p=new Float32Array([o.exposureEV,u,c,0]),b=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),h=new Float32Array([o.split,o.alpha,0,o.filter==="nearest"?0:1]),v=new Float32Array([o.offset??0,0,0,0]);let w;try{w=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:l},{binding:3,resource:{uniform:p}},{binding:4,resource:{uniform:b}},{binding:5,resource:{uniform:h}},{binding:6,resource:{uniform:v}}]),e.renderFullscreen(t,s,w)}finally{(g=w==null?void 0:w.destroy)==null||g.call(w),l.destroy()}}function Yn(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,i=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:i,mae:o}}async function Kn(e,t,n,r){const o=r??Tt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),i=o.result.w,s=o.result.h,l=i*s*3;if(l<=0)return{mse:0,psnr:1/0,mae:0};if(o.fit==="crop"&&o.offsetA.x===0&&o.offsetA.y===0&&o.offsetB.x===0&&o.offsetB.y===0&&e.reduceDiffSumSquaredAbs){const{sumSq:y,sumAbs:E}=await e.reduceDiffSumSquaredAbs(t,n,i,s);return Yn(y,E,l)}const u=await e.readback(t),p=await e.readback(n),b=u instanceof Uint8Array?255:1,h=p instanceof Uint8Array?255:1,v=qn(u,t.width,t.height,b,o.offsetA,o.fit==="fill",i,s),w=qn(p,n.width,n.height,h,o.offsetB,o.fit==="fill",i,s);let g=0,T=0;const m=[0,0,0],d=[0,0,0];for(let y=0;y<s;y++)for(let E=0;E<i;E++){v(E,y,m),w(E,y,d);for(let S=0;S<3;S++){const x=m[S]-d[S];g+=x*x,T+=Math.abs(x)}}return Yn(g,T,l)}function qn(e,t,n,r,o,i,s,l){const c=(b,h,v)=>e[(h*t+b)*4+v]??0;if(!i)return(b,h,v)=>{const w=Math.min(Math.max(b+o.x,0),t-1),g=Math.min(Math.max(h+o.y,0),n-1);v[0]=c(w,g,0)/r,v[1]=c(w,g,1)/r,v[2]=c(w,g,2)/r};const u=t-1,p=n-1;return(b,h,v)=>{const w=(b+.5)/s,g=(h+.5)/l,T=w*t-.5,m=g*n-.5,d=Math.floor(T),y=Math.floor(m),E=T-d,S=m-y,x=Math.min(Math.max(d,0),u),C=Math.min(Math.max(d+1,0),u),_=Math.min(Math.max(y,0),p),M=Math.min(Math.max(y+1,0),p);for(let P=0;P<3;P++){const L=c(x,_,P),R=c(C,_,P),A=c(x,M,P),V=c(C,M,P),k=L+(R-L)*E,B=A+(V-A)*E;v[P]=(k+(B-k)*S)/r}}}function Zn(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const fs=12,et=[];function Qn(e){const t=et.indexOf(e);t!==-1&&et.splice(t,1),et.push(e)}function ds(e){const t=et.indexOf(e);t!==-1&&et.splice(t,1)}function Pt(e){e.parked||(ds(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),e.surface=null,e.parked=!0)}function jn(e){for(;et.length>fs;){const t=et.find(n=>n!==e&&!n.visible)??et.find(n=>n!==e);if(!t)break;Pt(t)}}function Jn(e){var o,i,s,l;if(e.disposed)return;if(Zn())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){Qn(e),jn(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||((i=e.deep)==null?void 0:i.width)||1,r=e.backingHeight||((s=e.source)==null?void 0:s.height)||((l=e.deep)==null?void 0:l.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.deep){const c=t.createTexture(e.deep.width,e.deep.height,"rgba16float");e.srcTexture=c,e.deepBuffers=t.createDeepSampleBuffers(e.deep),t.compositeDeep(e.deepBuffers,c,e.deepZClip)}else if(e.source){const c=t.createTexture(e.source.width,e.source.height,e.source.format);c.write(e.source.data),e.srcTexture=c}e.parked=!1,Qn(e),jn(e)}function ps(e,t){if(e.disposed||!e.source&&!e.deep)return!0;try{return Jn(e),!e.surface||!e.srcTexture?!1:(cs(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,Pt(e),!1}}function hs(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,e.deep=null,e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},setDeepSource(t,n){if(!e.disposed&&(e.deep=t,e.deepZClip=n,e.source=null,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy(),e.deepBuffers&&e.deepBuffers.destroy();const r=e.device.createTexture(t.width,t.height,"rgba16float");e.srcTexture=r,e.deepBuffers=e.device.createDeepSampleBuffers(t),e.device.compositeDeep(e.deepBuffers,r,n)}},setDeepZClip(t){e.disposed||(e.deepZClip=t,!e.parked&&e.deepBuffers&&e.srcTexture&&e.device.compositeDeep(e.deepBuffers,e.srcTexture,t))},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return ps(e,t)},park(){e.disposed||Pt(e)},restore(){e.disposed||!e.source&&!e.deep||Jn(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(Pt(e),e.source=null,e.deep=null,e.disposed=!0)}}}async function ms(e,t){const n=await xt(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,deep:null,deepZClip:0,deepBuffers:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return hs(r)}function er(e){e.dispose()}function gs(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:i}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...i?["invert(1)"]:[]].join(" ")}function tr(e){const n=`cairn-gamma-${a.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:i,exposure:s,offset:l,flipSign:c}=e,u=a.useMemo(()=>gs(e,n),[n,r,o,s,c]);return{gammaFilterId:n,filterStr:u,gamma:i,offset:l}}function nr({id:e,gamma:t,offset:n}){return f.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:f.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:f.jsxs("feComponentTransfer",{children:[f.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),f.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),f.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}function rr(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function xs({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=rr(e),i=rr(t),s=[];for(let d=0;d<=e;d+=o)s.push(d);const l=[];for(let d=0;d<=t;d+=i)l.push(d);const c=1/n,u=8*c,p=-12*c,b=-2*c,h=r==null?void 0:r.current;let v=0,w=0,g=0,T=0;if(h){const d=h.clientWidth,y=h.clientHeight,E=d/e,S=y/t,x=Math.min(E,S);g=e*x,T=t*x,v=(d-g)/2,w=(y-T)/2}const m=h&&g>0;return f.jsxs(f.Fragment,{children:[f.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:m?w:0,transform:`translateY(${p}px)`,fontSize:u},children:s.map(d=>f.jsx("span",{className:"mono",style:{position:"absolute",left:m?v+d/e*g:`${d/e*100}%`,transform:"translateX(-50%)"},children:d},d))}),f.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:m?v:0,transform:`translateX(${b}px)`,fontSize:u},children:l.map(d=>f.jsx("span",{className:"mono",style:{position:"absolute",top:m?w+d/t*T:`${d/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*c}px`},children:d},d))})]})}function bs({label:e,isDraggable:t,onDragStart:n}){return f.jsxs("span",{className:`absolute bottom-1 left-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${t?" cairn-drag-grip":""}`,draggable:t,onDragStart:n,style:{cursor:t?"grab":void 0},children:[t&&f.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const vs=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function or(e,t){const n=getComputedStyle(e),r=vs.map(c=>`${c}:${n.getPropertyValue(c)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const i=e.children,s=t.children,l=Math.min(i.length,s.length);for(let c=0;c<l;c++)or(i[c],s[c])}function on(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function sn(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function an(e,t,n,r,o){const i=document.createElement("canvas");i.width=Math.max(1,Math.round(e*n)),i.height=Math.max(1,Math.round(t*n));const s=i.getContext("2d");if(!s)throw new Error("plot-to-png: 2D canvas context unavailable");return s.scale(n,n),r&&(s.fillStyle=r,s.fillRect(0,0,e,t)),o(s),await new Promise((l,c)=>i.toBlob(u=>u?l(u):c(new Error("plot-to-png: toBlob returned null")),"image/png"))}function ws(e,t,n){const r=e.cloneNode(!0);or(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),i="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((s,l)=>{const c=new Image;c.onload=()=>s(c),c.onerror=()=>l(new Error("plot-to-png: SVG rasterization failed")),c.src=i})}async function sr(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,i=(t==null?void 0:t.background)??on(e);return an(r,o,sn(t),i,s=>s.drawImage(e,0,0,r,o))}async function ys(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,i=(t==null?void 0:t.background)??on(e);try{return await an(r,o,sn(t),i,s=>s.drawImage(e,0,0,r,o))}catch(s){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${s instanceof Error?s.message:String(s)})`)}}function Es(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const i=o.getBoundingClientRect(),s=i.width*i.height;s>r&&(r=s,n=o)}return n}async function _s(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),i=o.width||300,s=o.height||150,l=(t==null?void 0:t.background)??on(e);if(n){const u=n.getBoundingClientRect(),p=await ws(n,u.width||i,u.height||s);return an(i,s,sn(t),l,b=>{for(const h of r){const v=h.getBoundingClientRect();b.drawImage(h,v.left-o.left,v.top-o.top,v.width,v.height)}b.drawImage(p,u.left-o.left,u.top-o.top,u.width,u.height)})}if(r.length)return sr(r[0],t);const c=Es(e);if(c)return ys(c,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function Ms(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const Ss=8;function Ts(e,t,n,r=Ss){return!(t>0)||!(e>0)?n:e<t+r}function ir(e,t){return Math.max(0,e.findIndex(n=>n.id===t))}function Ps(e){const t=e.trim();if(t==="")return null;const n=t.replace(/−/g,"-").replace(",","."),r=Number(n);return Number.isFinite(r)?r:null}function As(e,t){const n=Ps(e);return n===null?t:n}function Cs(e){return String(e)}const Rs={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},Ds={boxZoom:f.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:f.jsxs(f.Fragment,{children:[f.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),f.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),f.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),f.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 2v20M2 12h20"}),f.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),f.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),f.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:f.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:f.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),f.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:f.jsx("path",{d:"M6 9l6 6 6-6"}),ellipsis:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"5",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),f.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),f.jsx("circle",{cx:"19",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"})]}),sun:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"12",cy:"12",r:"4"}),f.jsx("path",{d:"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"})]}),plusminus:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M4 7h6M7 4v6"}),f.jsx("path",{d:"M14 17h6"}),f.jsx("path",{d:"M6 20l12-16"})]}),layers:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 3l9 5-9 5-9-5 9-5z"}),f.jsx("path",{d:"M3 13l9 5 9-5"})]})};function qe({name:e}){return f.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:Ds[e]??null})}function ar({icon:e,label:t,title:n,active:r,disabled:o,onClick:i}){return f.jsx("button",{type:"button",disabled:o,onClick:s=>{s.stopPropagation(),!o&&i()},onPointerDown:s=>s.stopPropagation(),onDoubleClick:s=>s.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?f.jsx("span",{"aria-hidden":"true",children:t}):f.jsx(qe,{name:e??""})})}function cr(){return f.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function ks({icon:e,title:t,menu:n}){var T;const{options:r,value:o,onSelect:i}=n,[s,l]=a.useState(!1),[c,u]=a.useState(0),p=a.useRef(null),b=ir(r,o),h=e?void 0:((T=r[b])==null?void 0:T.label)??"",v=a.useCallback(()=>{l(m=>{const d=!m;return d&&u(b),d})},[b]),w=a.useCallback(m=>{i(m),l(!1)},[i]);a.useEffect(()=>{if(!s)return;const m=y=>{p.current&&!p.current.contains(y.target)&&l(!1)},d=y=>{y.key==="Escape"&&(y.stopPropagation(),l(!1))};return document.addEventListener("pointerdown",m,!0),document.addEventListener("keydown",d,!0),()=>{document.removeEventListener("pointerdown",m,!0),document.removeEventListener("keydown",d,!0)}},[s]);const g=m=>{if(!s){(m.key==="ArrowDown"||m.key==="Enter"||m.key===" ")&&(m.preventDefault(),u(b),l(!0));return}if(m.key==="ArrowDown")m.preventDefault(),u(d=>(d+1)%r.length);else if(m.key==="ArrowUp")m.preventDefault(),u(d=>(d-1+r.length)%r.length);else if(m.key==="Enter"||m.key===" "){m.preventDefault();const d=r[c];d&&w(d.id)}};return f.jsxs("div",{ref:p,className:"relative inline-flex",onPointerDown:m=>m.stopPropagation(),children:[f.jsxs("button",{type:"button",onClick:m=>{m.stopPropagation(),v()},onDoubleClick:m=>m.stopPropagation(),onKeyDown:g,"aria-haspopup":"listbox","aria-expanded":s,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",h?"px-1.5 text-[10px] font-mono":"px-1 text-xs",s?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[h?f.jsx("span",{"aria-hidden":"true",children:h}):f.jsx(qe,{name:e??""}),f.jsx(qe,{name:"caret"})]}),s&&f.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((m,d)=>{const y=m.id===o,E=d===c;return f.jsx("li",{role:"option","aria-selected":y,children:f.jsx("button",{type:"button",onClick:S=>{S.stopPropagation(),w(m.id)},onPointerEnter:()=>u(d),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",E?"bg-bg-hover":"",y?"text-accent font-medium":"text-fg"].join(" "),children:m.label})},m.id)})})]})}const Ls=e=>e.format?e.format(e.value):String(e.value);function lr({spec:e}){const[t,n]=a.useState(!1),[r,o]=a.useState(""),i=a.useRef(null),s=a.useCallback(()=>{o(Cs(e.value)),n(!0)},[e.value]);a.useEffect(()=>{t&&i.current&&(i.current.focus(),i.current.select())},[t]);const l=a.useCallback(()=>{n(u=>(u&&e.onChange(As(r,e.value)),!1))},[r,e]),c=a.useCallback(()=>n(!1),[]);return f.jsxs("label",{className:"inline-flex items-center gap-1 text-fg-muted",title:e.title,onPointerDown:u=>u.stopPropagation(),onDoubleClick:u=>{u.stopPropagation(),t||s()},children:[e.icon?f.jsx("span",{"aria-hidden":"true",className:"inline-flex",children:f.jsx(qe,{name:e.icon})}):f.jsx("span",{"aria-hidden":"true",className:"text-[9px] font-mono",children:e.label}),t?f.jsx("input",{ref:i,type:"text",inputMode:"decimal","aria-label":`${e.title} (numeric entry)`,value:r,onChange:u=>o(u.target.value),onPointerDown:u=>u.stopPropagation(),onDoubleClick:u=>u.stopPropagation(),onKeyDown:u=>{u.stopPropagation(),u.key==="Enter"?(u.preventDefault(),l()):u.key==="Escape"&&(u.preventDefault(),c())},onBlur:l,className:"cairn-plot-toolbar-slider-entry h-3.5 w-[6.5rem] rounded border border-border bg-bg px-1 text-[9px] font-mono tabular-nums text-fg outline-none focus:border-accent"}):f.jsxs(f.Fragment,{children:[f.jsx("input",{type:"range","aria-label":e.title,min:e.min,max:e.max,step:e.step,value:e.value,onChange:u=>e.onChange(Number(u.target.value)),onPointerDown:u=>u.stopPropagation(),className:"cairn-plot-toolbar-slider h-1 w-16 cursor-pointer accent-accent"}),f.jsx("span",{"aria-hidden":"true",className:"w-8 text-right text-[9px] font-mono tabular-nums",children:Ls(e)})]})]})}function Bs({icon:e,title:t,menu:n,onClose:r}){var b;const{options:o,value:i,onSelect:s}=n,[l,c]=a.useState(!1),u=ir(o,i),p=((b=o[u])==null?void 0:b.label)??"";return f.jsxs("div",{children:[f.jsxs("button",{type:"button","aria-haspopup":"menu","aria-expanded":l,"aria-label":t,onClick:h=>{h.stopPropagation(),c(v=>!v)},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",l?"text-accent":"text-fg hover:bg-bg-hover"].join(" "),children:[e?f.jsx(qe,{name:e}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{className:"flex-1",children:t}),f.jsx("span",{className:"font-mono text-[10px] text-fg-muted",children:p}),f.jsx("span",{className:l?"rotate-180 transition-transform":"transition-transform",children:f.jsx(qe,{name:"caret"})})]}),l&&o.map(h=>{const v=h.id===i;return f.jsxs("button",{type:"button",role:"menuitemradio","aria-checked":v,"data-menu-option":"",onClick:w=>{w.stopPropagation(),s(h.id),r()},className:["flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-[11px]",v?"text-accent font-medium bg-bg-hover/40":"text-fg hover:bg-bg-hover"].join(" "),children:[f.jsx("span",{"aria-hidden":"true",className:"w-3 text-center text-accent",children:v?"✓":""}),f.jsx("span",{children:h.label})]},h.id)})]})}function Is({actions:e,leading:t,sliders:n}){const[r,o]=a.useState(!1),i=a.useRef(null);return a.useEffect(()=>{if(!r)return;const s=c=>{i.current&&!i.current.contains(c.target)&&o(!1)},l=c=>{c.key==="Escape"&&(c.stopPropagation(),o(!1))};return document.addEventListener("pointerdown",s,!0),document.addEventListener("keydown",l,!0),()=>{document.removeEventListener("pointerdown",s,!0),document.removeEventListener("keydown",l,!0)}},[r]),f.jsxs("div",{ref:i,className:"relative inline-flex",onPointerDown:s=>s.stopPropagation(),children:[f.jsx("button",{type:"button",onClick:s=>{s.stopPropagation(),o(l=>!l)},onDoubleClick:s=>s.stopPropagation(),"aria-haspopup":"menu","aria-expanded":r,"aria-label":"More controls",title:"More controls",className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded text-xs",r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:f.jsx(qe,{name:"ellipsis"})}),r&&f.jsxs("div",{role:"menu",className:["absolute right-0 top-full z-40 mt-1 min-w-[10rem] max-h-80 overflow-auto","rounded border border-border bg-bg-elevated py-1 shadow-md"].join(" "),children:[t.map(s=>s.menu?f.jsx(Bs,{icon:s.icon,title:s.title,menu:s.menu,onClose:()=>o(!1)},s.id):f.jsxs("button",{type:"button",disabled:s.disabled,onClick:l=>{var c;l.stopPropagation(),!s.disabled&&((c=s.onClick)==null||c.call(s),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?f.jsx(qe,{name:s.icon}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{children:s.label??s.title})]},s.id)),t.length>0&&e.length>0&&f.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),e.map(s=>f.jsxs("button",{type:"button",role:"menuitem",disabled:s.disabled,onClick:l=>{l.stopPropagation(),!s.disabled&&(s.onClick(),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?f.jsx(qe,{name:s.icon}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{children:s.title})]},s.id)),n.length>0&&(e.length>0||t.length>0)&&f.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),n.map(s=>f.jsx("div",{className:"px-2 py-1",children:f.jsx(lr,{spec:s})},s.id))]})]})}function Os({controller:e,config:t}){var L,R;const n=a.useRef(null),[r,o]=a.useState(!1),i=a.useRef(r);i.current=r;const s=a.useRef(0),l=`${((L=t==null?void 0:t.leadingButtons)==null?void 0:L.length)??0}:${((R=t==null?void 0:t.sliders)==null?void 0:R.length)??0}:${(t==null?void 0:t.visibility)??"hover"}`;if(a.useEffect(()=>{const A=n.current,V=A==null?void 0:A.parentElement;if(!V)return;const k=()=>{const Q=V.clientWidth;if(!i.current&&n.current){const j=n.current.scrollWidth;j>0&&(s.current=j)}o(Ts(Q,s.current,i.current))};let B=0;const N=()=>{B||(B=requestAnimationFrame(()=>{B=0,k()}))},U=new ResizeObserver(N);return U.observe(V),k(),()=>{U.disconnect(),B&&cancelAnimationFrame(B)}},[l]),(t==null?void 0:t.enabled)===!1)return null;const c=e.capabilities,u=t==null?void 0:t.buttons,p=(A,V)=>V&&(u==null?void 0:u[A])!==!1,b=A=>()=>e.setDragMode(A),h=()=>{e.toPNG({filename:"plot"}).then(A=>Ms(A,"plot.png")).catch(()=>{})},v=[];p("zoom",c.zoom)&&v.push({id:"zoom",icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:b("zoom")}),p("pan",c.pan)&&v.push({id:"pan",icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:b("pan")}),p("select",c.select)&&v.push({id:"select",icon:"select",title:"Box select",active:e.dragMode==="select",onClick:b("select")}),p("lasso",c.lasso)&&v.push({id:"lasso",icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:b("lasso")});const w=[];p("zoomIn",c.zoom)&&w.push({id:"zoomIn",icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),p("zoomOut",c.zoom)&&w.push({id:"zoomOut",icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()});const g=[];p("autoscale",c.autoscale)&&g.push({id:"autoscale",icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),p("reset",c.reset)&&g.push({id:"reset",icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()});const T=[];p("screenshot",c.screenshot)&&T.push({id:"screenshot",icon:"camera",title:"Download plot as PNG",onClick:h});const m=[v,w,g,T].filter(A=>A.length>0),d=m.flat(),y=(t==null?void 0:t.leadingButtons)??[],E=(t==null?void 0:t.sliders)??[];if(!y.length&&d.length===0&&E.length===0)return null;const S=(t==null?void 0:t.position)??"top-right",x=(t==null?void 0:t.visibility)==="always",C=S==="top-right"||S==="bottom-right",M=["cairn-plot-toolbar z-30 rounded border border-border bg-bg-elevated/90 shadow-sm backdrop-blur-sm transition-opacity",x?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),P={position:"absolute",pointerEvents:"auto",...Rs[S]};return r?f.jsx("div",{ref:n,style:P,className:`${M} inline-flex px-0.5 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:f.jsx(Is,{actions:d,leading:y,sliders:E})}):f.jsxs("div",{ref:n,style:P,className:`${M} flex flex-col gap-0.5 px-1 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:[f.jsxs("div",{className:`flex items-center gap-0.5 ${C?"justify-end":"justify-start"}`,children:[y.length>0&&f.jsxs(f.Fragment,{children:[y.map(A=>A.menu?f.jsx(ks,{icon:A.icon,title:A.title,menu:A.menu},A.id):f.jsx(ar,{icon:A.icon,label:A.label,title:A.title,active:A.active,disabled:A.disabled,onClick:A.onClick??(()=>{})},A.id)),m.length>0&&f.jsx(cr,{})]}),m.map((A,V)=>f.jsxs("span",{className:"inline-flex items-center gap-0.5",children:[V>0&&f.jsx(cr,{}),A.map(k=>f.jsx(ar,{icon:k.icon,title:k.title,active:k.active,disabled:k.disabled,onClick:k.onClick},k.id))]},A[0].id))]}),E.length>0&&f.jsx("div",{className:`flex items-center gap-2 ${C?"justify-end":"justify-start"}`,children:E.map(A=>f.jsx(lr,{spec:A},A.id))})]})}const Us={zoom:1,pan:{x:0,y:0}},ur=1.3,Fs=.25,Ns=64,Gs={buttons:{zoom:!1}};function zs(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const Vs=[{id:"none",label:"None"},{id:"viridis",label:"Viridis"},{id:"plasma",label:"Plasma"},{id:"magma",label:"Magma"},{id:"red-green",label:"Red–Green"},{id:"red-blue",label:"Red–Blue"}];function cn(e,t){return{id:"colormap",title:"Colormap",menu:{options:Vs,value:e,onSelect:t}}}const fr=[{id:"linear",label:"Linear"},{id:"srgb",label:"sRGB"},{id:"reinhard",label:"Reinhard"},{id:"aces",label:"ACES"}],$s={id:"extended",label:"Extended (HDR)"};function dr(e,t,n){return{id:"tonemap",title:"Tone-mapping operator",menu:{options:n?[...fr,$s]:fr,value:e,onSelect:t}}}function Xs({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:i,naturalHeight:s,minZoom:l=Fs,maxZoom:c=Ns,requestRender:u,onReset:p,extraModified:b=!1}){const h=a.useCallback(x=>{var B;if(!o)return;const C=(B=e.current)==null?void 0:B.getBoundingClientRect(),_=(C==null?void 0:C.width)??0,M=(C==null?void 0:C.height)??0,P=i&&s&&_>0&&M>0?jt(i,s,_,M):c,L=Math.max(l,Math.min(P,n*x));if(L===n)return;const R=_/2,A=M/2,V=R-(R-r.x)/n*L,k=A-(A-r.y)/n*L;o({zoom:L,pan:{x:V,y:k}})},[o,e,i,s,c,l,n,r.x,r.y]),v=a.useCallback(()=>h(ur),[h]),w=a.useCallback(()=>h(1/ur),[h]),g=a.useCallback(()=>{o==null||o(Us),p==null||p()},[o,p]),T=a.useCallback(x=>{const C={scale:x==null?void 0:x.scale,filename:x==null?void 0:x.filename};u==null||u();const _=t==null?void 0:t.current;if(_)return sr(_,C);const M=e.current;return M?_s(M,C):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,u]),m=a.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),d=n!==1||r.x!==0||r.y!==0||b,y=a.useCallback(x=>{},[]),E=a.useCallback(x=>{},[]),S=a.useCallback(()=>{},[]);return a.useMemo(()=>({capabilities:m,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:d,setDragMode:y,setHoverMode:E,toggleSpikelines:S,zoomIn:v,zoomOut:w,autoscale:g,reset:g,toPNG:T}),[m,d,y,E,S,v,w,g,T])}const Ws={zoom:1,pan:{x:0,y:0}};function At({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:i,pan:s,onViewportChange:l,naturalDims:c,checkerboard:u,wrapperClassName:p,wrapperStyle:b,viewportPadding:h,header:v,surface:w,showAxes:g,overlayNode:T,overlay:m,notationSeed:d,exportCanvasRef:y,requestRender:E,leadingMenus:S,displayAdjust:x,depthSlider:C,onReset:_,extraModified:M,label:P,showLabelChip:L,isDraggable:R=!1,onDragStart:A,extraChips:V}){const[k,B]=a.useState(d),[N,U]=a.useState(!1),{containerProps:Q}=Fn({containerRef:r,zoom:i,pan:s,onViewportChange:l,naturalWidth:c==null?void 0:c.w,naturalHeight:c==null?void 0:c.h}),j=a.useCallback(()=>{x==null||x.onExposureChange(0),x==null||x.onOffsetChange(0),_==null||_()},[x,_]),Te=a.useCallback(()=>{l==null||l(Ws),j()},[l,j]),ge=Xs({rootRef:r,canvasRef:y,zoom:i,pan:s,onViewportChange:l,naturalWidth:c==null?void 0:c.w,naturalHeight:c==null?void 0:c.h,requestRender:E,onReset:j,extraModified:((x==null?void 0:x.exposureEV)??0)!==0||((x==null?void 0:x.offset)??0)!==0||!!M}),oe=a.useMemo(()=>{const ie=[];if(C&&ie.push(C),!x)return ie.length?ie:void 0;const ee=($,Y)=>`${$>=0?"+":"−"}${Math.abs($).toFixed(Y)}`;return ie.push({id:"exposure",icon:"sun",label:"EV",title:"Exposure (EV stops) — color × 2^EV. Double-click to type a value (may exceed the slider range).",min:-8,max:8,step:.1,value:x.exposureEV,onChange:x.onExposureChange,format:$=>ee($,1)},{id:"offset",icon:"plusminus",label:"OFF",title:"Offset — added after exposure (before tonemap). Double-click to type a value (may exceed the slider range).",min:-1,max:1,step:.01,value:x.offset,onChange:x.onOffsetChange,format:$=>ee($,2)}),ie},[x,C]),Me=a.useMemo(()=>({...Gs,leadingButtons:[...S??[],...N?[zs(k,B)]:[]],sliders:oe}),[N,k,S,oe]),we=" cairn-checkerboard",se="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(u==="pane"?we:""),Oe=p+(u==="wrapper"?we:""),xe="render"in m?m.render({notation:k,setOverlayActive:U}):m.hasSource&&c?f.jsx(it,{imageElRef:m.displayElRef,naturalWidth:c.w,naturalHeight:c.h,zoom:i,pan:s,sourceWindow:m.sourceWindow,sample:m.sample,notation:k,version:m.version,onActiveChange:U}):null;return f.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[v,n&&f.jsx(Os,{controller:ge,config:Me}),f.jsxs("div",{ref:r,className:se,style:{padding:h,...Q.style},onPointerDown:Q.onPointerDown,onPointerMove:Q.onPointerMove,onPointerUp:Q.onPointerUp,onPointerCancel:Q.onPointerCancel,onDoubleClick:Te,...t,children:[f.jsxs("div",{ref:o,className:Oe,style:b,children:[w,g&&c&&f.jsx(xs,{naturalWidth:c.w,naturalHeight:c.h,zoom:i,containerRef:o}),T]}),xe,!n&&N&&f.jsx(Gn,{notation:k,onChange:B})]}),L&&f.jsx(bs,{label:P,isDraggable:R,onDragStart:A}),V]})}const pr={inFlight:!1,pending:null};function Hs(e,t){return e.inFlight?{state:{inFlight:!0,pending:t},launch:null}:{state:{inFlight:!0,pending:null},launch:t}}function Ys(e){return e.pending!=null?{state:{inFlight:!0,pending:null},launch:e.pending}:{state:pr,launch:null}}const Ks=1e3,qs=typeof requestAnimationFrame=="function"?e=>requestAnimationFrame(()=>e()):e=>setTimeout(e,0),hr=typeof cancelAnimationFrame=="function"?cancelAnimationFrame:e=>clearTimeout(e);function mr(e,t){const n=e.deep,r=(n==null?void 0:n.zMin)??0,o=(n==null?void 0:n.zMax)??0,i=t!=null,[s,l,c]=ct(o),[u,p]=a.useState(null),b=a.useRef(n);b.current=n;const h=a.useRef(o);h.current=o;const v=a.useRef(s),w=a.useRef(pr),g=a.useRef(null),T=a.useCallback(x=>{const C=b.current;if(!C)return;const _=()=>{const M=Ys(w.current);w.current=M.state,M.launch!=null&&T(M.launch)};C.flatten(x).then(M=>{v.current===x&&x<h.current&&(g.current!=null&&hr(g.current),g.current=qs(()=>{g.current=null,p(M)})),_()}).catch(_)},[]),m=a.useCallback(x=>{const C=Hs(w.current,x);w.current=C.state,C.launch!=null&&T(C.launch)},[T]);a.useEffect(()=>()=>{g.current!=null&&hr(g.current),n==null||n.dispose()},[n]),a.useEffect(()=>{if(n){if(v.current=s,i){t(s);return}if(s>=o){p(null);return}m(s)}},[n,s,o,m,i,t]);const d=a.useMemo(()=>n&&!i&&u!=null?{...e,data:u}:e,[e,n,i,u]),y=n!=null&&r>0&&o/r>Ks,E=a.useMemo(()=>{if(!n||!(o>r))return;const x=C=>Math.abs(C)>=1e3||Math.abs(C)<.01?C.toExponential(2):C.toFixed(3);if(y){const C=Math.log10(r),_=Math.log10(o);return{id:"depth",icon:"layers",label:"Z",title:"Depth cutoff — composite only samples with Z ≤ this (log scale). Double-click to type a Z.",min:C,max:_,step:(_-C)/200,value:Math.log10(Math.max(r,Math.min(s,o))),onChange:M=>l(10**M),format:M=>x(10**M)}}return{id:"depth",icon:"layers",label:"Z",title:"Depth cutoff — composite only samples with Z ≤ this. Double-click to type a Z.",min:r,max:o,step:(o-r)/200,value:s,onChange:C=>l(C),format:C=>x(C)}},[n,r,o,s,y,l]),S=a.useCallback(()=>{c.reset(),p(null)},[c]);return{hdr:d,slider:E,reset:S,isModified:c.isModified}}function gr(e){return"hdr"in e&&e.hdr!=null}function xr(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function ke(e){return Number.isFinite(e)?e:0}const Zs={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Qs(e,t,n,r,o=0){const{h:i,w:s,c:l}=xr(e.shape),c=e.precision==="f16-bits"?Dn(e.data):e.data,u=yo(t),p=new Uint8ClampedArray(s*i*4);for(let b=0;b<s*i;b++){const h=b*l;let v,w,g,T=1;l===1?v=w=g=ke(c[h]):l===3?(v=ke(c[h]),w=ke(c[h+1]),g=ke(c[h+2])):(v=ke(c[h]),w=ke(c[h+1]),g=ke(c[h+2]),T=ke(c[h+3]));const m=[bt(v,n,o),bt(w,n,o),bt(g,n,o)],[d,y,E]=u(m),S=b*4;p[S]=255*Wt(d,r),p[S+1]=255*Wt(y,r),p[S+2]=255*Wt(E,r),p[S+3]=255*(T<0?0:T>1?1:T)}return new ImageData(p,s,i)}function js(e){var Fe,De;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:i="auto",colormap:s="none",showAxes:l=!1,processing:c=Zs,zoom:u=1,pan:p={x:0,y:0},onViewportChange:b,onNaturalSize:h,label:v,isDraggable:w=!1,onDragStart:g,overlay:T,overlaySettings:m,pixelValueNotation:d="decimal",toolbar:y=!0}=e,[E,S,x]=ct(s);a.useEffect(()=>{S(s)},[s,S]);const C=a.useRef(null),_=a.useRef(null),M=a.useRef(null),P=a.useRef(null),L=a.useRef(null),R=a.useRef(null),A=a.useRef(null),[V,k]=a.useState(0),B=a.useCallback(()=>k(F=>F+1),[]),N=a.useMemo(()=>({get current(){const F=L.current;return F instanceof HTMLCanvasElement?F:null}}),[]),U=a.useCallback(F=>{C.current=F,F&&(L.current=F)},[]),Q=a.useCallback(F=>{_.current=F,F&&(L.current=F)},[]),j=a.useCallback(F=>{F&&(L.current=F)},[]),[Te,ge]=a.useState(!1),[oe,Me]=a.useState(!1),[we,se]=a.useState(null),{flipSign:Oe}=c,{gammaFilterId:xe,filterStr:ie,gamma:ee,offset:$}=tr(c),Y=!r&&o!=="none"&&n!=null&&t!=null,Se=o!=="none"&&n!=null,be=E!=="none"&&!Y&&!(r&&Se)&&t!=null;a.useEffect(()=>{if(!be||!t){Me(!1);return}let F=!1;Me(!1);const ce=`${t}::${E}`,ye=Kt(ce);if(ye){const re=_.current;if(re){re.width=ye.width,re.height=ye.height;const le=re.getContext("2d");le&&le.putImageData(ye,0,0),A.current=ye,B(),se({w:ye.width,h:ye.height}),h==null||h(ye.width,ye.height),Me(!0)}return}const ve=new Image;return ve.onload=()=>{if(F)return;const re=document.createElement("canvas");re.width=ve.naturalWidth,re.height=ve.naturalHeight;const le=re.getContext("2d");if(!le)return;le.drawImage(ve,0,0);const Le=le.getImageData(0,0,re.width,re.height),z=Yt(E),O=Ht(Le,E,z);qt(ce,O);const X=_.current;if(!X||F)return;X.width=O.width,X.height=O.height;const I=X.getContext("2d");I&&I.putImageData(O,0,0),A.current=O,B(),se({w:O.width,h:O.height}),h==null||h(O.width,O.height),Me(!0)},ve.src=t,()=>{F=!0}},[be,t,E]);const me=a.useCallback((F,ce)=>{se(ye=>ye&&ye.w===F&&ye.h===ce?ye:{w:F,h:ce}),h==null||h(F,ce)},[]);a.useEffect(()=>{if(!t){R.current=null,A.current=null,B();return}let F=!1;return rt(t).then(ce=>{F||(R.current=ce,E==="none"&&(A.current=ce),B())}),()=>{F=!0}},[t,E,B]);const fe=a.useCallback((F,ce,ye)=>{const ve=R.current;if(!ve||F<0||ce<0||F>=ve.width||ce>=ve.height)return null;const re=(ce*ve.width+F)*4,le=ve.data[re],Le=ve.data[re+1],z=ve.data[re+2],O=A.current;let X=le,I=Le,q=z;if(O&&O.width===ve.width&&O.height===ve.height){const de=(ce*O.width+F)*4;X=O.data[de],I=O.data[de+1],q=O.data[de+2]}const K=(.299*X+.587*I+.114*q)/255;return st(E!=="none"||le===Le&&Le===z?[le]:[le,Le,z],"uint8",ye,K)},[E]);a.useEffect(()=>{if(!Y){ge(!1);return}let F=!1;const ce=Oo(),ye=ce==="gpu"||ce==="auto",ve=`${n}::${t}::${o}::${E}`;if(ce!=="gpu"){const re=Kt(ve);if(re){const le=C.current;if(le){(le.width!==re.width||le.height!==re.height)&&(le.width=re.width,le.height=re.height);const Le=le.getContext("2d");Le&&Le.putImageData(re,0,0),me(re.width,re.height),ge(!0)}return}}return(async()=>{const[re,le]=await Promise.all([rt(n),rt(t)]);if(F||!re||!le)return;const z=o.includes("signed")?"signed":"positive",O=E!=="none"?zt(E):null,X={diffMode:o,colormap:O,cmapMode:z};if(ye)try{const Ee=C.current;if(Ee){const de=Bo(re,le,X,Ee);if(de){if(F)return;me(de.width,de.height),ge(!0);return}}}catch(Ee){console.warn("[cairn] WebGL 2 diff error:",Ee)}if(ce==="gpu"){console.error("[cairn] WebGL 2 unavailable — set render mode to 'Auto' or 'CPU'");return}let I=Po(re,le,o);E!=="none"&&(I=Ht(I,E,z)),qt(ve,I);const q=C.current;if(!q||F)return;(q.width!==I.width||q.height!==I.height)&&(q.width=I.width,q.height=I.height);const K=q.getContext("2d");K&&K.putImageData(I,0,0),me(I.width,I.height),ge(!0)})(),()=>{F=!0}},[n,t,o,Y,E,h]);const Ce=i==="auto"?void 0:i,Re=Oe?{filter:"invert(1)"}:{},Ne=T&&(m!=null&&m.enabled)&&we&&t&&((((Fe=T.boxes)==null?void 0:Fe.length)??0)>0||(((De=T.masks)==null?void 0:De.length)??0)>0)?f.jsx(en,{data:T,settings:m,naturalWidth:we.w,naturalHeight:we.h}):void 0,nt=t?Y?f.jsxs(f.Fragment,{children:[!Te&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),f.jsx("canvas",{ref:U,className:"w-full h-full object-contain block",style:{display:Te?"block":"none",imageRendering:Ce,...Re}})]}):be?f.jsxs(f.Fragment,{children:[!oe&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),f.jsx("canvas",{ref:Q,className:"w-full h-full object-contain block",style:{display:oe?"block":"none",imageRendering:Ce,...Re}})]}):f.jsx("img",{ref:j,src:t,alt:v,className:"w-full h-full object-contain block",draggable:!1,style:{filter:ie,imageRendering:Ce},onLoad:F=>{const ce=F.currentTarget;se({w:ce.naturalWidth,h:ce.naturalHeight}),h==null||h(ce.naturalWidth,ce.naturalHeight)}}):f.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return f.jsx(At,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:y,paneRef:M,wrapperRef:P,zoom:u,pan:p,onViewportChange:b,naturalDims:we,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${p.x}px, ${p.y}px) scale(${u})`,transformOrigin:"0 0"},viewportPadding:l&&we?"16px 4px 4px 28px":"4px",header:f.jsx(nr,{id:xe,gamma:ee,offset:$}),surface:nt,showAxes:l,overlayNode:Ne,overlay:{displayElRef:L,sample:fe,version:V,hasSource:!!t},notationSeed:d,exportCanvasRef:N,leadingMenus:[cn(E,F=>S(F))],onReset:x.reset,extraModified:x.isModified,label:v,showLabelChip:!0,isDraggable:w,onDragStart:g})}function Js(e){const{tonemap:t="srgb",exposure:n=0,gamma:r,showAxes:o=!1,label:i="",interpolation:s="auto",zoom:l=1,pan:c={x:0,y:0},onViewportChange:u,pixelValueNotation:p="decimal",toolbar:b=!0}=e,h=mr(e.hdr),v=h.hdr,[w,g,T]=ct(Xt(t));a.useEffect(()=>{g(Xt(t))},[t,g]);const m=a.useRef(null),d=a.useRef(null),y=a.useRef(null),[E,S]=a.useState(null),x=a.useRef(null),[C,_]=a.useState(0),[M,P]=a.useState(0),[L,R]=a.useState(0);a.useEffect(()=>{const k=m.current;if(!k)return;let B;try{B=Qs(v,w,n+M,r,L)}catch(U){console.error("[cairn] HDR tone-map error:",U);return}(k.width!==B.width||k.height!==B.height)&&(k.width=B.width,k.height=B.height);const N=k.getContext("2d");N&&(N.putImageData(B,0,0),x.current=B,_(U=>U+1),S(U=>U&&U.w===B.width&&U.h===B.height?U:{w:B.width,h:B.height}))},[v,w,n,r,M,L]);const A=a.useCallback((k,B,N)=>{const U=E;if(!U||k<0||B<0||k>=U.w||B>=U.h)return null;const Q=v.shape.length===2?1:v.shape[2]??1,j=(B*U.w+k)*Q,Te=v.data,ge=v.precision==="f16-bits"?se=>yt(Te[se]??0):se=>Te[se]??0,oe=x.current;let Me=.5;if(oe&&oe.width===U.w&&oe.height===U.h){const se=(B*U.w+k)*4;Me=(.299*oe.data[se]+.587*oe.data[se+1]+.114*oe.data[se+2])/255}const we=Q===1?[ge(j)]:[ge(j),ge(j+1),ge(j+2)];return st(we,"unit",N,Me)},[v,E]),V=s==="auto"?void 0:s;return f.jsx(At,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:b,paneRef:d,wrapperRef:y,zoom:l,pan:c,onViewportChange:u,naturalDims:E,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${c.x}px, ${c.y}px) scale(${l})`,transformOrigin:"0 0"},viewportPadding:o&&E?"16px 4px 4px 28px":"4px",surface:f.jsx("canvas",{ref:m,className:"w-full h-full object-contain block",style:{imageRendering:V}}),showAxes:o,overlay:{displayElRef:m,sample:A,version:C,hasSource:!0},notationSeed:p,exportCanvasRef:m,leadingMenus:[dr(w,k=>g(k),!1)],displayAdjust:{exposureEV:M,offset:L,onExposureChange:P,onOffsetChange:R},depthSlider:h.slider,onReset:()=>{h.reset(),T.reset()},extraModified:h.isModified||T.isModified,label:i,showLabelChip:!!i})}function ln(e){return gr(e)?f.jsx(Js,{...e}):f.jsx(js,{...e})}const br={"no-webgpu":0,"no-hdr-browser":1,"no-hdr-display":2},ei="https://github.com/doeringchristian/cairn-plot/blob/main/docs/browser-support.md";function ti(e,t=!1){const n=e||"";return t?"brave":/firefox/i.test(n)?"firefox":/safari/i.test(n)&&!/chrome|chromium|crios|android/i.test(n)?"safari":/linux/i.test(n)&&/chrome|chromium/i.test(n)?"chromium-linux":"chromium"}function ni(e){const t=e||"";return/mac os x|macintosh/i.test(t)?"macos":/windows/i.test(t)?"windows":"other"}function ri(e,t){if(e==="no-hdr-display")switch(ni(t.userAgent)){case"macos":return"macOS: EDR engages automatically on HDR-capable displays — confirm your display supports HDR.";case"windows":return"Windows: turn on Settings → System → Display → Use HDR.";default:return"Enable HDR in your display and OS settings."}const n=ti(t.userAgent,t.isBrave);if(e==="no-hdr-browser")switch(n){case"firefox":return"Firefox has no extended-tone-mapping canvas path at all — true HDR output is impossible until Firefox implements it (fundamental browser limitation).";case"safari":return"Safari's WebGPU HDR canvas tone-mapping is still maturing — update to the latest Safari 26+.";default:return"Chrome/Edge 129+ is required for HDR canvas output (toneMapping: extended) — update your browser."}switch(n){case"firefox":return"Firefox: about:config → dom.webgpu.enabled (HDR output is not available in Firefox at all — browser limitation).";case"safari":return"Safari: Develop → Feature Flags → WebGPU (Safari 26+ has it by default).";case"brave":return"Brave: check Shields fingerprint blocking + brave://flags.";case"chromium-linux":return"Chromium on Linux: enable chrome://flags/#enable-unsafe-webgpu.";case"chromium":default:return"Chrome/Edge: enable chrome://flags/#enable-unsafe-webgpu and hardware acceleration."}}function oi(e){switch(e){case"no-webgpu":return"GPU renderer unavailable → CPU fallback active; FLIP kernels + HDR compare disabled.";case"no-hdr-browser":return"True HDR output is unsupported by this browser — a fundamental browser limitation, not a cairn-plot bug → HDR images tone-mapped to SDR.";case"no-hdr-display":return"Your display/OS is not in HDR mode → HDR images tone-mapped to SDR."}}function vr(e,t){return`cairn-plot:capnotice:${e}:${t}`}const wr=new Set;function yr(e){try{if(window.localStorage.getItem(e)==="1")return!0}catch{}try{if(window.sessionStorage.getItem(e)==="1")return!0}catch{}return wr.has(e)}function si(e){try{window.localStorage.setItem(e,"1");return}catch{}try{window.sessionStorage.setItem(e,"1");return}catch{}wr.add(e)}const Er=new Set;let Ct=null,ft=null;function _r(){ft&&ft.parentNode&&ft.parentNode.removeChild(ft),ft=null,Ct=null}function ii(e){const t=vr(e,window.location.pathname),n=ri(e,{userAgent:navigator.userAgent,isBrave:!!navigator.brave}),r=document.createElement("div");r.setAttribute("role","status"),r.setAttribute("data-cairn-plot-capnotice",e),Object.assign(r.style,{position:"fixed",bottom:"12px",right:"12px",zIndex:"2147483000",maxWidth:"340px",boxSizing:"border-box",padding:"10px 30px 10px 12px",borderRadius:"6px",border:"1px solid var(--color-border, #d0d7de)",background:"rgb(var(--color-bg-elevated-rgb, 246 248 250) / 0.9)",color:"var(--color-fg-muted, #656d76)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",boxShadow:"0 4px 12px rgba(0, 0, 0, 0.18)",font:"12px/1.4 system-ui, sans-serif"});const o=document.createElement("div");o.textContent=oi(e),Object.assign(o.style,{fontWeight:"600",color:"var(--color-fg, #1f2328)",marginBottom:"4px"});const i=document.createElement("div");i.textContent=n,i.style.marginBottom="4px";const s=document.createElement("a");s.href=ei,s.target="_blank",s.rel="noopener noreferrer",s.textContent="Learn more",Object.assign(s.style,{color:"var(--color-accent, #0969da)",textDecoration:"none"});const l=document.createElement("button");l.type="button",l.textContent="×",l.setAttribute("aria-label","Dismiss browser capability notice"),l.title="Dismiss",Object.assign(l.style,{position:"absolute",top:"4px",right:"6px",padding:"0 4px",border:"0",background:"transparent",color:"var(--color-fg-subtle, #8b949e)",cursor:"pointer",fontSize:"16px",lineHeight:"1"}),l.addEventListener("click",()=>{si(t),_r()}),r.appendChild(o),r.appendChild(i),r.appendChild(s),r.appendChild(l),document.body.appendChild(r),ft=r,Ct=e}function Mr(e){if(typeof document>"u"||typeof window>"u"||Er.has(e))return;Er.add(e);const t=vr(e,window.location.pathname);if(yr(t))return;const n=()=>{if(!yr(t)){if(Ct!==null)if(br[e]<br[Ct])_r();else return;ii(e)}};document.body?n():window.addEventListener("DOMContentLoaded",n,{once:!0})}const ai={data:new Float32Array(0),shape:[0,0],dtype:"<f4"};function ci(e){const{h:t,w:n,c:r}=xr(e.shape);if(e.precision==="f16-bits"){const s=e.data,l=new Uint16Array(n*t*4);for(let c=0;c<n*t;c++){const u=c*r,p=c*4;if(r===1){const b=s[u];l[p]=b,l[p+1]=b,l[p+2]=b,l[p+3]=wt}else l[p]=s[u],l[p+1]=s[u+1],l[p+2]=s[u+2],l[p+3]=r>=4?s[u+3]:wt}return{data:l,width:n,height:t,format:"rgba16float"}}const o=e.data,i=new Float32Array(n*t*4);for(let s=0;s<n*t;s++){const l=s*r;let c,u,p,b=1;r===1?c=u=p=ke(o[l]):r===3?(c=ke(o[l]),u=ke(o[l+1]),p=ke(o[l+2])):(c=ke(o[l]),u=ke(o[l+1]),p=ke(o[l+2]),b=ke(o[l+3]));const h=s*4;i[h]=c,i[h+1]=u,i[h+2]=p,i[h+3]=b}return{data:i,width:n,height:t,format:"rgba32float"}}function Sr(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),i=n*o,s=r*o,l=(t.width-i)/2,c=(t.height-s)/2,u=Math.max(e.zoom,1e-6),p=t.width/(u*i),b=t.height/(u*s),h=-l/i-e.pan.x/(u*i),v=-c/s-e.pan.y/(u*s);return{x:h,y:v,w:p,h:b}}function Tr(e,t,n,r){const o=e.w*n,i=e.h*r;return o<=0||i<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/i)}function li(e){var re,le,Le;const t=gr(e),n=a.useRef(null),r=a.useRef(null),o=a.useRef(null),i=a.useRef(null),s=a.useRef(null),l=t&&!!((re=e.hdr)!=null&&re.deep),c=a.useCallback(z=>{var O,X;(O=i.current)==null||O.setDeepZClip(z),(X=s.current)==null||X.call(s)},[]),u=mr(t?e.hdr:ai,l?c:void 0),p=a.useRef(!1),[b,h]=a.useState(!1),[v,w]=a.useState(!1),[g,T]=a.useState(!1),[m,d]=a.useState(null),[y,E]=a.useState(0),[S,x]=a.useState(0),[C,_]=a.useState({x:0,y:0,w:1,h:1}),M=a.useRef(null),P=a.useRef(null),[L,R]=a.useState(0),A=e.zoom??1,V=e.pan??{x:0,y:0},k=e.onViewportChange,B=t?"none":e.colormap??"none",[N,U]=a.useState(B);a.useEffect(()=>{U(B)},[B]);const Q=t?"none":N,j=a.useRef(B),Te=a.useCallback(()=>{U(j.current)},[]),ge=t?e.tonemap:void 0,[oe,Me]=a.useState(null);a.useEffect(()=>{Me(null)},[ge]);const we=Eo(ge,b),se=oe??we,Oe=oe!==null&&oe!==we,xe=a.useCallback(()=>Me(null),[]),[ie,ee]=a.useState(0),[$,Y]=a.useState(0),Se=Jt();a.useEffect(()=>{const z=n.current;if(!z)return;let O=!1;return xt().then(X=>{var Ee;if(O)return;const I=((Ee=X.probeExtendedToneMapping)==null?void 0:Ee.call(X))??!1,q=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,K=I&&q&&t;p.current=K,h(K),t&&!K&&Mr(I?"no-hdr-display":"no-hdr-browser"),ms(z,{hdr:K}).then(de=>{if(O){er(de);return}i.current=de,T(!0)}).catch(de=>{O||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",de),w(!0))})}).catch(X=>{O||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",X),w(!0))}),()=>{O=!0,i.current&&(er(i.current),i.current=null)}},[]),a.useEffect(()=>{const z=r.current;if(!z)return;const O=new ResizeObserver(()=>x(X=>X+1));return O.observe(z),()=>O.disconnect()},[]),a.useEffect(()=>{const z=r.current;if(!z)return;const O=new IntersectionObserver(X=>{const I=X[0];if(!I)return;const q=i.current;q&&(q.setVisible(I.isIntersecting),I.isIntersecting?q.isParked&&(q.restore(),x(K=>K+1)):q.park())},{threshold:0});return O.observe(z),()=>O.disconnect()},[]),a.useEffect(()=>{var X;if(!t||!g||l)return;const z=u.hdr;M.current=z;const O=ci(z);(X=i.current)==null||X.setSource(O),d(I=>I&&I.w===O.width&&I.h===O.height?I:{w:O.width,h:O.height}),R(I=>I+1),E(I=>I+1)},[t,g,l,t?u.hdr:null]),a.useEffect(()=>{if(!t||!g||!l)return;const z=e.hdr,O=z.deep;M.current=z;let X=!1;return O.getGpuCsr().then(I=>{var q;X||((q=i.current)==null||q.setDeepSource(I,O.zMax),d(K=>K&&K.w===I.width&&K.h===I.height?K:{w:I.width,h:I.height}),R(K=>K+1),E(K=>K+1))}).catch(I=>{X||console.warn("[cairn] deep GPU CSR upload failed:",I)}),()=>{X=!0}},[t,g,l,t?e.hdr.deep:null]),a.useEffect(()=>{if(t||!g)return;const z=e,O=z.imageUrl,X=N;if(!O){P.current=null,d(null),R(q=>q+1);return}let I=!1;return rt(O).then(q=>{var de,Pe;if(I||!q)return;let K=q;if(X!=="none"){const ue=`gpu::${O}::${X}::ev${ie}::off${$}`,ze=Kt(ue);if(ze)K=ze;else{const Ze=Yt(X);K=Ht(q,X,Ze,ie,$),qt(ue,K)}}P.current=q;const Ee={data:K.data,width:K.width,height:K.height,format:"rgba8unorm"};(de=i.current)==null||de.setSource(Ee),d(ue=>ue&&ue.w===K.width&&ue.h===K.height?ue:{w:K.width,h:K.height}),(Pe=z.onNaturalSize)==null||Pe.call(z,K.width,K.height),R(ue=>ue+1),E(ue=>ue+1)}),()=>{I=!0}},[t,g,t?null:e.imageUrl,t?null:N,t?0:ie,t?0:$]);const be=t?e.exposure??0:0,me=t?e.gamma:void 0,fe=a.useCallback(()=>{const z=i.current;if(!z||!g||!m)return;const O=r.current,X=o.current,I=X?X.getBoundingClientRect():O?O.getBoundingClientRect():{width:m.w,height:m.h},q=Sr({zoom:A,pan:V},I,m.w,m.h);_(ue=>ue.x===q.x&&ue.y===q.y&&ue.w===q.w&&ue.h===q.h?ue:q),I.width>0&&I.height>0&&z.resize(Math.round(I.width*Se),Math.round(I.height*Se));const K=Tr(q,I,m.w,m.h)>=tn?"nearest":"linear",Ee=q,de=p.current&&se==="extended",Pe=t?{exposureEV:be+ie,offset:$,operator:se,gamma:me,isScalar:!1,hdrOut:de,uv:Ee,filter:K}:{exposureEV:Q!=="none"?0:ie,offset:Q!=="none"?0:$,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:Ee,filter:K};try{z.render(Pe)||w(!0)}catch(ue){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",ue),w(!0)}},[g,m,A,V.x,V.y,be,ie,$,se,me,t,Q,Se]);s.current=fe,a.useEffect(()=>{fe()},[fe,y,S]);const Ce=a.useCallback((z,O,X)=>{if(t){const ze=M.current,Ze=m;if(!ze||!Ze||z<0||O<0||z>=Ze.w||O>=Ze.h)return null;const Ve=ze.shape.length===2?1:ze.shape[2]??1,Ae=(O*Ze.w+z)*Ve,dt=ze.data,Qe=ze.precision==="f16-bits"?at=>yt(dt[at]??0):at=>dt[at]??0,It=.5,pt=Ve===1?[Qe(Ae)]:[Qe(Ae),Qe(Ae+1),Qe(Ae+2)];return st(pt,"unit",X,It)}const I=P.current;if(!I||z<0||O<0||z>=I.width||O>=I.height)return null;const q=(O*I.width+z)*4,K=I.data[q],Ee=I.data[q+1],de=I.data[q+2],Pe=(.299*K+.587*Ee+.114*de)/255;return st(Q!=="none"||K===Ee&&Ee===de?[K]:[K,Ee,de],"uint8",X,Pe)},[t,m,Q]),Re=e.showAxes??!1,Ne=t?e.label??"":e.label,nt=e.interpolation??"auto",Fe=nt==="auto"?void 0:nt,De=t?void 0:e.overlay,F=t?void 0:e.overlaySettings,ce=t?!1:e.isDraggable??!1,ye=t?void 0:e.onDragStart;if(v)return t?f.jsx(ln,{...e}):f.jsx(ln,{...e});const ve=De&&(F!=null&&F.enabled)&&m&&((((le=De.boxes)==null?void 0:le.length)??0)>0||(((Le=De.masks)==null?void 0:Le.length)??0)>0)?f.jsx(en,{data:De,settings:F,naturalWidth:m.w,naturalHeight:m.h}):void 0;return f.jsx(At,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":g},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:r,wrapperRef:o,zoom:A,pan:V,onViewportChange:k,naturalDims:m,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:Re&&m?"16px 4px 4px 28px":0,surface:f.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:Fe},"data-gpu-image-canvas":!0}),showAxes:Re,overlayNode:ve,overlay:{displayElRef:n,sample:Ce,version:L,hasSource:!0,sourceWindow:C},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:fe,leadingMenus:t?[dr(se,z=>Me(z),b)]:[cn(Q,z=>U(z))],displayAdjust:{exposureEV:ie,offset:$,onExposureChange:ee,onOffsetChange:Y},depthSlider:u.slider,onReset:()=>{Te(),xe(),u.reset()},extraModified:N!==j.current||Oe||u.isModified,label:Ne,showLabelChip:!!Ne,isDraggable:ce,onDragStart:ye})}const Rt=new Map;function Ye(e){if(Rt.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);Rt.set(e.id,e)}function tt(e){return Rt.get(e)}function ui(){return Array.from(Rt.values())}function Pr(e,t){return{...e.params??{},...t??{}}}const fi={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},di={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},pi={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},hi={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},mi={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},gi={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},Ar=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];bi(Ar);const un=[1.052156925,1,.91835767],xi=.7;function bi(e){const[t,n,r]=e[0],[o,i,s]=e[1],[l,c,u]=e[2],p=i*u-s*c,b=-(o*u-s*l),h=o*c-i*l,w=1/(t*p+n*b+r*h);return[[p*w,-(n*u-r*c)*w,(n*s-r*i)*w],[b*w,(t*u-r*l)*w,-(t*s-r*o)*w],[h*w,-(t*c-n*l)*w,(t*i-n*o)*w]]}function vi(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const fn=6/29;function dn(e){return e>fn**3?Math.cbrt(e):e/(3*fn*fn)+4/29}function Cr(e,t,n){const[r,o,i]=vi(Ar,e,t,n),s=dn(r*un[0]),l=dn(o*un[1]),c=dn(i*un[2]),u=116*l-16,p=500*(s-l),b=200*(l-c);return[u,.01*u*p,.01*u*b]}function wi(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function yi(){const e=Cr(0,1,0),t=Cr(0,0,1);return Math.pow(wi(e,t),xi)}const Rr=yi(),Ei=.082;function Dr(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],i=Math.max(...n,...o),s=Math.ceil(3*Math.sqrt(i/(2*Math.PI**2))*e),l=1/e,c=Math.PI**2,u=[0,0,0];for(let p=-s;p<=s;p++)for(let b=-s;b<=s;b++){const h=(b*l)**2+(p*l)**2;for(let v=0;v<3;v++)u[v]+=t[v]*Math.sqrt(Math.PI/n[v])*Math.exp(-c*h/n[v])+r[v]*Math.sqrt(Math.PI/o[v])*Math.exp(-c*h/o[v])}return{r:s,deltaX:l,sums:u}}function kr(e){const t=.5*Ei*e,n=Math.ceil(3*t);let r=0,o=0,i=0;for(let s=-n;s<=n;s++)for(let l=-n;l<=n;l++){const c=Math.exp(-(l*l+s*s)/(2*t*t)),u=-l*c,p=(l*l/(t*t)-1)*c;u>0&&(r+=u),p>0?o+=p:i-=p}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:i}}const _i=`
${Ue}
${St}
${ut}
${Mt}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_map0: vec4<f32>; // offX, offY, fitFill, 0
@group(0) @binding(8) var<uniform> u_map1: vec4<f32>; // resultW, resultH, 0, 0
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = mapSample(src, px, u_map0.x, u_map0.y, u_map1.x, u_map1.y, u_map0.z);
  return vec4<f32>(flip_rgb2ycxcz(s.rgb), 1.0);
}
`,Mi=`
${Ue}
${St}
${ut}
${Mt}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_map0: vec4<f32>; // offX, offY, fitFill, 0
@group(0) @binding(8) var<uniform> u_map1: vec4<f32>; // resultW, resultH, 0, 0
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = mapSample(src, px, u_map0.x, u_map0.y, u_map1.x, u_map1.y, u_map0.z);
  return vec4<f32>(flip_linrgb2ycxcz(clamp(s.rgb, vec3<f32>(0.0), vec3<f32>(1.0))), 1.0);
}
`,Dt=`
${Ue}
${St}
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
`,Lr=`
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
`;function Ke(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function kt(e,t,n){const r=n.sourceMap,o=r?t==="a"?r.offsetA:r.offsetB:{x:0,y:0},i=r!=null&&r.fill?1:0;return[Ke(e,[o.x,o.y,i,0]),Ke(e+1,[n.width,n.height,0,0])]}function Lt(e){return[Ke(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),Ke(2,[e.sums[2],0,0,0])]}function Br(e){return[Ke(4,[Rr,e.sd,e.r,e.edgeNorm]),Ke(5,[e.pointPos,e.pointNeg,0,0])]}function Ir(e,t,n,r,o,i=""){const s=Dr(e),l=kr(e),c=`ycxczA${i}`,u=`ycxczB${i}`,p=`labA${i}`,b=`labB${i}`,h=`flip${i}`;return{passes:[{name:c,shader:t,inputs:[n],output:c,uniforms:()=>kt(1,"a",o)},{name:u,shader:t,inputs:[r],output:u,uniforms:()=>kt(1,"b",o)},{name:p,shader:Dt,inputs:[c],output:p,uniforms:()=>Lt(s)},{name:b,shader:Dt,inputs:[u],output:b,uniforms:()=>Lt(s)},{name:h,shader:Lr,inputs:[p,b,c,u],output:h,uniforms:()=>Br(l)}],flipRef:h}}const Si={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=Ir(t,_i,"srcA","srcB",e);return{passes:n,final:r}}},Ti={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=Ir(t,Mi,"srcA","srcB",e);return{passes:n,final:r}}},Or=`
${Ue}
${St}
${ut}
${Mt}
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
`,Pi=`
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
`,Ai={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",output:"scalar",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),i=(r-n)/Math.max(o-1,1),s=Dr(t),l=kr(t),c=[];let u=null;for(let p=0;p<o;p++){const b=n+p*i,h=`_e${p}`,v=`ycxczA${h}`,w=`ycxczB${h}`,g=`labA${h}`,T=`labB${h}`,m=`acc${h}`;c.push({name:v,shader:Or,inputs:["srcA"],output:v,uniforms:()=>[Ke(1,[b,0,0,0]),...kt(2,"a",e)]},{name:w,shader:Or,inputs:["srcB"],output:w,uniforms:()=>[Ke(1,[b,0,0,0]),...kt(2,"b",e)]},{name:g,shader:Dt,inputs:[v],output:g,uniforms:()=>Lt(s)},{name:T,shader:Dt,inputs:[w],output:T,uniforms:()=>Lt(s)}),u===null?c.push({name:m,shader:Lr,inputs:[g,T,v,w],output:m,uniforms:()=>Br(l)}):c.push({name:m,shader:Pi,inputs:[g,T,v,w,u],output:m,uniforms:()=>[Ke(5,[Rr,l.sd,l.r,l.edgeNorm]),Ke(6,[l.pointPos,l.pointNeg,0,0])]}),u=m}return{passes:c,final:u}}},Ci=.01,Ri=.03,Ur=1,Fr=1.5,Nr=5,Gr=`
fn ssim_srgb2linear(c: f32) -> f32 {
  if (c <= 0.04045) { return c / 12.92; }
  return pow((c + 0.055) / 1.055, 2.4);
}
fn ssim_luma(srgb: vec3<f32>) -> f32 {
  let lin = vec3<f32>(ssim_srgb2linear(srgb.r), ssim_srgb2linear(srgb.g), ssim_srgb2linear(srgb.b));
  return clamp(dot(lin, vec3<f32>(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
}
`,Di=`
${Ue}
${Gr}
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
`,ki=`
${Ue}
${Gr}
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
`,zr=`
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
`,Li=`
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
`;function pn(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function Vr(e,t){const n=`${t}H`,r=`${t}V`;return{passes:[{name:n,shader:zr,inputs:[e],output:n,uniforms:()=>[pn(1,[1,0,Nr,Fr])]},{name:r,shader:zr,inputs:[n],output:r,uniforms:()=>[pn(1,[0,1,Nr,Fr])]}],out:r}}const Bi={kind:"multipass",id:"ssim",label:"SSIM (1−SSIM)",publicName:"ssim",displayRange:"unit",output:"scalar",buildPasses(e){const t=(Ci*Ur)**2,n=(Ri*Ur)**2,r=Vr("momA","statsA"),o=Vr("momB","statsB");return{passes:[{name:"momA",shader:Di,inputs:["srcA","srcB"],output:"momA"},{name:"momB",shader:ki,inputs:["srcA","srcB"],output:"momB"},...r.passes,...o.passes,{name:"ssim",shader:Li,inputs:[r.out,o.out],output:"ssim",uniforms:()=>[pn(2,[t,n,0,0])]}],final:"ssim"}}};let $r=!1;function Ii(){$r||($r=!0,Ye(di),Ye(fi),Ye(pi),Ye(mi),Ye(hi),Ye(gi),Ye(Si),Ye(Ai),Ye(Ti),Ye(Bi))}Ii();function Xr(){const e=[];for(const n of ui())n.kind==="pointwise"&&e.push({id:n.id,label:n.label});e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"});const t=tt("ssim");return t&&e.push({id:t.id,label:t.label}),e}function Oi(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}const Wr=new WeakMap;function hn(e,t,n,r){let o=Wr.get(e);o||(o=new Map,Wr.set(e,o));const i=`${t}::${r}`;let s=o.get(i);return s||(s=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(i,s)),s}function Ui(e){return`
${Ue}
${ut}
${Mt}
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
`}const Bt="rgba16float";function Fi(e,t,n,r,o,i){var T,m;const s=tt(r);if(!s)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const l=i??Tt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),c=l.result.w,u=l.result.h,p=l.fit==="fill"?1:0,b=Pr(s,o);if(s.kind==="pointwise"){const d=e.createTexture(c,u,Bt),y=hn(e,`pw:${s.id}`,Ui(s.source),Bt),E=new Float32Array([l.offsetA.x,l.offsetA.y,l.offsetB.x,l.offsetB.y]),S=new Float32Array([c,u,p,0]);let x;try{x=e.createBindGroup(y,[{binding:0,resource:t},{binding:1,resource:n},{binding:2,resource:{uniform:E}},{binding:3,resource:{uniform:S}}]),e.renderFullscreen(d,y,x)}finally{(T=x==null?void 0:x.destroy)==null||T.call(x)}return d}const h={width:c,height:u,params:b,sourceMap:{fill:l.fit==="fill",offsetA:l.offsetA,offsetB:l.offsetB}},v=s.buildPasses(h),w=new Map([["srcA",t],["srcB",n]]),g=[];try{for(const y of v.passes){const E=e.createTexture(c,u,Bt);g.push(E),w.set(y.output,E);const S=hn(e,`mp:${s.id}:${y.name}`,y.shader,Bt),x=y.inputs.map((_,M)=>{const P=w.get(_);if(!P)throw new Error(`computeDiff: pass "${y.name}" input "${_}" not produced yet`);return{binding:M,resource:P}});y.uniforms&&x.push(...y.uniforms(h));let C;try{C=e.createBindGroup(S,x),e.renderFullscreen(E,S,C)}finally{(m=C==null?void 0:C.destroy)==null||m.call(C)}}const d=w.get(v.final);if(!d)throw new Error(`computeDiff: final ref "${v.final}" not produced`);for(const y of g)y!==d&&y.destroy();return d}catch(d){for(const y of g)y.destroy();throw d}}const Ni=8,Gi=256*1024*1024;class zi{constructor(t=Ni,n=Gi){ne(this,"map",new Map);ne(this,"totalBytes",0);this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}accountReadbackBytes(t,n){let r=!1;for(const o of this.map.values())if(o===t){r=!0;break}r&&(t.bytes+=n,this.totalBytes+=n,this.evict())}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const Hr=new WeakMap;function Yr(e){let t=Hr.get(e);return t||(t=new zi,Hr.set(e,t)),t}function Vi(e,t){const n=Pr(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function $i(e,t,n,r,o){const i=tt(n),s=i?Vi(i,r):"",l=o?is(o):"";return`${e}|${t}|${n}|${s}|${l}`}function Xi(e,t,n,r,o,i,s,l){const c=tt(r);if(!c)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const u=Yr(e),p=l??Tt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),b=$i(i,s,r,o,p),h=u.get(b);if(h)return h;const v=Fi(e,t,n,r,o,p),w=p.result.w,g=p.result.h,T={texture:v,width:w,height:g,displayRange:c.displayRange,bytes:w*g*8};return u.set(b,T),T}async function Wi(e,t,n,r,o){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=Kn(e,n,r,o).then(i=>(t.scalars=i,i))),t.scalarsPending)}async function Hi(e,t){return t.resultSamples?t.resultSamples:(t.resultSamplesPending||(t.resultSamplesPending=e.readback(t.texture).then(n=>{const r=n instanceof Float32Array?n:Float32Array.from(n);return t.resultSamples=r,Yr(e).accountReadbackBytes(t,r.byteLength),r})),t.resultSamplesPending)}const Yi=`
${Ue}
${ut}
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
`,Ki={unit:0,signed:1,relative:2},qi={linear:0,signed:1,positive:2};function Zi(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function Qi(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function ji(e,t,n,r,o){var v,w,g;const i=Qi(t),s=hn(e,"diff-display",Yi,i),l=Zi(e,o.colormap),c=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),u=new Float32Array([Ki[r],qi[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]),p=new Float32Array([o.exposureEV??0,o.offset??0,0,0]),b=new Float32Array([((v=o.sourceDims)==null?void 0:v.w)??0,((w=o.sourceDims)==null?void 0:w.h)??0,0,0]);let h;try{h=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:l},{binding:2,resource:{uniform:c}},{binding:3,resource:{uniform:u}},{binding:4,resource:{uniform:p}},{binding:5,resource:{uniform:b}}]),e.renderFullscreen(t,s,h)}finally{(g=h==null?void 0:h.destroy)==null||g.call(h),l.destroy()}}const Kr=.6*.6*2.51,Ji=.6*.03,ea=0,qr=.6*.6*2.43,ta=.6*.59,na=.14;function Zr(e){const t=(Ji-ta*e)/(Kr-qr*e),n=(ea-na*e)/(Kr-qr*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const ra=.85,oa=.85,Qr=11920928955078125e-23,mn=[.2126,.7152,.0722];function sa(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function ia(e,t,n,r=3,o={}){const i=t*n,s=Zr(ra),l=Zr(oa),c=new Float64Array(i);let u=0;for(let d=0;d<i;d++){const[y,E,S]=sa(e,d,r),x=y*mn[0]+E*mn[1]+S*mn[2];c[d]=x,x>u&&(u=x)}const p=Float64Array.from(c).sort(),b=i>>1,h=i%2===1?p[b]:p[b-1],v=Math.max(h,Qr),w=Math.max(u,Qr),g=o.startExposure??Math.log2(s/w),T=o.stopExposure??Math.log2(l/v),m=Math.max(2,Math.ceil(T-g));return{startExposure:g,stopExposure:T,numExposures:m}}const aa={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function ca({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:i,zoom:s,pan:l,onViewportChange:c,processing:u=aa,interpolation:p="auto",label:b="",isDraggable:h=!1,onDragStart:v,overlay:w,overlaySettings:g,pixelValueNotation:T="decimal"}){var xe,ie;const m=a.useRef(null),[d,y]=a.useState(null),[E,S]=a.useState(null),[x,C]=a.useState(T),[_,M]=a.useState(!1),P=a.useRef(null),L=a.useRef(null),R=a.useRef(null),A=a.useRef(null),[V,k]=a.useState(0);a.useEffect(()=>{if(!e){R.current=null,k($=>$+1);return}let ee=!1;return rt(e).then($=>{ee||(R.current=$,k(Y=>Y+1))}),()=>{ee=!0}},[e]),a.useEffect(()=>{if(!t){A.current=null,k($=>$+1);return}let ee=!1;return rt(t).then($=>{ee||(A.current=$,k(Y=>Y+1))}),()=>{ee=!0}},[t]);const B=ee=>($,Y,Se)=>{const be=ee.current;if(!be||$<0||Y<0||$>=be.width||Y>=be.height)return null;const me=(Y*be.width+$)*4,fe=be.data[me],Ce=be.data[me+1],Re=be.data[me+2],Ne=(.299*fe+.587*Ce+.114*Re)/255;return fe===Ce&&Ce===Re?{lines:[lt(fe,"uint8",Se)],luminance:Ne}:{lines:[lt(fe,"uint8",Se),lt(Ce,"uint8",Se),lt(Re,"uint8",Se)],luminance:Ne,colors:[_t[0],_t[1],_t[2]]}},N=a.useMemo(()=>B(R),[]),U=a.useMemo(()=>B(A),[]),Q=!!w&&!!(g!=null&&g.enabled)&&!!d&&!!e&&((((xe=w.boxes)==null?void 0:xe.length)??0)>0||(((ie=w.masks)==null?void 0:ie.length)??0)>0),{gammaFilterId:j,filterStr:Te,gamma:ge,offset:oe}=tr(u),Me=`translate(${l.x}px, ${l.y}px) scale(${s})`,we=p==="auto"?void 0:p,{containerProps:se,modifierActive:Oe}=Fn({containerRef:m,zoom:s,pan:l,onViewportChange:c});return f.jsxs("div",{className:"relative flex flex-col h-full",children:[f.jsx(nr,{id:j,gamma:ge,offset:oe}),f.jsxs("div",{ref:m,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...se.style},onPointerDown:se.onPointerDown,onPointerMove:se.onPointerMove,onPointerUp:se.onPointerUp,onPointerCancel:se.onPointerCancel,children:[f.jsxs("div",{className:"relative w-full h-full",children:[f.jsxs("div",{className:"relative w-full h-full",style:{transform:Me,transformOrigin:"0 0"},children:[f.jsx("img",{ref:P,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:Te,imageRendering:we,...n==="blend"?{opacity:o}:{}},onLoad:ee=>{const $=ee.currentTarget;y({w:$.naturalWidth,h:$.naturalHeight})}}),Q&&f.jsx(en,{data:w,settings:g,naturalWidth:d.w,naturalHeight:d.h})]}),f.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:f.jsx("div",{className:"w-full h-full",style:{transform:Me,transformOrigin:"0 0"},children:f.jsx("img",{ref:L,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:Te,imageRendering:we,...n==="blend"?{opacity:1-o}:{}},onLoad:ee=>{const $=ee.currentTarget;S({w:$.naturalWidth,h:$.naturalHeight})}})})}),n==="split"&&f.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${r*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:()=>i==null?void 0:i(.5),onPointerDown:ee=>{ee.stopPropagation(),ee.preventDefault();const $=ee.currentTarget;try{$.setPointerCapture(ee.pointerId)}catch{}const Se=$.parentElement.getBoundingClientRect(),be=fe=>{i==null||i(Math.max(0,Math.min(1,(fe.clientX-Se.left)/Se.width)))},me=()=>{window.removeEventListener("pointermove",be),window.removeEventListener("pointerup",me)};window.addEventListener("pointermove",be),window.addEventListener("pointerup",me)},children:f.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})]}),n==="split"?f.jsxs(f.Fragment,{children:[t&&E&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:f.jsx(it,{imageElRef:L,naturalWidth:E.w,naturalHeight:E.h,zoom:s,pan:l,sample:U,notation:x,version:V})}),e&&d&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:f.jsx(it,{imageElRef:P,naturalWidth:d.w,naturalHeight:d.h,zoom:s,pan:l,sample:N,notation:x,version:V,onActiveChange:M})})]}):e&&d&&f.jsx(it,{imageElRef:P,naturalWidth:d.w,naturalHeight:d.h,zoom:s,pan:l,sample:N,notation:x,version:V,onActiveChange:M}),_&&f.jsx(Gn,{notation:x,onChange:C})]}),n==="split"&&f.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),f.jsxs("span",{className:`absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${h&&!Oe?" cairn-drag-grip":""}`,draggable:h&&!Oe,onDragStart:v,style:{cursor:h&&!Oe?"grab":void 0},children:[f.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50"}),b]})]})}function la(){return f.jsx("div",{className:"card p-4 text-sm text-red-400 h-full flex items-center justify-center text-center",children:"Plot error: float URL sources need the GPU compare (WebGPU) — unavailable here"})}function ua({mode:e,kernel:t,kernelOptions:n,onSlide:r,onBlend:o,onKernel:i,onSide:s}){return{id:"compare-mode",title:"Compare / diff mode",menu:{options:[...s?[{id:"side",label:"Side"}]:[],{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...n],value:e==="side"?"side":e==="split"?"slide":e==="blend"?"blend":t,onSelect:u=>{u==="side"?s==null||s():u==="slide"?r():u==="blend"?o():i(u)}}}}function fa(e){const t=zt(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function da(e){const{width:t,height:n,channels:r}=e,o=t*n;if(e.precision==="f16-bits"){const c=e.data,u=new Uint16Array(o*4);for(let p=0;p<o;p++){const b=p*r,h=p*4;if(r===1){const v=c[b];u[h]=v,u[h+1]=v,u[h+2]=v,u[h+3]=wt}else u[h]=c[b],u[h+1]=c[b+1],u[h+2]=c[b+2],u[h+3]=r>=4?c[b+3]:wt}return{data:u,format:"rgba16float"}}const i=e.data,s=new Float32Array(o*4),l=c=>Number.isFinite(c)?c:0;for(let c=0;c<o;c++){const u=c*r;let p,b,h,v=1;r===1?p=b=h=l(i[u]):r===3?(p=l(i[u]),b=l(i[u+1]),h=l(i[u+2])):(p=l(i[u]),b=l(i[u+1]),h=l(i[u+2]),v=l(i[u+3]));const w=c*4;s[w]=p,s[w+1]=b,s[w+2]=h,s[w+3]=v}return{data:s,format:"rgba32float"}}function pa({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:i,blendAlpha:s,onSplitPositionChange:l,diffSubmode:c,colormap:u="none",align:p="top-left",fit:b="crop",diffKernel:h,onDiffKernelChange:v,onCompareModeChange:w,onRequestSide:g,zoom:T,pan:m,onViewportChange:d,interpolation:y="auto",label:E="",pixelValueNotation:S="decimal"}){var jr;const x=a.useRef(null),C=a.useRef(null),_=a.useRef(null),M=a.useRef(null),P=a.useRef(null),[L,R]=a.useState(!1),[A,V]=a.useState(!1),[k,B]=a.useState(null),[N,U]=a.useState(null),[Q,j]=a.useState(0),[Te,ge]=a.useState(0),[oe,Me]=a.useState(null),[we,se]=a.useState({x:0,y:0,w:1,h:1}),Oe=h??c??"absolute",[xe,ie,ee]=ct(Oe);a.useEffect(()=>{ie(h??c??"absolute")},[h,c,ie]);const $=a.useCallback(D=>{ie(D),v==null||v(D)},[v,ie]);a.useEffect(()=>{const D=x.current;if(D)return D.__cairnDiffKernel={current:xe,set:$},()=>{D&&delete D.__cairnDiffKernel}},[xe,$]);const[Y,Se,be]=ct(o);a.useEffect(()=>{Se(o)},[o,Se]);const me=a.useCallback(D=>{Se(D),w==null||w(D)},[w,Se]),[fe,Ce,Re]=ct(u);a.useEffect(()=>{Ce(u)},[u,Ce]);const Ne=a.useCallback(()=>{me(be.default),Ce(Re.default),$(ee.default)},[me,Ce,$,be.default,Re.default,ee.default]),nt=be.isModified||Re.isModified||ee.isModified,[Fe,De]=a.useState(0),[F,ce]=a.useState(0),ye=a.useMemo(()=>{const W=[ua({mode:Y,kernel:xe,kernelOptions:Xr().map(H=>({id:H.id,label:H.label})),onSide:g,onSlide:()=>me("split"),onBlend:()=>me("blend"),onKernel:H=>{me("diff"),$(H)}})];return Y==="diff"&&W.push(cn(fe,H=>Ce(H))),W},[Y,xe,fe,$,me,g]),ve=a.useRef(null),re=a.useRef(null),le=a.useRef(null),Le=a.useRef(null),[z,O]=a.useState(0),X=a.useRef(null),I=a.useRef(null),[q,K]=a.useState(0),Ee=Jt();a.useEffect(()=>{const D=_.current;if(!D)return;let W=!1;return xt().then(H=>{if(!W)try{if(Zn())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const G=H.createSurface(D,{hdr:!1});M.current={device:H,surface:G,texA:null,texB:null},V(!0)}catch(G){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",G),R(!0)}}).catch(H=>{W||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",H),R(!0))}),()=>{var G,J;W=!0;const H=M.current;H&&((G=H.texA)==null||G.destroy(),(J=H.texB)==null||J.destroy(),M.current=null)}},[]),a.useEffect(()=>{const D=x.current;if(!D)return;const W=new ResizeObserver(()=>ge(H=>H+1));return W.observe(D),()=>W.disconnect()},[]),a.useEffect(()=>{if(!A)return;let D=!1;if(!M.current)return;async function H(G,J){if(J){const pe=da(J);return{width:J.width,height:J.height,imageData:null,make:_e=>{const ae=_e.createTexture(J.width,J.height,pe.format);return ae.write(pe.data),ae}}}if(!G)return null;const te=await rt(G);return te?{width:te.width,height:te.height,imageData:te,make:pe=>{const _e=pe.createTexture(te.width,te.height,"rgba8unorm");return _e.write(te.data),_e}}:null}return Promise.all([H(e,n),H(t,r)]).then(([G,J])=>{var Ie,$e;if(D||!M.current)return;const te=M.current;ve.current=(G==null?void 0:G.imageData)??null,re.current=(J==null?void 0:J.imageData)??null,le.current=n??null,Le.current=r??null,(Ie=te.texA)==null||Ie.destroy(),($e=te.texB)==null||$e.destroy(),te.texA=null,te.texB=null;const pe=G??J;if(!pe){B(null),U(null),O(Ge=>Ge+1);return}const _e=J??pe,ae=G??pe;te.texA=_e.make(te.device),te.texB=ae.make(te.device),U({a:{w:_e.width,h:_e.height},b:{w:ae.width,h:ae.height}}),B({w:pe.width,h:pe.height}),O(Ge=>Ge+1),j(Ge=>Ge+1)}),()=>{D=!0}},[A,e,t,n,r]);const de=n!=null||r!=null,Pe=a.useMemo(()=>Oi(xe,de),[xe,de]),ue=a.useMemo(()=>{if(!de)return null;const D=r??n;if(!D)return null;const W=D.precision==="f16-bits"?Dn(D.data):D.data;return ia(W,D.width,D.height,D.channels)},[de,r,n]),ze=a.useMemo(()=>{var D;return Mo(((D=tt(Pe))==null?void 0:D.displayRange)??"unit",fe==="none"?null:fe)},[Pe,fe]),Ze=a.useMemo(()=>fe!=="none"?fa(fe):void 0,[fe]),Ve=a.useMemo(()=>N?Tt(N.a,N.b,p,b,"b"):null,[N,p,b]),Ae=a.useMemo(()=>k?Y==="diff"&&Ve?Ve.result:k:null,[Y,Ve,k]),dt=a.useCallback(()=>{const D=M.current;if(!A||!D||!D.surface||!D.texA||!D.texB||!k)return;const W=Ae??k,H=x.current,G=H?H.getBoundingClientRect():{width:W.w,height:W.h},J=Sr({zoom:T,pan:m},G,W.w,W.h);se(ae=>ae.x===J.x&&ae.y===J.y&&ae.w===J.w&&ae.h===J.h?ae:J);const te=_.current;if(G.width>0&&G.height>0&&te&&D.surface){const ae=Math.max(1,Math.round(G.width*Ee)),Ie=Math.max(1,Math.round(G.height*Ee));(te.width!==ae||te.height!==Ie)&&(te.width=ae,te.height=Ie,D.surface.configure(ae,Ie))}const pe=Tr(J,G,W.w,W.h)>=tn?"nearest":"linear",_e=J;try{if(Y==="diff"){const ae=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",Ie=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",$e=tt(Pe)?Pe:"absolute",Ge=$e==="hdr-flip"&&ue?{ppd:67,startExposure:ue.startExposure,stopExposure:ue.stopExposure,numExposures:ue.numExposures}:void 0,ht=Xi(D.device,D.texA,D.texB,$e,Ge,ae,Ie,Ve??void 0);P.current=ht,ji(D.device,D.surface,ht.texture,ht.displayRange,{uv:_e,cmapMode:ze,colormap:Ze,filter:pe,exposureEV:Fe,offset:F})}else{const ae={exposureEV:Fe,offset:F,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,uv:_e,filter:pe,mode:Y,split:i,alpha:s};us(D.device,D.surface,D.texA,D.texB,ae)}}catch(ae){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",ae),R(!0)}},[A,k,Ae,Ve,T,m.x,m.y,Y,i,s,Fe,F,xe,Pe,ue,ze,Ze,e,t,n,r,Ee]);a.useEffect(()=>{dt()},[dt,Q,Te]);const Qe=t!=null||r!=null;a.useEffect(()=>{const D=M.current;if(!A||!D||!D.texA||!D.texB||!Qe){Me(null);return}let W=!1;const H=D.texA,G=D.texB,J=P.current,te=Y==="diff"?Ve??void 0:void 0;return(Y==="diff"&&J?Wi(D.device,J,H,G,te):Kn(D.device,H,G,te)).then(_e=>{W||Me(_e)}),()=>{W=!0}},[A,Q,Qe,Y,xe,Ve]),a.useEffect(()=>{if(Y!=="diff"){X.current=null,I.current=null;return}const D=M.current,W=P.current;if(!A||!D||!W)return;let H=!1;return X.current=null,I.current=null,K(G=>G+1),Hi(D.device,W).then(G=>{H||(X.current=G,I.current={w:W.width,h:W.height},K(J=>J+1))}).catch(()=>{}),()=>{H=!0}},[A,Y,Pe,Q,Ve]);const It=(D,W)=>(H,G,J)=>{const te=W.current;if(te){const{data:ht,width:Jr,height:ba,channels:eo}=te;if(H<0||G<0||H>=Jr||G>=ba)return null;const Ot=(G*Jr+H)*eo,Ut=te.precision==="f16-bits"?xn=>yt(ht[xn]??0):xn=>ht[xn]??0,va=.5,wa=eo===1?[Ut(Ot)]:[Ut(Ot),Ut(Ot+1),Ut(Ot+2)];return st(wa,"unit",J,va)}const pe=D.current;if(!pe||H<0||G<0||H>=pe.width||G>=pe.height)return null;const _e=(G*pe.width+H)*4,ae=pe.data[_e],Ie=pe.data[_e+1],$e=pe.data[_e+2],Ge=(.299*ae+.587*Ie+.114*$e)/255;return st(ae===Ie&&Ie===$e?[ae]:[ae,Ie,$e],"uint8",J,Ge)},pt=a.useMemo(()=>It(ve,le),[]),at=a.useMemo(()=>It(re,Le),[]),gn=a.useMemo(()=>(D,W,H)=>{var Ge;const G=X.current,J=I.current;if(!G||!J)return null;const{w:te,h:pe}=J;if(D<0||W<0||D>=te||W>=pe)return null;const _e=(W*te+D)*4,ae=((Ge=tt(Pe))==null?void 0:Ge.output)??"per-channel",Ie=.5,$e=ae==="scalar"?[G[_e]??0]:[G[_e]??0,G[_e+1]??0,G[_e+2]??0];return st($e,"unit",H,Ie)},[Pe]);a.useEffect(()=>{const D=x.current;if(D)return D.__cairnCompareProbe={sampleDiff:(W,H,G="decimal")=>gn(W,H,G),sampleFg:(W,H,G="decimal")=>pt(W,H,G),sampleRef:(W,H,G="decimal")=>at(W,H,G),get diffSamples(){return X.current},get dims(){return Ae},get primaryDims(){return k},get diffResultDims(){return I.current},get align(){return p},get fit(){return b},get resolvedKernelId(){return Pe},get compareMode(){return Y}},()=>{D&&delete D.__cairnCompareProbe}},[gn,pt,at,k,Ae,p,b,Pe,Y]);const ga=y==="auto"?void 0:y;if(L)return n!=null||r!=null?f.jsx(la,{}):Y==="diff"?f.jsx(ln,{imageUrl:e,baselineUrl:t,diffMode:((jr=tt(Pe))==null?void 0:jr.kind)==="pointwise"?Pe:"absolute",interpolation:y,colormap:fe,showAxes:!1,zoom:T,pan:m,onViewportChange:d,label:E,pixelValueNotation:S}):f.jsx(ca,{imageUrl:e,baselineUrl:t,mode:Y,splitPosition:i,blendAlpha:s,onSplitPositionChange:l,zoom:T,pan:m,onViewportChange:d,interpolation:y,label:E,pixelValueNotation:S});const xa=f.jsxs(f.Fragment,{children:[f.jsx("canvas",{ref:_,className:"w-full h-full block",style:{imageRendering:ga},"data-gpu-compare-canvas":!0}),Y==="split"&&f.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${i*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:D=>{D.stopPropagation(),l==null||l(.5)},onPointerDown:D=>{D.stopPropagation(),D.preventDefault();const W=D.currentTarget;try{W.setPointerCapture(D.pointerId)}catch{}const G=W.parentElement.getBoundingClientRect(),J=pe=>{l==null||l(Math.max(0,Math.min(1,(pe.clientX-G.left)/G.width)))},te=()=>{window.removeEventListener("pointermove",J),window.removeEventListener("pointerup",te)};window.addEventListener("pointermove",J),window.addEventListener("pointerup",te)},children:f.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})]});return f.jsx(At,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":A},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:x,wrapperRef:C,zoom:T,pan:m,onViewportChange:d,naturalDims:Ae,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:xa,showAxes:!1,notationSeed:S,onReset:Ne,extraModified:nt,exportCanvasRef:_,requestRender:dt,leadingMenus:ye,displayAdjust:{exposureEV:Fe,offset:F,onExposureChange:De,onOffsetChange:ce},label:"",showLabelChip:!1,overlay:{render:({notation:D,setOverlayActive:W})=>Y==="split"?f.jsxs(f.Fragment,{children:[Qe&&Ae&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-i)*100}% 0 0)`},children:f.jsx(it,{imageElRef:_,naturalWidth:Ae.w,naturalHeight:Ae.h,zoom:T,pan:m,sourceWindow:we,sample:at,notation:D,version:z})}),Qe&&Ae&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${i*100}%)`},children:f.jsx(it,{imageElRef:_,naturalWidth:Ae.w,naturalHeight:Ae.h,zoom:T,pan:m,sourceWindow:we,sample:pt,notation:D,version:z,onActiveChange:W})})]}):Ae&&f.jsx(it,{imageElRef:_,naturalWidth:Ae.w,naturalHeight:Ae.h,zoom:T,pan:m,sourceWindow:we,sample:Y==="diff"?gn:pt,notation:D,version:Y==="diff"?q:z,onActiveChange:W})},extraChips:f.jsxs(f.Fragment,{children:[Y==="split"&&f.jsx("span",{className:"absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm",children:"REF"}),E?f.jsx("span",{className:"absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm",children:E}):null,oe&&f.jsxs("span",{className:`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${E?"bottom-7":"bottom-1"}`,"data-gpu-compare-metrics":!0,children:["MSE ",oe.mse.toExponential(2)," · PSNR ",Number.isFinite(oe.psnr)?oe.psnr.toFixed(1):"∞"," dB · MAE"," ",oe.mae.toExponential(2)]})]})})}const ha="cairn-plot:gpu-image-ready";async function ma(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await xt(),window.__cairnPlotGpuImagePane=li,window.__cairnPlotGpuComparePane=pa,window.__cairnPlotDiffMenuModes=Xr(),window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(ha))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e),Mr("no-webgpu")}}}ma()})(__cairnPlotJsxRuntime,__cairnPlotReact);
