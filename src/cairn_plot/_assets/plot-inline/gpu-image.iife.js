var xl=Object.defineProperty;var bl=(f,c,ot)=>c in f?xl(f,c,{enumerable:!0,configurable:!0,writable:!0,value:ot}):f[c]=ot;var se=(f,c,ot)=>bl(f,typeof c!="symbol"?c+"":c,ot);(function(f,c){"use strict";const ot=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC;function ar(e,t){const n=navigator.gpu.getPreferredCanvasFormat();return e.configure({device:t,format:n,alphaMode:"premultiplied",usage:ot}),{hdr:!1,format:n}}function bs(e,t){try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:ot}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"extended"}}catch{try{return e.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"standard"},alphaMode:"premultiplied",usage:ot}),{hdr:!0,format:"rgba16float",colorSpace:"display-p3",toneMappingMode:"standard"}}catch{return ar(e,t)}}}const vs=`
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
`,ws=`
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
`;class ys extends Error{constructor(n){super(n);se(this,"deviceLost",!0);this.name="DeviceLostError"}}async function ir(e,t){try{await e.mapAsync(GPUMapMode.READ)}catch(n){if((n instanceof Error?n.name:"")==="AbortError"){const o=t.info;throw new ys("webgpu readback: buffer map aborted — device lost or destroyed mid-readback"+(o?` (reason=${String(o.reason)}${o.message?`: ${o.message}`:""})`:"")+`: ${n instanceof Error?n.message:String(n)}`)}throw n instanceof Error?n:new Error(String(n))}}function wn(e){switch(e){case"rgba8unorm":return"rgba8unorm";case"rgba16float":return"rgba16float";case"rgba32float":return"rgba32float";case"r32float":return"r32float";default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function cr(e){switch(e){case"rgba8unorm":return 4;case"rgba16float":return 8;case"rgba32float":return 16;case"r32float":return 4;default:{const t=e;throw new Error(`webgpu device: unknown TextureFormat ${String(t)}`)}}}function Es(e){const t=(e&32768)>>15,n=(e&31744)>>10,r=e&1023;let o;return n===0?o=r/1024*Math.pow(2,-14):n===31?o=r?NaN:1/0:o=(1+r/1024)*Math.pow(2,n-15),t?-o:o}const _s={texture:0,sampler:1,uniform:2};function yn(e,t){return e*3+_s[t]}const Ms={f32:4,i32:4,u32:4,"vec2<f32>":8,vec2f:8,"vec3<f32>":12,vec3f:12,"vec4<f32>":16,vec4f:16,"mat4x4<f32>":64,mat4x4f:64};function Ss(e){const t=new Map,n=/@group\(0\)\s*@binding\((\d+)\)\s*var(<uniform>)?\s+\w+\s*:\s*([^;]+);/g;let r;for(;(r=n.exec(e))!==null;){const o=Number(r[1]),a=r[2]!==void 0,s=r[3].trim();if(a){const u=Ms[s];if(u===void 0)throw new Error(`webgpu device: parseWGSLBindings doesn't know the size of uniform type "${s}" (binding ${o}). Add it to WGSL_UNIFORM_TYPE_SIZE.`);t.set(o,{kind:"uniform",sizeBytes:u})}else s==="sampler"||s==="sampler_comparison"?t.set(o,{kind:"sampler"}):t.set(o,{kind:"texture"})}return t}class lr{constructor(t,n,r,o){se(this,"width");se(this,"height");se(this,"format");se(this,"gpuTexture");se(this,"device");se(this,"destroyed",!1);this.device=t,this.width=n,this.height=r,this.format=o,this.gpuTexture=t.createTexture({size:{width:n,height:r,depthOrArrayLayers:1},format:wn(o),usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT})}write(t){if(this.destroyed)throw new Error("webgpu device: write() on a destroyed texture");const n=this.width*cr(this.format);this.device.queue.writeTexture({texture:this.gpuTexture},t,{bytesPerRow:n,rowsPerImage:this.height},{width:this.width,height:this.height,depthOrArrayLayers:1})}destroy(){this.destroyed||(this.gpuTexture.destroy(),this.destroyed=!0)}}class ur{constructor(t){se(this,"_s");se(this,"gpuSampler");this.gpuSampler=t,this._s=t}}class As{constructor(t,n,r,o,a){se(this,"_p");se(this,"gpuPipeline");se(this,"bindings");se(this,"bindGroupLayout");se(this,"variants");se(this,"buildVariant");this.gpuPipeline=t,this.bindings=n,this.bindGroupLayout=r,this.buildVariant=a,this.variants=new Map([[o,t]]),this._p=t}pipelineFor(t){let n=this.variants.get(t);return n||(n=this.buildVariant(t),this.variants.set(t,n)),n}}function Ps(e,t){const n=[];for(const[r,o]of t)o.kind==="uniform"?n.push({binding:r,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}):o.kind==="sampler"?n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}):n.push({binding:r,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}});return e.createBindGroupLayout({entries:n})}class Ts{constructor(t){se(this,"_c");se(this,"gpuPipeline");this.gpuPipeline=t,this._c=t}}class Rs{constructor(t,n,r,o,a){se(this,"width");se(this,"height");se(this,"paramsBuffer");se(this,"bindGroup");se(this,"buffers");se(this,"destroyed",!1);this.width=t,this.height=n,this.buffers=r,this.paramsBuffer=o,this.bindGroup=a}destroy(){if(!this.destroyed){for(const t of this.buffers)t.destroy();this.paramsBuffer.destroy(),this.destroyed=!0}}}class Cs{constructor(t,n){se(this,"_b");se(this,"gpuBindGroup");se(this,"ownedBuffers");se(this,"destroyed",!1);this.gpuBindGroup=t,this.ownedBuffers=n,this._b=t}destroy(){if(!this.destroyed){for(const t of this.ownedBuffers)t.destroy();this.destroyed=!0}}}class Ds{constructor(t,n,r,o){se(this,"canvas");se(this,"hdr");se(this,"format");se(this,"context");se(this,"reconfigure");this.canvas=t,this.context=n,this.hdr=r.hdr,this.format=r.format,this.reconfigure=o}configure(t,n){this.canvas.width=t,this.canvas.height=n;const r=this.reconfigure();this.hdr=r.hdr,this.format=r.format}getCurrentTextureView(){return this.context.getCurrentTexture().createView()}getCurrentGPUTexture(){return this.context.getCurrentTexture()}}function It(e){return"canvas"in e}async function ks(){if(!("gpu"in navigator)||!navigator.gpu)throw new Error("webgpu device: navigator.gpu is not available in this browser");const e=await navigator.gpu.requestAdapter();if(!e)throw new Error("webgpu device: requestAdapter() returned null");const t=await e.requestDevice(),n={hdr:!0,compute:!0,float16:!0};let r=null;function o(){return r||(r=t.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})),r}function a(m){return It(m)?m.getCurrentTextureView():m.gpuTexture.createView()}function s(m){if(It(m))return{width:m.canvas.width,height:m.canvas.height};const E=m;return{width:E.width,height:E.height}}let u=!1;const i={};t.lost.then(m=>{i.info=m},()=>{});let l=null;function d(){var E,_;if(l!==null)return l;let m=!1;try{if(typeof document<"u"){const y=document.createElement("canvas");y.width=1,y.height=1;const R=y.getContext("webgpu");if(R)try{R.configure({device:t,format:"rgba16float",colorSpace:"display-p3",toneMapping:{mode:"extended"},alphaMode:"premultiplied",usage:GPUTextureUsage.RENDER_ATTACHMENT});const P=(E=R.getConfiguration)==null?void 0:E.call(R);m=((_=P==null?void 0:P.toneMapping)==null?void 0:_.mode)==="extended"}catch{m=!1}finally{try{R.unconfigure()}catch{}}}}catch{m=!1}return l=m,m}const x=256;let p=null,b=null;function w(){if(!p||!b){const m=t.createShaderModule({code:vs});b=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"unfilterable-float"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});const E=t.createPipelineLayout({bindGroupLayouts:[b]});p=t.createComputePipeline({layout:E,compute:{module:m,entryPoint:"cs_main"}})}return{pipeline:p,layout:b}}let v=null,M=null;function h(){if(!v||!M){const m=t.createShaderModule({code:ws});M=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});const E=t.createPipelineLayout({bindGroupLayouts:[M]});v=t.createRenderPipeline({layout:E,vertex:{module:m,entryPoint:"vs_main"},fragment:{module:m,entryPoint:"fs_main",targets:[{format:"rgba16float"}]},primitive:{topology:"triangle-list"}})}return{pipeline:v,layout:M}}return{backend:"webgpu",capabilities:n,probeExtendedToneMapping:d,createTexture(m,E,_){return new lr(t,m,E,_)},createSampler(m){const E=(m==null?void 0:m.filter)==="linear"?"linear":"nearest",_=t.createSampler({magFilter:E,minFilter:E,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return new ur(_)},createRenderPipeline(m){const E=t.createShaderModule({code:m.shaderWGSL}),_=Ss(m.shaderWGSL),y=wn(m.targetFormat),R=Ps(t,_),P=t.createPipelineLayout({bindGroupLayouts:[R]}),S=T=>t.createRenderPipeline({layout:P,vertex:{module:E,entryPoint:"vs_main"},fragment:{module:E,entryPoint:"fs_main",targets:[{format:T}]},primitive:{topology:"triangle-list"}}),A=S(y);return new As(A,_,R,y,S)},createComputePipeline(m){const E=t.createShaderModule({code:m.shaderWGSL}),_=t.createComputePipeline({layout:"auto",compute:{module:E,entryPoint:"cs_main"}});return new Ts(_)},createBindGroup(m,E){const _=m,y=new Map,R=[];for(const[S,A]of _.bindings)if(A.kind==="uniform"){const T=t.createBuffer({size:A.sizeBytes,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});R.push(T),y.set(S,{binding:S,resource:{buffer:T}})}else A.kind==="sampler"&&y.set(S,{binding:S,resource:o()});for(const S of E){const A=S.resource;if(A instanceof lr){const T=yn(S.binding,"texture");_.bindings.has(T)&&y.set(T,{binding:T,resource:A.gpuTexture.createView()})}else if(A instanceof ur){const T=yn(S.binding,"sampler");_.bindings.has(T)&&y.set(T,{binding:T,resource:A.gpuSampler})}else{const T=yn(S.binding,"uniform"),L=_.bindings.get(T);if(L&&L.kind==="uniform"){const D=A.uniform,B=t.createBuffer({size:Math.max(L.sizeBytes,D.byteLength),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(B,0,D.buffer,D.byteOffset,D.byteLength),R.push(B),y.set(T,{binding:T,resource:{buffer:B}})}}}const P=t.createBindGroup({layout:_.bindGroupLayout,entries:Array.from(y.values())});return new Cs(P,R)},createSurface(m,E){const _=m.getContext("webgpu");if(!_)throw new Error("webgpu device: canvas.getContext('webgpu') returned null");const y=E.hdr&&n.hdr,R=()=>y?bs(_,t):ar(_,t),P=R();return new Ds(m,_,P,R)},renderFullscreen(m,E,_){const y=E,R=_,P=a(m),{width:S,height:A}=s(m),T=It(m)?m.format:wn(m.format),L=y.pipelineFor(T),D=t.createCommandEncoder(),B=D.beginRenderPass({colorAttachments:[{view:P,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});B.setPipeline(L),B.setBindGroup(0,R.gpuBindGroup),B.setViewport(0,0,S,A,0,1),B.draw(3),B.end(),t.queue.submit([D.finish()])},createDeepSampleBuffers(m){const{layout:E}=h(),_=T=>{const L=t.createBuffer({size:T.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});return t.queue.writeBuffer(L,0,T.buffer,T.byteOffset,T.byteLength),L},y=_(m.offsets),R=_(m.colors),P=_(m.zs),S=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),A=t.createBindGroup({layout:E,entries:[{binding:0,resource:{buffer:y}},{binding:1,resource:{buffer:R}},{binding:2,resource:{buffer:P}},{binding:3,resource:{buffer:S}}]});return new Rs(m.width,m.height,[y,R,P],S,A)},compositeDeep(m,E,_,y){const R=m,P=E,{pipeline:S}=h();t.queue.writeBuffer(R.paramsBuffer,0,new Float32Array([R.width,R.height,y,_]));const A=t.createCommandEncoder(),T=A.beginRenderPass({colorAttachments:[{view:P.gpuTexture.createView(),loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});T.setPipeline(S),T.setBindGroup(0,R.bindGroup),T.setViewport(0,0,P.width,P.height,0,1),T.draw(3),T.end(),t.queue.submit([A.finish()])},async readback(m){const E=It(m),{width:_,height:y}=s(m),R=E?m.hdr?"rgba16float":"rgba8unorm":m.format,P=E&&m.format==="bgra8unorm",S=E?m.getCurrentGPUTexture():m.gpuTexture,A=cr(R),T=_*A,L=256,D=Math.ceil(T/L)*L,B=D*y,N=t.createBuffer({size:B,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),F=t.createCommandEncoder();F.copyTextureToBuffer({texture:S},{buffer:N,bytesPerRow:D,rowsPerImage:y},{width:_,height:y,depthOrArrayLayers:1}),t.queue.submit([F.finish()]);try{await ir(N,i)}catch(V){try{N.destroy()}catch{}throw V}const z=new Uint8Array(N.getMappedRange()),G=new Uint8Array(T*y);for(let V=0;V<y;V++){const $=V*D,Q=V*T;G.set(z.subarray($,$+T),Q)}if(N.unmap(),N.destroy(),R==="rgba8unorm"){if(P)for(let V=0;V<G.length;V+=4){const $=G[V],Q=G[V+2];G[V]=Q,G[V+2]=$}return G}if(R==="rgba16float"){const V=new Uint16Array(G.buffer,G.byteOffset,G.byteLength/2),$=new Float32Array(V.length);for(let Q=0;Q<V.length;Q++)$[Q]=Es(V[Q]);return $}return new Float32Array(G.buffer,G.byteOffset,G.byteLength/4)},async reduceDiffSumSquaredAbs(m,E,_,y){const R=m,P=E,S=Math.max(0,_*y),A=Math.max(1,Math.ceil(S/x)),{pipeline:T,layout:L}=w(),D=A*2*4,B=t.createBuffer({size:D,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),N=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(N,0,new Uint32Array([Math.max(1,_),Math.max(1,y),S,0]));const F=t.createBindGroup({layout:L,entries:[{binding:0,resource:R.gpuTexture.createView()},{binding:1,resource:P.gpuTexture.createView()},{binding:2,resource:{buffer:B}},{binding:3,resource:{buffer:N}}]}),z=t.createBuffer({size:D,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),G=t.createCommandEncoder(),V=G.beginComputePass();V.setPipeline(T),V.setBindGroup(0,F),V.dispatchWorkgroups(A),V.end(),G.copyBufferToBuffer(B,0,z,0,D),t.queue.submit([G.finish()]);try{await ir(z,i)}catch(de){for(const W of[z,B,N])try{W.destroy()}catch{}throw de}const Q=new Float32Array(z.getMappedRange()).slice();z.unmap(),z.destroy(),B.destroy(),N.destroy();let he=0,ae=0;for(let de=0;de<A;de++)he+=Q[de*2],ae+=Q[de*2+1];return{sumSq:he,sumAbs:ae}},destroy(){u||(t.destroy(),u=!0)},isContextLost(){return!1}}}let En=null;async function Ls(){if(typeof navigator>"u"||!("gpu"in navigator)||!navigator.gpu)throw new Error("cairn-plot engine: WebGPU is not available (no navigator.gpu) — no fallback backend in the engine, caller must use the legacy CPU pane");return ks()}function Ft(){return En||(En=Ls()),En}function Os(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function Bs(e){const t=new Uint8Array(768);for(let n=0;n<256;n++){const o=n/255*(e.length-1),a=Math.floor(o),s=Math.min(a+1,e.length-1),u=o-a,[i,l,d]=Os(e[a],e[s],u);t[n*3]=Math.round(i),t[n*3+1]=Math.round(l),t[n*3+2]=Math.round(d)}return t}const _n={viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},Ns=Object.keys(_n),Is={viridis:"Viridis",plasma:"Plasma",magma:"Magma","red-green":"Red–Green","red-blue":"Red–Blue"},Fs=Ns.map(e=>({id:e,label:Is[e]})),Gs=new Set(["red-green","red-blue"]),fr=new Map;function Mn(e){let t=fr.get(e);if(!t){const n=_n[e]??_n.viridis;t=Bs(n),fr.set(e,t)}return t}function mt(e,t,n){return e<t?t:e>n?n:e}function Oe(e){return e<0?0:e>1?1:e}function Gt(e,t,n){return mt(Math.floor(e),t,n)}const Sn=e=>{const t=e<0?0:e;return t/(1+t)},An=e=>{const t=e<0?0:e,n=t*(2.51*t+.03),r=t*(2.43*t+.59)+.14;return Oe(n/r)},Ut=4,dr=1,Tt=16,pr=.5,mr={linear:([e,t,n])=>[Oe(e),Oe(t),Oe(n)],srgb:([e,t,n])=>[Oe(e),Oe(t),Oe(n)],gamma:([e,t,n])=>[Oe(e),Oe(t),Oe(n)],reinhard:([e,t,n])=>[Sn(e),Sn(t),Sn(n)],aces:([e,t,n])=>[An(e),An(t),An(n)],extended:([e,t,n])=>[e,t,n]},hr="srgb",gr=["linear","srgb","gamma","reinhard","aces"],Us=["srgb","gamma","linear"],xr={extended:"linear","extended-clamp":"linear","extended-reinhard":"reinhard","extended-aces":"aces","extended-gamma":"gamma"};function zs(e){return e&&mr[e]||mr[hr]}function zt(e){return e&&xr[e]?xr[e]:e&&gr.includes(e)?e:hr}const br=zt;function vr(e){return e==="extended"?$s:void 0}function wr(e,t){return e==null?"srgb":br(e)}function Vt(e,t,n){return e*2**t+n}function Vs(e){const t=Oe(e);return t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055}function Pn(e){const t=Oe(e);return t<=.04045?t/12.92:Math.pow((t+.055)/1.055,2.4)}function yt(e,t){return typeof t=="number"&&t>0?Oe(Math.pow(Oe(e),1/t)):Vs(e)}const Et=2.2,$t=.5,Xt=4,Ht=.1;function Wt(e){return e==="gamma"}function Tn(e,t){if(e==="gamma")return t>0?t:Et;if(e==="linear")return 1}const $s=1/0;function yr(e,t,n,r){const o=br(e),a=Tn(o,r);if(!n||Number.isFinite(t)&&t<=1)return{operator:o,hdrOut:!1,peak:1,gamma:a};const s=!Number.isFinite(t);switch(o){case"reinhard":return s?{operator:"extended",hdrOut:!0,peak:Tt,gamma:void 0}:{operator:"extended-reinhard",hdrOut:!0,peak:t,gamma:void 0};case"aces":return{operator:"extended-aces",hdrOut:!0,peak:s?Tt:t,gamma:void 0};default:return s?{operator:"extended",hdrOut:!0,peak:Tt,gamma:a}:{operator:"extended-clamp",hdrOut:!0,peak:t,gamma:a}}}function Rn(e,t,n="linear",r=0,o=0){const a=Mn(t),s=new ImageData(e.width,e.height),u=e.data,i=s.data,l=r!==0||o!==0;for(let d=0;d<u.length;d+=4){let x=(u[d]+u[d+1]+u[d+2])/3;l&&(x=Math.max(0,Math.min(255,Vt(x/255,r,o)*255)));let p;n==="positive"?p=Math.round(128+x/255*127):p=Math.round(x),p=Math.max(0,Math.min(255,p)),i[d]=a[p*3],i[d+1]=a[p*3+1],i[d+2]=a[p*3+2],i[d+3]=u[d+3]}return s}function Xs(e,t){return e==="signed"||e==="relative"?"signed":Cn(t)}function Cn(e){return Gs.has(e??"")?"positive":"linear"}function Er(e,t){const n=new Map;return{get(r){const o=n.get(r);if(o!==void 0)return n.delete(r),n.set(r,o),o},set(r,o){for(n.get(r)!==void 0&&n.delete(r),n.set(r,o);n.size>e;){const s=n.keys().next().value;if(s===void 0)break;n.get(s),n.delete(s)}},has(r){return n.has(r)},get size(){return n.size}}}const _r=Er(50);function Dn(e){return _r.get(e)}function kn(e,t){_r.set(e,t)}const Mr=Er(100);function Hs(e){return Mr.get(e)}function Ws(e,t){Mr.set(e,t)}function Ys(e,t,n){const r=Math.min(e.width,t.width),o=Math.min(e.height,t.height),a=new ImageData(r,o);for(let s=0;s<o;s++)for(let u=0;u<r;u++){const i=(s*e.width+u)*4,l=(s*t.width+u)*4,d=(s*r+u)*4;for(let x=0;x<3;x++){const p=e.data[i+x],b=t.data[l+x],w=p-b,v=Math.abs(w),M=Math.max(p,1);let h;switch(n){case"signed":h=(w+255)/2;break;case"absolute":h=v;break;case"squared":h=w*w/255;break;case"relative_signed":h=(w/M+1)*127.5;break;case"relative_absolute":h=v/M*255;break;case"relative_squared":h=w*w/(M*M)*255;break}a.data[d+x]=Math.min(255,Math.max(0,Math.round(h)))}a.data[d+3]=255}return a}async function st(e){const t=Hs(e);return t||new Promise(n=>{const r=new Image;r.onload=()=>{try{const o=document.createElement("canvas");o.width=r.naturalWidth,o.height=r.naturalHeight;const a=o.getContext("2d");if(!a){n(null);return}a.drawImage(r,0,0);const s=a.getImageData(0,0,o.width,o.height);Ws(e,s),n(s)}catch(o){console.warn("[cairn] loadImageData failed:",o),n(null)}},r.onerror=o=>{console.warn("[cairn] loadImageData: image failed to load:",e,o),n(null)},r.src=e})}const Ks={signed:0,absolute:1,squared:2,relative_signed:3,relative_absolute:4,relative_squared:5},qs={linear:0,signed:1,positive:2},Zs=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,Qs=`#version 300 es
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
}`;let ht=null,ee=null,De=null,Yt=null;function js(){if(ee)return ee;try{if(typeof OffscreenCanvas<"u"?ht=new OffscreenCanvas(1,1):ht=document.createElement("canvas"),ee=ht.getContext("webgl2",{preserveDrawingBuffer:!0}),!ee)return console.warn("[cairn] WebGL 2 not available"),null;const e=ee.createShader(ee.VERTEX_SHADER);if(ee.shaderSource(e,Zs),ee.compileShader(e),!ee.getShaderParameter(e,ee.COMPILE_STATUS))return console.error("[cairn] WebGL vertex shader:",ee.getShaderInfoLog(e)),null;const t=ee.createShader(ee.FRAGMENT_SHADER);if(ee.shaderSource(t,Qs),ee.compileShader(t),!ee.getShaderParameter(t,ee.COMPILE_STATUS))return console.error("[cairn] WebGL fragment shader:",ee.getShaderInfoLog(t)),null;if(De=ee.createProgram(),ee.attachShader(De,e),ee.attachShader(De,t),ee.linkProgram(De),!ee.getProgramParameter(De,ee.LINK_STATUS))return console.error("[cairn] WebGL program link:",ee.getProgramInfoLog(De)),null;Yt=ee.createVertexArray(),ee.bindVertexArray(Yt);const n=ee.createBuffer();ee.bindBuffer(ee.ARRAY_BUFFER,n),ee.bufferData(ee.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),ee.STATIC_DRAW);const r=ee.getAttribLocation(De,"a_pos");return ee.enableVertexAttribArray(r),ee.vertexAttribPointer(r,2,ee.FLOAT,!1,0,0),ee.bindVertexArray(null),console.info("[cairn] WebGL 2 diff initialized"),ee}catch(e){return console.warn("[cairn] WebGL 2 init failed:",e),null}}function Sr(e,t,n){const r=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,t.data),r}function Js(e,t,n){const r=new Uint8Array(1024);for(let a=0;a<256;a++)r[a*4]=t[a*3],r[a*4+1]=t[a*3+1],r[a*4+2]=t[a*3+2],r[a*4+3]=255;const o=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,r),o}function ea(e,t,n,r){const o=js();if(!o||!De||!Yt||!ht)return null;const a=Math.min(e.width,t.width),s=Math.min(e.height,t.height);ht.width=a,ht.height=s,o.viewport(0,0,a,s);const u=Sr(o,e,0),i=Sr(o,t,1);let l=null;n.colormap?l=Js(o,n.colormap,2):(l=o.createTexture(),o.activeTexture(o.TEXTURE2),o.bindTexture(o.TEXTURE_2D,l),o.texImage2D(o.TEXTURE_2D,0,o.RGBA8,1,1,0,o.RGBA,o.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]))),o.useProgram(De),o.uniform1i(o.getUniformLocation(De,"u_baseline"),0),o.uniform1i(o.getUniformLocation(De,"u_other"),1),o.uniform1i(o.getUniformLocation(De,"u_lut"),2),o.uniform1i(o.getUniformLocation(De,"u_diff_mode"),Ks[n.diffMode]),o.uniform1i(o.getUniformLocation(De,"u_cmap_mode"),qs[n.cmapMode]??0),o.uniform1i(o.getUniformLocation(De,"u_use_colormap"),n.colormap?1:0),o.bindVertexArray(Yt),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null),r.width=a,r.height=s;const d=r.getContext("2d");return d&&(d.save(),d.scale(1,-1),d.drawImage(ht,0,0,a,s,0,-s,a,s),d.restore()),o.deleteTexture(u),o.deleteTexture(i),o.deleteTexture(l),{width:a,height:s}}const ta="cairn:render-mode";function na(){try{const e=localStorage.getItem(ta);if(e==="gpu"||e==="cpu"||e==="auto")return e}catch{}return"auto"}const Kt=15360;function qt(e){const t=e&32768?-1:1,n=e>>10&31,r=e&1023;return n===0?r===0?t*0:t*r*2**-24:n===31?r===0?t*(1/0):NaN:t*2**(n-15)*(1+r/1024)}const Ar=globalThis.Float16Array;function Pr(e,t=e.length){if(Ar){const r=new Ar(e.buffer,e.byteOffset,t);return Float32Array.from(r)}const n=new Float32Array(t);for(let r=0;r<t;r++)n[r]=qt(e[r]);return n}const qe=new Uint32Array(512),Ze=new Uint32Array(512);for(let e=0;e<256;++e){const t=e-127;t<-27?(qe[e]=0,qe[e|256]=32768,Ze[e]=24,Ze[e|256]=24):t<-14?(qe[e]=1024>>-t-14,qe[e|256]=1024>>-t-14|32768,Ze[e]=-t-1,Ze[e|256]=-t-1):t<=15?(qe[e]=t+15<<10,qe[e|256]=t+15<<10|32768,Ze[e]=13,Ze[e|256]=13):t<128?(qe[e]=31744,qe[e|256]=64512,Ze[e]=24,Ze[e|256]=24):(qe[e]=31744,qe[e|256]=64512,Ze[e]=13,Ze[e|256]=13)}/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.8.2
*/var Rt=Uint8Array,Tr=Uint16Array,ra=Int32Array,oa=new Rt([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),sa=new Rt([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),Rr=function(e,t){for(var n=new Tr(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var o=new ra(n[30]),r=1;r<30;++r)for(var a=n[r];a<n[r+1];++a)o[a]=a-n[r]<<5|r;return{b:n,r:o}},Cr=Rr(oa,2),aa=Cr.b,ia=Cr.r;aa[28]=258,ia[258]=28,Rr(sa,0);for(var ca=new Tr(32768),we=0;we<32768;++we){var at=(we&43690)>>1|(we&21845)<<1;at=(at&52428)>>2|(at&13107)<<2,at=(at&61680)>>4|(at&3855)<<4,ca[we]=((at&65280)>>8|(at&255)<<8)>>1}for(var Zt=new Rt(288),we=0;we<144;++we)Zt[we]=8;for(var we=144;we<256;++we)Zt[we]=9;for(var we=256;we<280;++we)Zt[we]=7;for(var we=280;we<288;++we)Zt[we]=8;for(var la=new Rt(32),we=0;we<32;++we)la[we]=5;var ua=new Rt(0),fa=typeof TextDecoder<"u"&&new TextDecoder,da=0;try{fa.decode(ua,{stream:!0}),da=1}catch{}const Dr=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function Ln(e){const t=Dr.length;return Dr[(e%t+t)%t]}function pa(e){const n=c.useRef(null),[r,o]=c.useState({w:0,h:0}),a=c.useRef(null),s=c.useRef(null),u=c.useRef(null),i=c.useCallback((l,d)=>{o(x=>x.w===l&&x.h===d?x:{w:l,h:d})},[]);return c.useLayoutEffect(()=>{const l=n.current;if(!l||l===u.current)return;const d=l.getBoundingClientRect();(d.width>0||d.height>0)&&(u.current=l,i(d.width,d.height))}),c.useEffect(()=>{var x;const l=n.current;if(l===s.current||((x=a.current)==null||x.disconnect(),a.current=null,s.current=l,!l))return;const d=new ResizeObserver(p=>{for(const b of p)i(b.contentRect.width,b.contentRect.height)});a.current=d,d.observe(l)}),c.useEffect(()=>()=>{var l;return(l=a.current)==null?void 0:l.disconnect()},[]),{ref:n,size:r}}function ma(){const[e,t]=c.useState(!1);return c.useEffect(()=>{const n=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!0)},r=a=>{(a.key==="Alt"||a.key==="Control"||a.key==="Meta")&&t(!1)},o=()=>t(!1);return window.addEventListener("keydown",n),window.addEventListener("keyup",r),window.addEventListener("blur",o),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",r),window.removeEventListener("blur",o)}},[]),e}const ha=.001;function ga(e,t=ha){return Math.exp(-e*t)}function kr(e,t){return Math.hypot(e.x-t.x,e.y-t.y)}function Lr(e,t){return{x:(e.x+t.x)/2,y:(e.y+t.y)/2}}function xa(e,t,n,r,o,a,s){const u=t>0&&r>0?r/t:1,i=Math.max(a,Math.min(s,e.zoom*u)),l=(n.x-e.pan.x)/e.zoom,d=(n.y-e.pan.y)/e.zoom;return{zoom:i,pan:{x:o.x-l*i,y:o.y-d*i}}}const ba=.25,On=64;function Bn(e,t,n,r){if(e<=0||t<=0||n<=0||r<=0)return On;const o=Math.min(n/e,r/t);return o<=0?On:Math.max(Math.max(n,r)/o,8)}function Or(e){const{containerRef:t,zoom:n,pan:r,onViewportChange:o,minZoom:a=ba,maxZoom:s=On,naturalWidth:u,naturalHeight:i}=e,l=ma(),d=c.useRef(l);d.current=l;const x=c.useRef({zoom:n,pan:r});x.current={zoom:n,pan:r};const p=c.useRef(o);p.current=o,c.useEffect(()=>{const P=t.current;if(!P||!o)return;const S=A=>{var $;if(!A.ctrlKey&&!d.current)return;A.preventDefault(),A.stopPropagation();const T=ga(A.deltaY),L=x.current,D=P.getBoundingClientRect(),B=u&&i?Bn(u,i,D.width,D.height):s,N=Math.max(a,Math.min(B,L.zoom*T));if(L.zoom===N)return;const F=A.clientX-D.left,z=A.clientY-D.top,G=F-(F-L.pan.x)/L.zoom*N,V=z-(z-L.pan.y)/L.zoom*N;($=p.current)==null||$.call(p,{zoom:N,pan:{x:G,y:V}})};return P.addEventListener("wheel",S,{passive:!1}),()=>P.removeEventListener("wheel",S)},[t,!!o,a,s,u,i]);const b=c.useRef(new Map),w=c.useRef(null),v=c.useRef(null),M=c.useCallback((P,S,A)=>{const T=P.getBoundingClientRect();return{x:S-T.left,y:A-T.top}},[]),h=c.useCallback(P=>{if(!u||!i)return s;const S=P.getBoundingClientRect();return Bn(u,i,S.width,S.height)},[u,i,s]),g=c.useCallback((P,S)=>{const A=b.current,T=A.get(P),L=A.get(S);!T||!L||(w.current=null,v.current={idA:P,idB:S,startDist:kr(T,L),startMid:Lr(T,L),startZoom:x.current.zoom,startPan:{...x.current.pan}})},[]),m=c.useCallback(P=>{const S=b.current.get(P);S&&(w.current={pointerId:P,startX:S.x,startY:S.y,panX:x.current.pan.x,panY:x.current.pan.y})},[]),E=c.useCallback(P=>{if(!p.current)return;const S=P.pointerType==="touch";if(!S&&!d.current)return;const A=P.currentTarget;if(A.setPointerCapture(P.pointerId),b.current.set(P.pointerId,M(A,P.clientX,P.clientY)),S&&b.current.size>=2){const T=[...b.current.keys()];g(T[T.length-2],T[T.length-1]);return}m(P.pointerId)},[M,g,m]),_=c.useCallback(P=>{var D,B;const S=P.currentTarget,A=b.current.get(P.pointerId);if(A){const N=M(S,P.clientX,P.clientY);A.x=N.x,A.y=N.y}const T=v.current;if(T){const N=b.current.get(T.idA),F=b.current.get(T.idB);if(!N||!F)return;const z=xa({zoom:T.startZoom,pan:T.startPan},T.startDist,T.startMid,kr(N,F),Lr(N,F),a,h(S));(D=p.current)==null||D.call(p,z);return}const L=w.current;!L||L.pointerId!==P.pointerId||!A||(B=p.current)==null||B.call(p,{zoom:x.current.zoom,pan:{x:L.panX+(A.x-L.startX),y:L.panY+(A.y-L.startY)}})},[M,a,h]),y=c.useCallback(P=>{var A;try{P.currentTarget.releasePointerCapture(P.pointerId)}catch{}b.current.delete(P.pointerId);const S=v.current;if(S&&(P.pointerId===S.idA||P.pointerId===S.idB)){v.current=null;const T=[...b.current.keys()];T.length===1&&m(T[0]);return}((A=w.current)==null?void 0:A.pointerId)===P.pointerId&&(w.current=null)},[m]);return{containerProps:{onPointerDown:E,onPointerMove:_,onPointerUp:y,onPointerCancel:y,style:{cursor:l&&!!o?"move":void 0,touchAction:o?"none":void 0}},modifierActive:l}}function Nn(){const[e,t]=c.useState(()=>typeof window<"u"&&window.devicePixelRatio||1);return c.useEffect(()=>{if(typeof matchMedia>"u")return;let n=!1,r=null;const o=()=>{n||(t(window.devicePixelRatio||1),a())};function a(){if(n)return;const s=window.devicePixelRatio||1;r=matchMedia(`(resolution: ${s}dppx)`),r.addEventListener("change",o,{once:!0})}return a(),()=>{n=!0,r==null||r.removeEventListener("change",o)}},[]),e}function ke(e){const t=c.useRef(e),[n,r]=c.useState(e),o=c.useCallback(()=>r(t.current),[]);return[n,r,{reset:o,isModified:!Object.is(n,t.current),default:t.current}]}function va(e){const t=e.replace("#","");return[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}function Br(e,t,n){return!(n.has(e.class_id)||e.score!=null&&e.score<t.scoreThreshold)}function In({data:e,settings:t,naturalWidth:n,naturalHeight:r}){const{ref:o,size:a}=pa(),s=c.useRef(null),u=c.useMemo(()=>new Set(t.hiddenClasses),[t.hiddenClasses]),i=c.useMemo(()=>{const v=a.w,M=a.h;if(v<=0||M<=0||n<=0||r<=0)return null;const h=Math.min(v/n,M/r),g=n*h,m=r*h;return{left:(v-g)/2,top:(M-m)/2,width:g,height:m}},[a.w,a.h,n,r]),l=e.masks,d=t.showMasks&&!!l&&l.length>0,x=c.useMemo(()=>t.hiddenClasses.join(","),[t.hiddenClasses]);if(c.useEffect(()=>{if(!d||!l)return;const v=s.current;if(!v)return;(v.width!==n||v.height!==r)&&(v.width=n,v.height=r);const M=v.getContext("2d");if(!M)return;M.clearRect(0,0,v.width,v.height);let h=!1;const g=M.createImageData(n,r),m=g.data;let E=l.length,_=!1;const y=()=>{h||_&&M.putImageData(g,0,0)},R=document.createElement("canvas");R.width=n,R.height=r;const P=R.getContext("2d",{willReadFrequently:!0});for(const S of l){const A=new Image;A.onload=()=>{if(!h){if(P){P.clearRect(0,0,n,r),P.drawImage(A,0,0,n,r);const T=P.getImageData(0,0,n,r).data;for(let L=0;L<n*r;L++){const D=T[L*4];if(D===0||u.has(D))continue;const[B,N,F]=va(Ln(D));m[L*4]=B,m[L*4+1]=N,m[L*4+2]=F,m[L*4+3]=255,_=!0}}E-=1,E===0&&y()}},A.onerror=()=>{E-=1,E===0&&y()},A.src=`data:image/png;base64,${S.png_b64}`}return()=>{h=!0}},[d,l,n,r,x]),!i)return f.jsx("div",{ref:o,className:"absolute inset-0 pointer-events-none"});const p=e.boxes??[],b=t.showBoxes&&p.length>0,w=e.class_labels??{};return f.jsxs("div",{ref:o,className:"absolute inset-0 pointer-events-none overflow-hidden",children:[d&&f.jsx("canvas",{ref:s,className:"absolute",style:{left:i.left,top:i.top,width:i.width,height:i.height,opacity:t.maskOpacity,imageRendering:"pixelated"}}),b&&f.jsx("svg",{className:"absolute",style:{left:i.left,top:i.top,width:i.width,height:i.height,overflow:"visible"},viewBox:`0 0 ${n} ${r}`,preserveAspectRatio:"none",children:p.map((v,M)=>{if(!Br(v,t,u))return null;const h=v.domain==="pixel"?1:n,g=v.domain==="pixel"?1:r,m=v.position.minX*h,E=v.position.minY*g,_=(v.position.maxX-v.position.minX)*h,y=(v.position.maxY-v.position.minY)*g;return f.jsx("rect",{x:m,y:E,width:_,height:y,fill:"none",stroke:Ln(v.class_id),strokeWidth:2,vectorEffect:"non-scaling-stroke"},M)})}),b&&f.jsx("div",{className:"absolute",style:{left:i.left,top:i.top,width:i.width,height:i.height},children:p.map((v,M)=>{if(!Br(v,t,u))return null;const h=v.domain==="pixel"?1/n:1,g=v.domain==="pixel"?1/r:1,m=v.position.minX*h*100,E=v.position.minY*g*100,_=v.label??w[String(v.class_id)]??`#${v.class_id}`,y=v.score!=null?` ${(v.score*100).toFixed(0)}%`:"";return!_&&!y?null:f.jsx("span",{className:"absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white",style:{left:`${m}%`,top:`${E}%`,transform:"translateY(-100%)",backgroundColor:Ln(v.class_id)},children:f.jsxs("span",{className:"mono",children:[_,y]})},M)})})]})}function wa(e,t){const n=t==null?void 0:t.precision,r=ya(e,n);return t!=null&&t.minus?r.replace("-","−"):r}function ya(e,t){if(!Number.isFinite(e))return String(e);if(e===0)return"0";const n=Math.abs(e);return n>=1e3||n<.001?e.toExponential(Math.max(0,t-2)):Number(e.toPrecision(t)).toString()}const Ea={x:0,y:0,w:1,h:1};function Qt(e){const t=e.sourceWindow??Ea,n=t.x*e.naturalWidth,r=t.y*e.naturalHeight,o=t.w*e.naturalWidth,a=t.h*e.naturalHeight,s=Math.min(e.box.width/o,e.box.height/a),u=o*s,i=a*s;return{scale:s,imgLeft:e.box.left+(e.box.width-u)/2,imgTop:e.box.top+(e.box.height-i)/2,srcOriginX:n,srcOriginY:r,visibleW:o,visibleH:a}}function _a(e){return Qt(e).scale}function Nr(e,t,n){const r=Qt(n);return{x:r.srcOriginX+(e-r.imgLeft)/r.scale,y:r.srcOriginY+(t-r.imgTop)/r.scale}}function Ir(e,t,n){const r=Qt(n);return{x:r.imgLeft+(e-r.srcOriginX)*r.scale,y:r.imgTop+(t-r.srcOriginY)*r.scale}}function Ma(e,t){const n=Ir(e.x0,e.y0,t),r=Ir(e.x1+1,e.y1+1,t);return{left:n.x,top:n.y,width:r.x-n.x,height:r.y-n.y}}function Fr(e,t,n,r,o){const a=Nr(e,t,o),s=Nr(n,r,o),u=o.naturalWidth-1,i=o.naturalHeight-1,l=Math.min(a.x,s.x),d=Math.max(a.x,s.x),x=Math.min(a.y,s.y),p=Math.max(a.y,s.y);return d<0||l>u||p<0||x>i?null:{x0:Gt(l,0,u),y0:Gt(x,0,i),x1:Gt(d,0,u),y1:Gt(p,0,i)}}const jt=30,Sa=.14,Gr=1.15,Aa=.62,Pa=4,Ta=24,Ra=6;function Ca(e,t){if(e<=0||t<=0)return 0;const n=e*(1-2*Sa),r=n/(t*Gr),o=n/(Pa*Aa);return Math.min(r,o,Ta)}function Da(e){return e>=jt}const Jt=["#ff5a5a","#39d353","#5b9bff"],ka="#ffffff",La="rgba(0,0,0,0.9)",Oa=.15,Ba=.06;function Fn(e){return wa(e,{precision:3})}function _t(e,t,n){return t==="uint8"?n==="int"?String(Math.round(e)):Fn(e/255):Fn(n==="int"?e*255:e)}function gt(e,t,n){return e.length===1?{lines:[_t(e[0],t,n)]}:{lines:e.map(r=>_t(r,t,n)),colors:e.map((r,o)=>Jt[o]??null)}}const Na={x:0,y:0,w:1,h:1};function xt({imageElRef:e,naturalWidth:t,naturalHeight:n,zoom:r,pan:o,sample:a,notation:s="decimal",version:u=0,onActiveChange:i,sourceWindow:l=Na}){const d=c.useRef(null),x=c.useRef(!1),p=Nn(),b=c.useRef(i);b.current=i;const w=c.useCallback(M=>{var h;M!==x.current&&(x.current=M,(h=b.current)==null||h.call(b,M))},[]),v=c.useCallback(()=>{var W;const M=d.current,h=e.current;if(!M)return;const g=window.devicePixelRatio||1,m=M.clientWidth,E=M.clientHeight;if(m===0||E===0)return;M.width!==Math.round(m*g)&&(M.width=Math.round(m*g)),M.height!==Math.round(E*g)&&(M.height=Math.round(E*g));const _=M.getContext("2d");if(!_)return;if(_.setTransform(g,0,0,g,0,0),_.clearRect(0,0,m,E),!h||t<=0||n<=0){w(!1);return}const y=h.getBoundingClientRect(),R=M.getBoundingClientRect();if(y.width===0||y.height===0){w(!1);return}const S=Qt({box:y,naturalWidth:t,naturalHeight:n,sourceWindow:l}),{srcOriginX:A,srcOriginY:T,visibleW:L,visibleH:D,scale:B}=S;if(L<=0||D<=0){w(!1);return}if(!Da(B)){w(!1);return}const N=S.imgLeft-R.left,F=S.imgTop-R.top,z=Math.max(Math.floor(A),Math.floor(A+(0-N)/B)),G=Math.min(Math.ceil(A+L),Math.ceil(A+(m-N)/B)),V=Math.max(Math.floor(T),Math.floor(T+(0-F)/B)),$=Math.min(Math.ceil(T+D),Math.ceil(T+(E-F)/B));if(G<=z||$<=V){w(!1);return}w(!0);const Q=N+(0-A)*B,he=F+(0-T)*B,ae=N+(t-A)*B,de=F+(n-T)*B;_.save(),_.beginPath(),_.rect(Q,he,ae-Q,de-he),_.clip(),_.textAlign="center",_.textBaseline="middle";for(let j=V;j<$;j++)for(let q=z;q<G;q++){if(q<0||j<0||q>=t||j>=n)continue;const re=a(q,j,s);if(!re||re.lines.length===0)continue;const ge=re.lines.length,te=Ca(B,ge);if(te<Ra)continue;const ie=N+(q-A+.5)*B,xe=F+(j-T+.5)*B,ye=te*Gr;_.font=`${te}px ui-monospace, SFMono-Regular, Menlo, monospace`,_.shadowColor=La,_.shadowBlur=Math.max(2,te*Oa),_.shadowOffsetX=0,_.shadowOffsetY=Math.max(1,te*Ba);let pe=xe-ge*ye/2+ye/2;for(let Se=0;Se<re.lines.length;Se++){const me=re.lines[Se];_.fillStyle=((W=re.colors)==null?void 0:W[Se])??ka,_.fillText(me,ie,pe),pe+=ye}}_.restore()},[e,t,n,a,s,w,l]);return c.useEffect(()=>{v()},[v,r,o.x,o.y,u,s,l,p]),c.useEffect(()=>{const M=d.current;if(!M)return;const h=new ResizeObserver(()=>v());return h.observe(M),()=>h.disconnect()},[v]),f.jsx("canvas",{ref:d,className:"absolute inset-0 w-full h-full pointer-events-none z-10","aria-hidden":!0})}function Ur({notation:e,onChange:t,className:n=""}){return f.jsx("button",{type:"button",onClick:r=>{r.stopPropagation(),t(e==="int"?"decimal":"int")},onPointerDown:r=>r.stopPropagation(),className:`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${n}`,title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",children:e==="int"?"0–255":"0–1"})}const Ia=`
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
`,Ct=`
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
`,Fa=`
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
`,en=`
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
`;function zr(e){return`
${Ue}
${bt}
${Fa}

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
`}const Ga=zr("select(colorB, colorA, uv.x < split)"),Ua=zr("mix(colorA, colorB, alpha)");function za(e){switch(e){case"center":return{v:"center",h:"center"};case"top-right":return{v:"top",h:"right"};case"bottom-left":return{v:"bottom",h:"left"};case"bottom-right":return{v:"bottom",h:"right"};case"top-left":default:return{v:"top",h:"left"}}}function Vr(e,t,n){const{v:r,h:o}=za(n),a=e.w-t.w,s=e.h-t.h,u=o==="left"?0:o==="right"?a:Math.floor(a/2),i=r==="top"?0:r==="bottom"?s:Math.floor(s/2);return{x:u,y:i}}function Dt(e,t,n,r,o="b"){if(r==="fill"){const s=o==="a"?{w:e.w,h:e.h}:{w:t.w,h:t.h};return{fit:r,result:s,offsetA:{x:0,y:0},offsetB:{x:0,y:0}}}const a={w:Math.min(e.w,t.w),h:Math.min(e.h,t.h)};return{fit:r,result:a,offsetA:Vr(e,a,n),offsetB:Vr(t,a,n)}}function Gn(e){return`${e.fit}:${e.result.w}x${e.result.h}:${e.offsetA.x},${e.offsetA.y}:${e.offsetB.x},${e.offsetB.y}`}const tn={linear:0,srgb:1,reinhard:2,aces:3,extended:4,"extended-reinhard":5,"extended-aces":6,"extended-clamp":7,gamma:8},$r=new WeakMap;function Va(e,t){let n=$r.get(e);n||(n=new Map,$r.set(e,n));let r=n.get(t);return r||(r=e.createRenderPipeline({shaderWGSL:Ia,targetFormat:t}),n.set(t,r)),r}function Xr(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function Hr(e,t){if(t){if(t.length!==256*4)throw new Error(`renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function $a(e,t,n,r){var h;const o=Xr(t),a=Va(e,o),s=Hr(e,r.isScalar?r.colormap:void 0),u=typeof r.gamma=="number"&&r.gamma>0?r.gamma:0,i=tn[r.operator]??tn.srgb,l=new Float32Array([r.exposureEV,i,u,r.isScalar?1:0]),d=new Float32Array([r.uv.x,r.uv.y,r.uv.w,r.uv.h]),x=new Float32Array([r.hdrOut?1:0]),p=new Float32Array([r.filter==="nearest"?0:1]),b=new Float32Array([r.offset??0]),w=new Float32Array([r.peak??Ut]),v=new Float32Array([r.srgbDecode?1:0]);let M;try{M=e.createBindGroup(a,[{binding:0,resource:n},{binding:1,resource:s},{binding:2,resource:{uniform:l}},{binding:3,resource:{uniform:d}},{binding:4,resource:{uniform:x}},{binding:5,resource:{uniform:p}},{binding:6,resource:{uniform:b}},{binding:7,resource:{uniform:w}},{binding:8,resource:{uniform:v}}]),e.renderFullscreen(t,a,M)}finally{(h=M==null?void 0:M.destroy)==null||h.call(M),s.destroy()}}const Wr=new WeakMap;function Xa(e,t,n){let r=Wr.get(e);r||(r=new Map,Wr.set(e,r));const o=`${t}:${n}`;let a=r.get(o);return a||(a=e.createRenderPipeline({shaderWGSL:t==="split"?Ga:Ua,targetFormat:n}),r.set(o,a)),a}function Ha(e,t,n,r,o){var v;if(o.mode==="diff")throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");const a=Xr(t),s=Xa(e,o.mode,a),u=Hr(e,o.isScalar?o.colormap:void 0),i=typeof o.gamma=="number"&&o.gamma>0?o.gamma:0,l=tn[o.operator]??tn.srgb,d=new Float32Array([o.exposureEV,l,i,o.isScalar?1:0]),x=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),p=new Float32Array([o.split,o.alpha,o.hdrOut?1:0,o.filter==="nearest"?0:1]),b=new Float32Array([o.offset??0,o.peak??Ut,o.srgbDecodeA?1:0,o.srgbDecodeB?1:0]);let w;try{w=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:r},{binding:2,resource:u},{binding:3,resource:{uniform:d}},{binding:4,resource:{uniform:x}},{binding:5,resource:{uniform:p}},{binding:6,resource:{uniform:b}}]),e.renderFullscreen(t,s,w)}finally{(v=w==null?void 0:w.destroy)==null||v.call(w),u.destroy()}}function Yr(e,t,n){if(n<=0)return{mse:0,psnr:1/0,mae:0};const r=e/n,o=t/n,a=r<=0?1/0:10*Math.log10(1/r);return{mse:r,psnr:a,mae:o}}async function Kr(e,t,n,r){const o=r??Dt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),a=o.result.w,s=o.result.h,u=a*s*3;if(u<=0)return{mse:0,psnr:1/0,mae:0};if(o.fit==="crop"&&o.offsetA.x===0&&o.offsetA.y===0&&o.offsetB.x===0&&o.offsetB.y===0&&e.reduceDiffSumSquaredAbs){const{sumSq:m,sumAbs:E}=await e.reduceDiffSumSquaredAbs(t,n,a,s);return Yr(m,E,u)}const l=await e.readback(t),d=await e.readback(n),x=l instanceof Uint8Array?255:1,p=d instanceof Uint8Array?255:1,b=nn(l,t.width,t.height,x,o.offsetA,o.fit==="fill",a,s),w=nn(d,n.width,n.height,p,o.offsetB,o.fit==="fill",a,s);let v=0,M=0;const h=[0,0,0],g=[0,0,0];for(let m=0;m<s;m++)for(let E=0;E<a;E++){b(E,m,h),w(E,m,g);for(let _=0;_<3;_++){const y=h[_]-g[_];v+=y*y,M+=Math.abs(y)}}return Yr(v,M,u)}function nn(e,t,n,r,o,a,s,u){const i=(x,p,b)=>e[(p*t+x)*4+b]??0;if(!a)return(x,p,b)=>{const w=Math.min(Math.max(x+o.x,0),t-1),v=Math.min(Math.max(p+o.y,0),n-1);b[0]=i(w,v,0)/r,b[1]=i(w,v,1)/r,b[2]=i(w,v,2)/r};const l=t-1,d=n-1;return(x,p,b)=>{const w=(x+.5)/s,v=(p+.5)/u,M=w*t-.5,h=v*n-.5,g=Math.floor(M),m=Math.floor(h),E=M-g,_=h-m,y=Math.min(Math.max(g,0),l),R=Math.min(Math.max(g+1,0),l),P=Math.min(Math.max(m,0),d),S=Math.min(Math.max(m+1,0),d);for(let A=0;A<3;A++){const T=i(y,P,A),L=i(R,P,A),D=i(y,S,A),B=i(R,S,A),N=T+(L-T)*E,F=D+(B-D)*E;b[A]=(N+(F-N)*_)/r}}}function qr(){if(typeof location>"u")return!1;try{return new URLSearchParams(location.search).has("forceEngineFail")}catch{return!1}}const Wa=12,it=[];function Zr(e){const t=it.indexOf(e);t!==-1&&it.splice(t,1),it.push(e)}function Ya(e){const t=it.indexOf(e);t!==-1&&it.splice(t,1)}function rn(e){e.parked||(Ya(e),e.srcTexture&&(e.srcTexture.destroy(),e.srcTexture=null),e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),e.surface=null,e.parked=!0)}function Qr(e){for(;it.length>Wa;){const t=it.find(n=>n!==e&&!n.visible)??it.find(n=>n!==e);if(!t)break;rn(t)}}function jr(e){var o,a,s,u;if(e.disposed)return;if(qr())throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");if(!e.parked&&e.surface){Zr(e),Qr(e);return}const t=e.device;e.surface=t.createSurface(e.canvas,{hdr:e.hdr});const n=e.backingWidth||((o=e.source)==null?void 0:o.width)||((a=e.deep)==null?void 0:a.width)||1,r=e.backingHeight||((s=e.source)==null?void 0:s.height)||((u=e.deep)==null?void 0:u.height)||1;if(e.canvas.width=n,e.canvas.height=r,e.surface.configure(n,r),e.deep){const i=t.createTexture(e.deep.width,e.deep.height,"rgba16float");e.srcTexture=i,e.deepBuffers=t.createDeepSampleBuffers(e.deep),t.compositeDeep(e.deepBuffers,i,e.deepZNear,e.deepZFar)}else if(e.source){const i=t.createTexture(e.source.width,e.source.height,e.source.format);i.write(e.source.data),e.srcTexture=i}e.parked=!1,Zr(e),Qr(e)}function Ka(e,t){if(e.disposed||!e.source&&!e.deep)return!0;try{return jr(e),!e.surface||!e.srcTexture?!1:($a(e.device,e.surface,e.srcTexture,t),!0)}catch(n){return console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane",n),e.parked=!1,rn(e),!1}}function qa(e){return{canvas:e.canvas,get isParked(){return e.parked},setSource(t){if(!e.disposed&&(e.source=t,e.deep=null,e.deepBuffers&&(e.deepBuffers.destroy(),e.deepBuffers=null),!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy();const n=e.device.createTexture(t.width,t.height,t.format);n.write(t.data),e.srcTexture=n}},setDeepSource(t,n,r){if(!e.disposed&&(e.deep=t,e.deepZNear=n,e.deepZFar=r,e.source=null,!e.parked&&e.surface)){e.srcTexture&&e.srcTexture.destroy(),e.deepBuffers&&e.deepBuffers.destroy();const o=e.device.createTexture(t.width,t.height,"rgba16float");e.srcTexture=o,e.deepBuffers=e.device.createDeepSampleBuffers(t),e.device.compositeDeep(e.deepBuffers,o,n,r)}},setDeepWindow(t,n){e.disposed||(e.deepZNear=t,e.deepZFar=n,!e.parked&&e.deepBuffers&&e.srcTexture&&e.device.compositeDeep(e.deepBuffers,e.srcTexture,t,n))},resize(t,n){if(e.disposed)return;const r=Math.max(1,Math.round(t)),o=Math.max(1,Math.round(n));e.backingWidth===r&&e.backingHeight===o||(e.backingWidth=r,e.backingHeight=o,!e.parked&&e.surface&&(e.canvas.width=r,e.canvas.height=o,e.surface.configure(r,o)))},render(t){return Ka(e,t)},park(){e.disposed||rn(e)},restore(){e.disposed||!e.source&&!e.deep||jr(e)},setVisible(t){e.disposed||(e.visible=t)},dispose(){e.disposed||(rn(e),e.source=null,e.deep=null,e.disposed=!0)}}}async function Za(e,t){const n=await Ft(),r={canvas:e,device:n,hdr:(t==null?void 0:t.hdr)??!1,surface:null,srcTexture:null,source:null,deep:null,deepZNear:-1/0,deepZFar:1/0,deepBuffers:null,parked:!0,disposed:!1,visible:!0,backingWidth:0,backingHeight:0};return qa(r)}function Jr(e){e.dispose()}function eo({title:e,body:t,className:n}){return f.jsx("div",{className:n??"relative h-full w-full",children:f.jsxs("div",{className:"flex h-full w-full flex-col items-center justify-center gap-1 rounded bg-bg-hover p-4 text-center",children:[f.jsx("div",{className:"text-sm font-semibold text-fg",children:e}),f.jsx("div",{className:"text-xs text-fg-muted",children:t})]})})}function Qa(e,t,n){return t<=0||n<=0||e.width<=0||e.height<=0?0:Math.min(e.width/t,e.height/n)}function ja(e,t){return e>=t?"pixelated":void 0}function Ja(e,t){const{brightness:n,contrast:r,exposure:o,flipSign:a}=e;return[`url(#${t})`,`brightness(${(1+n)*Math.pow(2,o)})`,`contrast(${1+r})`,...a?["invert(1)"]:[]].join(" ")}function to(e){const n=`cairn-gamma-${c.useId().replace(/[^a-zA-Z0-9_-]/g,"-")}`,{brightness:r,contrast:o,gamma:a,exposure:s,offset:u,flipSign:i}=e,l=c.useMemo(()=>Ja(e,n),[n,r,o,s,i]);return{gammaFilterId:n,filterStr:l,gamma:a,offset:u}}function no({id:e,gamma:t,offset:n}){return f.jsx("svg",{"aria-hidden":"true",style:{position:"absolute",width:0,height:0},children:f.jsx("filter",{id:e,colorInterpolationFilters:"sRGB",children:f.jsxs("feComponentTransfer",{children:[f.jsx("feFuncR",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),f.jsx("feFuncG",{type:"gamma",amplitude:1,exponent:1/t,offset:n}),f.jsx("feFuncB",{type:"gamma",amplitude:1,exponent:1/t,offset:n})]})})})}const ei=["nw","n","ne","e","se","s","sw","w"];function ti(e,t,n,r,o,a=1){const s=o.w-1,u=o.h-1,i=Math.round(n),l=Math.round(r);if(t==="move"){const g=e.x1-e.x0,m=e.y1-e.y0,E=mt(e.x0+i,0,s-g),_=mt(e.y0+l,0,u-m);return{x0:E,y0:_,x1:E+g,y1:_+m}}let{x0:d,y0:x,x1:p,y1:b}=e;const w=t==="nw"||t==="w"||t==="sw",v=t==="ne"||t==="e"||t==="se",M=t==="nw"||t==="n"||t==="ne",h=t==="sw"||t==="s"||t==="se";return w&&(d=mt(d+i,0,p-(a-1))),v&&(p=mt(p+i,d+(a-1),s)),M&&(x=mt(x+l,0,b-(a-1))),h&&(b=mt(b+l,x+(a-1),u)),{x0:d,y0:x,x1:p,y1:b}}function ro(e){return e<=32?4:e<=128?16:e<=512?64:e<=2048?256:512}function ni({naturalWidth:e,naturalHeight:t,zoom:n=1,containerRef:r}){const o=ro(e),a=ro(t),s=[];for(let g=0;g<=e;g+=o)s.push(g);const u=[];for(let g=0;g<=t;g+=a)u.push(g);const i=1/n,l=8*i,d=-12*i,x=-2*i,p=r==null?void 0:r.current;let b=0,w=0,v=0,M=0;if(p){const g=p.clientWidth,m=p.clientHeight,E=g/e,_=m/t,y=Math.min(E,_);v=e*y,M=t*y,b=(g-v)/2,w=(m-M)/2}const h=p&&v>0;return f.jsxs(f.Fragment,{children:[f.jsx("div",{className:"absolute left-0 right-0 text-fg-muted leading-none pointer-events-none select-none",style:{top:h?w:0,transform:`translateY(${d}px)`,fontSize:l},children:s.map(g=>f.jsx("span",{className:"mono",style:{position:"absolute",left:h?b+g/e*v:`${g/e*100}%`,transform:"translateX(-50%)"},children:g},g))}),f.jsx("div",{className:"absolute top-0 bottom-0 text-fg-muted leading-none pointer-events-none select-none",style:{left:h?b:0,transform:`translateX(${x}px)`,fontSize:l},children:u.map(g=>f.jsx("span",{className:"mono",style:{position:"absolute",top:h?w+g/t*M:`${g/t*100}%`,transform:"translate(-100%, -50%)",paddingRight:`${3*i}px`},children:g},g))})]})}function Un({label:e,corner:t="bottom-left",isDraggable:n=!1,grip:r=n,onDragStart:o}){const a=t==="bottom-right"?"bottom-1 right-1":"bottom-1 left-1";return f.jsxs("span",{className:`absolute ${a} z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${n?" cairn-drag-grip":""}`,draggable:n,onDragStart:o,style:{cursor:n?"grab":void 0},children:[r&&f.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),e]})}const ri=["fill","fill-opacity","stroke","stroke-width","stroke-opacity","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","color","font","font-family","font-size","font-weight","font-style","text-anchor","dominant-baseline","visibility","display"];function oo(e,t){const n=getComputedStyle(e),r=ri.map(i=>`${i}:${n.getPropertyValue(i)}`).join(";"),o=t.getAttribute("style");t.setAttribute("style",o?`${o};${r}`:r);const a=e.children,s=t.children,u=Math.min(a.length,s.length);for(let i=0;i<u;i++)oo(a[i],s[i])}function zn(e){let t=e;for(;t;){const n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"&&!n.startsWith("rgba(0, 0, 0, 0)"))return n;t=t.parentElement}return"#ffffff"}function Vn(e){const t=(e==null?void 0:e.scale)??(typeof window<"u"&&window.devicePixelRatio||1);return Math.min(Math.max(t,1),3)}async function $n(e,t,n,r,o){const a=document.createElement("canvas");a.width=Math.max(1,Math.round(e*n)),a.height=Math.max(1,Math.round(t*n));const s=a.getContext("2d");if(!s)throw new Error("plot-to-png: 2D canvas context unavailable");return s.scale(n,n),r&&(s.fillStyle=r,s.fillRect(0,0,e,t)),o(s),await new Promise((u,i)=>a.toBlob(l=>l?u(l):i(new Error("plot-to-png: toBlob returned null")),"image/png"))}function oi(e,t,n){const r=e.cloneNode(!0);oo(e,r),r.setAttribute("width",String(t)),r.setAttribute("height",String(n)),r.setAttribute("xmlns","http://www.w3.org/2000/svg");const o=new XMLSerializer().serializeToString(r),a="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(o);return new Promise((s,u)=>{const i=new Image;i.onload=()=>s(i),i.onerror=()=>u(new Error("plot-to-png: SVG rasterization failed")),i.src=a})}async function so(e,t){const n=e.getBoundingClientRect(),r=n.width||e.width,o=n.height||e.height,a=(t==null?void 0:t.background)??zn(e);return $n(r,o,Vn(t),a,s=>s.drawImage(e,0,0,r,o))}async function si(e,t){const n=e.getBoundingClientRect(),r=n.width||e.naturalWidth||e.width,o=n.height||e.naturalHeight||e.height,a=(t==null?void 0:t.background)??zn(e);try{return await $n(r,o,Vn(t),a,s=>s.drawImage(e,0,0,r,o))}catch(s){throw new Error(`plot-to-png: cannot export <img> — the image source appears to be cross-origin (tainted canvas). Same-document data:/blob: images export fine. (${s instanceof Error?s.message:String(s)})`)}}function ai(e){const t=Array.from(e.querySelectorAll("img"));let n=null,r=0;for(const o of t){const a=o.getBoundingClientRect(),s=a.width*a.height;s>r&&(r=s,n=o)}return n}async function ii(e,t){const n=e.querySelector("svg"),r=Array.from(e.querySelectorAll("canvas")),o=e.getBoundingClientRect(),a=o.width||300,s=o.height||150,u=(t==null?void 0:t.background)??zn(e);if(n){const l=n.getBoundingClientRect(),d=await oi(n,l.width||a,l.height||s);return $n(a,s,Vn(t),u,x=>{for(const p of r){const b=p.getBoundingClientRect();x.drawImage(p,b.left-o.left,b.top-o.top,b.width,b.height)}x.drawImage(d,l.left-o.left,l.top-o.top,l.width,l.height)})}if(r.length)return so(r[0],t);const i=ai(e);if(i)return si(i,t);throw new Error("plot-to-png: no <svg>, <canvas>, or <img> found under root")}function ci(e,t){const n=URL.createObjectURL(e),r=document.createElement("a");r.href=n,r.download=t.endsWith(".png")?t:`${t}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}const li=8;function ui(e,t,n,r=li){return!(t>0)||!(e>0)?n:e<t+r}function ao(e,t){return Math.max(0,e.findIndex(n=>n.id===t))}function fi(e){const t=e.trim();if(t==="")return null;const n=t.replace(/−/g,"-").replace(",","."),r=/^([+-]?)(inf(?:inity)?|∞)$/i.exec(n);if(r)return r[1]==="-"?-1/0:1/0;const o=Number(n);return Number.isNaN(o)?null:o}function di(e,t){const n=fi(e);return n===null?t:n}function pi(e){return String(e)}const mi={"top-right":{top:6,right:6},"top-left":{top:6,left:6},"bottom-right":{bottom:6,right:6},"bottom-left":{bottom:6,left:6}},hi={boxZoom:f.jsx("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"1.5",strokeDasharray:"4 3"}),select:f.jsxs(f.Fragment,{children:[f.jsx("rect",{x:"3",y:"3",width:"11",height:"11",rx:"1",strokeDasharray:"3 2.5"}),f.jsx("path",{d:"M12 12l8.5 3.3-3.4 1-1 3.4z",fill:"currentColor",stroke:"currentColor",strokeWidth:"1",strokeLinejoin:"round"})]}),lasso:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z"}),f.jsx("path",{d:"M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5"}),f.jsx("circle",{cx:"7.7",cy:"19.6",r:"1.05",fill:"currentColor",stroke:"none"})]}),pan:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 2v20M2 12h20"}),f.jsx("path",{d:"M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"})]}),zoomIn:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),f.jsx("path",{d:"M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6"})]}),zoomOut:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"10.5",cy:"10.5",r:"7"}),f.jsx("path",{d:"M21 21l-5.2-5.2M7.5 10.5h6"})]}),autoscale:f.jsx("path",{d:"M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"}),home:f.jsx("path",{d:"M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6"}),camera:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"}),f.jsx("circle",{cx:"12",cy:"13.5",r:"3.3"})]}),caret:f.jsx("path",{d:"M6 9l6 6 6-6"}),ellipsis:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"5",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),f.jsx("circle",{cx:"12",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"}),f.jsx("circle",{cx:"19",cy:"12",r:"1.4",fill:"currentColor",stroke:"none"})]}),sun:f.jsxs(f.Fragment,{children:[f.jsx("circle",{cx:"12",cy:"12",r:"4"}),f.jsx("path",{d:"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"})]}),plusminus:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M4 7h6M7 4v6"}),f.jsx("path",{d:"M14 17h6"}),f.jsx("path",{d:"M6 20l12-16"})]}),layers:f.jsxs(f.Fragment,{children:[f.jsx("path",{d:"M12 3l9 5-9 5-9-5 9-5z"}),f.jsx("path",{d:"M3 13l9 5 9-5"})]})};function tt({name:e}){return f.jsx("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:hi[e]??null})}function io({icon:e,label:t,title:n,active:r,disabled:o,onClick:a}){return f.jsx("button",{type:"button",disabled:o,onClick:s=>{s.stopPropagation(),!o&&a()},onPointerDown:s=>s.stopPropagation(),onDoubleClick:s=>s.stopPropagation(),"aria-label":n,"aria-pressed":r,"aria-disabled":o,title:n,className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",t?"px-1.5 text-[10px] font-mono":"text-xs",o?"opacity-40 cursor-default text-fg-muted":r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:t?f.jsx("span",{"aria-hidden":"true",children:t}):f.jsx(tt,{name:e??""})})}function co(){return f.jsx("span",{"aria-hidden":"true",className:"mx-0.5 h-3.5 w-px bg-border"})}function lo(e,t,n){const r=c.useRef(n);r.current=n,c.useEffect(()=>{if(!e)return;const o=s=>{t.current&&!t.current.contains(s.target)&&r.current()},a=s=>{s.key==="Escape"&&(s.stopPropagation(),r.current())};return document.addEventListener("pointerdown",o,!0),document.addEventListener("keydown",a,!0),()=>{document.removeEventListener("pointerdown",o,!0),document.removeEventListener("keydown",a,!0)}},[e,t])}function gi({icon:e,title:t,menu:n}){var M;const{options:r,value:o,onSelect:a}=n,[s,u]=c.useState(!1),[i,l]=c.useState(0),d=c.useRef(null),x=ao(r,o),p=e?void 0:((M=r[x])==null?void 0:M.label)??"",b=c.useCallback(()=>{u(h=>{const g=!h;return g&&l(x),g})},[x]),w=c.useCallback(h=>{a(h),u(!1)},[a]);lo(s,d,()=>u(!1));const v=h=>{if(!s){(h.key==="ArrowDown"||h.key==="Enter"||h.key===" ")&&(h.preventDefault(),l(x),u(!0));return}if(h.key==="ArrowDown")h.preventDefault(),l(g=>(g+1)%r.length);else if(h.key==="ArrowUp")h.preventDefault(),l(g=>(g-1+r.length)%r.length);else if(h.key==="Enter"||h.key===" "){h.preventDefault();const g=r[i];g&&w(g.id)}};return f.jsxs("div",{ref:d,className:"relative inline-flex",onPointerDown:h=>h.stopPropagation(),children:[f.jsxs("button",{type:"button",onClick:h=>{h.stopPropagation(),b()},onDoubleClick:h=>h.stopPropagation(),onKeyDown:v,"aria-haspopup":"listbox","aria-expanded":s,"aria-label":t,title:t,className:["h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",p?"px-1.5 text-[10px] font-mono":"px-1 text-xs",s?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:[p?f.jsx("span",{"aria-hidden":"true",children:p}):f.jsx(tt,{name:e??""}),f.jsx(tt,{name:"caret"})]}),s&&f.jsx("ul",{role:"listbox",className:["absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto","rounded border border-border bg-bg-elevated py-0.5 shadow-md"].join(" "),children:r.map((h,g)=>{const m=h.id===o,E=g===i;return f.jsx("li",{role:"option","aria-selected":m,children:f.jsx("button",{type:"button",onClick:_=>{_.stopPropagation(),w(h.id)},onPointerEnter:()=>l(g),className:["block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",E?"bg-bg-hover":"",m?"text-accent font-medium":"text-fg"].join(" "),children:h.label})},h.id)})})]})}const xi=e=>e.format?e.format(e.value):String(e.value);function uo({spec:e}){const[t,n]=c.useState(!1),[r,o]=c.useState(""),a=c.useRef(null),s=c.useCallback(()=>{o(pi(e.value)),n(!0)},[e.value]);c.useEffect(()=>{t&&a.current&&(a.current.focus(),a.current.select())},[t]);const u=c.useCallback(()=>{n(l=>(l&&e.onChange(di(r,e.value)),!1))},[r,e]),i=c.useCallback(()=>n(!1),[]);return f.jsxs("label",{className:"inline-flex items-center gap-1 text-fg-muted",title:e.title,onPointerDown:l=>l.stopPropagation(),onDoubleClick:l=>{l.stopPropagation(),t||s()},children:[e.icon?f.jsx("span",{"aria-hidden":"true",className:"inline-flex",children:f.jsx(tt,{name:e.icon})}):f.jsx("span",{"aria-hidden":"true",className:"text-[9px] font-mono",children:e.label}),t?f.jsx("input",{ref:a,type:"text",inputMode:"decimal","aria-label":`${e.title} (numeric entry)`,value:r,onChange:l=>o(l.target.value),onPointerDown:l=>l.stopPropagation(),onDoubleClick:l=>l.stopPropagation(),onKeyDown:l=>{l.stopPropagation(),l.key==="Enter"?(l.preventDefault(),u()):l.key==="Escape"&&(l.preventDefault(),i())},onBlur:u,className:"cairn-plot-toolbar-slider-entry h-3.5 w-[6.5rem] rounded border border-border bg-bg px-1 text-[9px] font-mono tabular-nums text-fg outline-none focus:border-accent"}):f.jsxs(f.Fragment,{children:[f.jsx("input",{type:"range","aria-label":e.title,min:e.min,max:e.max,step:e.step,value:e.value,onChange:l=>e.onChange(Number(l.target.value)),onPointerDown:l=>l.stopPropagation(),className:"cairn-plot-toolbar-slider h-1 w-16 cursor-pointer accent-accent"}),f.jsx("span",{"aria-hidden":"true",className:"w-8 text-right text-[9px] font-mono tabular-nums",children:xi(e)})]})]})}function bi({icon:e,title:t,menu:n,onClose:r}){var x;const{options:o,value:a,onSelect:s}=n,[u,i]=c.useState(!1),l=ao(o,a),d=((x=o[l])==null?void 0:x.label)??"";return f.jsxs("div",{children:[f.jsxs("button",{type:"button","aria-haspopup":"menu","aria-expanded":u,"aria-label":t,onClick:p=>{p.stopPropagation(),i(b=>!b)},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",u?"text-accent":"text-fg hover:bg-bg-hover"].join(" "),children:[e?f.jsx(tt,{name:e}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{className:"flex-1",children:t}),f.jsx("span",{className:"font-mono text-[10px] text-fg-muted",children:d}),f.jsx("span",{className:u?"rotate-180 transition-transform":"transition-transform",children:f.jsx(tt,{name:"caret"})})]}),u&&o.map(p=>{const b=p.id===a;return f.jsxs("button",{type:"button",role:"menuitemradio","aria-checked":b,"data-menu-option":"",onClick:w=>{w.stopPropagation(),s(p.id),r()},className:["flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-[11px]",b?"text-accent font-medium bg-bg-hover/40":"text-fg hover:bg-bg-hover"].join(" "),children:[f.jsx("span",{"aria-hidden":"true",className:"w-3 text-center text-accent",children:b?"✓":""}),f.jsx("span",{children:p.label})]},p.id)})]})}function vi({actions:e,leading:t,sliders:n}){const[r,o]=c.useState(!1),a=c.useRef(null);return lo(r,a,()=>o(!1)),f.jsxs("div",{ref:a,className:"relative inline-flex",onPointerDown:s=>s.stopPropagation(),children:[f.jsx("button",{type:"button",onClick:s=>{s.stopPropagation(),o(u=>!u)},onDoubleClick:s=>s.stopPropagation(),"aria-haspopup":"menu","aria-expanded":r,"aria-label":"More controls",title:"More controls",className:["h-[22px] min-w-[22px] inline-flex items-center justify-center rounded text-xs",r?"bg-bg-hover text-accent":"text-fg-muted hover:text-fg hover:bg-bg-hover"].join(" "),children:f.jsx(tt,{name:"ellipsis"})}),r&&f.jsxs("div",{role:"menu",className:["absolute right-0 top-full z-40 mt-1 min-w-[10rem] max-h-80 overflow-auto","rounded border border-border bg-bg-elevated py-1 shadow-md"].join(" "),children:[t.map(s=>s.menu?f.jsx(bi,{icon:s.icon,title:s.title,menu:s.menu,onClose:()=>o(!1)},s.id):f.jsxs("button",{type:"button",disabled:s.disabled,onClick:u=>{var i;u.stopPropagation(),!s.disabled&&((i=s.onClick)==null||i.call(s),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?f.jsx(tt,{name:s.icon}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{children:s.label??s.title})]},s.id)),t.length>0&&e.length>0&&f.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),e.map(s=>f.jsxs("button",{type:"button",role:"menuitem",disabled:s.disabled,onClick:u=>{u.stopPropagation(),!s.disabled&&(s.onClick(),o(!1))},className:["flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",s.disabled?"opacity-40 cursor-default text-fg-muted":"text-fg hover:bg-bg-hover",s.active?"text-accent":""].join(" "),children:[s.icon?f.jsx(tt,{name:s.icon}):f.jsx("span",{className:"w-[13px]"}),f.jsx("span",{children:s.title})]},s.id)),n.length>0&&(e.length>0||t.length>0)&&f.jsx("div",{"aria-hidden":"true",className:"my-1 h-px bg-border"}),n.map(s=>f.jsx("div",{className:"px-2 py-1",children:f.jsx(uo,{spec:s})},s.id))]})]})}function wi({controller:e,config:t}){var T,L;const n=c.useRef(null),[r,o]=c.useState(!1),a=c.useRef(r);a.current=r;const s=c.useRef(0),u=`${((T=t==null?void 0:t.leadingButtons)==null?void 0:T.length)??0}:${((L=t==null?void 0:t.sliders)==null?void 0:L.length)??0}:${(t==null?void 0:t.visibility)??"hover"}`;if(c.useEffect(()=>{const D=n.current,B=D==null?void 0:D.parentElement;if(!B)return;const N=()=>{const V=B.clientWidth;if(!a.current&&n.current){const $=n.current.scrollWidth;$>0&&(s.current=$)}o(ui(V,s.current,a.current))};let F=0;const z=()=>{F||(F=requestAnimationFrame(()=>{F=0,N()}))},G=new ResizeObserver(z);return G.observe(B),N(),()=>{G.disconnect(),F&&cancelAnimationFrame(F)}},[u]),(t==null?void 0:t.enabled)===!1)return null;const i=e.capabilities,l=t==null?void 0:t.buttons,d=(D,B)=>B&&(l==null?void 0:l[D])!==!1,x=D=>()=>e.setDragMode(D),p=()=>{e.toPNG({filename:"plot"}).then(D=>ci(D,"plot.png")).catch(()=>{})},b=[];d("zoom",i.zoom)&&b.push({id:"zoom",icon:"boxZoom",title:"Box zoom",active:e.dragMode==="zoom",onClick:x("zoom")}),d("pan",i.pan)&&b.push({id:"pan",icon:"pan",title:"Pan",active:e.dragMode==="pan",onClick:x("pan")}),d("select",i.select)&&b.push({id:"select",icon:"select",title:"Box select",active:e.dragMode==="select",onClick:x("select")}),d("lasso",i.lasso)&&b.push({id:"lasso",icon:"lasso",title:"Lasso select",active:e.dragMode==="lasso",onClick:x("lasso")});const w=[];d("zoomIn",i.zoom)&&w.push({id:"zoomIn",icon:"zoomIn",title:"Zoom in",onClick:()=>e.zoomIn()}),d("zoomOut",i.zoom)&&w.push({id:"zoomOut",icon:"zoomOut",title:"Zoom out",onClick:()=>e.zoomOut()});const v=[];d("autoscale",i.autoscale)&&v.push({id:"autoscale",icon:"autoscale",title:"Autoscale",onClick:()=>e.autoscale()}),d("reset",i.reset)&&v.push({id:"reset",icon:"home",title:e.isModified?"Reset view":"Reset view (at home)",disabled:!e.isModified,onClick:()=>e.reset()});const M=[];d("screenshot",i.screenshot)&&M.push({id:"screenshot",icon:"camera",title:"Download plot as PNG",onClick:p});const h=[b,w,v,M].filter(D=>D.length>0),g=h.flat(),m=(t==null?void 0:t.leadingButtons)??[],E=(t==null?void 0:t.sliders)??[];if(!m.length&&g.length===0&&E.length===0)return null;const _=(t==null?void 0:t.position)??"top-right",y=(t==null?void 0:t.visibility)==="always",R=_==="top-right"||_==="bottom-right",S=["cairn-plot-toolbar z-30 rounded border border-border bg-bg-elevated/90 shadow-sm backdrop-blur-sm transition-opacity",y?"opacity-100":"opacity-0 group-hover:opacity-100"].join(" "),A={position:"absolute",pointerEvents:"auto",...mi[_]};return r?f.jsx("div",{ref:n,style:A,className:`${S} inline-flex px-0.5 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:f.jsx(vi,{actions:g,leading:m,sliders:E})}):f.jsxs("div",{ref:n,style:A,className:`${S} flex flex-col gap-0.5 px-1 py-0.5`,role:"toolbar","aria-label":"Plot controls",children:[f.jsxs("div",{className:`flex items-center gap-0.5 ${R?"justify-end":"justify-start"}`,children:[m.length>0&&f.jsxs(f.Fragment,{children:[m.map(D=>D.menu?f.jsx(gi,{icon:D.icon,title:D.title,menu:D.menu},D.id):f.jsx(io,{icon:D.icon,label:D.label,title:D.title,active:D.active,disabled:D.disabled,onClick:D.onClick??(()=>{})},D.id)),h.length>0&&f.jsx(co,{})]}),h.map((D,B)=>f.jsxs("span",{className:"inline-flex items-center gap-0.5",children:[B>0&&f.jsx(co,{}),D.map(N=>f.jsx(io,{icon:N.icon,title:N.title,active:N.active,disabled:N.disabled,onClick:N.onClick},N.id))]},D[0].id))]}),E.length>0&&f.jsx("div",{className:`flex items-center gap-2 ${R?"justify-end":"justify-start"}`,children:E.map(D=>f.jsx(uo,{spec:D},D.id))})]})}const yi={zoom:1,pan:{x:0,y:0}},fo=1.3,Ei=.25,_i=64,Mi={buttons:{zoom:!1}};function Si(e,t){return{id:"notation",label:e==="int"?"0–255":"0–1",title:"Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",onClick:()=>t(e==="int"?"decimal":"int")}}const Ai=[{id:"none",label:"None"},...Fs];function kt(e,t){return{id:"colormap",title:"Colormap",menu:{options:Ai,value:e,onSelect:t}}}const po={linear:"Linear",srgb:"sRGB",gamma:"Gamma",reinhard:"Reinhard",aces:"ACES",extended:"Extended · Linear","extended-clamp":"Extended · Linear (managed)","extended-reinhard":"Extended · Reinhard","extended-aces":"Extended · ACES"},Pi=gr.map(e=>({id:e,label:po[e]}));function on(e,t){return{id:"tonemap",title:"Tone-mapping operator",menu:{options:Pi,value:e,onSelect:t}}}const Ti=Us.map(e=>({id:e,label:po[e]}));function Ri(e,t){return{id:"tonemap",title:"Display transfer (sRGB · Gamma · Linear)",menu:{options:Ti,value:e,onSelect:t}}}function Ci({rootRef:e,canvasRef:t,zoom:n,pan:r,onViewportChange:o,naturalWidth:a,naturalHeight:s,minZoom:u=Ei,maxZoom:i=_i,requestRender:l,onReset:d,extraModified:x=!1}){const p=c.useCallback(y=>{var F;if(!o)return;const R=(F=e.current)==null?void 0:F.getBoundingClientRect(),P=(R==null?void 0:R.width)??0,S=(R==null?void 0:R.height)??0,A=a&&s&&P>0&&S>0?Bn(a,s,P,S):i,T=Math.max(u,Math.min(A,n*y));if(T===n)return;const L=P/2,D=S/2,B=L-(L-r.x)/n*T,N=D-(D-r.y)/n*T;o({zoom:T,pan:{x:B,y:N}})},[o,e,a,s,i,u,n,r.x,r.y]),b=c.useCallback(()=>p(fo),[p]),w=c.useCallback(()=>p(1/fo),[p]),v=c.useCallback(()=>{o==null||o(yi),d==null||d()},[o,d]),M=c.useCallback(y=>{const R={scale:y==null?void 0:y.scale,filename:y==null?void 0:y.filename};l==null||l();const P=t==null?void 0:t.current;if(P)return so(P,R);const S=e.current;return S?ii(S,R):Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"))},[t,e,l]),h=c.useMemo(()=>({zoom:!0,pan:!0,autoscale:!0,reset:!0,screenshot:!0,boxZoom:!1,select:!1,lasso:!1,hover:!1,spikelines:!1,hoverModes:!1,legend:!1,axisScaleToggle:!1,perAxisDrag:!1,brush:!1,reorder:!1}),[]),g=n!==1||r.x!==0||r.y!==0||x,m=c.useCallback(y=>{},[]),E=c.useCallback(y=>{},[]),_=c.useCallback(()=>{},[]);return c.useMemo(()=>({capabilities:h,dragMode:"pan",hoverMode:"closest",spikelines:!1,isModified:g,setDragMode:m,setHoverMode:E,toggleSpikelines:_,zoomIn:b,zoomOut:w,autoscale:v,reset:v,toPNG:M}),[h,g,m,E,_,b,w,v,M])}const Di={zoom:1,pan:{x:0,y:0}};function sn({paneAttrs:e,viewportAttrs:t,toolbar:n,paneRef:r,wrapperRef:o,zoom:a,pan:s,onViewportChange:u,naturalDims:i,checkerboard:l,wrapperClassName:d,wrapperStyle:x,viewportPadding:p,header:b,surface:w,showAxes:v,overlayNode:M,overlay:h,notationSeed:g,exportCanvasRef:m,requestRender:E,leadingMenus:_,displayAdjust:y,depthSliders:R,extraSliders:P,regionSelect:S,onReset:A,extraModified:T,label:L,showLabelChip:D,isDraggable:B=!1,onDragStart:N,extraChips:F}){const[z,G]=c.useState(g),[V,$]=c.useState(!1),[Q,he]=c.useState(!1),ae="render"in h?null:h,de=!!S&&!!ae,{containerProps:W}=Or({containerRef:r,zoom:a,pan:s,onViewportChange:u,naturalWidth:i==null?void 0:i.w,naturalHeight:i==null?void 0:i.h}),j=c.useCallback(()=>{y==null||y.onExposureChange(0),y==null||y.onOffsetChange(0),A==null||A()},[y,A]),q=c.useCallback(()=>{u==null||u(Di),j()},[u,j]),re=Ci({rootRef:r,canvasRef:m,zoom:a,pan:s,onViewportChange:u,naturalWidth:i==null?void 0:i.w,naturalHeight:i==null?void 0:i.h,requestRender:E,onReset:j,extraModified:((y==null?void 0:y.exposureEV)??0)!==0||((y==null?void 0:y.offset)??0)!==0||!!T}),ge=c.useMemo(()=>{const me=[];if(R&&me.push(...R),!y)return P&&me.push(...P),me.length?me:void 0;const Le=(ue,Pe)=>`${ue>=0?"+":"−"}${Math.abs(ue).toFixed(Pe)}`;return me.push({id:"exposure",icon:"sun",label:"EV",title:"Exposure (EV stops) — color × 2^EV. Double-click to type a value (may exceed the slider range).",min:-8,max:8,step:.1,value:y.exposureEV,onChange:y.onExposureChange,format:ue=>Le(ue,1)},{id:"offset",icon:"plusminus",label:"OFF",title:"Offset — added after exposure (before tonemap). Double-click to type a value (may exceed the slider range).",min:-1,max:1,step:.01,value:y.offset,onChange:y.onOffsetChange,format:ue=>Le(ue,2)}),P&&me.push(...P),me},[y,R,P]),te=c.useMemo(()=>de?{id:"region-depth",icon:"select",title:"Select depth from region — drag a rectangle to set the Z window to the samples it covers (Esc to cancel)",active:Q,onClick:()=>he(me=>!me)}:null,[de,Q]),ie=c.useMemo(()=>({...Mi,leadingButtons:[..._??[],...te?[te]:[],...V?[Si(z,G)]:[]],sliders:ge}),[V,z,_,te,ge]),xe=" cairn-checkerboard",ye="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded"+(l==="pane"?xe:""),pe=d+(l==="wrapper"?xe:""),Se="render"in h?h.render({notation:z,setOverlayActive:$}):h.hasSource&&i?f.jsx(xt,{imageElRef:h.displayElRef,naturalWidth:i.w,naturalHeight:i.h,zoom:a,pan:s,sourceWindow:h.sourceWindow,sample:h.sample,notation:z,version:h.version,onActiveChange:$}):null;return f.jsxs("div",{className:`relative flex flex-col h-full${n?" group":""}`,...e,children:[b,n&&f.jsx(wi,{controller:re,config:ie}),f.jsxs("div",{ref:r,className:ye,style:{padding:p,...W.style},onPointerDown:W.onPointerDown,onPointerMove:W.onPointerMove,onPointerUp:W.onPointerUp,onPointerCancel:W.onPointerCancel,onDoubleClick:q,...t,children:[f.jsxs("div",{ref:o,className:pe,style:x,children:[w,v&&i&&f.jsx(ni,{naturalWidth:i.w,naturalHeight:i.h,zoom:a,containerRef:o}),M]}),Se,!n&&V&&f.jsx(Ur,{notation:z,onChange:G}),Q&&S&&ae&&i&&f.jsx(ki,{imageElRef:ae.displayElRef,naturalDims:i,sourceWindow:ae.sourceWindow,onQueryLive:S.queryLive,onSelect:(me,Le,ue,Pe)=>{he(!1),S.commit(me,Le,ue,Pe)},onExit:()=>he(!1)}),!Q&&(S==null?void 0:S.rect)&&ae&&i&&f.jsx(Oi,{rect:S.rect,imageElRef:ae.displayElRef,naturalDims:i,sourceWindow:ae.sourceWindow,zoom:a,pan:s,onQueryLive:S.queryLive,onCommit:S.commit,onRemove:S.remove})]}),D&&f.jsx(Un,{label:L,isDraggable:B,onDragStart:N}),F]})}function ki({imageElRef:e,naturalDims:t,sourceWindow:n,onQueryLive:r,onSelect:o,onExit:a}){var M;const s=c.useRef(null),u=c.useRef(null),[i,l]=c.useState(null),d=c.useCallback((h,g,m,E)=>{const _=e.current;return _?Fr(h,g,m,E,{box:_.getBoundingClientRect(),naturalWidth:t.w,naturalHeight:t.h,sourceWindow:n}):null},[e,t,n]);c.useEffect(()=>{const h=g=>{g.key==="Escape"&&a()};return window.addEventListener("keydown",h),()=>window.removeEventListener("keydown",h)},[a]);const x=c.useCallback(h=>{var g,m;(m=(g=h.target).setPointerCapture)==null||m.call(g,h.pointerId),u.current={x:h.clientX,y:h.clientY},l({x0:h.clientX,y0:h.clientY,x1:h.clientX,y1:h.clientY})},[]),p=c.useCallback(h=>{const g=u.current;if(!g)return;l({x0:g.x,y0:g.y,x1:h.clientX,y1:h.clientY});const m=d(g.x,g.y,h.clientX,h.clientY);m&&r(m.x0,m.y0,m.x1,m.y1)},[d,r]),b=c.useCallback(h=>{const g=u.current;u.current=null,l(null);const m=e.current;if(!g||!m){a();return}if(Math.abs(h.clientX-g.x)<3&&Math.abs(h.clientY-g.y)<3){a();return}const E=m.getBoundingClientRect(),_=Fr(g.x,g.y,h.clientX,h.clientY,{box:E,naturalWidth:t.w,naturalHeight:t.h,sourceWindow:n});if(!_){a();return}o(_.x0,_.y0,_.x1,_.y1)},[e,t,n,o,a]),w=(M=s.current)==null?void 0:M.getBoundingClientRect(),v=i&&w?{left:Math.min(i.x0,i.x1)-w.left,top:Math.min(i.y0,i.y1)-w.top,width:Math.abs(i.x1-i.x0),height:Math.abs(i.y1-i.y0)}:null;return f.jsx("div",{ref:s,className:"absolute inset-0 z-20",style:{cursor:"crosshair",touchAction:"none"},onPointerDown:x,onPointerMove:p,onPointerUp:b,children:v&&f.jsx("div",{className:"absolute border-2 border-dashed border-sky-400 bg-sky-400/15 pointer-events-none",style:v})})}const Li={nw:{cursor:"nwse-resize",fx:0,fy:0},n:{cursor:"ns-resize",fx:.5,fy:0},ne:{cursor:"nesw-resize",fx:1,fy:0},e:{cursor:"ew-resize",fx:1,fy:.5},se:{cursor:"nwse-resize",fx:1,fy:1},s:{cursor:"ns-resize",fx:.5,fy:1},sw:{cursor:"nesw-resize",fx:0,fy:1},w:{cursor:"ew-resize",fx:0,fy:.5}};function Oi({rect:e,imageElRef:t,naturalDims:n,sourceWindow:r,zoom:o,pan:a,onQueryLive:s,onCommit:u,onRemove:i}){const l=c.useRef(null),[d,x]=c.useState(null),p=c.useRef(null),[b,w]=c.useState(null),v=d??e;c.useLayoutEffect(()=>{const m=()=>{const y=t.current,R=l.current;if(!y||!R)return;const P=y.getBoundingClientRect(),S=R.getBoundingClientRect(),A=Ma(v,{box:P,naturalWidth:n.w,naturalHeight:n.h,sourceWindow:r});w({left:A.left-S.left,top:A.top-S.top,width:A.width,height:A.height})};m();const E=t.current;if(!E||typeof ResizeObserver>"u")return;const _=new ResizeObserver(m);return _.observe(E),()=>_.disconnect()},[v,n.w,n.h,r,o,a.x,a.y]);const M=c.useCallback(m=>E=>{var _,y;E.stopPropagation(),(y=(_=E.target).setPointerCapture)==null||y.call(_,E.pointerId),p.current={handle:m,sx:E.clientX,sy:E.clientY,start:v},x(v)},[v]),h=c.useCallback(m=>{const E=p.current,_=t.current;if(!E||!_)return;const y=_a({box:_.getBoundingClientRect(),naturalWidth:n.w,naturalHeight:n.h,sourceWindow:r}),R=(m.clientX-E.sx)/(y||1),P=(m.clientY-E.sy)/(y||1),S=ti(E.start,E.handle,R,P,{w:n.w,h:n.h},1);x(S),s(S.x0,S.y0,S.x1,S.y1)},[t,n.w,n.h,r,s]),g=c.useCallback(()=>{const m=p.current;p.current=null;const E=d;x(null),m&&E&&u(E.x0,E.y0,E.x1,E.y1)},[d,u]);return b?f.jsxs("div",{ref:l,className:"absolute inset-0 z-20 pointer-events-none",style:{touchAction:"none"},children:[f.jsx("div",{className:"absolute border-2 border-sky-400 bg-sky-400/10 pointer-events-auto",style:{...b,cursor:"move",touchAction:"none"},onPointerDown:M("move"),onPointerMove:h,onPointerUp:g}),ei.map(m=>{const E=Li[m];return f.jsx("div",{className:"absolute pointer-events-auto flex items-center justify-center",style:{left:b.left+E.fx*b.width-12,top:b.top+E.fy*b.height-12,width:24,height:24,cursor:E.cursor,touchAction:"none"},onPointerDown:M(m),onPointerMove:h,onPointerUp:g,children:f.jsx("div",{className:"w-2.5 h-2.5 rounded-sm bg-sky-400 border border-white/80"})},m)}),f.jsx("button",{type:"button","aria-label":"Remove depth region",title:"Remove region (reset the depth window)",className:"absolute pointer-events-auto flex items-center justify-center rounded-full text-white",style:{left:b.left+b.width-8,top:b.top-32,width:40,height:40},onPointerDown:m=>m.stopPropagation(),onClick:i,children:f.jsx("span",{className:"flex items-center justify-center w-5 h-5 rounded-full bg-slate-800/90 border border-white/70 text-[11px] leading-none",children:"×"})})]}):f.jsx("div",{ref:l,className:"absolute inset-0 z-20 pointer-events-none"})}const Xn={inFlight:!1,pending:null};function mo(e,t){return e.inFlight?{state:{inFlight:!0,pending:t},launch:null}:{state:{inFlight:!0,pending:null},launch:t}}function ho(e){return e.pending!=null?{state:{inFlight:!0,pending:null},launch:e.pending}:{state:Xn,launch:null}}const Bi=1e3,Ni=typeof requestAnimationFrame=="function"?e=>requestAnimationFrame(()=>e()):e=>setTimeout(e,0),go=typeof cancelAnimationFrame=="function"?cancelAnimationFrame:e=>clearTimeout(e);function xo(e,t){const n=e.deep,r=(n==null?void 0:n.zMin)??0,o=(n==null?void 0:n.zMax)??0,a=t!=null,[s,u,i]=ke(r),[l,d,x]=ke(o),[p,b]=c.useState(null),[w,v]=c.useState(null),M=c.useRef(n);M.current=n;const h=c.useRef(r);h.current=r;const g=c.useRef(o);g.current=o;const m=c.useRef(s);m.current=s;const E=c.useRef(l);E.current=l;const _=c.useRef({near:s,far:l,ver:0}),y=c.useRef(0),R=c.useRef(!0),P=c.useRef(Xn),S=c.useRef(null),A=u,T=d,L=c.useCallback(()=>{const W=M.current;if(!W)return;const{near:j,far:q,ver:re}=_.current,ge=()=>{const te=ho(P.current);P.current=te.state,te.launch!=null&&L()};W.flatten(j,q).then(te=>{_.current.ver===re&&!R.current&&(S.current!=null&&go(S.current),S.current=Ni(()=>{S.current=null,b(te)})),ge()}).catch(ge)},[]),D=c.useCallback(()=>{const W=mo(P.current,1);P.current=W.state,W.launch!=null&&L()},[L]);c.useEffect(()=>()=>{S.current!=null&&go(S.current),n==null||n.dispose()},[n]),c.useEffect(()=>{if(!n)return;const W=s<=r&&l>=o;if(R.current=W,y.current+=1,_.current={near:s,far:l,ver:y.current},a){t(s,l);return}if(W){b(null);return}D()},[n,s,l,r,o,D,a,t]);const B=c.useMemo(()=>n&&!a&&p!=null?{...e,data:p}:e,[e,n,a,p]),N=n!=null&&r>0&&o/r>Bi,F=c.useMemo(()=>{if(!n||!(o>r))return;const W=q=>Math.abs(q)>=1e3||Math.abs(q)<.01&&q!==0?q.toExponential(2):q.toFixed(3),j=(q,re,ge,te,ie)=>{if(N){const xe=Math.log10(r),ye=Math.log10(o);return{id:q,icon:"layers",label:re,title:`${ge} (log scale). Double-click to type a Z.`,min:xe,max:ye,step:(ye-xe)/200,value:Math.log10(Math.max(r,Math.min(te,o))),onChange:pe=>ie(10**pe),format:pe=>W(10**pe)}}return{id:q,icon:"layers",label:re,title:`${ge}. Double-click to type a Z.`,min:r,max:o,step:(o-r)/200,value:te,onChange:ie,format:W}};return[j("depth-near","ZN","Depth window NEAR — composite only samples with Z ≥ this",s,A),j("depth-far","ZF","Depth window FAR — composite only samples with Z ≤ this",l,T)]},[n,r,o,s,l,N,A,T]),z=c.useCallback(W=>{if(W.count===0){const re=h.current,ge=g.current,te=ge>re?0:1;u(ge+te),d(re-te);return}const j=g.current-h.current,q=Math.max(Math.abs(j)*1e-4,1e-4);u(W.zMin-q),d(W.zMax+q)},[u,d]),G=c.useRef(null),V=c.useRef(Xn),$=c.useCallback(()=>{const W=M.current,j=G.current,q=()=>{const re=ho(V.current);V.current=re.state,re.launch!=null&&$()};if(!W||!j){q();return}W.zRangeInRect(j.x0,j.y0,j.x1,j.y1).then(re=>{z(re),q()}).catch(q)},[z]),Q=c.useCallback((W,j,q,re)=>{G.current={x0:W,y0:j,x1:q,y1:re};const ge=mo(V.current,1);V.current=ge.state,ge.launch!=null&&$()},[$]),he=c.useCallback((W,j,q,re)=>{v({x0:W,y0:j,x1:q,y1:re}),Q(W,j,q,re)},[Q]),ae=c.useCallback(()=>{v(null),i.reset(),x.reset(),b(null)},[i,x]),de=c.useCallback(()=>{i.reset(),x.reset(),v(null),b(null)},[i,x]);return{hdr:B,sliders:F,hasDeep:n!=null,region:w,queryRegionWindow:Q,commitRegion:he,removeRegion:ae,reset:de,isModified:i.isModified||x.isModified}}function bo(e){return"hdr"in e&&e.hdr!=null}function vo(e){if(e.length===2)return{h:e[0],w:e[1],c:1};if(e.length===3)return{h:e[0],w:e[1],c:e[2]};throw new Error(`cairn-plot image: unsupported HDR shape [${e.join(",")}] (want [H,W] or [H,W,C]).`)}function Re(e){return Number.isFinite(e)?e:0}const Ii={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function Fi(e,t,n,r,o=0){const{h:a,w:s,c:u}=vo(e.shape),i=e.precision==="f16-bits"?Pr(e.data):e.data,l=zs(t),d=new Uint8ClampedArray(s*a*4);for(let x=0;x<s*a;x++){const p=x*u;let b,w,v,M=1;u===1?b=w=v=Re(i[p]):u===3?(b=Re(i[p]),w=Re(i[p+1]),v=Re(i[p+2])):(b=Re(i[p]),w=Re(i[p+1]),v=Re(i[p+2]),M=Re(i[p+3]));const h=[Vt(b,n,o),Vt(w,n,o),Vt(v,n,o)],[g,m,E]=l(h),_=x*4;d[_]=255*yt(g,r),d[_+1]=255*yt(m,r),d[_+2]=255*yt(E,r),d[_+3]=255*(M<0?0:M>1?1:M)}return new ImageData(d,s,a)}function Gi(e,t,n){const r=Tn(t,n??Et),o=new Uint8ClampedArray(e.data.length),a=e.data;for(let s=0;s<a.length;s+=4)o[s]=255*yt(Pn(a[s]/255),r),o[s+1]=255*yt(Pn(a[s+1]/255),r),o[s+2]=255*yt(Pn(a[s+2]/255),r),o[s+3]=a[s+3];return new ImageData(o,e.width,e.height)}function wo(e,t,n,r){const[o,a]=c.useState(null);if(c.useEffect(()=>{const u=e.current;if(!u||typeof ResizeObserver>"u")return;const i=new ResizeObserver(l=>{var x;const d=(x=l[l.length-1])==null?void 0:x.contentRect;d&&a(p=>p&&p.width===d.width&&p.height===d.height?p:{width:d.width,height:d.height})});return i.observe(u),()=>i.disconnect()},[e]),r!=="auto")return r;if(!o||!n)return;const s=Qa({width:o.width*t,height:o.height*t},n.w,n.h);return ja(s,jt)}function Ui(e){var nt,H;const{imageUrl:t,baselineUrl:n=null,isBaseline:r=!1,diffMode:o="none",interpolation:a="auto",colormap:s="none",tonemap:u,gamma:i,showAxes:l=!1,processing:d=Ii,zoom:x=1,pan:p={x:0,y:0},onViewportChange:b,onNaturalSize:w,label:v,isDraggable:M=!1,onDragStart:h,overlay:g,overlaySettings:m,pixelValueNotation:E="decimal",toolbar:_=!0}=e,[y,R,P]=ke(s);c.useEffect(()=>{R(s)},[s,R]);const S=(()=>{const C=zt(u);return C==="gamma"||C==="linear"?C:"srgb"})(),[A,T,L]=ke(S);c.useEffect(()=>{T(S)},[u]);const[D,B,N]=ke(i&&i>0?i:Et);c.useEffect(()=>{i&&i>0&&B(i)},[i,B]);const F=c.useRef(null),z=c.useRef(null),G=c.useRef(null),[V,$]=c.useState(!1),Q=c.useRef(null),he=c.useRef(null),ae=c.useRef(null),de=c.useRef(null),[W,j]=c.useState(0),q=c.useCallback(()=>j(C=>C+1),[]),re=c.useMemo(()=>({get current(){const C=ae.current;return C instanceof HTMLCanvasElement?C:null}}),[]),ge=c.useCallback(C=>{F.current=C,C&&(ae.current=C)},[]),te=c.useCallback(C=>{z.current=C,C&&(ae.current=C)},[]),ie=c.useCallback(C=>{G.current=C,C&&(ae.current=C)},[]),xe=c.useCallback(C=>{C&&(ae.current=C)},[]),[ye,pe]=c.useState(!1),[Se,me]=c.useState(!1),[Le,ue]=c.useState(!1),[Pe,Fe]=c.useState(null),{flipSign:We}=d,{gammaFilterId:ce,filterStr:Ye,gamma:vt,offset:Ke}=to(d),Ae=!r&&o!=="none"&&n!=null&&t!=null,Je=o!=="none"&&n!=null,et=y!=="none"&&!Ae&&!(r&&Je)&&t!=null;c.useEffect(()=>{if(!et||!t){ue(!1);return}let C=!1;ue(!1);const U=`${t}::${y}`,O=Dn(U);if(O){const I=z.current;if(I){I.width=O.width,I.height=O.height;const oe=I.getContext("2d");oe&&oe.putImageData(O,0,0),q(),Fe({w:O.width,h:O.height}),w==null||w(O.width,O.height),ue(!0)}return}const X=new Image;return X.onload=()=>{if(C)return;const I=document.createElement("canvas");I.width=X.naturalWidth,I.height=X.naturalHeight;const oe=I.getContext("2d");if(!oe)return;oe.drawImage(X,0,0);const be=oe.getImageData(0,0,I.width,I.height),Me=Cn(y),J=Rn(be,y,Me);kn(U,J);const Te=z.current;if(!Te||C)return;Te.width=J.width,Te.height=J.height;const _e=Te.getContext("2d");_e&&_e.putImageData(J,0,0),q(),Fe({w:J.width,h:J.height}),w==null||w(J.width,J.height),ue(!0)},X.src=t,()=>{C=!0}},[et,t,y]);const ze=t!=null&&!Ae&&!et&&A!=="srgb";c.useEffect(()=>{if(!ze||!t){$(!1);return}let C=!1;return $(!1),st(t).then(U=>{if(C||!U)return;const O=Gi(U,A,D),X=G.current;if(!X)return;X.width=O.width,X.height=O.height;const I=X.getContext("2d");I&&I.putImageData(O,0,0),q(),Fe({w:O.width,h:O.height}),w==null||w(O.width,O.height),$(!0)}),()=>{C=!0}},[ze,t,A,D]);const Ve=c.useCallback((C,U)=>{Fe(O=>O&&O.w===C&&O.h===U?O:{w:C,h:U}),w==null||w(C,U)},[]);c.useEffect(()=>{if(!t){de.current=null,q();return}let C=!1;return st(t).then(U=>{C||(de.current=U,q())}),()=>{C=!0}},[t,q]);const St=c.useCallback((C,U,O)=>{const X=de.current;if(!X||C<0||U<0||C>=X.width||U>=X.height)return null;const I=(U*X.width+C)*4,oe=X.data[I],be=X.data[I+1],Me=X.data[I+2];return gt(y!=="none"||oe===be&&be===Me?[oe]:[oe,be,Me],"uint8",O)},[y]);c.useEffect(()=>{if(me(!1),!Ae){pe(!1);return}let C=!1;const U=na(),O=U==="gpu"||U==="auto",X=`${n}::${t}::${o}::${y}`;if(U!=="gpu"){const I=Dn(X);if(I){const oe=F.current;if(oe){(oe.width!==I.width||oe.height!==I.height)&&(oe.width=I.width,oe.height=I.height);const be=oe.getContext("2d");be&&be.putImageData(I,0,0),Ve(I.width,I.height),pe(!0)}return}}return(async()=>{const[I,oe]=await Promise.all([st(n),st(t)]);if(C||!I||!oe)return;const Me=o.includes("signed")?"signed":"positive",J=y!=="none"?Mn(y):null,Te={diffMode:o,colormap:J,cmapMode:Me};if(O)try{const Ge=F.current;if(Ge){const dt=ea(I,oe,Te,Ge);if(dt){if(C)return;Ve(dt.width,dt.height),pe(!0);return}}}catch(Ge){console.warn("[cairn] WebGL 2 diff error:",Ge)}if(U==="gpu"){C||me(!0);return}let _e=Ys(I,oe,o);y!=="none"&&(_e=Rn(_e,y,Me)),kn(X,_e);const Ne=F.current;if(!Ne||C)return;(Ne.width!==_e.width||Ne.height!==_e.height)&&(Ne.width=_e.width,Ne.height=_e.height);const ft=Ne.getContext("2d");ft&&ft.putImageData(_e,0,0),Ve(_e.width,_e.height),pe(!0)})(),()=>{C=!0}},[n,t,o,Ae,y,w]);const Be=wo(he,x,Pe,a),wt=We?{filter:"invert(1)"}:{},ut=g&&(m!=null&&m.enabled)&&Pe&&t&&((((nt=g.boxes)==null?void 0:nt.length)??0)>0||(((H=g.masks)==null?void 0:H.length)??0)>0)?f.jsx(In,{data:g,settings:m,naturalWidth:Pe.w,naturalHeight:Pe.h}):void 0,At=t?Ae&&Se?f.jsx(eo,{title:"WebGL 2 unavailable",body:"GPU render mode needs WebGL 2 here — switch render mode to Auto or CPU."}):Ae?f.jsxs(f.Fragment,{children:[!ye&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"computing diff..."}),f.jsx("canvas",{ref:ge,className:"w-full h-full object-contain block",style:{display:ye?"block":"none",imageRendering:Be,...wt}})]}):et?f.jsxs(f.Fragment,{children:[!Le&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying colormap..."}),f.jsx("canvas",{ref:te,className:"w-full h-full object-contain block",style:{display:Le?"block":"none",imageRendering:Be,...wt}})]}):ze?f.jsxs(f.Fragment,{children:[!V&&f.jsx("span",{className:"text-xs text-fg-muted motion-safe:animate-pulse",children:"applying transfer..."}),f.jsx("canvas",{ref:ie,className:"w-full h-full object-contain block",style:{display:V?"block":"none",imageRendering:Be,...wt}})]}):f.jsx("img",{ref:xe,src:t,alt:v,className:"w-full h-full object-contain block",draggable:!1,style:{filter:Ye,imageRendering:Be},onLoad:C=>{const U=C.currentTarget;Fe({w:U.naturalWidth,h:U.naturalHeight}),w==null||w(U.naturalWidth,U.naturalHeight)}}):f.jsx("span",{className:"text-xs text-fg-muted",children:"no image"});return f.jsx(sn,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:_,paneRef:Q,wrapperRef:he,zoom:x,pan:p,onViewportChange:b,naturalDims:Pe,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${p.x}px, ${p.y}px) scale(${x})`,transformOrigin:"0 0"},viewportPadding:l&&Pe?"16px 4px 4px 28px":"4px",header:f.jsx(no,{id:ce,gamma:vt,offset:Ke}),surface:At,showAxes:l,overlayNode:ut,overlay:{displayElRef:ae,sample:St,version:W,hasSource:!!t},notationSeed:E,exportCanvasRef:re,leadingMenus:y==="none"?[kt(y,C=>R(C)),Ri(A,C=>T(C))]:[kt(y,C=>R(C))],extraSliders:y==="none"&&Wt(A)?[{id:"gamma",label:"γ",title:"Display gamma γ for the Gamma transfer — display = clamp(value)^(1/γ), tev-style. Default 2.2 (close to sRGB, not identical). Double-click to type a value.",min:$t,max:Xt,step:Ht,value:D,onChange:B,format:C=>C.toFixed(1)}]:void 0,onReset:()=>{P.reset(),L.reset(),N.reset()},extraModified:P.isModified||L.isModified||N.isModified,label:v,showLabelChip:!!v,isDraggable:M,onDragStart:h})}function zi(e){const{tonemap:t="srgb",exposure:n=0,gamma:r,showAxes:o=!1,label:a="",interpolation:s="auto",zoom:u=1,pan:i={x:0,y:0},onViewportChange:l,pixelValueNotation:d="decimal",toolbar:x=!0}=e,p=xo(e.hdr),b=p.hdr,[w,v,M]=ke(zt(t));c.useEffect(()=>{v(zt(t))},[t,v]);const[h,g,m]=ke(r&&r>0?r:Et);c.useEffect(()=>{r&&r>0&&g(r)},[r,g]);const E=c.useRef(null),_=c.useRef(null),y=c.useRef(null),[R,P]=c.useState(null),[S,A]=c.useState(0),[T,L]=c.useState(0),[D,B]=c.useState(0);c.useEffect(()=>{const z=E.current;if(!z)return;let G;try{G=Fi(b,w,n+T,Tn(w,h),D)}catch($){console.error("[cairn] HDR tone-map error:",$);return}(z.width!==G.width||z.height!==G.height)&&(z.width=G.width,z.height=G.height);const V=z.getContext("2d");V&&(V.putImageData(G,0,0),A($=>$+1),P($=>$&&$.w===G.width&&$.h===G.height?$:{w:G.width,h:G.height}))},[b,w,n,h,T,D]);const N=c.useCallback((z,G,V)=>{const $=R;if(!$||z<0||G<0||z>=$.w||G>=$.h)return null;const Q=b.shape.length===2?1:b.shape[2]??1,he=(G*$.w+z)*Q,ae=b.data,de=b.precision==="f16-bits"?j=>qt(ae[j]??0):j=>ae[j]??0,W=Q===1?[de(he)]:[de(he),de(he+1),de(he+2)];return gt(W,"unit",V)},[b,R]),F=wo(y,u,R,s);return f.jsx(sn,{paneAttrs:{"data-cpu-image-pane":""},viewportAttrs:{"data-cpu-image-viewport":""},toolbar:x,paneRef:_,wrapperRef:y,zoom:u,pan:i,onViewportChange:l,naturalDims:R,checkerboard:"pane",wrapperClassName:"relative w-full h-full",wrapperStyle:{transform:`translate(${i.x}px, ${i.y}px) scale(${u})`,transformOrigin:"0 0"},viewportPadding:o&&R?"16px 4px 4px 28px":"4px",surface:f.jsx("canvas",{ref:E,className:"w-full h-full object-contain block",style:{imageRendering:F}}),showAxes:o,overlay:{displayElRef:E,sample:N,version:S,hasSource:!0},notationSeed:d,exportCanvasRef:E,leadingMenus:[on(w,z=>v(z))],displayAdjust:{exposureEV:T,offset:D,onExposureChange:L,onOffsetChange:B},extraSliders:Wt(w)?[{id:"gamma",label:"γ",title:"Display gamma γ for the Gamma transfer — display = clamp(value)^(1/γ), tev-style. Default 2.2 (close to sRGB, not identical). Double-click to type a value.",min:$t,max:Xt,step:Ht,value:h,onChange:g,format:z=>z.toFixed(1)}]:void 0,depthSliders:p.sliders,regionSelect:p.hasDeep?{rect:p.region,queryLive:p.queryRegionWindow,commit:p.commitRegion,remove:p.removeRegion}:void 0,onReset:()=>{p.reset(),M.reset(),m.reset()},extraModified:p.isModified||M.isModified||m.isModified,label:a,showLabelChip:!!a})}function Hn(e){return bo(e)?f.jsx(zi,{...e}):f.jsx(Ui,{...e})}const yo={"no-webgpu":0,"no-hdr-browser":1,"no-hdr-display":2},Vi="https://github.com/doeringchristian/cairn-plot/blob/main/docs/browser-support.md";function $i(e,t=!1){const n=e||"";return t?"brave":/firefox/i.test(n)?"firefox":/safari/i.test(n)&&!/chrome|chromium|crios|android/i.test(n)?"safari":/linux/i.test(n)&&/chrome|chromium/i.test(n)?"chromium-linux":"chromium"}function Xi(e){const t=e||"";return/mac os x|macintosh/i.test(t)?"macos":/windows/i.test(t)?"windows":"other"}function Hi(e,t){if(e==="no-hdr-display")switch(Xi(t.userAgent)){case"macos":return"macOS: EDR engages automatically on HDR-capable displays — confirm your display supports HDR.";case"windows":return"Windows: turn on Settings → System → Display → Use HDR.";default:return"Enable HDR in your display and OS settings."}const n=$i(t.userAgent,t.isBrave);if(e==="no-hdr-browser")switch(n){case"firefox":return"Firefox has no extended-tone-mapping canvas path at all — true HDR output is impossible until Firefox implements it (fundamental browser limitation).";case"safari":return"Safari's WebGPU HDR canvas tone-mapping is still maturing — update to the latest Safari 26+.";default:return"Chrome/Edge 129+ is required for HDR canvas output (toneMapping: extended) — update your browser."}switch(n){case"firefox":return"Firefox: about:config → dom.webgpu.enabled (HDR output is not available in Firefox at all — browser limitation).";case"safari":return"Safari: Develop → Feature Flags → WebGPU (Safari 26+ has it by default).";case"brave":return"Brave: check Shields fingerprint blocking + brave://flags.";case"chromium-linux":return"Chromium on Linux: enable chrome://flags/#enable-unsafe-webgpu.";case"chromium":default:return"Chrome/Edge: enable chrome://flags/#enable-unsafe-webgpu and hardware acceleration."}}function Wi(e){switch(e){case"no-webgpu":return"GPU renderer unavailable → CPU fallback active; FLIP kernels + HDR compare disabled.";case"no-hdr-browser":return"True HDR output is unsupported by this browser — a fundamental browser limitation, not a cairn-plot bug → HDR images tone-mapped to SDR.";case"no-hdr-display":return"Your display/OS is not in HDR mode → HDR images tone-mapped to SDR."}}function Eo(e,t){return`cairn-plot:capnotice:${e}:${t}`}const _o=new Set;function Mo(e){try{if(window.localStorage.getItem(e)==="1")return!0}catch{}try{if(window.sessionStorage.getItem(e)==="1")return!0}catch{}return _o.has(e)}function Yi(e){try{window.localStorage.setItem(e,"1");return}catch{}try{window.sessionStorage.setItem(e,"1");return}catch{}_o.add(e)}const So=new Set;let an=null,Mt=null;function Ao(){Mt&&Mt.parentNode&&Mt.parentNode.removeChild(Mt),Mt=null,an=null}function Ki(e){const t=Eo(e,window.location.pathname),n=Hi(e,{userAgent:navigator.userAgent,isBrave:!!navigator.brave}),r=document.createElement("div");r.setAttribute("role","status"),r.setAttribute("data-cairn-plot-capnotice",e),Object.assign(r.style,{position:"fixed",bottom:"12px",right:"12px",zIndex:"2147483000",maxWidth:"340px",boxSizing:"border-box",padding:"10px 30px 10px 12px",borderRadius:"6px",border:"1px solid var(--color-border, #d0d7de)",background:"rgb(var(--color-bg-elevated-rgb, 246 248 250) / 0.9)",color:"var(--color-fg-muted, #656d76)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",boxShadow:"0 4px 12px rgba(0, 0, 0, 0.18)",font:"12px/1.4 system-ui, sans-serif"});const o=document.createElement("div");o.textContent=Wi(e),Object.assign(o.style,{fontWeight:"600",color:"var(--color-fg, #1f2328)",marginBottom:"4px"});const a=document.createElement("div");a.textContent=n,a.style.marginBottom="4px";const s=document.createElement("a");s.href=Vi,s.target="_blank",s.rel="noopener noreferrer",s.textContent="Learn more",Object.assign(s.style,{color:"var(--color-accent, #0969da)",textDecoration:"none"});const u=document.createElement("button");u.type="button",u.textContent="×",u.setAttribute("aria-label","Dismiss browser capability notice"),u.title="Dismiss",Object.assign(u.style,{position:"absolute",top:"4px",right:"6px",padding:"0 4px",border:"0",background:"transparent",color:"var(--color-fg-subtle, #8b949e)",cursor:"pointer",fontSize:"16px",lineHeight:"1"}),u.addEventListener("click",()=>{Yi(t),Ao()}),r.appendChild(o),r.appendChild(a),r.appendChild(s),r.appendChild(u),document.body.appendChild(r),Mt=r,an=e}function Po(e){if(typeof document>"u"||typeof window>"u"||So.has(e))return;So.add(e);const t=Eo(e,window.location.pathname);if(Mo(t))return;const n=()=>{if(!Mo(t)){if(an!==null)if(yo[e]<yo[an])Ao();else return;Ki(e)}};document.body?n():window.addEventListener("DOMContentLoaded",n,{once:!0})}const qi={data:new Float32Array(0),shape:[0,0],dtype:"<f4"};function Zi(e){const{h:t,w:n,c:r}=vo(e.shape);if(e.precision==="f16-bits"){const s=e.data,u=new Uint16Array(n*t*4);for(let i=0;i<n*t;i++){const l=i*r,d=i*4;if(r===1){const x=s[l];u[d]=x,u[d+1]=x,u[d+2]=x,u[d+3]=Kt}else u[d]=s[l],u[d+1]=s[l+1],u[d+2]=s[l+2],u[d+3]=r>=4?s[l+3]:Kt}return{data:u,width:n,height:t,format:"rgba16float"}}const o=e.data,a=new Float32Array(n*t*4);for(let s=0;s<n*t;s++){const u=s*r;let i,l,d,x=1;r===1?i=l=d=Re(o[u]):r===3?(i=Re(o[u]),l=Re(o[u+1]),d=Re(o[u+2])):(i=Re(o[u]),l=Re(o[u+1]),d=Re(o[u+2]),x=Re(o[u+3]));const p=s*4;a[p]=i,a[p+1]=l,a[p+2]=d,a[p+3]=x}return{data:a,width:n,height:t,format:"rgba32float"}}function To(e,t,n,r){if(n<=0||r<=0||t.width<=0||t.height<=0)return{x:0,y:0,w:1,h:1};const o=Math.min(t.width/n,t.height/r),a=n*o,s=r*o,u=(t.width-a)/2,i=(t.height-s)/2,l=Math.max(e.zoom,1e-6),d=t.width/(l*a),x=t.height/(l*s),p=-u/a-e.pan.x/(l*a),b=-i/s-e.pan.y/(l*s);return{x:p,y:b,w:d,h:x}}function Ro(e,t,n,r){const o=e.w*n,a=e.h*r;return o<=0||a<=0||t.width<=0||t.height<=0?0:Math.min(t.width/o,t.height/a)}function Qi(e){var ut,At,nt;const t=bo(e),n=c.useRef(null),r=c.useRef(null),o=c.useRef(null),a=c.useRef(null),s=c.useRef(null),u=t&&!!((ut=e.hdr)!=null&&ut.deep),i=c.useCallback((H,C)=>{var U,O;(U=a.current)==null||U.setDeepWindow(H,C),(O=s.current)==null||O.call(s)},[]),l=xo(t?e.hdr:qi,u?i:void 0),d=c.useRef(!1),[x,p]=c.useState(!1),[b,w]=c.useState(!1),[v,M]=c.useState(!1),[h,g]=c.useState(null),[m,E]=c.useState(0),[_,y]=c.useState(0),[R,P]=c.useState({x:0,y:0,w:1,h:1}),S=c.useRef(null),A=c.useRef(null),[T,L]=c.useState(0),D=e.zoom??1,B=e.pan??{x:0,y:0},N=e.onViewportChange,F=t?"none":e.colormap??"none",[z,G,V]=ke(F);c.useEffect(()=>{G(F)},[F,G]);const $=t?"none":z,Q=e.tonemap,[he,ae]=c.useState(null);c.useEffect(()=>{ae(null)},[Q]);const de=wr(Q),W=he??de,j=he!==null&&he!==de,q=c.useCallback(()=>ae(null),[]),re=e.peak,[ge,te,ie]=ke(re!=null&&re>0?re:vr(Q)??Ut),xe=e.gamma,[ye,pe,Se]=ke(xe&&xe>0?xe:Et);c.useEffect(()=>{xe&&xe>0&&pe(xe)},[xe,pe]);const[me,Le]=c.useState(0),[ue,Pe]=c.useState(0),Fe=Nn();c.useEffect(()=>{const H=n.current;if(!H)return;let C=!1;return Ft().then(U=>{var be;if(C)return;const O=((be=U.probeExtendedToneMapping)==null?void 0:be.call(U))??!1,X=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,oe=O&&X&&(t||F==="none");d.current=oe,p(oe),t&&!oe&&Po(O?"no-hdr-display":"no-hdr-browser"),Za(H,{hdr:oe}).then(Me=>{if(C){Jr(Me);return}a.current=Me,M(!0)}).catch(Me=>{C||(console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane",Me),w(!0))})}).catch(U=>{C||(console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane",U),w(!0))}),()=>{C=!0,a.current&&(Jr(a.current),a.current=null)}},[]),c.useEffect(()=>{const H=r.current;if(!H)return;const C=new ResizeObserver(()=>y(U=>U+1));return C.observe(H),()=>C.disconnect()},[]),c.useEffect(()=>{const H=r.current;if(!H)return;const C=new IntersectionObserver(U=>{const O=U[0];if(!O)return;const X=a.current;X&&(X.setVisible(O.isIntersecting),O.isIntersecting?X.isParked&&(X.restore(),y(I=>I+1)):X.park())},{threshold:0});return C.observe(H),()=>C.disconnect()},[]),c.useEffect(()=>{var U;if(!t||!v||u)return;const H=l.hdr;S.current=H;const C=Zi(H);(U=a.current)==null||U.setSource(C),g(O=>O&&O.w===C.width&&O.h===C.height?O:{w:C.width,h:C.height}),L(O=>O+1),E(O=>O+1)},[t,v,u,t?l.hdr:null]),c.useEffect(()=>{if(!t||!v||!u)return;const H=e.hdr,C=H.deep;S.current=H;let U=!1;return C.getGpuCsr().then(O=>{var X;U||((X=a.current)==null||X.setDeepSource(O,C.zMin,C.zMax),g(I=>I&&I.w===O.width&&I.h===O.height?I:{w:O.width,h:O.height}),L(I=>I+1),E(I=>I+1))}).catch(O=>{U||console.warn("[cairn] deep GPU CSR upload failed:",O)}),()=>{U=!0}},[t,v,u,t?e.hdr.deep:null]),c.useEffect(()=>{if(t||!v)return;const H=e,C=H.imageUrl,U=z;if(!C){A.current=null,g(null),L(X=>X+1);return}let O=!1;return st(C).then(X=>{var be,Me;if(O||!X)return;let I=X;if(U!=="none"){const J=`gpu::${C}::${U}::ev${me}::off${ue}`,Te=Dn(J);if(Te)I=Te;else{const _e=Cn(U);I=Rn(X,U,_e,me,ue),kn(J,I)}}A.current=X;const oe={data:I.data,width:I.width,height:I.height,format:"rgba8unorm"};(be=a.current)==null||be.setSource(oe),g(J=>J&&J.w===I.width&&J.h===I.height?J:{w:I.width,h:I.height}),(Me=H.onNaturalSize)==null||Me.call(H,I.width,I.height),L(J=>J+1),E(J=>J+1)}),()=>{O=!0}},[t,v,t?null:e.imageUrl,t?null:z,t?0:me,t?0:ue]);const We=t?e.exposure??0:0,ce=!t&&$==="none",Ye=c.useCallback(()=>{const H=a.current;if(!H||!v||!h)return;const C=r.current,U=o.current,O=U?U.getBoundingClientRect():C?C.getBoundingClientRect():{width:h.w,height:h.h},X=To({zoom:D,pan:B},O,h.w,h.h);P(J=>J.x===X.x&&J.y===X.y&&J.w===X.w&&J.h===X.h?J:X),O.width>0&&O.height>0&&H.resize(Math.round(O.width*Fe),Math.round(O.height*Fe));const I=Ro(X,O,h.w,h.h)>=jt?"nearest":"linear",oe=X,be=yr(W,d.current?ge:1,d.current,ye),Me=t||ce?{exposureEV:(t?We:0)+me,offset:ue,operator:be.operator,gamma:be.gamma,isScalar:!1,hdrOut:be.hdrOut,peak:be.peak,srgbDecode:!t,uv:oe,filter:I}:{exposureEV:0,offset:0,operator:"linear",gamma:1,isScalar:!1,hdrOut:!1,srgbDecode:!1,uv:oe,filter:I};try{H.render(Me)||w(!0)}catch(J){console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane",J),w(!0)}},[v,h,D,B.x,B.y,We,me,ue,W,ge,ye,ce,t,$,Fe]);s.current=Ye,c.useEffect(()=>{Ye()},[Ye,m,_]);const vt=c.useCallback((H,C,U)=>{if(t){const J=S.current,Te=h;if(!J||!Te||H<0||C<0||H>=Te.w||C>=Te.h)return null;const _e=J.shape.length===2?1:J.shape[2]??1,Ne=(C*Te.w+H)*_e,ft=J.data,Ge=J.precision==="f16-bits"?rt=>qt(ft[rt]??0):rt=>ft[rt]??0,dt=_e===1?[Ge(Ne)]:[Ge(Ne),Ge(Ne+1),Ge(Ne+2)];return gt(dt,"unit",U)}const O=A.current;if(!O||H<0||C<0||H>=O.width||C>=O.height)return null;const X=(C*O.width+H)*4,I=O.data[X],oe=O.data[X+1],be=O.data[X+2];return gt($!=="none"||I===oe&&oe===be?[I]:[I,oe,be],"uint8",U)},[t,h,$]),Ke=e.showAxes??!1,Ae=t?e.label??"":e.label,Je=e.interpolation??"auto",et=Je==="auto"?void 0:Je,ze=t?void 0:e.overlay,Ve=t?void 0:e.overlaySettings,St=t?!1:e.isDraggable??!1,Be=t?void 0:e.onDragStart;if(b)return t?f.jsx(Hn,{...e}):f.jsx(Hn,{...e});const wt=ze&&(Ve!=null&&Ve.enabled)&&h&&((((At=ze.boxes)==null?void 0:At.length)??0)>0||(((nt=ze.masks)==null?void 0:nt.length)??0)>0)?f.jsx(In,{data:ze,settings:Ve,naturalWidth:h.w,naturalHeight:h.h}):void 0;return f.jsx(sn,{paneAttrs:{"data-gpu-image-pane":"","data-gpu-backend-ready":v},viewportAttrs:{"data-gpu-image-viewport":""},toolbar:!0,paneRef:r,wrapperRef:o,zoom:D,pan:B,onViewportChange:N,naturalDims:h,checkerboard:"wrapper",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:Ke&&h?"16px 4px 4px 28px":0,surface:f.jsx("canvas",{ref:n,className:"w-full h-full block",style:{imageRendering:et},"data-gpu-image-canvas":!0}),showAxes:Ke,overlayNode:wt,overlay:{displayElRef:n,sample:vt,version:T,hasSource:!0,sourceWindow:R},notationSeed:e.pixelValueNotation??"decimal",exportCanvasRef:n,requestRender:Ye,leadingMenus:t?[on(W,H=>ae(H))]:ce?[kt($,H=>G(H)),on(W,H=>ae(H))]:[kt($,H=>G(H))],displayAdjust:{exposureEV:me,offset:ue,onExposureChange:Le,onOffsetChange:Pe},extraSliders:[...(t||ce)&&x?[{id:"peak",label:"PK",title:"Peak white (×SDR white) — the HDR ceiling P every operator clips at (Linear/sRGB/Gamma hard-clip at P; Reinhard/ACES roll off toward P). P=1 reproduces the SDR rendition exactly; double-click to type a value, including 'inf' for the raw browser-clipped extended look.",min:dr,max:Tt,step:pr,value:ge,onChange:te,format:H=>Number.isFinite(H)?`${H.toFixed(1)}×`:"∞"}]:[],...(t||ce)&&Wt(W)?[{id:"gamma",label:"γ",title:"Display gamma γ for the Gamma transfer — display = clamp(value)^(1/γ), tev-style. Default 2.2 (close to sRGB, not identical). Double-click to type a value.",min:$t,max:Xt,step:Ht,value:ye,onChange:pe,format:H=>H.toFixed(1)}]:[]],depthSliders:l.sliders,regionSelect:u?{rect:l.region,queryLive:l.queryRegionWindow,commit:l.commitRegion,remove:l.removeRegion}:void 0,onReset:()=>{V.reset(),q(),ie.reset(),Se.reset(),l.reset()},extraModified:V.isModified||j||ie.isModified||Se.isModified||l.isModified,label:Ae,showLabelChip:!!Ae,isDraggable:St,onDragStart:Be})}const cn=new Map;function Qe(e){if(cn.has(e.id))throw new Error(`registerDiffKernel: duplicate kernel id "${e.id}"`);cn.set(e.id,e)}function ct(e){return cn.get(e)}function ji(){return Array.from(cn.values())}function Co(e,t){return{...e.params??{},...t??{}}}const Ji={kind:"pointwise",id:"signed",label:"Signed Error",publicName:"signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`},ec={kind:"pointwise",id:"absolute",label:"Absolute Error",publicName:"abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`},tc={kind:"pointwise",id:"squared",label:"Squared Error",publicName:"square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`},nc={kind:"pointwise",id:"relative_signed",label:"Relative Signed",publicName:"rel_signed",displayRange:"signed",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`},rc={kind:"pointwise",id:"relative_absolute",label:"Relative Absolute",publicName:"rel_abs",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`},oc={kind:"pointwise",id:"relative_squared",label:"Relative Squared",publicName:"rel_square",displayRange:"unit",output:"per-channel",source:`
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`},Do=[[10135552/24577794,8788810/24577794,4435075/24577794],[2613072/12288897,8788810/12288897,887015/12288897],[1425312/73733382,8788810/73733382,70074185/73733382]];ac(Do);const Wn=[1.052156925,1,.91835767],sc=.7;function ac(e){const[t,n,r]=e[0],[o,a,s]=e[1],[u,i,l]=e[2],d=a*l-s*i,x=-(o*l-s*u),p=o*i-a*u,w=1/(t*d+n*x+r*p);return[[d*w,-(n*l-r*i)*w,(n*s-r*a)*w],[x*w,(t*l-r*u)*w,-(t*s-r*o)*w],[p*w,-(t*i-n*u)*w,(t*a-n*o)*w]]}function ic(e,t,n,r){return[e[0][0]*t+e[0][1]*n+e[0][2]*r,e[1][0]*t+e[1][1]*n+e[1][2]*r,e[2][0]*t+e[2][1]*n+e[2][2]*r]}const Yn=6/29;function Kn(e){return e>Yn**3?Math.cbrt(e):e/(3*Yn*Yn)+4/29}function ko(e,t,n){const[r,o,a]=ic(Do,e,t,n),s=Kn(r*Wn[0]),u=Kn(o*Wn[1]),i=Kn(a*Wn[2]),l=116*u-16,d=500*(s-u),x=200*(u-i);return[l,.01*l*d,.01*l*x]}function cc(e,t){const n=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2];return Math.abs(n)+Math.sqrt(r*r+o*o)}function lc(){const e=ko(0,1,0),t=ko(0,0,1);return Math.pow(cc(e,t),sc)}const Lo=lc(),uc=.082;function Oo(e){const t=[1,1,34.1],n=[.0047,.0053,.04],r=[0,0,13.5],o=[1e-5,1e-5,.025],a=Math.max(...n,...o),s=Math.ceil(3*Math.sqrt(a/(2*Math.PI**2))*e),u=1/e,i=Math.PI**2,l=[0,0,0];for(let d=-s;d<=s;d++)for(let x=-s;x<=s;x++){const p=(x*u)**2+(d*u)**2;for(let b=0;b<3;b++)l[b]+=t[b]*Math.sqrt(Math.PI/n[b])*Math.exp(-i*p/n[b])+r[b]*Math.sqrt(Math.PI/o[b])*Math.exp(-i*p/o[b])}return{r:s,deltaX:u,sums:l}}function Bo(e){const t=.5*uc*e,n=Math.ceil(3*t);let r=0,o=0,a=0;for(let s=-n;s<=n;s++)for(let u=-n;u<=n;u++){const i=Math.exp(-(u*u+s*s)/(2*t*t)),l=-u*i,d=(u*u/(t*t)-1)*i;l>0&&(r+=l),d>0?o+=d:a-=d}return{r:n,sd:t,edgeNorm:r,pointPos:o,pointNeg:a}}const fc=`
${Ue}
${en}
${bt}
${Ct}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_map0: vec4<f32>; // offX, offY, fitFill, 0
@group(0) @binding(8) var<uniform> u_map1: vec4<f32>; // resultW, resultH, 0, 0
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = mapSample(src, px, u_map0.x, u_map0.y, u_map1.x, u_map1.y, u_map0.z);
  return vec4<f32>(flip_rgb2ycxcz(s.rgb), 1.0);
}
`,dc=`
${Ue}
${en}
${bt}
${Ct}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_map0: vec4<f32>; // offX, offY, fitFill, 0
@group(0) @binding(8) var<uniform> u_map1: vec4<f32>; // resultW, resultH, 0, 0
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = mapSample(src, px, u_map0.x, u_map0.y, u_map1.x, u_map1.y, u_map0.z);
  return vec4<f32>(flip_linrgb2ycxcz(clamp(s.rgb, vec3<f32>(0.0), vec3<f32>(1.0))), 1.0);
}
`,ln=`
${Ue}
${en}
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
`,No=`
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
`;function je(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function un(e,t,n){const r=n.sourceMap,o=r?t==="a"?r.offsetA:r.offsetB:{x:0,y:0},a=r!=null&&r.fill?1:0;return[je(e,[o.x,o.y,a,0]),je(e+1,[n.width,n.height,0,0])]}function fn(e){return[je(1,[e.deltaX,e.r,e.sums[0],e.sums[1]]),je(2,[e.sums[2],0,0,0])]}function Io(e){return[je(4,[Lo,e.sd,e.r,e.edgeNorm]),je(5,[e.pointPos,e.pointNeg,0,0])]}function Fo(e,t,n,r,o,a=""){const s=Oo(e),u=Bo(e),i=`ycxczA${a}`,l=`ycxczB${a}`,d=`labA${a}`,x=`labB${a}`,p=`flip${a}`;return{passes:[{name:i,shader:t,inputs:[n],output:i,uniforms:()=>un(1,"a",o)},{name:l,shader:t,inputs:[r],output:l,uniforms:()=>un(1,"b",o)},{name:d,shader:ln,inputs:[i],output:d,uniforms:()=>fn(s)},{name:x,shader:ln,inputs:[l],output:x,uniforms:()=>fn(s)},{name:p,shader:No,inputs:[d,x,i,l],output:p,uniforms:()=>Io(u)}],flipRef:p}}const pc={kind:"multipass",id:"flip",label:"FLIP (perceptual)",publicName:"flip",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=Fo(t,fc,"srcA","srcB",e);return{passes:n,final:r}}},mc={kind:"multipass",id:"flip-ldr-forced",label:"FLIP (LDR forced)",publicName:"flip_ldr",displayRange:"unit",output:"scalar",params:{ppd:67},buildPasses(e){const t=e.params.ppd??67,{passes:n,flipRef:r}=Fo(t,dc,"srcA","srcB",e);return{passes:n,final:r}}},Go=`
${Ue}
${en}
${bt}
${Ct}
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
`,hc=`
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
`,gc={kind:"multipass",id:"hdr-flip",label:"FLIP (perceptual)",publicName:"flip_hdr",displayRange:"unit",output:"scalar",params:{ppd:67,startExposure:0,stopExposure:4,numExposures:2},buildPasses(e){const t=e.params.ppd??67,n=e.params.startExposure??0,r=e.params.stopExposure??4,o=Math.max(2,Math.round(e.params.numExposures??2)),a=(r-n)/Math.max(o-1,1),s=Oo(t),u=Bo(t),i=[];let l=null;for(let d=0;d<o;d++){const x=n+d*a,p=`_e${d}`,b=`ycxczA${p}`,w=`ycxczB${p}`,v=`labA${p}`,M=`labB${p}`,h=`acc${p}`;i.push({name:b,shader:Go,inputs:["srcA"],output:b,uniforms:()=>[je(1,[x,0,0,0]),...un(2,"a",e)]},{name:w,shader:Go,inputs:["srcB"],output:w,uniforms:()=>[je(1,[x,0,0,0]),...un(2,"b",e)]},{name:v,shader:ln,inputs:[b],output:v,uniforms:()=>fn(s)},{name:M,shader:ln,inputs:[w],output:M,uniforms:()=>fn(s)}),l===null?i.push({name:h,shader:No,inputs:[v,M,b,w],output:h,uniforms:()=>Io(u)}):i.push({name:h,shader:hc,inputs:[v,M,b,w,l],output:h,uniforms:()=>[je(5,[Lo,u.sd,u.r,u.edgeNorm]),je(6,[u.pointPos,u.pointNeg,0,0])]}),l=h}return{passes:i,final:l}}},Uo=.01,zo=.03,dn=1,qn=1.5,lt=5,Zn=[.2126,.7152,.0722];function Qn(e){return e<=.04045?e/12.92:Math.pow((e+.055)/1.055,2.4)}function Vo(e,t,n){const r=Zn[0]*Qn(e)+Zn[1]*Qn(t)+Zn[2]*Qn(n);return Math.min(1,Math.max(0,r))}function xc(e,t){const n=2*t+1,r=new Float64Array(n);let o=0;for(let a=-t,s=0;a<=t;a++,s++){const u=Math.exp(-.5*a*a/(e*e));r[s]=u,o+=u}for(let a=0;a<n;a++)r[a]=r[a]/o;return r}function $o(e,t){if(t===1)return 0;const n=2*t;let r=(e%n+n)%n;return r>=t&&(r=n-1-r),r}const Xo=()=>new Promise(e=>{typeof setTimeout=="function"?setTimeout(e,0):Promise.resolve().then(e)}),jn=64;async function Lt(e,t,n,r,o,a){const s=new Float64Array(t*n);for(let i=0;i<n;i++){for(let l=0;l<t;l++){let d=0;for(let x=-o,p=0;x<=o;x++,p++)d+=r[p]*e[i*t+$o(l+x,t)];s[i*t+l]=d}(i+1)%jn===0&&await a()}const u=new Float64Array(t*n);for(let i=0;i<n;i++){for(let l=0;l<t;l++){let d=0;for(let x=-o,p=0;x<=o;x++,p++)d+=r[p]*s[$o(i+x,n)*t+l];u[i*t+l]=d}(i+1)%jn===0&&await a()}return u}async function bc(e,t,n,r,o=Xo){const a=n*r;if(a<=0)return NaN;const s=xc(qn,lt),u=new Float64Array(a),i=new Float64Array(a),l=new Float64Array(a);for(let g=0;g<a;g++)u[g]=e[g]*e[g],i[g]=t[g]*t[g],l[g]=e[g]*t[g];const d=await Lt(e,n,r,s,lt,o),x=await Lt(t,n,r,s,lt,o),p=await Lt(u,n,r,s,lt,o),b=await Lt(i,n,r,s,lt,o),w=await Lt(l,n,r,s,lt,o),v=(Uo*dn)**2,M=(zo*dn)**2;let h=0;for(let g=0;g<a;g++){const m=p[g]-d[g]*d[g],E=b[g]-x[g]*x[g],_=w[g]-d[g]*x[g],y=2*d[g]*x[g]+v,R=2*_+M,P=d[g]*d[g]+x[g]*x[g]+v,S=m+E+M;h+=y*R/(P*S)}return h/a}const Ho=`
${Ue}

fn ssim_srgb2linear(c: f32) -> f32 {
  if (c <= 0.04045) { return c / 12.92; }
  return pow((c + 0.055) / 1.055, 2.4);
}
fn ssim_luma(srgb: vec3<f32>) -> f32 {
  let lin = vec3<f32>(ssim_srgb2linear(srgb.r), ssim_srgb2linear(srgb.g), ssim_srgb2linear(srgb.b));
  return clamp(dot(lin, vec3<f32>(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
}

${bt}
${Ct}
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
`,vc=`
${Ho}
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let y = ssim_moment_luma(in);
  return vec4<f32>(y.x, y.y, y.x * y.x, y.y * y.y);
}
`,wc=`
${Ho}
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let y = ssim_moment_luma(in);
  return vec4<f32>(y.x * y.y, 0.0, 0.0, 0.0);
}
`,Wo=`
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
`,yc=`
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
`;function Ot(e,t){return{binding:e,resource:{uniform:new Float32Array(t)}}}function Yo(e){const t=e.sourceMap,n=t?t.offsetA:{x:0,y:0},r=t?t.offsetB:{x:0,y:0},o=t!=null&&t.fill?1:0;return[Ot(2,[n.x,n.y,r.x,r.y]),Ot(3,[e.width,e.height,o,0])]}function Ko(e,t){const n=`${t}H`,r=`${t}V`;return{passes:[{name:n,shader:Wo,inputs:[e],output:n,uniforms:()=>[Ot(1,[1,0,lt,qn])]},{name:r,shader:Wo,inputs:[n],output:r,uniforms:()=>[Ot(1,[0,1,lt,qn])]}],out:r}}const Ec={kind:"multipass",id:"ssim",label:"SSIM (1−SSIM)",publicName:"ssim",displayRange:"unit",output:"scalar",buildPasses(e){const t=(Uo*dn)**2,n=(zo*dn)**2,r=Ko("momA","statsA"),o=Ko("momB","statsB");return{passes:[{name:"momA",shader:vc,inputs:["srcA","srcB"],output:"momA",uniforms:Yo},{name:"momB",shader:wc,inputs:["srcA","srcB"],output:"momB",uniforms:Yo},...r.passes,...o.passes,{name:"ssim",shader:yc,inputs:[r.out,o.out],output:"ssim",uniforms:()=>[Ot(2,[t,n,0,0])]}],final:"ssim"}}};let qo=!1;function _c(){qo||(qo=!0,Qe(ec),Qe(Ji),Qe(tc),Qe(rc),Qe(nc),Qe(oc),Qe(pc),Qe(gc),Qe(mc),Qe(Ec))}_c();function Zo(){const e=[];for(const n of ji())n.kind==="pointwise"&&e.push({id:n.id,label:n.label});e.push({id:"flip",label:"FLIP (perceptual)"}),e.push({id:"flip_ldr",label:"FLIP (LDR forced)"});const t=ct("ssim");return t&&e.push({id:t.id,label:t.label}),e}function Mc(e,t){return e==="flip"?t?"hdr-flip":"flip":e==="flip_ldr"||e==="flip-ldr-forced"?t?"flip-ldr-forced":"flip":e}function Sc(e,t,n){const r=t*n;if(r<=0)return NaN;let o=0;for(let a=0;a<r;a++)o+=e[a*4]??0;return 1-o/r}function Qo(e){return e==null||Number.isNaN(e)?"—":e.toFixed(4)}const jo=new WeakMap;function Ac(e,t,n){let r=jo.get(e);r||(r=new Map,jo.set(e,r));const o=r.get(t);if(o)return o;const a=n().catch(s=>{throw r.get(t)===a&&r.delete(t),s});return r.set(t,a),a}const Jo=new WeakMap;function Jn(e,t,n,r){let o=Jo.get(e);o||(o=new Map,Jo.set(e,o));const a=`${t}::${r}`;let s=o.get(a);return s||(s=e.createRenderPipeline({shaderWGSL:n,targetFormat:r}),o.set(a,s)),s}function Pc(e){return`
${Ue}
${bt}
${Ct}
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
`}const pn="rgba16float";function Tc(e,t,n,r,o,a){var M,h;const s=ct(r);if(!s)throw new Error(`computeDiff: unknown diff kernel "${r}"`);const u=a??Dt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),i=u.result.w,l=u.result.h,d=u.fit==="fill"?1:0,x=Co(s,o);if(s.kind==="pointwise"){const g=e.createTexture(i,l,pn),m=Jn(e,`pw:${s.id}`,Pc(s.source),pn),E=new Float32Array([u.offsetA.x,u.offsetA.y,u.offsetB.x,u.offsetB.y]),_=new Float32Array([i,l,d,0]);let y;try{y=e.createBindGroup(m,[{binding:0,resource:t},{binding:1,resource:n},{binding:2,resource:{uniform:E}},{binding:3,resource:{uniform:_}}]),e.renderFullscreen(g,m,y)}finally{(M=y==null?void 0:y.destroy)==null||M.call(y)}return g}const p={width:i,height:l,params:x,sourceMap:{fill:u.fit==="fill",offsetA:u.offsetA,offsetB:u.offsetB}},b=s.buildPasses(p),w=new Map([["srcA",t],["srcB",n]]),v=[];try{for(const m of b.passes){const E=e.createTexture(i,l,pn);v.push(E),w.set(m.output,E);const _=Jn(e,`mp:${s.id}:${m.name}`,m.shader,pn),y=m.inputs.map((P,S)=>{const A=w.get(P);if(!A)throw new Error(`computeDiff: pass "${m.name}" input "${P}" not produced yet`);return{binding:S,resource:A}});m.uniforms&&y.push(...m.uniforms(p));let R;try{R=e.createBindGroup(_,y),e.renderFullscreen(E,_,R)}finally{(h=R==null?void 0:R.destroy)==null||h.call(R)}}const g=w.get(b.final);if(!g)throw new Error(`computeDiff: final ref "${b.final}" not produced`);for(const m of v)m!==g&&m.destroy();return g}catch(g){for(const m of v)m.destroy();throw g}}const Rc=8,Cc=256*1024*1024;class Dc{constructor(t=Rc,n=Cc){se(this,"map",new Map);se(this,"totalBytes",0);se(this,"maxEntries");se(this,"maxBytes");this.maxEntries=t,this.maxBytes=n}get(t){const n=this.map.get(t);return n&&(this.map.delete(t),this.map.set(t,n)),n}set(t,n){const r=this.map.get(t);r&&(this.totalBytes-=r.bytes,r.texture.destroy(),this.map.delete(t)),this.map.set(t,n),this.totalBytes+=n.bytes,this.evict()}accountReadbackBytes(t,n){let r=!1;for(const o of this.map.values())if(o===t){r=!0;break}r&&(t.bytes+=n,this.totalBytes+=n,this.evict())}evict(){for(;this.map.size>this.maxEntries||this.totalBytes>this.maxBytes;){const t=this.map.keys().next().value;if(t===void 0)break;const n=this.map.get(t);if(this.map.size===1)break;this.map.delete(t),this.totalBytes-=n.bytes,n.texture.destroy()}}clear(){for(const t of this.map.values())t.texture.destroy();this.map.clear(),this.totalBytes=0}get size(){return this.map.size}}const es=new WeakMap;function ts(e){let t=es.get(e);return t||(t=new Dc,es.set(e,t)),t}function kc(e,t){const n=Co(e,t);return Object.keys(n).sort().map(o=>`${o}=${n[o]}`).join(",")}function Lc(e,t,n,r,o){const a=ct(n),s=a?kc(a,r):"",u=o?Gn(o):"";return`${e}|${t}|${n}|${s}|${u}`}function ns(e,t,n,r,o,a,s,u){const i=ct(r);if(!i)throw new Error(`ensureDiff: unknown diff kernel "${r}"`);const l=ts(e),d=u??Dt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),x=Lc(a,s,r,o,d),p=l.get(x);if(p)return p;const b=Tc(e,t,n,r,o,d),w=d.result.w,v=d.result.h,M={texture:b,width:w,height:v,displayRange:i.displayRange,bytes:w*v*8};return l.set(x,M),M}function Oc(e,t,n){return`${e}|${t}|${n?Gn(n):""}`}function Bc(e,t,n,r,o,a){return Ac(e,Oc(r,o,a),()=>Nc(e,t,n,r,o,a))}async function Nc(e,t,n,r,o,a){try{const s=ns(e,t,n,"ssim",void 0,r,o,a);return s.ssimMean!==void 0?s.ssimMean:(s.ssimMeanPending||(s.ssimMeanPending=rs(e,s).then(u=>{const i=Sc(u,s.width,s.height);return s.ssimMean=i,i})),await s.ssimMeanPending)}catch{return Ic(e,t,n,a)}}async function Ic(e,t,n,r){const o=r??Dt({w:t.width,h:t.height},{w:n.width,h:n.height},"top-left","crop","b"),a=o.result.w,s=o.result.h,u=a*s;if(u<=0)return NaN;const i=await e.readback(t),l=await e.readback(n),d=i instanceof Uint8Array?255:1,x=l instanceof Uint8Array?255:1,p=o.fit==="fill",b=nn(i,t.width,t.height,d,o.offsetA,p,a,s),w=nn(l,n.width,n.height,x,o.offsetB,p,a,s),v=new Float64Array(u),M=new Float64Array(u),h=[0,0,0],g=[0,0,0];for(let m=0;m<s;m++){for(let E=0;E<a;E++){b(E,m,h),w(E,m,g);const _=m*a+E;v[_]=Vo(h[0],h[1],h[2]),M[_]=Vo(g[0],g[1],g[2])}(m+1)%jn===0&&await Xo()}return bc(v,M,a,s)}async function Fc(e,t,n,r,o){return t.scalars?t.scalars:(t.scalarsPending||(t.scalarsPending=Kr(e,n,r,o).then(a=>(t.scalars=a,a))),t.scalarsPending)}async function rs(e,t){return t.resultSamples?t.resultSamples:(t.resultSamplesPending||(t.resultSamplesPending=e.readback(t.texture).then(n=>{const r=n instanceof Float32Array?n:Float32Array.from(n);return t.resultSamples=r,ts(e).accountReadbackBytes(t,r.byteLength),r})),t.resultSamplesPending)}const Gc=`
${Ue}
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
`,Uc={unit:0,signed:1,relative:2},zc={linear:0,signed:1,positive:2};function Vc(e,t){if(t){if(t.length!==256*4)throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${t.length}`);const r=e.createTexture(256,1,"rgba32float");return r.write(t),r}const n=e.createTexture(1,1,"rgba32float");return n.write(new Float32Array([0,0,0,1])),n}function $c(e){return"canvas"in e?e.hdr?"rgba16float":"rgba8unorm":e.format}function Xc(e,t,n,r,o){var b,w,v;const a=$c(t),s=Jn(e,"diff-display",Gc,a),u=Vc(e,o.colormap),i=new Float32Array([o.uv.x,o.uv.y,o.uv.w,o.uv.h]),l=new Float32Array([Uc[r],zc[o.cmapMode??"positive"],o.colormap?1:0,o.filter==="nearest"?0:1]),d=new Float32Array([o.exposureEV??0,o.offset??0,0,0]),x=new Float32Array([((b=o.sourceDims)==null?void 0:b.w)??0,((w=o.sourceDims)==null?void 0:w.h)??0,0,0]);let p;try{p=e.createBindGroup(s,[{binding:0,resource:n},{binding:1,resource:u},{binding:2,resource:{uniform:i}},{binding:3,resource:{uniform:l}},{binding:4,resource:{uniform:d}},{binding:5,resource:{uniform:x}}]),e.renderFullscreen(t,s,p)}finally{(v=p==null?void 0:p.destroy)==null||v.call(p),u.destroy()}}const os=.6*.6*2.51,Hc=.6*.03,Wc=0,ss=.6*.6*2.43,Yc=.6*.59,Kc=.14;function as(e){const t=(Hc-Yc*e)/(os-ss*e),n=(Wc-Kc*e)/(os-ss*e);return-.5*t+Math.sqrt((.5*t)**2-n)}const qc=.85,Zc=.85,is=11920928955078125e-23,er=[.2126,.7152,.0722];function Qc(e,t,n){const r=t*n;if(n===1){const o=e[r];return[o,o,o]}return[e[r],e[r+1],e[r+2]]}function jc(e,t,n,r=3,o={}){const a=t*n,s=as(qc),u=as(Zc),i=new Float64Array(a);let l=0;for(let g=0;g<a;g++){const[m,E,_]=Qc(e,g,r),y=m*er[0]+E*er[1]+_*er[2];i[g]=y,y>l&&(l=y)}const d=Float64Array.from(i).sort(),x=a>>1,p=a%2===1?d[x]:d[x-1],b=Math.max(p,is),w=Math.max(l,is),v=o.startExposure??Math.log2(s/w),M=o.stopExposure??Math.log2(u/b),h=Math.max(2,Math.ceil(M-v));return{startExposure:v,stopExposure:M,numExposures:h}}const Jc="absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm pointer-events-none select-none",el="REF";function cs(){return f.jsx("span",{className:Jc,children:el})}function ls({splitPosition:e,onChange:t,onReset:n}){return f.jsx("div",{className:"cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center",style:{left:`${e*100}%`,transform:"translateX(-50%)",cursor:"col-resize",touchAction:"none"},onDoubleClick:r=>{r.stopPropagation(),n==null||n()},onPointerDown:r=>{r.stopPropagation(),r.preventDefault();const o=r.currentTarget;try{o.setPointerCapture(r.pointerId)}catch{}const s=o.parentElement.getBoundingClientRect(),u=l=>{t==null||t(Math.max(0,Math.min(1,(l.clientX-s.left)/s.width)))},i=()=>{window.removeEventListener("pointermove",u),window.removeEventListener("pointerup",i)};window.addEventListener("pointermove",u),window.addEventListener("pointerup",i)},children:f.jsx("div",{className:"w-1 h-full bg-accent/80 rounded-full pointer-events-none"})})}const tl={brightness:0,contrast:0,gamma:1,exposure:0,offset:0,flipSign:!1};function nl({imageUrl:e,baselineUrl:t,mode:n,splitPosition:r,blendAlpha:o,onSplitPositionChange:a,zoom:s,pan:u,onViewportChange:i,processing:l=tl,interpolation:d="auto",label:x="",isDraggable:p=!1,onDragStart:b,overlay:w,overlaySettings:v,pixelValueNotation:M="decimal"}){var re,ge;const h=c.useRef(null),[g,m]=c.useState(null),[E,_]=c.useState(null),[y,R]=c.useState(M),[P,S]=c.useState(!1),A=c.useRef(null),T=c.useRef(null),L=c.useRef(null),D=c.useRef(null),[B,N]=c.useState(0);c.useEffect(()=>{if(!e){L.current=null,N(ie=>ie+1);return}let te=!1;return st(e).then(ie=>{te||(L.current=ie,N(xe=>xe+1))}),()=>{te=!0}},[e]),c.useEffect(()=>{if(!t){D.current=null,N(ie=>ie+1);return}let te=!1;return st(t).then(ie=>{te||(D.current=ie,N(xe=>xe+1))}),()=>{te=!0}},[t]);const F=te=>(ie,xe,ye)=>{const pe=te.current;if(!pe||ie<0||xe<0||ie>=pe.width||xe>=pe.height)return null;const Se=(xe*pe.width+ie)*4,me=pe.data[Se],Le=pe.data[Se+1],ue=pe.data[Se+2];return me===Le&&Le===ue?{lines:[_t(me,"uint8",ye)]}:{lines:[_t(me,"uint8",ye),_t(Le,"uint8",ye),_t(ue,"uint8",ye)],colors:[Jt[0],Jt[1],Jt[2]]}},z=c.useMemo(()=>F(L),[]),G=c.useMemo(()=>F(D),[]),V=!!w&&!!(v!=null&&v.enabled)&&!!g&&!!e&&((((re=w.boxes)==null?void 0:re.length)??0)>0||(((ge=w.masks)==null?void 0:ge.length)??0)>0),{gammaFilterId:$,filterStr:Q,gamma:he,offset:ae}=to(l),de=`translate(${u.x}px, ${u.y}px) scale(${s})`,W=d==="auto"?void 0:d,{containerProps:j,modifierActive:q}=Or({containerRef:h,zoom:s,pan:u,onViewportChange:i});return f.jsxs("div",{className:"relative flex flex-col h-full",children:[f.jsx(no,{id:$,gamma:he,offset:ae}),f.jsxs("div",{ref:h,className:"relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard",style:{padding:0,...j.style},onPointerDown:j.onPointerDown,onPointerMove:j.onPointerMove,onPointerUp:j.onPointerUp,onPointerCancel:j.onPointerCancel,children:[f.jsxs("div",{className:"relative w-full h-full",children:[f.jsxs("div",{className:"relative w-full h-full",style:{transform:de,transformOrigin:"0 0"},children:[f.jsx("img",{ref:A,src:e??void 0,alt:"pred",className:"w-full h-full object-contain block",draggable:!1,style:{filter:Q,imageRendering:W,...n==="blend"?{opacity:o}:{}},onLoad:te=>{const ie=te.currentTarget;m({w:ie.naturalWidth,h:ie.naturalHeight})}}),V&&f.jsx(In,{data:w,settings:v,naturalWidth:g.w,naturalHeight:g.h})]}),f.jsx("div",{className:"absolute inset-0 overflow-hidden",style:n==="split"?{clipPath:`inset(0 ${(1-r)*100}% 0 0)`}:void 0,children:f.jsx("div",{className:"w-full h-full",style:{transform:de,transformOrigin:"0 0"},children:f.jsx("img",{ref:T,src:t??void 0,alt:"ref",className:"w-full h-full object-contain block",draggable:!1,style:{filter:Q,imageRendering:W,...n==="blend"?{opacity:1-o}:{}},onLoad:te=>{const ie=te.currentTarget;_({w:ie.naturalWidth,h:ie.naturalHeight})}})})}),n==="split"&&f.jsx(ls,{splitPosition:r,onChange:a,onReset:()=>a==null?void 0:a(.5)})]}),n==="split"?f.jsxs(f.Fragment,{children:[t&&E&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-r)*100}% 0 0)`},children:f.jsx(xt,{imageElRef:T,naturalWidth:E.w,naturalHeight:E.h,zoom:s,pan:u,sample:G,notation:y,version:B})}),e&&g&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${r*100}%)`},children:f.jsx(xt,{imageElRef:A,naturalWidth:g.w,naturalHeight:g.h,zoom:s,pan:u,sample:z,notation:y,version:B,onActiveChange:S})})]}):e&&g&&f.jsx(xt,{imageElRef:A,naturalWidth:g.w,naturalHeight:g.h,zoom:s,pan:u,sample:z,notation:y,version:B,onActiveChange:S}),P&&f.jsx(Ur,{notation:y,onChange:R})]}),n==="split"&&f.jsx(cs,{}),f.jsx(Un,{label:x,corner:"bottom-right",isDraggable:p&&!q,grip:!0,onDragStart:b})]})}function rl(){return f.jsx(eo,{title:"GPU compare unavailable",body:"Float image sources need the GPU compare (WebGPU), which isn't available in this browser."})}function ol({mode:e,kernel:t,kernelOptions:n,onSlide:r,onBlend:o,onKernel:a,onSide:s}){return{id:"compare-mode",title:"Compare / diff mode",menu:{options:[...s?[{id:"side",label:"Side"}]:[],{id:"slide",label:"Slide"},{id:"blend",label:"Blend"},...n],value:e==="side"?"side":e==="split"?"slide":e==="blend"?"blend":t,onSelect:l=>{l==="side"?s==null||s():l==="slide"?r():l==="blend"?o():a(l)}}}}function sl(e){const t=Mn(e),n=new Float32Array(256*4);for(let r=0;r<256;r++)n[r*4+0]=t[r*3+0]/255,n[r*4+1]=t[r*3+1]/255,n[r*4+2]=t[r*3+2]/255,n[r*4+3]=1;return n}function al(e){const{width:t,height:n,channels:r}=e,o=t*n;if(e.precision==="f16-bits"){const i=e.data,l=new Uint16Array(o*4);for(let d=0;d<o;d++){const x=d*r,p=d*4;if(r===1){const b=i[x];l[p]=b,l[p+1]=b,l[p+2]=b,l[p+3]=Kt}else l[p]=i[x],l[p+1]=i[x+1],l[p+2]=i[x+2],l[p+3]=r>=4?i[x+3]:Kt}return{data:l,format:"rgba16float"}}const a=e.data,s=new Float32Array(o*4),u=i=>Number.isFinite(i)?i:0;for(let i=0;i<o;i++){const l=i*r;let d,x,p,b=1;r===1?d=x=p=u(a[l]):r===3?(d=u(a[l]),x=u(a[l+1]),p=u(a[l+2])):(d=u(a[l]),x=u(a[l+1]),p=u(a[l+2]),b=u(a[l+3]));const w=i*4;s[w]=d,s[w+1]=x,s[w+2]=p,s[w+3]=b}return{data:s,format:"rgba32float"}}function il({imageUrl:e,baselineUrl:t,imageFloat:n,baselineFloat:r,mode:o,splitPosition:a,blendAlpha:s,onSplitPositionChange:u,diffSubmode:i,colormap:l="none",align:d="top-left",fit:x="crop",diffKernel:p,onDiffKernelChange:b,onCompareModeChange:w,onRequestSide:v,zoom:M,pan:h,onViewportChange:g,interpolation:m="auto",label:E="",pixelValueNotation:_="decimal",tonemap:y,peak:R,gamma:P}){var hs;const S=c.useRef(null),A=c.useRef(null),T=c.useRef(null),L=c.useRef(null),D=c.useRef(null),[B,N]=c.useState(!1),[F,z]=c.useState(!1),G=c.useRef(!1),[V,$]=c.useState(!1),[Q,he]=c.useState(null),[ae,de]=c.useState(null),[W,j]=c.useState({a:!1,b:!1}),[q,re]=c.useState(0),[ge,te]=c.useState(0),[ie,xe]=c.useState(null),[ye,pe]=c.useState(null),[Se,me]=c.useState({x:0,y:0,w:1,h:1}),Le=p??i??"absolute",[ue,Pe,Fe]=ke(Le);c.useEffect(()=>{Pe(p??i??"absolute")},[p,i,Pe]);const We=c.useCallback(k=>{Pe(k),b==null||b(k)},[b,Pe]);c.useEffect(()=>{const k=S.current;if(k)return k.__cairnDiffKernel={current:ue,set:We},()=>{k&&delete k.__cairnDiffKernel}},[ue,We]);const[ce,Ye,vt]=ke(o);c.useEffect(()=>{Ye(o)},[o,Ye]);const Ke=c.useCallback(k=>{Ye(k),w==null||w(k)},[w,Ye]),[Ae,Je,et]=ke(l);c.useEffect(()=>{Je(l)},[l,Je]);const[ze,Ve]=c.useState(null);c.useEffect(()=>{Ve(null)},[y]);const St=wr(y),Be=ze??St,wt=ze!==null&&ze!==St,[ut,At,nt]=ke(R!=null&&R>0?R:vr(y)??Ut),[H,C,U]=ke(P&&P>0?P:Et),O=c.useCallback(()=>{Ke(vt.default),Je(et.default),We(Fe.default),Ve(null),nt.reset(),U.reset()},[Ke,Je,We,vt.default,et.default,Fe.default,nt,U]),X=vt.isModified||et.isModified||Fe.isModified||wt||nt.isModified||U.isModified,[I,oe]=c.useState(0),[be,Me]=c.useState(0),J=c.useMemo(()=>{const Z=[ol({mode:ce,kernel:ue,kernelOptions:Zo().map(Y=>({id:Y.id,label:Y.label})),onSide:v,onSlide:()=>Ke("split"),onBlend:()=>Ke("blend"),onKernel:Y=>{Ke("diff"),We(Y)}})];return ce==="diff"?Z.push(kt(Ae,Y=>Je(Y))):Z.push(on(Be,Y=>Ve(Y))),Z},[ce,ue,Ae,Be,We,Ke,v]),Te=c.useRef(null),_e=c.useRef(null),Ne=c.useRef(null),ft=c.useRef(null),[Ge,dt]=c.useState(0),rt=c.useRef(null),Bt=c.useRef(null),[ul,us]=c.useState(0),tr=Nn();c.useEffect(()=>{const k=T.current;if(!k)return;let Z=!1;return Ft().then(Y=>{var K;if(!Z)try{if(qr())throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");const ne=((K=Y.probeExtendedToneMapping)==null?void 0:K.call(Y))??!1,le=typeof matchMedia<"u"&&matchMedia("(dynamic-range: high)").matches,ve=ne&&le;G.current=ve,$(ve);const Ee=Y.createSurface(k,{hdr:ve});L.current={device:Y,surface:Ee,texA:null,texB:null},z(!0)}catch(ne){console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane",ne),N(!0)}}).catch(Y=>{Z||(console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane",Y),N(!0))}),()=>{var K,ne;Z=!0;const Y=L.current;Y&&((K=Y.texA)==null||K.destroy(),(ne=Y.texB)==null||ne.destroy(),L.current=null)}},[]),c.useEffect(()=>{const k=S.current;if(!k)return;const Z=new ResizeObserver(()=>te(Y=>Y+1));return Z.observe(k),()=>Z.disconnect()},[]),c.useEffect(()=>{if(!F)return;let k=!1;if(!L.current)return;async function Y(K,ne){if(ne){const ve=al(ne);return{width:ne.width,height:ne.height,imageData:null,make:Ee=>{const fe=Ee.createTexture(ne.width,ne.height,ve.format);return fe.write(ve.data),fe}}}if(!K)return null;const le=await st(K);return le?{width:le.width,height:le.height,imageData:le,make:ve=>{const Ee=ve.createTexture(le.width,le.height,"rgba8unorm");return Ee.write(le.data),Ee}}:null}return Promise.all([Y(e,n),Y(t,r)]).then(([K,ne])=>{var Ce,He;if(k||!L.current)return;const le=L.current;Te.current=(K==null?void 0:K.imageData)??null,_e.current=(ne==null?void 0:ne.imageData)??null,Ne.current=n??null,ft.current=r??null,(Ce=le.texA)==null||Ce.destroy(),(He=le.texB)==null||He.destroy(),le.texA=null,le.texB=null;const ve=K??ne;if(!ve){he(null),de(null),dt(pt=>pt+1);return}const Ee=ne??ve,fe=K??ve;le.texA=Ee.make(le.device),le.texB=fe.make(le.device),de({a:{w:Ee.width,h:Ee.height},b:{w:fe.width,h:fe.height}}),j({a:Ee.imageData!=null,b:fe.imageData!=null}),he({w:ve.width,h:ve.height}),dt(pt=>pt+1),re(pt=>pt+1)}),()=>{k=!0}},[F,e,t,n,r]);const mn=n!=null||r!=null,$e=c.useMemo(()=>Mc(ue,mn),[ue,mn]),Nt=c.useMemo(()=>{if(!mn)return null;const k=r??n;if(!k)return null;const Z=k.precision==="f16-bits"?Pr(k.data):k.data;return jc(Z,k.width,k.height,k.channels)},[mn,r,n]),fs=c.useMemo(()=>{var k;return Xs(((k=ct($e))==null?void 0:k.displayRange)??"unit",Ae==="none"?null:Ae)},[$e,Ae]),ds=c.useMemo(()=>Ae!=="none"?sl(Ae):void 0,[Ae]),Xe=c.useMemo(()=>ae?Dt(ae.a,ae.b,d,x,"b"):null,[ae,d,x]),fl=c.useMemo(()=>Xe?Gn(Xe):"none",[Xe]),hn=(r==null?void 0:r.contentKey)??t??(n==null?void 0:n.contentKey)??e??"none",gn=(n==null?void 0:n.contentKey)??e??(r==null?void 0:r.contentKey)??t??"none",Ie=c.useMemo(()=>Q?ce==="diff"&&Xe?Xe.result:Q:null,[ce,Xe,Q]),nr=c.useCallback(()=>{const k=L.current;if(!F||!k||!k.surface||!k.texA||!k.texB||!Q)return;const Z=Ie??Q,Y=S.current,K=Y?Y.getBoundingClientRect():{width:Z.w,height:Z.h},ne=To({zoom:M,pan:h},K,Z.w,Z.h);me(fe=>fe.x===ne.x&&fe.y===ne.y&&fe.w===ne.w&&fe.h===ne.h?fe:ne);const le=T.current;if(K.width>0&&K.height>0&&le&&k.surface){const fe=Math.max(1,Math.round(K.width*tr)),Ce=Math.max(1,Math.round(K.height*tr));(le.width!==fe||le.height!==Ce)&&(le.width=fe,le.height=Ce,k.surface.configure(fe,Ce))}const ve=Ro(ne,K,Z.w,Z.h)>=jt?"nearest":"linear",Ee=ne;try{if(ce==="diff"){const fe=ct($e)?$e:"absolute",Ce=fe==="hdr-flip"&&Nt?{ppd:67,startExposure:Nt.startExposure,stopExposure:Nt.stopExposure,numExposures:Nt.numExposures}:void 0,He=ns(k.device,k.texA,k.texB,fe,Ce,hn,gn,Xe??void 0);D.current=He,Xc(k.device,k.surface,He.texture,He.displayRange,{uv:Ee,cmapMode:fs,colormap:ds,filter:ve,exposureEV:I,offset:be})}else{const fe=yr(Be,G.current?ut:1,G.current,H),Ce={exposureEV:I,offset:be,operator:fe.operator,gamma:fe.gamma,isScalar:!1,hdrOut:fe.hdrOut,peak:fe.peak,srgbDecodeA:W.a,srgbDecodeB:W.b,uv:Ee,filter:ve,mode:ce,split:a,alpha:s};Ha(k.device,k.surface,k.texA,k.texB,Ce)}}catch(fe){console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane",fe),N(!0)}},[F,Q,Ie,Xe,M,h.x,h.y,ce,a,s,I,be,Be,ut,H,W,ue,$e,Nt,fs,ds,e,t,n,r,hn,gn,tr]);c.useEffect(()=>{nr()},[nr,q,ge]);const Pt=t!=null||r!=null;c.useEffect(()=>{const k=L.current;if(!F||!k||!k.texA||!k.texB||!Pt){xe(null);return}let Z=!1;const Y=k.texA,K=k.texB,ne=D.current,le=ce==="diff"?Xe??void 0:void 0;return(ce==="diff"&&ne?Fc(k.device,ne,Y,K,le):Kr(k.device,Y,K,le)).then(Ee=>{Z||xe(Ee)}),()=>{Z=!0}},[F,q,Pt,ce,ue,Xe]),c.useEffect(()=>{const k=L.current;if(!F||!k||!k.texA||!k.texB||!Pt){pe(null);return}let Z=!1;pe(null);const Y=ce==="diff"?Xe??void 0:void 0;return Bc(k.device,k.texA,k.texB,hn,gn,Y).then(K=>{Z||pe(K)}).catch(()=>{Z||pe(null)}),()=>{Z=!0}},[F,q,Pt,ce,fl,hn,gn]),c.useEffect(()=>{if(ce!=="diff"){rt.current=null,Bt.current=null;return}const k=L.current,Z=D.current;if(!F||!k||!Z)return;let Y=!1;return rt.current=null,Bt.current=null,us(K=>K+1),rs(k.device,Z).then(K=>{Y||(rt.current=K,Bt.current={w:Z.width,h:Z.height},us(ne=>ne+1))}).catch(()=>{}),()=>{Y=!0}},[F,ce,$e,q,Xe]);const ps=(k,Z)=>(Y,K,ne)=>{const le=Z.current;if(le){const{data:pt,width:gs,height:hl,channels:xs}=le;if(Y<0||K<0||Y>=gs||K>=hl)return null;const bn=(K*gs+Y)*xs,vn=le.precision==="f16-bits"?sr=>qt(pt[sr]??0):sr=>pt[sr]??0,gl=xs===1?[vn(bn)]:[vn(bn),vn(bn+1),vn(bn+2)];return gt(gl,"unit",ne)}const ve=k.current;if(!ve||Y<0||K<0||Y>=ve.width||K>=ve.height)return null;const Ee=(K*ve.width+Y)*4,fe=ve.data[Ee],Ce=ve.data[Ee+1],He=ve.data[Ee+2];return gt(fe===Ce&&Ce===He?[fe]:[fe,Ce,He],"uint8",ne)},xn=c.useMemo(()=>ps(Te,Ne),[]),rr=c.useMemo(()=>ps(_e,ft),[]),or=c.useMemo(()=>(k,Z,Y)=>{var He;const K=rt.current,ne=Bt.current;if(!K||!ne)return null;const{w:le,h:ve}=ne;if(k<0||Z<0||k>=le||Z>=ve)return null;const Ee=(Z*le+k)*4,Ce=(((He=ct($e))==null?void 0:He.output)??"per-channel")==="scalar"?[K[Ee]??0]:[K[Ee]??0,K[Ee+1]??0,K[Ee+2]??0];return gt(Ce,"unit",Y)},[$e]);c.useEffect(()=>{const k=S.current;if(k)return k.__cairnCompareProbe={sampleDiff:(Z,Y,K="decimal")=>or(Z,Y,K),sampleFg:(Z,Y,K="decimal")=>xn(Z,Y,K),sampleRef:(Z,Y,K="decimal")=>rr(Z,Y,K),get diffSamples(){return rt.current},get dims(){return Ie},get primaryDims(){return Q},get diffResultDims(){return Bt.current},get align(){return d},get fit(){return x},get resolvedKernelId(){return $e},get compareMode(){return ce},get ssimScalar(){return ye},get ssimText(){return Qo(ye)},get effectiveTonemap(){return Be},get hdrEngaged(){return V}},()=>{k&&delete k.__cairnCompareProbe}},[or,xn,rr,Q,Ie,d,x,$e,ce,ye,Be,V]);const dl=m==="auto"?void 0:m;if(B)return n!=null||r!=null?f.jsx(rl,{}):ce==="diff"?f.jsx(Hn,{imageUrl:e,baselineUrl:t,diffMode:((hs=ct($e))==null?void 0:hs.kind)==="pointwise"?$e:"absolute",interpolation:m,colormap:Ae,showAxes:!1,zoom:M,pan:h,onViewportChange:g,label:E,pixelValueNotation:_}):f.jsx(nl,{imageUrl:e,baselineUrl:t,mode:ce,splitPosition:a,blendAlpha:s,onSplitPositionChange:u,zoom:M,pan:h,onViewportChange:g,interpolation:m,label:E,pixelValueNotation:_});const pl=f.jsxs(f.Fragment,{children:[f.jsx("canvas",{ref:T,className:"w-full h-full block",style:{imageRendering:dl},"data-gpu-compare-canvas":!0}),ce==="split"&&f.jsx(ls,{splitPosition:a,onChange:u,onReset:()=>u==null?void 0:u(.5)})]}),ms=!!E,ml=ms?"bottom-7":"bottom-1";return f.jsx(sn,{paneAttrs:{"data-gpu-compare-pane":"","data-gpu-compare-ready":F},viewportAttrs:{"data-gpu-compare-viewport":""},toolbar:!0,paneRef:S,wrapperRef:A,zoom:M,pan:h,onViewportChange:g,naturalDims:Ie,checkerboard:"pane",wrapperClassName:"relative w-full h-full flex items-center justify-center",viewportPadding:0,surface:pl,showAxes:!1,notationSeed:_,onReset:O,extraModified:X,exportCanvasRef:T,requestRender:nr,leadingMenus:J,displayAdjust:{exposureEV:I,offset:be,onExposureChange:oe,onOffsetChange:Me},extraSliders:[...V&&ce!=="diff"?[{id:"peak",label:"PK",title:"Peak white (×SDR white) — the HDR ceiling P every operator clips at (Linear/sRGB/Gamma hard-clip at P; Reinhard/ACES roll off toward P). P=1 reproduces the SDR rendition exactly; double-click to type a value, including 'inf' for the raw browser-clipped extended look.",min:dr,max:Tt,step:pr,value:ut,onChange:At,format:k=>Number.isFinite(k)?`${k.toFixed(1)}×`:"∞"}]:[],...ce!=="diff"&&Wt(Be)?[{id:"gamma",label:"γ",title:"Display gamma γ for the Gamma transfer — display = clamp(value)^(1/γ), tev-style. Default 2.2 (close to sRGB, not identical). Double-click to type a value.",min:$t,max:Xt,step:Ht,value:H,onChange:C,format:k=>k.toFixed(1)}]:[]],label:"",showLabelChip:!1,overlay:{render:({notation:k,setOverlayActive:Z})=>ce==="split"?f.jsxs(f.Fragment,{children:[Pt&&Ie&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 ${(1-a)*100}% 0 0)`},children:f.jsx(xt,{imageElRef:T,naturalWidth:Ie.w,naturalHeight:Ie.h,zoom:M,pan:h,sourceWindow:Se,sample:rr,notation:k,version:Ge})}),Pt&&Ie&&f.jsx("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",style:{clipPath:`inset(0 0 0 ${a*100}%)`},children:f.jsx(xt,{imageElRef:T,naturalWidth:Ie.w,naturalHeight:Ie.h,zoom:M,pan:h,sourceWindow:Se,sample:xn,notation:k,version:Ge,onActiveChange:Z})})]}):Ie&&f.jsx(xt,{imageElRef:T,naturalWidth:Ie.w,naturalHeight:Ie.h,zoom:M,pan:h,sourceWindow:Se,sample:ce==="diff"?or:xn,notation:k,version:ce==="diff"?ul:Ge,onActiveChange:Z})},extraChips:f.jsxs(f.Fragment,{children:[ce==="split"&&f.jsx(cs,{}),ms?f.jsx(Un,{label:E,corner:"bottom-right"}):null,ie&&f.jsxs("span",{className:`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${ml}`,"data-gpu-compare-metrics":!0,children:["MSE ",ie.mse.toExponential(2)," · PSNR ",Number.isFinite(ie.psnr)?ie.psnr.toFixed(1):"∞"," dB · MAE"," ",ie.mae.toExponential(2)," · SSIM ",Qo(ye)]})]})})}const cl="cairn-plot:gpu-image-ready";async function ll(){if(!window.__cairnPlotGpuImageLoaded){if(window.__cairnPlotUseGpuImage===!1){console.info("cairn-plot gpu-image addon: skipped (__cairnPlotUseGpuImage === false)");return}try{await Ft(),window.__cairnPlotGpuImagePane=Qi,window.__cairnPlotGpuComparePane=il,window.__cairnPlotDiffMenuModes=Zo(),window.__cairnPlotUseGpuImage=!0,window.__cairnPlotGpuImageLoaded=!0,window.dispatchEvent(new Event(cl))}catch(e){console.warn("cairn-plot gpu-image addon: engine init failed, staying on legacy panes",e),Po("no-webgpu")}}}ll()})(__cairnPlotJsxRuntime,__cairnPlotReact);
