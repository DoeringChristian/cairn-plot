(function(ne,Ae){"use strict";/**
 * @license
 * Copyright 2010-2026 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const xc="185",Gr={ROTATE:0,DOLLY:1,PAN:2},Wr={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},lv=0,Lh=1,cv=2,jo=1,uv=2,Ws=3,$n=0,rn=1,Rn=2,_i=0,Xr=1,Dh=2,Ih=3,Nh=4,fv=5,_r=100,dv=101,hv=102,pv=103,mv=104,gv=200,_v=201,vv=202,xv=203,Sc=204,yc=205,Sv=206,yv=207,Mv=208,Ev=209,Tv=210,wv=211,Av=212,Rv=213,bv=214,Mc=0,Ec=1,Tc=2,Yr=3,wc=4,Ac=5,Rc=6,bc=7,Uh=0,Cv=1,Pv=2,ei=0,Fh=1,Oh=2,Bh=3,kh=4,zh=5,Vh=6,Hh=7,Gh=300,vr=301,Kr=302,Cc=303,Pc=304,$o=306,Lc=1e3,fn=1001,Dc=1002,Wt=1003,Lv=1004,ea=1005,Dt=1006,Ic=1007,xr=1008,sn=1009,Wh=1010,Xh=1011,Xs=1012,Nc=1013,ti=1014,ni=1015,vi=1016,Uc=1017,Fc=1018,Ys=1020,Yh=35902,Kh=35899,Zh=1021,qh=1022,bn=1023,xi=1026,Sr=1027,Oc=1028,Bc=1029,yr=1030,kc=1031,zc=1033,ta=33776,na=33777,ia=33778,ra=33779,Vc=35840,Hc=35841,Gc=35842,Wc=35843,Xc=36196,Yc=37492,Kc=37496,Zc=37488,qc=37489,sa=37490,Qc=37491,Jc=37808,jc=37809,$c=37810,eu=37811,tu=37812,nu=37813,iu=37814,ru=37815,su=37816,ou=37817,au=37818,lu=37819,cu=37820,uu=37821,fu=36492,du=36494,hu=36495,pu=36283,mu=36284,oa=36285,gu=36286,Dv=3200,_u=0,Iv=1,Fi="",Cn="srgb",aa="srgb-linear",la="linear",ot="srgb",Zr=7680,Qh=519,Nv=512,Uv=513,Fv=514,vu=515,Ov=516,Bv=517,xu=518,kv=519,Jh=35044,Su="300 es",ii=2e3,Ks=2001;function zv(t){for(let e=t.length-1;e>=0;--e)if(t[e]>=65535)return!0;return!1}function ca(t){return document.createElementNS("http://www.w3.org/1999/xhtml",t)}function Vv(){const t=ca("canvas");return t.style.display="block",t}const jh={};function $h(...t){const e="THREE."+t.shift();console.log(e,...t)}function ep(t){const e=t[0];if(typeof e=="string"&&e.startsWith("TSL:")){const n=t[1];n&&n.isStackTrace?t[0]+=" "+n.getLocation():t[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return t}function Ne(...t){t=ep(t);const e="THREE."+t.shift();{const n=t[0];n&&n.isStackTrace?console.warn(n.getError(e)):console.warn(e,...t)}}function tt(...t){t=ep(t);const e="THREE."+t.shift();{const n=t[0];n&&n.isStackTrace?console.error(n.getError(e)):console.error(e,...t)}}function qr(...t){const e=t.join(" ");e in jh||(jh[e]=!0,Ne(...t))}function Hv(t,e,n){return new Promise(function(i,r){function s(){switch(t.clientWaitSync(e,t.SYNC_FLUSH_COMMANDS_BIT,0)){case t.WAIT_FAILED:r();break;case t.TIMEOUT_EXPIRED:setTimeout(s,n);break;default:i()}}setTimeout(s,n)})}const Gv={[Mc]:Ec,[Tc]:Rc,[wc]:bc,[Yr]:Ac,[Ec]:Mc,[Rc]:Tc,[bc]:wc,[Ac]:Yr};class Oi{addEventListener(e,n){this._listeners===void 0&&(this._listeners={});const i=this._listeners;i[e]===void 0&&(i[e]=[]),i[e].indexOf(n)===-1&&i[e].push(n)}hasEventListener(e,n){const i=this._listeners;return i===void 0?!1:i[e]!==void 0&&i[e].indexOf(n)!==-1}removeEventListener(e,n){const i=this._listeners;if(i===void 0)return;const r=i[e];if(r!==void 0){const s=r.indexOf(n);s!==-1&&r.splice(s,1)}}dispatchEvent(e){const n=this._listeners;if(n===void 0)return;const i=n[e.type];if(i!==void 0){e.target=this;const r=i.slice(0);for(let s=0,o=r.length;s<o;s++)r[s].call(this,e);e.target=null}}}const qt=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],ua=Math.PI/180,yu=180/Math.PI;function Zs(){const t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,n=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(qt[t&255]+qt[t>>8&255]+qt[t>>16&255]+qt[t>>24&255]+"-"+qt[e&255]+qt[e>>8&255]+"-"+qt[e>>16&15|64]+qt[e>>24&255]+"-"+qt[n&63|128]+qt[n>>8&255]+"-"+qt[n>>16&255]+qt[n>>24&255]+qt[i&255]+qt[i>>8&255]+qt[i>>16&255]+qt[i>>24&255]).toLowerCase()}function Je(t,e,n){return Math.max(e,Math.min(n,t))}function Wv(t,e){return(t%e+e)%e}function Mu(t,e,n){return(1-n)*t+n*e}function qs(t,e){switch(e.constructor){case Float32Array:return t;case Uint32Array:return t/4294967295;case Uint16Array:return t/65535;case Uint8Array:return t/255;case Int32Array:return Math.max(t/2147483647,-1);case Int16Array:return Math.max(t/32767,-1);case Int8Array:return Math.max(t/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function dn(t,e){switch(e.constructor){case Float32Array:return t;case Uint32Array:return Math.round(t*4294967295);case Uint16Array:return Math.round(t*65535);case Uint8Array:return Math.round(t*255);case Int32Array:return Math.round(t*2147483647);case Int16Array:return Math.round(t*32767);case Int8Array:return Math.round(t*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}const Xv={DEG2RAD:ua},Th=class Th{constructor(e=0,n=0){this.x=e,this.y=n}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,n){return this.x=e,this.y=n,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,n){switch(e){case 0:this.x=n;break;case 1:this.y=n;break;default:throw new Error("THREE.Vector2: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,n){return this.x=e.x+n.x,this.y=e.y+n.y,this}addScaledVector(e,n){return this.x+=e.x*n,this.y+=e.y*n,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,n){return this.x=e.x-n.x,this.y=e.y-n.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){const n=this.x,i=this.y,r=e.elements;return this.x=r[0]*n+r[3]*i+r[6],this.y=r[1]*n+r[4]*i+r[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,n){return this.x=Je(this.x,e.x,n.x),this.y=Je(this.y,e.y,n.y),this}clampScalar(e,n){return this.x=Je(this.x,e,n),this.y=Je(this.y,e,n),this}clampLength(e,n){const i=this.length();return this.divideScalar(i||1).multiplyScalar(Je(i,e,n))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){const n=Math.sqrt(this.lengthSq()*e.lengthSq());if(n===0)return Math.PI/2;const i=this.dot(e)/n;return Math.acos(Je(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const n=this.x-e.x,i=this.y-e.y;return n*n+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,n){return this.x+=(e.x-this.x)*n,this.y+=(e.y-this.y)*n,this}lerpVectors(e,n,i){return this.x=e.x+(n.x-e.x)*i,this.y=e.y+(n.y-e.y)*i,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,n=0){return this.x=e[n],this.y=e[n+1],this}toArray(e=[],n=0){return e[n]=this.x,e[n+1]=this.y,e}fromBufferAttribute(e,n){return this.x=e.getX(n),this.y=e.getY(n),this}rotateAround(e,n){const i=Math.cos(n),r=Math.sin(n),s=this.x-e.x,o=this.y-e.y;return this.x=s*i-o*r+e.x,this.y=s*r+o*i+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}};Th.prototype.isVector2=!0;let ze=Th;class Bi{constructor(e=0,n=0,i=0,r=1){this.isQuaternion=!0,this._x=e,this._y=n,this._z=i,this._w=r}static slerpFlat(e,n,i,r,s,o,a){let l=i[r+0],c=i[r+1],d=i[r+2],h=i[r+3],u=s[o+0],p=s[o+1],g=s[o+2],M=s[o+3];if(h!==M||l!==u||c!==p||d!==g){let m=l*u+c*p+d*g+h*M;m<0&&(u=-u,p=-p,g=-g,M=-M,m=-m);let f=1-a;if(m<.9995){const x=Math.acos(m),y=Math.sin(x);f=Math.sin(f*x)/y,a=Math.sin(a*x)/y,l=l*f+u*a,c=c*f+p*a,d=d*f+g*a,h=h*f+M*a}else{l=l*f+u*a,c=c*f+p*a,d=d*f+g*a,h=h*f+M*a;const x=1/Math.sqrt(l*l+c*c+d*d+h*h);l*=x,c*=x,d*=x,h*=x}}e[n]=l,e[n+1]=c,e[n+2]=d,e[n+3]=h}static multiplyQuaternionsFlat(e,n,i,r,s,o){const a=i[r],l=i[r+1],c=i[r+2],d=i[r+3],h=s[o],u=s[o+1],p=s[o+2],g=s[o+3];return e[n]=a*g+d*h+l*p-c*u,e[n+1]=l*g+d*u+c*h-a*p,e[n+2]=c*g+d*p+a*u-l*h,e[n+3]=d*g-a*h-l*u-c*p,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,n,i,r){return this._x=e,this._y=n,this._z=i,this._w=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,n=!0){const i=e._x,r=e._y,s=e._z,o=e._order,a=Math.cos,l=Math.sin,c=a(i/2),d=a(r/2),h=a(s/2),u=l(i/2),p=l(r/2),g=l(s/2);switch(o){case"XYZ":this._x=u*d*h+c*p*g,this._y=c*p*h-u*d*g,this._z=c*d*g+u*p*h,this._w=c*d*h-u*p*g;break;case"YXZ":this._x=u*d*h+c*p*g,this._y=c*p*h-u*d*g,this._z=c*d*g-u*p*h,this._w=c*d*h+u*p*g;break;case"ZXY":this._x=u*d*h-c*p*g,this._y=c*p*h+u*d*g,this._z=c*d*g+u*p*h,this._w=c*d*h-u*p*g;break;case"ZYX":this._x=u*d*h-c*p*g,this._y=c*p*h+u*d*g,this._z=c*d*g-u*p*h,this._w=c*d*h+u*p*g;break;case"YZX":this._x=u*d*h+c*p*g,this._y=c*p*h+u*d*g,this._z=c*d*g-u*p*h,this._w=c*d*h-u*p*g;break;case"XZY":this._x=u*d*h-c*p*g,this._y=c*p*h-u*d*g,this._z=c*d*g+u*p*h,this._w=c*d*h+u*p*g;break;default:Ne("Quaternion: .setFromEuler() encountered an unknown order: "+o)}return n===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,n){const i=n/2,r=Math.sin(i);return this._x=e.x*r,this._y=e.y*r,this._z=e.z*r,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(e){const n=e.elements,i=n[0],r=n[4],s=n[8],o=n[1],a=n[5],l=n[9],c=n[2],d=n[6],h=n[10],u=i+a+h;if(u>0){const p=.5/Math.sqrt(u+1);this._w=.25/p,this._x=(d-l)*p,this._y=(s-c)*p,this._z=(o-r)*p}else if(i>a&&i>h){const p=2*Math.sqrt(1+i-a-h);this._w=(d-l)/p,this._x=.25*p,this._y=(r+o)/p,this._z=(s+c)/p}else if(a>h){const p=2*Math.sqrt(1+a-i-h);this._w=(s-c)/p,this._x=(r+o)/p,this._y=.25*p,this._z=(l+d)/p}else{const p=2*Math.sqrt(1+h-i-a);this._w=(o-r)/p,this._x=(s+c)/p,this._y=(l+d)/p,this._z=.25*p}return this._onChangeCallback(),this}setFromUnitVectors(e,n){let i=e.dot(n)+1;return i<1e-8?(i=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=i):(this._x=0,this._y=-e.z,this._z=e.y,this._w=i)):(this._x=e.y*n.z-e.z*n.y,this._y=e.z*n.x-e.x*n.z,this._z=e.x*n.y-e.y*n.x,this._w=i),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(Je(this.dot(e),-1,1)))}rotateTowards(e,n){const i=this.angleTo(e);if(i===0)return this;const r=Math.min(1,n/i);return this.slerp(e,r),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,n){const i=e._x,r=e._y,s=e._z,o=e._w,a=n._x,l=n._y,c=n._z,d=n._w;return this._x=i*d+o*a+r*c-s*l,this._y=r*d+o*l+s*a-i*c,this._z=s*d+o*c+i*l-r*a,this._w=o*d-i*a-r*l-s*c,this._onChangeCallback(),this}slerp(e,n){let i=e._x,r=e._y,s=e._z,o=e._w,a=this.dot(e);a<0&&(i=-i,r=-r,s=-s,o=-o,a=-a);let l=1-n;if(a<.9995){const c=Math.acos(a),d=Math.sin(c);l=Math.sin(l*c)/d,n=Math.sin(n*c)/d,this._x=this._x*l+i*n,this._y=this._y*l+r*n,this._z=this._z*l+s*n,this._w=this._w*l+o*n,this._onChangeCallback()}else this._x=this._x*l+i*n,this._y=this._y*l+r*n,this._z=this._z*l+s*n,this._w=this._w*l+o*n,this.normalize();return this}slerpQuaternions(e,n,i){return this.copy(e).slerp(n,i)}random(){const e=2*Math.PI*Math.random(),n=2*Math.PI*Math.random(),i=Math.random(),r=Math.sqrt(1-i),s=Math.sqrt(i);return this.set(r*Math.sin(e),r*Math.cos(e),s*Math.sin(n),s*Math.cos(n))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,n=0){return this._x=e[n],this._y=e[n+1],this._z=e[n+2],this._w=e[n+3],this._onChangeCallback(),this}toArray(e=[],n=0){return e[n]=this._x,e[n+1]=this._y,e[n+2]=this._z,e[n+3]=this._w,e}fromBufferAttribute(e,n){return this._x=e.getX(n),this._y=e.getY(n),this._z=e.getZ(n),this._w=e.getW(n),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}const wh=class wh{constructor(e=0,n=0,i=0){this.x=e,this.y=n,this.z=i}set(e,n,i){return i===void 0&&(i=this.z),this.x=e,this.y=n,this.z=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,n){switch(e){case 0:this.x=n;break;case 1:this.y=n;break;case 2:this.z=n;break;default:throw new Error("THREE.Vector3: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,n){return this.x=e.x+n.x,this.y=e.y+n.y,this.z=e.z+n.z,this}addScaledVector(e,n){return this.x+=e.x*n,this.y+=e.y*n,this.z+=e.z*n,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,n){return this.x=e.x-n.x,this.y=e.y-n.y,this.z=e.z-n.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,n){return this.x=e.x*n.x,this.y=e.y*n.y,this.z=e.z*n.z,this}applyEuler(e){return this.applyQuaternion(tp.setFromEuler(e))}applyAxisAngle(e,n){return this.applyQuaternion(tp.setFromAxisAngle(e,n))}applyMatrix3(e){const n=this.x,i=this.y,r=this.z,s=e.elements;return this.x=s[0]*n+s[3]*i+s[6]*r,this.y=s[1]*n+s[4]*i+s[7]*r,this.z=s[2]*n+s[5]*i+s[8]*r,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){const n=this.x,i=this.y,r=this.z,s=e.elements,o=1/(s[3]*n+s[7]*i+s[11]*r+s[15]);return this.x=(s[0]*n+s[4]*i+s[8]*r+s[12])*o,this.y=(s[1]*n+s[5]*i+s[9]*r+s[13])*o,this.z=(s[2]*n+s[6]*i+s[10]*r+s[14])*o,this}applyQuaternion(e){const n=this.x,i=this.y,r=this.z,s=e.x,o=e.y,a=e.z,l=e.w,c=2*(o*r-a*i),d=2*(a*n-s*r),h=2*(s*i-o*n);return this.x=n+l*c+o*h-a*d,this.y=i+l*d+a*c-s*h,this.z=r+l*h+s*d-o*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){const n=this.x,i=this.y,r=this.z,s=e.elements;return this.x=s[0]*n+s[4]*i+s[8]*r,this.y=s[1]*n+s[5]*i+s[9]*r,this.z=s[2]*n+s[6]*i+s[10]*r,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,n){return this.x=Je(this.x,e.x,n.x),this.y=Je(this.y,e.y,n.y),this.z=Je(this.z,e.z,n.z),this}clampScalar(e,n){return this.x=Je(this.x,e,n),this.y=Je(this.y,e,n),this.z=Je(this.z,e,n),this}clampLength(e,n){const i=this.length();return this.divideScalar(i||1).multiplyScalar(Je(i,e,n))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,n){return this.x+=(e.x-this.x)*n,this.y+=(e.y-this.y)*n,this.z+=(e.z-this.z)*n,this}lerpVectors(e,n,i){return this.x=e.x+(n.x-e.x)*i,this.y=e.y+(n.y-e.y)*i,this.z=e.z+(n.z-e.z)*i,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,n){const i=e.x,r=e.y,s=e.z,o=n.x,a=n.y,l=n.z;return this.x=r*l-s*a,this.y=s*o-i*l,this.z=i*a-r*o,this}projectOnVector(e){const n=e.lengthSq();if(n===0)return this.set(0,0,0);const i=e.dot(this)/n;return this.copy(e).multiplyScalar(i)}projectOnPlane(e){return Eu.copy(this).projectOnVector(e),this.sub(Eu)}reflect(e){return this.sub(Eu.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){const n=Math.sqrt(this.lengthSq()*e.lengthSq());if(n===0)return Math.PI/2;const i=this.dot(e)/n;return Math.acos(Je(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const n=this.x-e.x,i=this.y-e.y,r=this.z-e.z;return n*n+i*i+r*r}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,n,i){const r=Math.sin(n)*e;return this.x=r*Math.sin(i),this.y=Math.cos(n)*e,this.z=r*Math.cos(i),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,n,i){return this.x=e*Math.sin(n),this.y=i,this.z=e*Math.cos(n),this}setFromMatrixPosition(e){const n=e.elements;return this.x=n[12],this.y=n[13],this.z=n[14],this}setFromMatrixScale(e){const n=this.setFromMatrixColumn(e,0).length(),i=this.setFromMatrixColumn(e,1).length(),r=this.setFromMatrixColumn(e,2).length();return this.x=n,this.y=i,this.z=r,this}setFromMatrixColumn(e,n){return this.fromArray(e.elements,n*4)}setFromMatrix3Column(e,n){return this.fromArray(e.elements,n*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,n=0){return this.x=e[n],this.y=e[n+1],this.z=e[n+2],this}toArray(e=[],n=0){return e[n]=this.x,e[n+1]=this.y,e[n+2]=this.z,e}fromBufferAttribute(e,n){return this.x=e.getX(n),this.y=e.getY(n),this.z=e.getZ(n),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const e=Math.random()*Math.PI*2,n=Math.random()*2-1,i=Math.sqrt(1-n*n);return this.x=i*Math.cos(e),this.y=n,this.z=i*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}};wh.prototype.isVector3=!0;let U=wh;const Eu=new U,tp=new Bi,Ah=class Ah{constructor(e,n,i,r,s,o,a,l,c){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,n,i,r,s,o,a,l,c)}set(e,n,i,r,s,o,a,l,c){const d=this.elements;return d[0]=e,d[1]=r,d[2]=a,d[3]=n,d[4]=s,d[5]=l,d[6]=i,d[7]=o,d[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){const n=this.elements,i=e.elements;return n[0]=i[0],n[1]=i[1],n[2]=i[2],n[3]=i[3],n[4]=i[4],n[5]=i[5],n[6]=i[6],n[7]=i[7],n[8]=i[8],this}extractBasis(e,n,i){return e.setFromMatrix3Column(this,0),n.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(e){const n=e.elements;return this.set(n[0],n[4],n[8],n[1],n[5],n[9],n[2],n[6],n[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,n){const i=e.elements,r=n.elements,s=this.elements,o=i[0],a=i[3],l=i[6],c=i[1],d=i[4],h=i[7],u=i[2],p=i[5],g=i[8],M=r[0],m=r[3],f=r[6],x=r[1],y=r[4],S=r[7],w=r[2],T=r[5],b=r[8];return s[0]=o*M+a*x+l*w,s[3]=o*m+a*y+l*T,s[6]=o*f+a*S+l*b,s[1]=c*M+d*x+h*w,s[4]=c*m+d*y+h*T,s[7]=c*f+d*S+h*b,s[2]=u*M+p*x+g*w,s[5]=u*m+p*y+g*T,s[8]=u*f+p*S+g*b,this}multiplyScalar(e){const n=this.elements;return n[0]*=e,n[3]*=e,n[6]*=e,n[1]*=e,n[4]*=e,n[7]*=e,n[2]*=e,n[5]*=e,n[8]*=e,this}determinant(){const e=this.elements,n=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],l=e[6],c=e[7],d=e[8];return n*o*d-n*a*c-i*s*d+i*a*l+r*s*c-r*o*l}invert(){const e=this.elements,n=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],l=e[6],c=e[7],d=e[8],h=d*o-a*c,u=a*l-d*s,p=c*s-o*l,g=n*h+i*u+r*p;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);const M=1/g;return e[0]=h*M,e[1]=(r*c-d*i)*M,e[2]=(a*i-r*o)*M,e[3]=u*M,e[4]=(d*n-r*l)*M,e[5]=(r*s-a*n)*M,e[6]=p*M,e[7]=(i*l-c*n)*M,e[8]=(o*n-i*s)*M,this}transpose(){let e;const n=this.elements;return e=n[1],n[1]=n[3],n[3]=e,e=n[2],n[2]=n[6],n[6]=e,e=n[5],n[5]=n[7],n[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){const n=this.elements;return e[0]=n[0],e[1]=n[3],e[2]=n[6],e[3]=n[1],e[4]=n[4],e[5]=n[7],e[6]=n[2],e[7]=n[5],e[8]=n[8],this}setUvTransform(e,n,i,r,s,o,a){const l=Math.cos(s),c=Math.sin(s);return this.set(i*l,i*c,-i*(l*o+c*a)+o+e,-r*c,r*l,-r*(-c*o+l*a)+a+n,0,0,1),this}scale(e,n){return qr("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(Tu.makeScale(e,n)),this}rotate(e){return qr("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(Tu.makeRotation(-e)),this}translate(e,n){return qr("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(Tu.makeTranslation(e,n)),this}makeTranslation(e,n){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,n,0,0,1),this}makeRotation(e){const n=Math.cos(e),i=Math.sin(e);return this.set(n,-i,0,i,n,0,0,0,1),this}makeScale(e,n){return this.set(e,0,0,0,n,0,0,0,1),this}equals(e){const n=this.elements,i=e.elements;for(let r=0;r<9;r++)if(n[r]!==i[r])return!1;return!0}fromArray(e,n=0){for(let i=0;i<9;i++)this.elements[i]=e[i+n];return this}toArray(e=[],n=0){const i=this.elements;return e[n]=i[0],e[n+1]=i[1],e[n+2]=i[2],e[n+3]=i[3],e[n+4]=i[4],e[n+5]=i[5],e[n+6]=i[6],e[n+7]=i[7],e[n+8]=i[8],e}clone(){return new this.constructor().fromArray(this.elements)}};Ah.prototype.isMatrix3=!0;let Ve=Ah;const Tu=new Ve,np=new Ve().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),ip=new Ve().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function Yv(){const t={enabled:!0,workingColorSpace:aa,spaces:{},convert:function(r,s,o){return this.enabled===!1||s===o||!s||!o||(this.spaces[s].transfer===ot&&(r.r=Si(r.r),r.g=Si(r.g),r.b=Si(r.b)),this.spaces[s].primaries!==this.spaces[o].primaries&&(r.applyMatrix3(this.spaces[s].toXYZ),r.applyMatrix3(this.spaces[o].fromXYZ)),this.spaces[o].transfer===ot&&(r.r=Qr(r.r),r.g=Qr(r.g),r.b=Qr(r.b))),r},workingToColorSpace:function(r,s){return this.convert(r,this.workingColorSpace,s)},colorSpaceToWorking:function(r,s){return this.convert(r,s,this.workingColorSpace)},getPrimaries:function(r){return this.spaces[r].primaries},getTransfer:function(r){return r===Fi?la:this.spaces[r].transfer},getToneMappingMode:function(r){return this.spaces[r].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(r,s=this.workingColorSpace){return r.fromArray(this.spaces[s].luminanceCoefficients)},define:function(r){Object.assign(this.spaces,r)},_getMatrix:function(r,s,o){return r.copy(this.spaces[s].toXYZ).multiply(this.spaces[o].fromXYZ)},_getDrawingBufferColorSpace:function(r){return this.spaces[r].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(r=this.workingColorSpace){return this.spaces[r].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(r,s){return qr("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),t.workingToColorSpace(r,s)},toWorkingColorSpace:function(r,s){return qr("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),t.colorSpaceToWorking(r,s)}},e=[.64,.33,.3,.6,.15,.06],n=[.2126,.7152,.0722],i=[.3127,.329];return t.define({[aa]:{primaries:e,whitePoint:i,transfer:la,toXYZ:np,fromXYZ:ip,luminanceCoefficients:n,workingColorSpaceConfig:{unpackColorSpace:Cn},outputColorSpaceConfig:{drawingBufferColorSpace:Cn}},[Cn]:{primaries:e,whitePoint:i,transfer:ot,toXYZ:np,fromXYZ:ip,luminanceCoefficients:n,outputColorSpaceConfig:{drawingBufferColorSpace:Cn}}}),t}const $e=Yv();function Si(t){return t<.04045?t*.0773993808:Math.pow(t*.9478672986+.0521327014,2.4)}function Qr(t){return t<.0031308?t*12.92:1.055*Math.pow(t,.41666)-.055}let Jr;class Kv{static getDataURL(e,n="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let i;if(e instanceof HTMLCanvasElement)i=e;else{Jr===void 0&&(Jr=ca("canvas")),Jr.width=e.width,Jr.height=e.height;const r=Jr.getContext("2d");e instanceof ImageData?r.putImageData(e,0,0):r.drawImage(e,0,0,e.width,e.height),i=Jr}return i.toDataURL(n)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){const n=ca("canvas");n.width=e.width,n.height=e.height;const i=n.getContext("2d");i.drawImage(e,0,0,e.width,e.height);const r=i.getImageData(0,0,e.width,e.height),s=r.data;for(let o=0;o<s.length;o++)s[o]=Si(s[o]/255)*255;return i.putImageData(r,0,0),n}else if(e.data){const n=e.data.slice(0);for(let i=0;i<n.length;i++)n instanceof Uint8Array||n instanceof Uint8ClampedArray?n[i]=Math.floor(Si(n[i]/255)*255):n[i]=Si(n[i]);return{data:n,width:e.width,height:e.height}}else return Ne("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}}let Zv=0;class wu{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:Zv++}),this.uuid=Zs(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){const n=this.data;return typeof HTMLVideoElement<"u"&&n instanceof HTMLVideoElement?e.set(n.videoWidth,n.videoHeight,0):typeof VideoFrame<"u"&&n instanceof VideoFrame?e.set(n.displayWidth,n.displayHeight,0):n!==null?e.set(n.width,n.height,n.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){const n=e===void 0||typeof e=="string";if(!n&&e.images[this.uuid]!==void 0)return e.images[this.uuid];const i={uuid:this.uuid,url:""},r=this.data;if(r!==null){let s;if(Array.isArray(r)){s=[];for(let o=0,a=r.length;o<a;o++)r[o].isDataTexture?s.push(Au(r[o].image)):s.push(Au(r[o]))}else s=Au(r);i.url=s}return n||(e.images[this.uuid]=i),i}}function Au(t){return typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap?Kv.getDataURL(t):t.data?{data:Array.from(t.data),width:t.width,height:t.height,type:t.data.constructor.name}:(Ne("Texture: Unable to serialize Texture."),{})}let qv=0;const Ru=new U;class on extends Oi{constructor(e=on.DEFAULT_IMAGE,n=on.DEFAULT_MAPPING,i=fn,r=fn,s=Dt,o=xr,a=bn,l=sn,c=on.DEFAULT_ANISOTROPY,d=Fi){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:qv++}),this.uuid=Zs(),this.name="",this.source=new wu(e),this.mipmaps=[],this.mapping=n,this.channel=0,this.wrapS=i,this.wrapT=r,this.magFilter=s,this.minFilter=o,this.anisotropy=c,this.format=a,this.internalFormat=null,this.type=l,this.offset=new ze(0,0),this.repeat=new ze(1,1),this.center=new ze(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Ve,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=d,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(Ru).x}get height(){return this.source.getSize(Ru).y}get depth(){return this.source.getSize(Ru).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,n){this.updateRanges.push({start:e,count:n})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(const n in e){const i=e[n];if(i===void 0){Ne(`Texture.setValues(): parameter '${n}' has value of undefined.`);continue}const r=this[n];if(r===void 0){Ne(`Texture.setValues(): property '${n}' does not exist.`);continue}r&&i&&r.isVector2&&i.isVector2||r&&i&&r.isVector3&&i.isVector3||r&&i&&r.isMatrix3&&i.isMatrix3?r.copy(i):this[n]=i}}toJSON(e){const n=e===void 0||typeof e=="string";if(!n&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];const i={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(i.userData=this.userData),n||(e.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==Gh)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case Lc:e.x=e.x-Math.floor(e.x);break;case fn:e.x=e.x<0?0:1;break;case Dc:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case Lc:e.y=e.y-Math.floor(e.y);break;case fn:e.y=e.y<0?0:1;break;case Dc:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}}on.DEFAULT_IMAGE=null,on.DEFAULT_MAPPING=Gh,on.DEFAULT_ANISOTROPY=1;const Rh=class Rh{constructor(e=0,n=0,i=0,r=1){this.x=e,this.y=n,this.z=i,this.w=r}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,n,i,r){return this.x=e,this.y=n,this.z=i,this.w=r,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,n){switch(e){case 0:this.x=n;break;case 1:this.y=n;break;case 2:this.z=n;break;case 3:this.w=n;break;default:throw new Error("THREE.Vector4: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,n){return this.x=e.x+n.x,this.y=e.y+n.y,this.z=e.z+n.z,this.w=e.w+n.w,this}addScaledVector(e,n){return this.x+=e.x*n,this.y+=e.y*n,this.z+=e.z*n,this.w+=e.w*n,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,n){return this.x=e.x-n.x,this.y=e.y-n.y,this.z=e.z-n.z,this.w=e.w-n.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){const n=this.x,i=this.y,r=this.z,s=this.w,o=e.elements;return this.x=o[0]*n+o[4]*i+o[8]*r+o[12]*s,this.y=o[1]*n+o[5]*i+o[9]*r+o[13]*s,this.z=o[2]*n+o[6]*i+o[10]*r+o[14]*s,this.w=o[3]*n+o[7]*i+o[11]*r+o[15]*s,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);const n=Math.sqrt(1-e.w*e.w);return n<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/n,this.y=e.y/n,this.z=e.z/n),this}setAxisAngleFromRotationMatrix(e){let n,i,r,s;const l=e.elements,c=l[0],d=l[4],h=l[8],u=l[1],p=l[5],g=l[9],M=l[2],m=l[6],f=l[10];if(Math.abs(d-u)<.01&&Math.abs(h-M)<.01&&Math.abs(g-m)<.01){if(Math.abs(d+u)<.1&&Math.abs(h+M)<.1&&Math.abs(g+m)<.1&&Math.abs(c+p+f-3)<.1)return this.set(1,0,0,0),this;n=Math.PI;const y=(c+1)/2,S=(p+1)/2,w=(f+1)/2,T=(d+u)/4,b=(h+M)/4,_=(g+m)/4;return y>S&&y>w?y<.01?(i=0,r=.707106781,s=.707106781):(i=Math.sqrt(y),r=T/i,s=b/i):S>w?S<.01?(i=.707106781,r=0,s=.707106781):(r=Math.sqrt(S),i=T/r,s=_/r):w<.01?(i=.707106781,r=.707106781,s=0):(s=Math.sqrt(w),i=b/s,r=_/s),this.set(i,r,s,n),this}let x=Math.sqrt((m-g)*(m-g)+(h-M)*(h-M)+(u-d)*(u-d));return Math.abs(x)<.001&&(x=1),this.x=(m-g)/x,this.y=(h-M)/x,this.z=(u-d)/x,this.w=Math.acos((c+p+f-1)/2),this}setFromMatrixPosition(e){const n=e.elements;return this.x=n[12],this.y=n[13],this.z=n[14],this.w=n[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,n){return this.x=Je(this.x,e.x,n.x),this.y=Je(this.y,e.y,n.y),this.z=Je(this.z,e.z,n.z),this.w=Je(this.w,e.w,n.w),this}clampScalar(e,n){return this.x=Je(this.x,e,n),this.y=Je(this.y,e,n),this.z=Je(this.z,e,n),this.w=Je(this.w,e,n),this}clampLength(e,n){const i=this.length();return this.divideScalar(i||1).multiplyScalar(Je(i,e,n))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,n){return this.x+=(e.x-this.x)*n,this.y+=(e.y-this.y)*n,this.z+=(e.z-this.z)*n,this.w+=(e.w-this.w)*n,this}lerpVectors(e,n,i){return this.x=e.x+(n.x-e.x)*i,this.y=e.y+(n.y-e.y)*i,this.z=e.z+(n.z-e.z)*i,this.w=e.w+(n.w-e.w)*i,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,n=0){return this.x=e[n],this.y=e[n+1],this.z=e[n+2],this.w=e[n+3],this}toArray(e=[],n=0){return e[n]=this.x,e[n+1]=this.y,e[n+2]=this.z,e[n+3]=this.w,e}fromBufferAttribute(e,n){return this.x=e.getX(n),this.y=e.getY(n),this.z=e.getZ(n),this.w=e.getW(n),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}};Rh.prototype.isVector4=!0;let St=Rh;class Qv extends Oi{constructor(e=1,n=1,i={}){super(),i=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Dt,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},i),this.isRenderTarget=!0,this.width=e,this.height=n,this.depth=i.depth,this.scissor=new St(0,0,e,n),this.scissorTest=!1,this.viewport=new St(0,0,e,n),this.textures=[];const r={width:e,height:n,depth:i.depth},s=new on(r),o=i.count;for(let a=0;a<o;a++)this.textures[a]=s.clone(),this.textures[a].isRenderTargetTexture=!0,this.textures[a].renderTarget=this;this._setTextureOptions(i),this.depthBuffer=i.depthBuffer,this.stencilBuffer=i.stencilBuffer,this.resolveDepthBuffer=i.resolveDepthBuffer,this.resolveStencilBuffer=i.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=i.depthTexture,this.samples=i.samples,this.multiview=i.multiview,this.useArrayDepthTexture=i.useArrayDepthTexture}_setTextureOptions(e={}){const n={minFilter:Dt,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(n.mapping=e.mapping),e.wrapS!==void 0&&(n.wrapS=e.wrapS),e.wrapT!==void 0&&(n.wrapT=e.wrapT),e.wrapR!==void 0&&(n.wrapR=e.wrapR),e.magFilter!==void 0&&(n.magFilter=e.magFilter),e.minFilter!==void 0&&(n.minFilter=e.minFilter),e.format!==void 0&&(n.format=e.format),e.type!==void 0&&(n.type=e.type),e.anisotropy!==void 0&&(n.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(n.colorSpace=e.colorSpace),e.flipY!==void 0&&(n.flipY=e.flipY),e.generateMipmaps!==void 0&&(n.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(n.internalFormat=e.internalFormat);for(let i=0;i<this.textures.length;i++)this.textures[i].setValues(n)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),e!==null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,n,i=1){if(this.width!==e||this.height!==n||this.depth!==i){this.width=e,this.height=n,this.depth=i;for(let r=0,s=this.textures.length;r<s;r++)this.textures[r].image.width=e,this.textures[r].image.height=n,this.textures[r].image.depth=i,this.textures[r].isData3DTexture!==!0&&(this.textures[r].isArrayTexture=this.textures[r].image.depth>1);this.dispose()}this.viewport.set(0,0,e,n),this.scissor.set(0,0,e,n)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let n=0,i=e.textures.length;n<i;n++){this.textures[n]=e.textures[n].clone(),this.textures[n].isRenderTargetTexture=!0,this.textures[n].renderTarget=this;const r=Object.assign({},e.textures[n].image);this.textures[n].source=new wu(r)}return this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}}class ri extends Qv{constructor(e=1,n=1,i={}){super(e,n,i),this.isWebGLRenderTarget=!0}}class rp extends on{constructor(e=null,n=1,i=1,r=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:n,height:i,depth:r},this.magFilter=Wt,this.minFilter=Wt,this.wrapR=fn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}}class sp extends on{constructor(e=null,n=1,i=1,r=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:n,height:i,depth:r},this.magFilter=Wt,this.minFilter=Wt,this.wrapR=fn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}const gc=class gc{constructor(e,n,i,r,s,o,a,l,c,d,h,u,p,g,M,m){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,n,i,r,s,o,a,l,c,d,h,u,p,g,M,m)}set(e,n,i,r,s,o,a,l,c,d,h,u,p,g,M,m){const f=this.elements;return f[0]=e,f[4]=n,f[8]=i,f[12]=r,f[1]=s,f[5]=o,f[9]=a,f[13]=l,f[2]=c,f[6]=d,f[10]=h,f[14]=u,f[3]=p,f[7]=g,f[11]=M,f[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new gc().fromArray(this.elements)}copy(e){const n=this.elements,i=e.elements;return n[0]=i[0],n[1]=i[1],n[2]=i[2],n[3]=i[3],n[4]=i[4],n[5]=i[5],n[6]=i[6],n[7]=i[7],n[8]=i[8],n[9]=i[9],n[10]=i[10],n[11]=i[11],n[12]=i[12],n[13]=i[13],n[14]=i[14],n[15]=i[15],this}copyPosition(e){const n=this.elements,i=e.elements;return n[12]=i[12],n[13]=i[13],n[14]=i[14],this}setFromMatrix3(e){const n=e.elements;return this.set(n[0],n[3],n[6],0,n[1],n[4],n[7],0,n[2],n[5],n[8],0,0,0,0,1),this}extractBasis(e,n,i){return this.determinantAffine()===0?(e.set(1,0,0),n.set(0,1,0),i.set(0,0,1),this):(e.setFromMatrixColumn(this,0),n.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this)}makeBasis(e,n,i){return this.set(e.x,n.x,i.x,0,e.y,n.y,i.y,0,e.z,n.z,i.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();const n=this.elements,i=e.elements,r=1/jr.setFromMatrixColumn(e,0).length(),s=1/jr.setFromMatrixColumn(e,1).length(),o=1/jr.setFromMatrixColumn(e,2).length();return n[0]=i[0]*r,n[1]=i[1]*r,n[2]=i[2]*r,n[3]=0,n[4]=i[4]*s,n[5]=i[5]*s,n[6]=i[6]*s,n[7]=0,n[8]=i[8]*o,n[9]=i[9]*o,n[10]=i[10]*o,n[11]=0,n[12]=0,n[13]=0,n[14]=0,n[15]=1,this}makeRotationFromEuler(e){const n=this.elements,i=e.x,r=e.y,s=e.z,o=Math.cos(i),a=Math.sin(i),l=Math.cos(r),c=Math.sin(r),d=Math.cos(s),h=Math.sin(s);if(e.order==="XYZ"){const u=o*d,p=o*h,g=a*d,M=a*h;n[0]=l*d,n[4]=-l*h,n[8]=c,n[1]=p+g*c,n[5]=u-M*c,n[9]=-a*l,n[2]=M-u*c,n[6]=g+p*c,n[10]=o*l}else if(e.order==="YXZ"){const u=l*d,p=l*h,g=c*d,M=c*h;n[0]=u+M*a,n[4]=g*a-p,n[8]=o*c,n[1]=o*h,n[5]=o*d,n[9]=-a,n[2]=p*a-g,n[6]=M+u*a,n[10]=o*l}else if(e.order==="ZXY"){const u=l*d,p=l*h,g=c*d,M=c*h;n[0]=u-M*a,n[4]=-o*h,n[8]=g+p*a,n[1]=p+g*a,n[5]=o*d,n[9]=M-u*a,n[2]=-o*c,n[6]=a,n[10]=o*l}else if(e.order==="ZYX"){const u=o*d,p=o*h,g=a*d,M=a*h;n[0]=l*d,n[4]=g*c-p,n[8]=u*c+M,n[1]=l*h,n[5]=M*c+u,n[9]=p*c-g,n[2]=-c,n[6]=a*l,n[10]=o*l}else if(e.order==="YZX"){const u=o*l,p=o*c,g=a*l,M=a*c;n[0]=l*d,n[4]=M-u*h,n[8]=g*h+p,n[1]=h,n[5]=o*d,n[9]=-a*d,n[2]=-c*d,n[6]=p*h+g,n[10]=u-M*h}else if(e.order==="XZY"){const u=o*l,p=o*c,g=a*l,M=a*c;n[0]=l*d,n[4]=-h,n[8]=c*d,n[1]=u*h+M,n[5]=o*d,n[9]=p*h-g,n[2]=g*h-p,n[6]=a*d,n[10]=M*h+u}return n[3]=0,n[7]=0,n[11]=0,n[12]=0,n[13]=0,n[14]=0,n[15]=1,this}makeRotationFromQuaternion(e){return this.compose(Jv,e,jv)}lookAt(e,n,i){const r=this.elements;return xn.subVectors(e,n),xn.lengthSq()===0&&(xn.z=1),xn.normalize(),ki.crossVectors(i,xn),ki.lengthSq()===0&&(Math.abs(i.z)===1?xn.x+=1e-4:xn.z+=1e-4,xn.normalize(),ki.crossVectors(i,xn)),ki.normalize(),fa.crossVectors(xn,ki),r[0]=ki.x,r[4]=fa.x,r[8]=xn.x,r[1]=ki.y,r[5]=fa.y,r[9]=xn.y,r[2]=ki.z,r[6]=fa.z,r[10]=xn.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,n){const i=e.elements,r=n.elements,s=this.elements,o=i[0],a=i[4],l=i[8],c=i[12],d=i[1],h=i[5],u=i[9],p=i[13],g=i[2],M=i[6],m=i[10],f=i[14],x=i[3],y=i[7],S=i[11],w=i[15],T=r[0],b=r[4],_=r[8],A=r[12],C=r[1],P=r[5],D=r[9],W=r[13],Z=r[2],B=r[6],X=r[10],H=r[14],L=r[3],k=r[7],Y=r[11],$=r[15];return s[0]=o*T+a*C+l*Z+c*L,s[4]=o*b+a*P+l*B+c*k,s[8]=o*_+a*D+l*X+c*Y,s[12]=o*A+a*W+l*H+c*$,s[1]=d*T+h*C+u*Z+p*L,s[5]=d*b+h*P+u*B+p*k,s[9]=d*_+h*D+u*X+p*Y,s[13]=d*A+h*W+u*H+p*$,s[2]=g*T+M*C+m*Z+f*L,s[6]=g*b+M*P+m*B+f*k,s[10]=g*_+M*D+m*X+f*Y,s[14]=g*A+M*W+m*H+f*$,s[3]=x*T+y*C+S*Z+w*L,s[7]=x*b+y*P+S*B+w*k,s[11]=x*_+y*D+S*X+w*Y,s[15]=x*A+y*W+S*H+w*$,this}multiplyScalar(e){const n=this.elements;return n[0]*=e,n[4]*=e,n[8]*=e,n[12]*=e,n[1]*=e,n[5]*=e,n[9]*=e,n[13]*=e,n[2]*=e,n[6]*=e,n[10]*=e,n[14]*=e,n[3]*=e,n[7]*=e,n[11]*=e,n[15]*=e,this}determinant(){const e=this.elements,n=e[0],i=e[4],r=e[8],s=e[12],o=e[1],a=e[5],l=e[9],c=e[13],d=e[2],h=e[6],u=e[10],p=e[14],g=e[3],M=e[7],m=e[11],f=e[15],x=l*p-c*u,y=a*p-c*h,S=a*u-l*h,w=o*p-c*d,T=o*u-l*d,b=o*h-a*d;return n*(M*x-m*y+f*S)-i*(g*x-m*w+f*T)+r*(g*y-M*w+f*b)-s*(g*S-M*T+m*b)}determinantAffine(){const e=this.elements,n=e[0],i=e[4],r=e[8],s=e[1],o=e[5],a=e[9],l=e[2],c=e[6],d=e[10];return n*(o*d-a*c)-i*(s*d-a*l)+r*(s*c-o*l)}transpose(){const e=this.elements;let n;return n=e[1],e[1]=e[4],e[4]=n,n=e[2],e[2]=e[8],e[8]=n,n=e[6],e[6]=e[9],e[9]=n,n=e[3],e[3]=e[12],e[12]=n,n=e[7],e[7]=e[13],e[13]=n,n=e[11],e[11]=e[14],e[14]=n,this}setPosition(e,n,i){const r=this.elements;return e.isVector3?(r[12]=e.x,r[13]=e.y,r[14]=e.z):(r[12]=e,r[13]=n,r[14]=i),this}invert(){const e=this.elements,n=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],l=e[6],c=e[7],d=e[8],h=e[9],u=e[10],p=e[11],g=e[12],M=e[13],m=e[14],f=e[15],x=n*a-i*o,y=n*l-r*o,S=n*c-s*o,w=i*l-r*a,T=i*c-s*a,b=r*c-s*l,_=d*M-h*g,A=d*m-u*g,C=d*f-p*g,P=h*m-u*M,D=h*f-p*M,W=u*f-p*m,Z=x*W-y*D+S*P+w*C-T*A+b*_;if(Z===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const B=1/Z;return e[0]=(a*W-l*D+c*P)*B,e[1]=(r*D-i*W-s*P)*B,e[2]=(M*b-m*T+f*w)*B,e[3]=(u*T-h*b-p*w)*B,e[4]=(l*C-o*W-c*A)*B,e[5]=(n*W-r*C+s*A)*B,e[6]=(m*S-g*b-f*y)*B,e[7]=(d*b-u*S+p*y)*B,e[8]=(o*D-a*C+c*_)*B,e[9]=(i*C-n*D-s*_)*B,e[10]=(g*T-M*S+f*x)*B,e[11]=(h*S-d*T-p*x)*B,e[12]=(a*A-o*P-l*_)*B,e[13]=(n*P-i*A+r*_)*B,e[14]=(M*y-g*w-m*x)*B,e[15]=(d*w-h*y+u*x)*B,this}scale(e){const n=this.elements,i=e.x,r=e.y,s=e.z;return n[0]*=i,n[4]*=r,n[8]*=s,n[1]*=i,n[5]*=r,n[9]*=s,n[2]*=i,n[6]*=r,n[10]*=s,n[3]*=i,n[7]*=r,n[11]*=s,this}getMaxScaleOnAxis(){const e=this.elements,n=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],i=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],r=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(n,i,r))}makeTranslation(e,n,i){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,n,0,0,1,i,0,0,0,1),this}makeRotationX(e){const n=Math.cos(e),i=Math.sin(e);return this.set(1,0,0,0,0,n,-i,0,0,i,n,0,0,0,0,1),this}makeRotationY(e){const n=Math.cos(e),i=Math.sin(e);return this.set(n,0,i,0,0,1,0,0,-i,0,n,0,0,0,0,1),this}makeRotationZ(e){const n=Math.cos(e),i=Math.sin(e);return this.set(n,-i,0,0,i,n,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,n){const i=Math.cos(n),r=Math.sin(n),s=1-i,o=e.x,a=e.y,l=e.z,c=s*o,d=s*a;return this.set(c*o+i,c*a-r*l,c*l+r*a,0,c*a+r*l,d*a+i,d*l-r*o,0,c*l-r*a,d*l+r*o,s*l*l+i,0,0,0,0,1),this}makeScale(e,n,i){return this.set(e,0,0,0,0,n,0,0,0,0,i,0,0,0,0,1),this}makeShear(e,n,i,r,s,o){return this.set(1,i,s,0,e,1,o,0,n,r,1,0,0,0,0,1),this}compose(e,n,i){const r=this.elements,s=n._x,o=n._y,a=n._z,l=n._w,c=s+s,d=o+o,h=a+a,u=s*c,p=s*d,g=s*h,M=o*d,m=o*h,f=a*h,x=l*c,y=l*d,S=l*h,w=i.x,T=i.y,b=i.z;return r[0]=(1-(M+f))*w,r[1]=(p+S)*w,r[2]=(g-y)*w,r[3]=0,r[4]=(p-S)*T,r[5]=(1-(u+f))*T,r[6]=(m+x)*T,r[7]=0,r[8]=(g+y)*b,r[9]=(m-x)*b,r[10]=(1-(u+M))*b,r[11]=0,r[12]=e.x,r[13]=e.y,r[14]=e.z,r[15]=1,this}decompose(e,n,i){const r=this.elements;e.x=r[12],e.y=r[13],e.z=r[14];const s=this.determinantAffine();if(s===0)return i.set(1,1,1),n.identity(),this;let o=jr.set(r[0],r[1],r[2]).length();const a=jr.set(r[4],r[5],r[6]).length(),l=jr.set(r[8],r[9],r[10]).length();s<0&&(o=-o),Vn.copy(this);const c=1/o,d=1/a,h=1/l;return Vn.elements[0]*=c,Vn.elements[1]*=c,Vn.elements[2]*=c,Vn.elements[4]*=d,Vn.elements[5]*=d,Vn.elements[6]*=d,Vn.elements[8]*=h,Vn.elements[9]*=h,Vn.elements[10]*=h,n.setFromRotationMatrix(Vn),i.x=o,i.y=a,i.z=l,this}makePerspective(e,n,i,r,s,o,a=ii,l=!1){const c=this.elements,d=2*s/(n-e),h=2*s/(i-r),u=(n+e)/(n-e),p=(i+r)/(i-r);let g,M;if(l)g=s/(o-s),M=o*s/(o-s);else if(a===ii)g=-(o+s)/(o-s),M=-2*o*s/(o-s);else if(a===Ks)g=-o/(o-s),M=-o*s/(o-s);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return c[0]=d,c[4]=0,c[8]=u,c[12]=0,c[1]=0,c[5]=h,c[9]=p,c[13]=0,c[2]=0,c[6]=0,c[10]=g,c[14]=M,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,n,i,r,s,o,a=ii,l=!1){const c=this.elements,d=2/(n-e),h=2/(i-r),u=-(n+e)/(n-e),p=-(i+r)/(i-r);let g,M;if(l)g=1/(o-s),M=o/(o-s);else if(a===ii)g=-2/(o-s),M=-(o+s)/(o-s);else if(a===Ks)g=-1/(o-s),M=-s/(o-s);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return c[0]=d,c[4]=0,c[8]=0,c[12]=u,c[1]=0,c[5]=h,c[9]=0,c[13]=p,c[2]=0,c[6]=0,c[10]=g,c[14]=M,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){const n=this.elements,i=e.elements;for(let r=0;r<16;r++)if(n[r]!==i[r])return!1;return!0}fromArray(e,n=0){for(let i=0;i<16;i++)this.elements[i]=e[i+n];return this}toArray(e=[],n=0){const i=this.elements;return e[n]=i[0],e[n+1]=i[1],e[n+2]=i[2],e[n+3]=i[3],e[n+4]=i[4],e[n+5]=i[5],e[n+6]=i[6],e[n+7]=i[7],e[n+8]=i[8],e[n+9]=i[9],e[n+10]=i[10],e[n+11]=i[11],e[n+12]=i[12],e[n+13]=i[13],e[n+14]=i[14],e[n+15]=i[15],e}};gc.prototype.isMatrix4=!0;let vt=gc;const jr=new U,Vn=new vt,Jv=new U(0,0,0),jv=new U(1,1,1),ki=new U,fa=new U,xn=new U,op=new vt,ap=new Bi;class zi{constructor(e=0,n=0,i=0,r=zi.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=n,this._z=i,this._order=r}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,n,i,r=this._order){return this._x=e,this._y=n,this._z=i,this._order=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,n=this._order,i=!0){const r=e.elements,s=r[0],o=r[4],a=r[8],l=r[1],c=r[5],d=r[9],h=r[2],u=r[6],p=r[10];switch(n){case"XYZ":this._y=Math.asin(Je(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-d,p),this._z=Math.atan2(-o,s)):(this._x=Math.atan2(u,c),this._z=0);break;case"YXZ":this._x=Math.asin(-Je(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(a,p),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-h,s),this._z=0);break;case"ZXY":this._x=Math.asin(Je(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(-h,p),this._z=Math.atan2(-o,c)):(this._y=0,this._z=Math.atan2(l,s));break;case"ZYX":this._y=Math.asin(-Je(h,-1,1)),Math.abs(h)<.9999999?(this._x=Math.atan2(u,p),this._z=Math.atan2(l,s)):(this._x=0,this._z=Math.atan2(-o,c));break;case"YZX":this._z=Math.asin(Je(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-d,c),this._y=Math.atan2(-h,s)):(this._x=0,this._y=Math.atan2(a,p));break;case"XZY":this._z=Math.asin(-Je(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(u,c),this._y=Math.atan2(a,s)):(this._x=Math.atan2(-d,p),this._y=0);break;default:Ne("Euler: .setFromRotationMatrix() encountered an unknown order: "+n)}return this._order=n,i===!0&&this._onChangeCallback(),this}setFromQuaternion(e,n,i){return op.makeRotationFromQuaternion(e),this.setFromRotationMatrix(op,n,i)}setFromVector3(e,n=this._order){return this.set(e.x,e.y,e.z,n)}reorder(e){return ap.setFromEuler(this),this.setFromQuaternion(ap,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],n=0){return e[n]=this._x,e[n+1]=this._y,e[n+2]=this._z,e[n+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}zi.DEFAULT_ORDER="XYZ";class lp{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}}let $v=0;const cp=new U,$r=new Bi,yi=new vt,da=new U,Qs=new U,ex=new U,tx=new Bi,up=new U(1,0,0),fp=new U(0,1,0),dp=new U(0,0,1),hp={type:"added"},nx={type:"removed"},es={type:"childadded",child:null},bu={type:"childremoved",child:null};class Ut extends Oi{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:$v++}),this.uuid=Zs(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=Ut.DEFAULT_UP.clone();const e=new U,n=new zi,i=new Bi,r=new U(1,1,1);function s(){i.setFromEuler(n,!1)}function o(){n.setFromQuaternion(i,void 0,!1)}n._onChange(s),i._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:n},quaternion:{configurable:!0,enumerable:!0,value:i},scale:{configurable:!0,enumerable:!0,value:r},modelViewMatrix:{value:new vt},normalMatrix:{value:new Ve}}),this.matrix=new vt,this.matrixWorld=new vt,this.matrixAutoUpdate=Ut.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=Ut.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new lp,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,n){this.quaternion.setFromAxisAngle(e,n)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,n){return $r.setFromAxisAngle(e,n),this.quaternion.multiply($r),this}rotateOnWorldAxis(e,n){return $r.setFromAxisAngle(e,n),this.quaternion.premultiply($r),this}rotateX(e){return this.rotateOnAxis(up,e)}rotateY(e){return this.rotateOnAxis(fp,e)}rotateZ(e){return this.rotateOnAxis(dp,e)}translateOnAxis(e,n){return cp.copy(e).applyQuaternion(this.quaternion),this.position.add(cp.multiplyScalar(n)),this}translateX(e){return this.translateOnAxis(up,e)}translateY(e){return this.translateOnAxis(fp,e)}translateZ(e){return this.translateOnAxis(dp,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(yi.copy(this.matrixWorld).invert())}lookAt(e,n,i){e.isVector3?da.copy(e):da.set(e,n,i);const r=this.parent;this.updateWorldMatrix(!0,!1),Qs.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?yi.lookAt(Qs,da,this.up):yi.lookAt(da,Qs,this.up),this.quaternion.setFromRotationMatrix(yi),r&&(yi.extractRotation(r.matrixWorld),$r.setFromRotationMatrix(yi),this.quaternion.premultiply($r.invert()))}add(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.add(arguments[n]);return this}return e===this?(tt("Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(hp),es.child=e,this.dispatchEvent(es),es.child=null):tt("Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let i=0;i<arguments.length;i++)this.remove(arguments[i]);return this}const n=this.children.indexOf(e);return n!==-1&&(e.parent=null,this.children.splice(n,1),e.dispatchEvent(nx),bu.child=e,this.dispatchEvent(bu),bu.child=null),this}removeFromParent(){const e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),yi.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),yi.multiply(e.parent.matrixWorld)),e.applyMatrix4(yi),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(hp),es.child=e,this.dispatchEvent(es),es.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,n){if(this[e]===n)return this;for(let i=0,r=this.children.length;i<r;i++){const o=this.children[i].getObjectByProperty(e,n);if(o!==void 0)return o}}getObjectsByProperty(e,n,i=[]){this[e]===n&&i.push(this);const r=this.children;for(let s=0,o=r.length;s<o;s++)r[s].getObjectsByProperty(e,n,i);return i}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Qs,e,ex),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Qs,tx,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);const n=this.matrixWorld.elements;return e.set(n[8],n[9],n[10]).normalize()}raycast(){}traverse(e){e(this);const n=this.children;for(let i=0,r=n.length;i<r;i++)n[i].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);const n=this.children;for(let i=0,r=n.length;i<r;i++)n[i].traverseVisible(e)}traverseAncestors(e){const n=this.parent;n!==null&&(e(n),n.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);const e=this.pivot;if(e!==null){const n=e.x,i=e.y,r=e.z,s=this.matrix.elements;s[12]+=n-s[0]*n-s[4]*i-s[8]*r,s[13]+=i-s[1]*n-s[5]*i-s[9]*r,s[14]+=r-s[2]*n-s[6]*i-s[10]*r}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);const n=this.children;for(let i=0,r=n.length;i<r;i++)n[i].updateMatrixWorld(e)}updateWorldMatrix(e,n,i=!1){const r=this.parent;if(e===!0&&r!==null&&r.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||i)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,i=!0),n===!0){const s=this.children;for(let o=0,a=s.length;o<a;o++)s[o].updateWorldMatrix(!1,!0,i)}}toJSON(e){const n=e===void 0||typeof e=="string",i={};n&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},i.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});const r={};r.uuid=this.uuid,r.type=this.type,this.name!==""&&(r.name=this.name),this.castShadow===!0&&(r.castShadow=!0),this.receiveShadow===!0&&(r.receiveShadow=!0),this.visible===!1&&(r.visible=!1),this.frustumCulled===!1&&(r.frustumCulled=!1),this.renderOrder!==0&&(r.renderOrder=this.renderOrder),this.static!==!1&&(r.static=this.static),Object.keys(this.userData).length>0&&(r.userData=this.userData),r.layers=this.layers.mask,r.matrix=this.matrix.toArray(),r.up=this.up.toArray(),this.pivot!==null&&(r.pivot=this.pivot.toArray()),this.matrixAutoUpdate===!1&&(r.matrixAutoUpdate=!1),this.morphTargetDictionary!==void 0&&(r.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(r.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(r.type="InstancedMesh",r.count=this.count,r.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(r.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(r.type="BatchedMesh",r.perObjectFrustumCulled=this.perObjectFrustumCulled,r.sortObjects=this.sortObjects,r.drawRanges=this._drawRanges,r.reservedRanges=this._reservedRanges,r.geometryInfo=this._geometryInfo.map(a=>({...a,boundingBox:a.boundingBox?a.boundingBox.toJSON():void 0,boundingSphere:a.boundingSphere?a.boundingSphere.toJSON():void 0})),r.instanceInfo=this._instanceInfo.map(a=>({...a})),r.availableInstanceIds=this._availableInstanceIds.slice(),r.availableGeometryIds=this._availableGeometryIds.slice(),r.nextIndexStart=this._nextIndexStart,r.nextVertexStart=this._nextVertexStart,r.geometryCount=this._geometryCount,r.maxInstanceCount=this._maxInstanceCount,r.maxVertexCount=this._maxVertexCount,r.maxIndexCount=this._maxIndexCount,r.geometryInitialized=this._geometryInitialized,r.matricesTexture=this._matricesTexture.toJSON(e),r.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(r.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(r.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(r.boundingBox=this.boundingBox.toJSON()));function s(a,l){return a[l.uuid]===void 0&&(a[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?r.background=this.background.toJSON():this.background.isTexture&&(r.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(r.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){r.geometry=s(e.geometries,this.geometry);const a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){const l=a.shapes;if(Array.isArray(l))for(let c=0,d=l.length;c<d;c++){const h=l[c];s(e.shapes,h)}else s(e.shapes,l)}}if(this.isSkinnedMesh&&(r.bindMode=this.bindMode,r.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(s(e.skeletons,this.skeleton),r.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const a=[];for(let l=0,c=this.material.length;l<c;l++)a.push(s(e.materials,this.material[l]));r.material=a}else r.material=s(e.materials,this.material);if(this.children.length>0){r.children=[];for(let a=0;a<this.children.length;a++)r.children.push(this.children[a].toJSON(e).object)}if(this.animations.length>0){r.animations=[];for(let a=0;a<this.animations.length;a++){const l=this.animations[a];r.animations.push(s(e.animations,l))}}if(n){const a=o(e.geometries),l=o(e.materials),c=o(e.textures),d=o(e.images),h=o(e.shapes),u=o(e.skeletons),p=o(e.animations),g=o(e.nodes);a.length>0&&(i.geometries=a),l.length>0&&(i.materials=l),c.length>0&&(i.textures=c),d.length>0&&(i.images=d),h.length>0&&(i.shapes=h),u.length>0&&(i.skeletons=u),p.length>0&&(i.animations=p),g.length>0&&(i.nodes=g)}return i.object=r,i;function o(a){const l=[];for(const c in a){const d=a[c];delete d.metadata,l.push(d)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,n=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot!==null?e.pivot.clone():null,this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),n===!0)for(let i=0;i<e.children.length;i++){const r=e.children[i];this.add(r.clone())}return this}}Ut.DEFAULT_UP=new U(0,1,0),Ut.DEFAULT_MATRIX_AUTO_UPDATE=!0,Ut.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;class ha extends Ut{constructor(){super(),this.isGroup=!0,this.type="Group"}}const ix={type:"move"};class Cu{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new ha,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new ha,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new U,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new U),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new ha,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new U,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new U,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){const n=this._hand;if(n)for(const i of e.hand.values())this._getHandJoint(n,i)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,n,i){let r=null,s=null,o=null;const a=this._targetRay,l=this._grip,c=this._hand;if(e&&n.session.visibilityState!=="visible-blurred"){if(c&&e.hand){o=!0;for(const M of e.hand.values()){const m=n.getJointPose(M,i),f=this._getHandJoint(c,M);m!==null&&(f.matrix.fromArray(m.transform.matrix),f.matrix.decompose(f.position,f.rotation,f.scale),f.matrixWorldNeedsUpdate=!0,f.jointRadius=m.radius),f.visible=m!==null}const d=c.joints["index-finger-tip"],h=c.joints["thumb-tip"],u=d.position.distanceTo(h.position),p=.02,g=.005;c.inputState.pinching&&u>p+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&u<=p-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(s=n.getPose(e.gripSpace,i),s!==null&&(l.matrix.fromArray(s.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,s.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(s.linearVelocity)):l.hasLinearVelocity=!1,s.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(s.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:e,target:this})));a!==null&&(r=n.getPose(e.targetRaySpace,i),r===null&&s!==null&&(r=s),r!==null&&(a.matrix.fromArray(r.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,r.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(r.linearVelocity)):a.hasLinearVelocity=!1,r.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(r.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(ix)))}return a!==null&&(a.visible=r!==null),l!==null&&(l.visible=s!==null),c!==null&&(c.visible=o!==null),this}_getHandJoint(e,n){if(e.joints[n.jointName]===void 0){const i=new ha;i.matrixAutoUpdate=!1,i.visible=!1,e.joints[n.jointName]=i,e.add(i)}return e.joints[n.jointName]}}const pp={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Vi={h:0,s:0,l:0},pa={h:0,s:0,l:0};function Pu(t,e,n){return n<0&&(n+=1),n>1&&(n-=1),n<1/6?t+(e-t)*6*n:n<1/2?e:n<2/3?t+(e-t)*6*(2/3-n):t}class Ke{constructor(e,n,i){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,n,i)}set(e,n,i){if(n===void 0&&i===void 0){const r=e;r&&r.isColor?this.copy(r):typeof r=="number"?this.setHex(r):typeof r=="string"&&this.setStyle(r)}else this.setRGB(e,n,i);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,n=Cn){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,$e.colorSpaceToWorking(this,n),this}setRGB(e,n,i,r=$e.workingColorSpace){return this.r=e,this.g=n,this.b=i,$e.colorSpaceToWorking(this,r),this}setHSL(e,n,i,r=$e.workingColorSpace){if(e=Wv(e,1),n=Je(n,0,1),i=Je(i,0,1),n===0)this.r=this.g=this.b=i;else{const s=i<=.5?i*(1+n):i+n-i*n,o=2*i-s;this.r=Pu(o,s,e+1/3),this.g=Pu(o,s,e),this.b=Pu(o,s,e-1/3)}return $e.colorSpaceToWorking(this,r),this}setStyle(e,n=Cn){function i(s){s!==void 0&&parseFloat(s)<1&&Ne("Color: Alpha component of "+e+" will be ignored.")}let r;if(r=/^(\w+)\(([^\)]*)\)/.exec(e)){let s;const o=r[1],a=r[2];switch(o){case"rgb":case"rgba":if(s=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setRGB(Math.min(255,parseInt(s[1],10))/255,Math.min(255,parseInt(s[2],10))/255,Math.min(255,parseInt(s[3],10))/255,n);if(s=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setRGB(Math.min(100,parseInt(s[1],10))/100,Math.min(100,parseInt(s[2],10))/100,Math.min(100,parseInt(s[3],10))/100,n);break;case"hsl":case"hsla":if(s=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setHSL(parseFloat(s[1])/360,parseFloat(s[2])/100,parseFloat(s[3])/100,n);break;default:Ne("Color: Unknown color model "+e)}}else if(r=/^\#([A-Fa-f\d]+)$/.exec(e)){const s=r[1],o=s.length;if(o===3)return this.setRGB(parseInt(s.charAt(0),16)/15,parseInt(s.charAt(1),16)/15,parseInt(s.charAt(2),16)/15,n);if(o===6)return this.setHex(parseInt(s,16),n);Ne("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,n);return this}setColorName(e,n=Cn){const i=pp[e.toLowerCase()];return i!==void 0?this.setHex(i,n):Ne("Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Si(e.r),this.g=Si(e.g),this.b=Si(e.b),this}copyLinearToSRGB(e){return this.r=Qr(e.r),this.g=Qr(e.g),this.b=Qr(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=Cn){return $e.workingToColorSpace(Qt.copy(this),e),Math.round(Je(Qt.r*255,0,255))*65536+Math.round(Je(Qt.g*255,0,255))*256+Math.round(Je(Qt.b*255,0,255))}getHexString(e=Cn){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,n=$e.workingColorSpace){$e.workingToColorSpace(Qt.copy(this),n);const i=Qt.r,r=Qt.g,s=Qt.b,o=Math.max(i,r,s),a=Math.min(i,r,s);let l,c;const d=(a+o)/2;if(a===o)l=0,c=0;else{const h=o-a;switch(c=d<=.5?h/(o+a):h/(2-o-a),o){case i:l=(r-s)/h+(r<s?6:0);break;case r:l=(s-i)/h+2;break;case s:l=(i-r)/h+4;break}l/=6}return e.h=l,e.s=c,e.l=d,e}getRGB(e,n=$e.workingColorSpace){return $e.workingToColorSpace(Qt.copy(this),n),e.r=Qt.r,e.g=Qt.g,e.b=Qt.b,e}getStyle(e=Cn){$e.workingToColorSpace(Qt.copy(this),e);const n=Qt.r,i=Qt.g,r=Qt.b;return e!==Cn?`color(${e} ${n.toFixed(3)} ${i.toFixed(3)} ${r.toFixed(3)})`:`rgb(${Math.round(n*255)},${Math.round(i*255)},${Math.round(r*255)})`}offsetHSL(e,n,i){return this.getHSL(Vi),this.setHSL(Vi.h+e,Vi.s+n,Vi.l+i)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,n){return this.r=e.r+n.r,this.g=e.g+n.g,this.b=e.b+n.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,n){return this.r+=(e.r-this.r)*n,this.g+=(e.g-this.g)*n,this.b+=(e.b-this.b)*n,this}lerpColors(e,n,i){return this.r=e.r+(n.r-e.r)*i,this.g=e.g+(n.g-e.g)*i,this.b=e.b+(n.b-e.b)*i,this}lerpHSL(e,n){this.getHSL(Vi),e.getHSL(pa);const i=Mu(Vi.h,pa.h,n),r=Mu(Vi.s,pa.s,n),s=Mu(Vi.l,pa.l,n);return this.setHSL(i,r,s),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){const n=this.r,i=this.g,r=this.b,s=e.elements;return this.r=s[0]*n+s[3]*i+s[6]*r,this.g=s[1]*n+s[4]*i+s[7]*r,this.b=s[2]*n+s[5]*i+s[8]*r,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,n=0){return this.r=e[n],this.g=e[n+1],this.b=e[n+2],this}toArray(e=[],n=0){return e[n]=this.r,e[n+1]=this.g,e[n+2]=this.b,e}fromBufferAttribute(e,n){return this.r=e.getX(n),this.g=e.getY(n),this.b=e.getZ(n),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const Qt=new Ke;Ke.NAMES=pp;class rx extends Ut{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new zi,this.environmentIntensity=1,this.environmentRotation=new zi,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,n){return super.copy(e,n),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){const n=super.toJSON(e);return this.fog!==null&&(n.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(n.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(n.object.backgroundIntensity=this.backgroundIntensity),n.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(n.object.environmentIntensity=this.environmentIntensity),n.object.environmentRotation=this.environmentRotation.toArray(),n}}const Hn=new U,Mi=new U,Lu=new U,Ei=new U,ts=new U,ns=new U,mp=new U,Du=new U,Iu=new U,Nu=new U,Uu=new St,Fu=new St,Ou=new St;class Gn{constructor(e=new U,n=new U,i=new U){this.a=e,this.b=n,this.c=i}static getNormal(e,n,i,r){r.subVectors(i,n),Hn.subVectors(e,n),r.cross(Hn);const s=r.lengthSq();return s>0?r.multiplyScalar(1/Math.sqrt(s)):r.set(0,0,0)}static getBarycoord(e,n,i,r,s){Hn.subVectors(r,n),Mi.subVectors(i,n),Lu.subVectors(e,n);const o=Hn.dot(Hn),a=Hn.dot(Mi),l=Hn.dot(Lu),c=Mi.dot(Mi),d=Mi.dot(Lu),h=o*c-a*a;if(h===0)return s.set(0,0,0),null;const u=1/h,p=(c*l-a*d)*u,g=(o*d-a*l)*u;return s.set(1-p-g,g,p)}static containsPoint(e,n,i,r){return this.getBarycoord(e,n,i,r,Ei)===null?!1:Ei.x>=0&&Ei.y>=0&&Ei.x+Ei.y<=1}static getInterpolation(e,n,i,r,s,o,a,l){return this.getBarycoord(e,n,i,r,Ei)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(s,Ei.x),l.addScaledVector(o,Ei.y),l.addScaledVector(a,Ei.z),l)}static getInterpolatedAttribute(e,n,i,r,s,o){return Uu.setScalar(0),Fu.setScalar(0),Ou.setScalar(0),Uu.fromBufferAttribute(e,n),Fu.fromBufferAttribute(e,i),Ou.fromBufferAttribute(e,r),o.setScalar(0),o.addScaledVector(Uu,s.x),o.addScaledVector(Fu,s.y),o.addScaledVector(Ou,s.z),o}static isFrontFacing(e,n,i,r){return Hn.subVectors(i,n),Mi.subVectors(e,n),Hn.cross(Mi).dot(r)<0}set(e,n,i){return this.a.copy(e),this.b.copy(n),this.c.copy(i),this}setFromPointsAndIndices(e,n,i,r){return this.a.copy(e[n]),this.b.copy(e[i]),this.c.copy(e[r]),this}setFromAttributeAndIndices(e,n,i,r){return this.a.fromBufferAttribute(e,n),this.b.fromBufferAttribute(e,i),this.c.fromBufferAttribute(e,r),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return Hn.subVectors(this.c,this.b),Mi.subVectors(this.a,this.b),Hn.cross(Mi).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return Gn.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,n){return Gn.getBarycoord(e,this.a,this.b,this.c,n)}getInterpolation(e,n,i,r,s){return Gn.getInterpolation(e,this.a,this.b,this.c,n,i,r,s)}containsPoint(e){return Gn.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return Gn.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,n){const i=this.a,r=this.b,s=this.c;let o,a;ts.subVectors(r,i),ns.subVectors(s,i),Du.subVectors(e,i);const l=ts.dot(Du),c=ns.dot(Du);if(l<=0&&c<=0)return n.copy(i);Iu.subVectors(e,r);const d=ts.dot(Iu),h=ns.dot(Iu);if(d>=0&&h<=d)return n.copy(r);const u=l*h-d*c;if(u<=0&&l>=0&&d<=0)return o=l/(l-d),n.copy(i).addScaledVector(ts,o);Nu.subVectors(e,s);const p=ts.dot(Nu),g=ns.dot(Nu);if(g>=0&&p<=g)return n.copy(s);const M=p*c-l*g;if(M<=0&&c>=0&&g<=0)return a=c/(c-g),n.copy(i).addScaledVector(ns,a);const m=d*g-p*h;if(m<=0&&h-d>=0&&p-g>=0)return mp.subVectors(s,r),a=(h-d)/(h-d+(p-g)),n.copy(r).addScaledVector(mp,a);const f=1/(m+M+u);return o=M*f,a=u*f,n.copy(i).addScaledVector(ts,o).addScaledVector(ns,a)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}}class Js{constructor(e=new U(1/0,1/0,1/0),n=new U(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=n}set(e,n){return this.min.copy(e),this.max.copy(n),this}setFromArray(e){this.makeEmpty();for(let n=0,i=e.length;n<i;n+=3)this.expandByPoint(Wn.fromArray(e,n));return this}setFromBufferAttribute(e){this.makeEmpty();for(let n=0,i=e.count;n<i;n++)this.expandByPoint(Wn.fromBufferAttribute(e,n));return this}setFromPoints(e){this.makeEmpty();for(let n=0,i=e.length;n<i;n++)this.expandByPoint(e[n]);return this}setFromCenterAndSize(e,n){const i=Wn.copy(n).multiplyScalar(.5);return this.min.copy(e).sub(i),this.max.copy(e).add(i),this}setFromObject(e,n=!1){return this.makeEmpty(),this.expandByObject(e,n)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,n=!1){e.updateWorldMatrix(!1,!1);const i=e.geometry;if(i!==void 0){const s=i.getAttribute("position");if(n===!0&&s!==void 0&&e.isInstancedMesh!==!0)for(let o=0,a=s.count;o<a;o++)e.isMesh===!0?e.getVertexPosition(o,Wn):Wn.fromBufferAttribute(s,o),Wn.applyMatrix4(e.matrixWorld),this.expandByPoint(Wn);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),ma.copy(e.boundingBox)):(i.boundingBox===null&&i.computeBoundingBox(),ma.copy(i.boundingBox)),ma.applyMatrix4(e.matrixWorld),this.union(ma)}const r=e.children;for(let s=0,o=r.length;s<o;s++)this.expandByObject(r[s],n);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,n){return n.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,Wn),Wn.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let n,i;return e.normal.x>0?(n=e.normal.x*this.min.x,i=e.normal.x*this.max.x):(n=e.normal.x*this.max.x,i=e.normal.x*this.min.x),e.normal.y>0?(n+=e.normal.y*this.min.y,i+=e.normal.y*this.max.y):(n+=e.normal.y*this.max.y,i+=e.normal.y*this.min.y),e.normal.z>0?(n+=e.normal.z*this.min.z,i+=e.normal.z*this.max.z):(n+=e.normal.z*this.max.z,i+=e.normal.z*this.min.z),n<=-e.constant&&i>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(js),ga.subVectors(this.max,js),is.subVectors(e.a,js),rs.subVectors(e.b,js),ss.subVectors(e.c,js),Hi.subVectors(rs,is),Gi.subVectors(ss,rs),Mr.subVectors(is,ss);let n=[0,-Hi.z,Hi.y,0,-Gi.z,Gi.y,0,-Mr.z,Mr.y,Hi.z,0,-Hi.x,Gi.z,0,-Gi.x,Mr.z,0,-Mr.x,-Hi.y,Hi.x,0,-Gi.y,Gi.x,0,-Mr.y,Mr.x,0];return!Bu(n,is,rs,ss,ga)||(n=[1,0,0,0,1,0,0,0,1],!Bu(n,is,rs,ss,ga))?!1:(_a.crossVectors(Hi,Gi),n=[_a.x,_a.y,_a.z],Bu(n,is,rs,ss,ga))}clampPoint(e,n){return n.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,Wn).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(Wn).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(Ti[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),Ti[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),Ti[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),Ti[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),Ti[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),Ti[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),Ti[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),Ti[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(Ti),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}}const Ti=[new U,new U,new U,new U,new U,new U,new U,new U],Wn=new U,ma=new Js,is=new U,rs=new U,ss=new U,Hi=new U,Gi=new U,Mr=new U,js=new U,ga=new U,_a=new U,Er=new U;function Bu(t,e,n,i,r){for(let s=0,o=t.length-3;s<=o;s+=3){Er.fromArray(t,s);const a=r.x*Math.abs(Er.x)+r.y*Math.abs(Er.y)+r.z*Math.abs(Er.z),l=e.dot(Er),c=n.dot(Er),d=i.dot(Er);if(Math.max(-Math.max(l,c,d),Math.min(l,c,d))>a)return!1}return!0}const It=new U,va=new ze;let sx=0;class bt extends Oi{constructor(e,n,i=!1){if(super(),Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:sx++}),this.name="",this.array=e,this.itemSize=n,this.count=e!==void 0?e.length/n:0,this.normalized=i,this.usage=Jh,this.updateRanges=[],this.gpuType=ni,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,n){this.updateRanges.push({start:e,count:n})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,n,i){e*=this.itemSize,i*=n.itemSize;for(let r=0,s=this.itemSize;r<s;r++)this.array[e+r]=n.array[i+r];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let n=0,i=this.count;n<i;n++)va.fromBufferAttribute(this,n),va.applyMatrix3(e),this.setXY(n,va.x,va.y);else if(this.itemSize===3)for(let n=0,i=this.count;n<i;n++)It.fromBufferAttribute(this,n),It.applyMatrix3(e),this.setXYZ(n,It.x,It.y,It.z);return this}applyMatrix4(e){for(let n=0,i=this.count;n<i;n++)It.fromBufferAttribute(this,n),It.applyMatrix4(e),this.setXYZ(n,It.x,It.y,It.z);return this}applyNormalMatrix(e){for(let n=0,i=this.count;n<i;n++)It.fromBufferAttribute(this,n),It.applyNormalMatrix(e),this.setXYZ(n,It.x,It.y,It.z);return this}transformDirection(e){for(let n=0,i=this.count;n<i;n++)It.fromBufferAttribute(this,n),It.transformDirection(e),this.setXYZ(n,It.x,It.y,It.z);return this}set(e,n=0){return this.array.set(e,n),this}getComponent(e,n){let i=this.array[e*this.itemSize+n];return this.normalized&&(i=qs(i,this.array)),i}setComponent(e,n,i){return this.normalized&&(i=dn(i,this.array)),this.array[e*this.itemSize+n]=i,this}getX(e){let n=this.array[e*this.itemSize];return this.normalized&&(n=qs(n,this.array)),n}setX(e,n){return this.normalized&&(n=dn(n,this.array)),this.array[e*this.itemSize]=n,this}getY(e){let n=this.array[e*this.itemSize+1];return this.normalized&&(n=qs(n,this.array)),n}setY(e,n){return this.normalized&&(n=dn(n,this.array)),this.array[e*this.itemSize+1]=n,this}getZ(e){let n=this.array[e*this.itemSize+2];return this.normalized&&(n=qs(n,this.array)),n}setZ(e,n){return this.normalized&&(n=dn(n,this.array)),this.array[e*this.itemSize+2]=n,this}getW(e){let n=this.array[e*this.itemSize+3];return this.normalized&&(n=qs(n,this.array)),n}setW(e,n){return this.normalized&&(n=dn(n,this.array)),this.array[e*this.itemSize+3]=n,this}setXY(e,n,i){return e*=this.itemSize,this.normalized&&(n=dn(n,this.array),i=dn(i,this.array)),this.array[e+0]=n,this.array[e+1]=i,this}setXYZ(e,n,i,r){return e*=this.itemSize,this.normalized&&(n=dn(n,this.array),i=dn(i,this.array),r=dn(r,this.array)),this.array[e+0]=n,this.array[e+1]=i,this.array[e+2]=r,this}setXYZW(e,n,i,r,s){return e*=this.itemSize,this.normalized&&(n=dn(n,this.array),i=dn(i,this.array),r=dn(r,this.array),s=dn(s,this.array)),this.array[e+0]=n,this.array[e+1]=i,this.array[e+2]=r,this.array[e+3]=s,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==Jh&&(e.usage=this.usage),e}dispose(){this.dispatchEvent({type:"dispose"})}}class gp extends bt{constructor(e,n,i){super(new Uint16Array(e),n,i)}}class _p extends bt{constructor(e,n,i){super(new Uint32Array(e),n,i)}}class Jt extends bt{constructor(e,n,i){super(new Float32Array(e),n,i)}}const ox=new Js,$s=new U,ku=new U;class eo{constructor(e=new U,n=-1){this.isSphere=!0,this.center=e,this.radius=n}set(e,n){return this.center.copy(e),this.radius=n,this}setFromPoints(e,n){const i=this.center;n!==void 0?i.copy(n):ox.setFromPoints(e).getCenter(i);let r=0;for(let s=0,o=e.length;s<o;s++)r=Math.max(r,i.distanceToSquared(e[s]));return this.radius=Math.sqrt(r),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){const n=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=n*n}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,n){const i=this.center.distanceToSquared(e);return n.copy(e),i>this.radius*this.radius&&(n.sub(this.center).normalize(),n.multiplyScalar(this.radius).add(this.center)),n}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;$s.subVectors(e,this.center);const n=$s.lengthSq();if(n>this.radius*this.radius){const i=Math.sqrt(n),r=(i-this.radius)*.5;this.center.addScaledVector($s,r/i),this.radius+=r}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(ku.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint($s.copy(e.center).add(ku)),this.expandByPoint($s.copy(e.center).sub(ku))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}}let ax=0;const Pn=new vt,zu=new Ut,os=new U,Sn=new Js,to=new Js,Vt=new U;class Xt extends Oi{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:ax++}),this.uuid=Zs(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(zv(e)?_p:gp)(e,1):this.index=e,this}setIndirect(e,n=0){return this.indirect=e,this.indirectOffset=n,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,n){return this.attributes[e]=n,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,n,i=0){this.groups.push({start:e,count:n,materialIndex:i})}clearGroups(){this.groups=[]}setDrawRange(e,n){this.drawRange.start=e,this.drawRange.count=n}applyMatrix4(e){const n=this.attributes.position;n!==void 0&&(n.applyMatrix4(e),n.needsUpdate=!0);const i=this.attributes.normal;if(i!==void 0){const s=new Ve().getNormalMatrix(e);i.applyNormalMatrix(s),i.needsUpdate=!0}const r=this.attributes.tangent;return r!==void 0&&(r.transformDirection(e),r.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(e){return Pn.makeRotationFromQuaternion(e),this.applyMatrix4(Pn),this}rotateX(e){return Pn.makeRotationX(e),this.applyMatrix4(Pn),this}rotateY(e){return Pn.makeRotationY(e),this.applyMatrix4(Pn),this}rotateZ(e){return Pn.makeRotationZ(e),this.applyMatrix4(Pn),this}translate(e,n,i){return Pn.makeTranslation(e,n,i),this.applyMatrix4(Pn),this}scale(e,n,i){return Pn.makeScale(e,n,i),this.applyMatrix4(Pn),this}lookAt(e){return zu.lookAt(e),zu.updateMatrix(),this.applyMatrix4(zu.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(os).negate(),this.translate(os.x,os.y,os.z),this}setFromPoints(e){const n=this.getAttribute("position");if(n===void 0){const i=[];for(let r=0,s=e.length;r<s;r++){const o=e[r];i.push(o.x,o.y,o.z||0)}this.setAttribute("position",new Jt(i,3))}else{const i=Math.min(e.length,n.count);for(let r=0;r<i;r++){const s=e[r];n.setXYZ(r,s.x,s.y,s.z||0)}e.length>n.count&&Ne("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),n.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Js);const e=this.attributes.position,n=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){tt("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new U(-1/0,-1/0,-1/0),new U(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),n)for(let i=0,r=n.length;i<r;i++){const s=n[i];Sn.setFromBufferAttribute(s),this.morphTargetsRelative?(Vt.addVectors(this.boundingBox.min,Sn.min),this.boundingBox.expandByPoint(Vt),Vt.addVectors(this.boundingBox.max,Sn.max),this.boundingBox.expandByPoint(Vt)):(this.boundingBox.expandByPoint(Sn.min),this.boundingBox.expandByPoint(Sn.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&tt('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new eo);const e=this.attributes.position,n=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){tt("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new U,1/0);return}if(e){const i=this.boundingSphere.center;if(Sn.setFromBufferAttribute(e),n)for(let s=0,o=n.length;s<o;s++){const a=n[s];to.setFromBufferAttribute(a),this.morphTargetsRelative?(Vt.addVectors(Sn.min,to.min),Sn.expandByPoint(Vt),Vt.addVectors(Sn.max,to.max),Sn.expandByPoint(Vt)):(Sn.expandByPoint(to.min),Sn.expandByPoint(to.max))}Sn.getCenter(i);let r=0;for(let s=0,o=e.count;s<o;s++)Vt.fromBufferAttribute(e,s),r=Math.max(r,i.distanceToSquared(Vt));if(n)for(let s=0,o=n.length;s<o;s++){const a=n[s],l=this.morphTargetsRelative;for(let c=0,d=a.count;c<d;c++)Vt.fromBufferAttribute(a,c),l&&(os.fromBufferAttribute(e,c),Vt.add(os)),r=Math.max(r,i.distanceToSquared(Vt))}this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&tt('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const e=this.index,n=this.attributes;if(e===null||n.position===void 0||n.normal===void 0||n.uv===void 0){tt("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const i=n.position,r=n.normal,s=n.uv;let o=this.getAttribute("tangent");(o===void 0||o.count!==i.count)&&(o=new bt(new Float32Array(4*i.count),4),this.setAttribute("tangent",o));const a=[],l=[];for(let _=0;_<i.count;_++)a[_]=new U,l[_]=new U;const c=new U,d=new U,h=new U,u=new ze,p=new ze,g=new ze,M=new U,m=new U;function f(_,A,C){c.fromBufferAttribute(i,_),d.fromBufferAttribute(i,A),h.fromBufferAttribute(i,C),u.fromBufferAttribute(s,_),p.fromBufferAttribute(s,A),g.fromBufferAttribute(s,C),d.sub(c),h.sub(c),p.sub(u),g.sub(u);const P=1/(p.x*g.y-g.x*p.y);isFinite(P)&&(M.copy(d).multiplyScalar(g.y).addScaledVector(h,-p.y).multiplyScalar(P),m.copy(h).multiplyScalar(p.x).addScaledVector(d,-g.x).multiplyScalar(P),a[_].add(M),a[A].add(M),a[C].add(M),l[_].add(m),l[A].add(m),l[C].add(m))}let x=this.groups;x.length===0&&(x=[{start:0,count:e.count}]);for(let _=0,A=x.length;_<A;++_){const C=x[_],P=C.start,D=C.count;for(let W=P,Z=P+D;W<Z;W+=3)f(e.getX(W+0),e.getX(W+1),e.getX(W+2))}const y=new U,S=new U,w=new U,T=new U;function b(_){w.fromBufferAttribute(r,_),T.copy(w);const A=a[_];y.copy(A),y.sub(w.multiplyScalar(w.dot(A))).normalize(),S.crossVectors(T,A);const P=S.dot(l[_])<0?-1:1;o.setXYZW(_,y.x,y.y,y.z,P)}for(let _=0,A=x.length;_<A;++_){const C=x[_],P=C.start,D=C.count;for(let W=P,Z=P+D;W<Z;W+=3)b(e.getX(W+0)),b(e.getX(W+1)),b(e.getX(W+2))}this._transformed=!0}computeVertexNormals(){const e=this.index,n=this.getAttribute("position");if(n!==void 0){let i=this.getAttribute("normal");if(i===void 0||i.count!==n.count)i=new bt(new Float32Array(n.count*3),3),this.setAttribute("normal",i);else for(let u=0,p=i.count;u<p;u++)i.setXYZ(u,0,0,0);const r=new U,s=new U,o=new U,a=new U,l=new U,c=new U,d=new U,h=new U;if(e)for(let u=0,p=e.count;u<p;u+=3){const g=e.getX(u+0),M=e.getX(u+1),m=e.getX(u+2);r.fromBufferAttribute(n,g),s.fromBufferAttribute(n,M),o.fromBufferAttribute(n,m),d.subVectors(o,s),h.subVectors(r,s),d.cross(h),a.fromBufferAttribute(i,g),l.fromBufferAttribute(i,M),c.fromBufferAttribute(i,m),a.add(d),l.add(d),c.add(d),i.setXYZ(g,a.x,a.y,a.z),i.setXYZ(M,l.x,l.y,l.z),i.setXYZ(m,c.x,c.y,c.z)}else for(let u=0,p=n.count;u<p;u+=3)r.fromBufferAttribute(n,u+0),s.fromBufferAttribute(n,u+1),o.fromBufferAttribute(n,u+2),d.subVectors(o,s),h.subVectors(r,s),d.cross(h),i.setXYZ(u+0,d.x,d.y,d.z),i.setXYZ(u+1,d.x,d.y,d.z),i.setXYZ(u+2,d.x,d.y,d.z);this.normalizeNormals(),i.needsUpdate=!0}}normalizeNormals(){const e=this.attributes.normal;for(let n=0,i=e.count;n<i;n++)Vt.fromBufferAttribute(e,n),Vt.normalize(),e.setXYZ(n,Vt.x,Vt.y,Vt.z)}toNonIndexed(){function e(a,l){const c=a.array,d=a.itemSize,h=a.normalized,u=new c.constructor(l.length*d);let p=0,g=0;for(let M=0,m=l.length;M<m;M++){a.isInterleavedBufferAttribute?p=l[M]*a.data.stride+a.offset:p=l[M]*d;for(let f=0;f<d;f++)u[g++]=c[p++]}return new bt(u,d,h)}if(this.index===null)return Ne("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const n=new Xt,i=this.index.array,r=this.attributes;for(const a in r){const l=r[a],c=e(l,i);n.setAttribute(a,c)}const s=this.morphAttributes;for(const a in s){const l=[],c=s[a];for(let d=0,h=c.length;d<h;d++){const u=c[d],p=e(u,i);l.push(p)}n.morphAttributes[a]=l}n.morphTargetsRelative=this.morphTargetsRelative;const o=this.groups;for(let a=0,l=o.length;a<l;a++){const c=o[a];n.addGroup(c.start,c.count,c.materialIndex)}return n}toJSON(){const e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};const n=this.index;n!==null&&(e.data.index={type:n.array.constructor.name,array:Array.prototype.slice.call(n.array)});const i=this.attributes;for(const l in i){const c=i[l];e.data.attributes[l]=c.toJSON(e.data)}const r={};let s=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],d=[];for(let h=0,u=c.length;h<u;h++){const p=c[h];d.push(p.toJSON(e.data))}d.length>0&&(r[l]=d,s=!0)}s&&(e.data.morphAttributes=r,e.data.morphTargetsRelative=this.morphTargetsRelative);const o=this.groups;o.length>0&&(e.data.groups=JSON.parse(JSON.stringify(o)));const a=this.boundingSphere;return a!==null&&(e.data.boundingSphere=a.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const n={};this.name=e.name;const i=e.index;i!==null&&this.setIndex(i.clone());const r=e.attributes;for(const c in r){const d=r[c];this.setAttribute(c,d.clone(n))}const s=e.morphAttributes;for(const c in s){const d=[],h=s[c];for(let u=0,p=h.length;u<p;u++)d.push(h[u].clone(n));this.morphAttributes[c]=d}this.morphTargetsRelative=e.morphTargetsRelative;const o=e.groups;for(let c=0,d=o.length;c<d;c++){const h=o[c];this.addGroup(h.start,h.count,h.materialIndex)}const a=e.boundingBox;a!==null&&(this.boundingBox=a.clone());const l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}}let lx=0;class Tr extends Oi{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:lx++}),this.uuid=Zs(),this.name="",this.type="Material",this.blending=Xr,this.side=$n,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Sc,this.blendDst=yc,this.blendEquation=_r,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Ke(0,0,0),this.blendAlpha=0,this.depthFunc=Yr,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Qh,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Zr,this.stencilZFail=Zr,this.stencilZPass=Zr,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(const n in e){const i=e[n];if(i===void 0){Ne(`Material: parameter '${n}' has value of undefined.`);continue}const r=this[n];if(r===void 0){Ne(`Material: '${n}' is not a property of THREE.${this.type}.`);continue}r&&r.isColor?r.set(i):r&&r.isVector2&&i&&i.isVector2||r&&r.isEuler&&i&&i.isEuler||r&&r.isVector3&&i&&i.isVector3?r.copy(i):this[n]=i}}toJSON(e){const n=e===void 0||typeof e=="string";n&&(e={textures:{},images:{}});const i={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.color&&this.color.isColor&&(i.color=this.color.getHex()),this.roughness!==void 0&&(i.roughness=this.roughness),this.metalness!==void 0&&(i.metalness=this.metalness),this.sheen!==void 0&&(i.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(i.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(i.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(i.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(i.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(i.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(i.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(i.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(i.shininess=this.shininess),this.clearcoat!==void 0&&(i.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(i.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(i.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(i.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(i.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,i.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(i.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(i.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(i.dispersion=this.dispersion),this.iridescence!==void 0&&(i.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(i.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(i.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(i.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(i.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(i.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(i.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(i.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(i.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(i.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(i.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(i.lightMap=this.lightMap.toJSON(e).uuid,i.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(i.aoMap=this.aoMap.toJSON(e).uuid,i.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(i.bumpMap=this.bumpMap.toJSON(e).uuid,i.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(i.normalMap=this.normalMap.toJSON(e).uuid,i.normalMapType=this.normalMapType,i.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(i.displacementMap=this.displacementMap.toJSON(e).uuid,i.displacementScale=this.displacementScale,i.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(i.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(i.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(i.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(i.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(i.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(i.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(i.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(i.combine=this.combine)),this.envMapRotation!==void 0&&(i.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(i.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(i.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(i.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(i.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(i.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(i.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(i.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(i.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(i.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(i.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(i.size=this.size),this.shadowSide!==null&&(i.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(i.sizeAttenuation=this.sizeAttenuation),this.blending!==Xr&&(i.blending=this.blending),this.side!==$n&&(i.side=this.side),this.vertexColors===!0&&(i.vertexColors=!0),this.opacity<1&&(i.opacity=this.opacity),this.transparent===!0&&(i.transparent=!0),this.blendSrc!==Sc&&(i.blendSrc=this.blendSrc),this.blendDst!==yc&&(i.blendDst=this.blendDst),this.blendEquation!==_r&&(i.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(i.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(i.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(i.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(i.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(i.blendAlpha=this.blendAlpha),this.depthFunc!==Yr&&(i.depthFunc=this.depthFunc),this.depthTest===!1&&(i.depthTest=this.depthTest),this.depthWrite===!1&&(i.depthWrite=this.depthWrite),this.colorWrite===!1&&(i.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(i.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==Qh&&(i.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(i.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(i.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Zr&&(i.stencilFail=this.stencilFail),this.stencilZFail!==Zr&&(i.stencilZFail=this.stencilZFail),this.stencilZPass!==Zr&&(i.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(i.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(i.rotation=this.rotation),this.polygonOffset===!0&&(i.polygonOffset=!0),this.polygonOffsetFactor!==0&&(i.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(i.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(i.linewidth=this.linewidth),this.dashSize!==void 0&&(i.dashSize=this.dashSize),this.gapSize!==void 0&&(i.gapSize=this.gapSize),this.scale!==void 0&&(i.scale=this.scale),this.dithering===!0&&(i.dithering=!0),this.alphaTest>0&&(i.alphaTest=this.alphaTest),this.alphaHash===!0&&(i.alphaHash=!0),this.alphaToCoverage===!0&&(i.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(i.premultipliedAlpha=!0),this.forceSinglePass===!0&&(i.forceSinglePass=!0),this.allowOverride===!1&&(i.allowOverride=!1),this.wireframe===!0&&(i.wireframe=!0),this.wireframeLinewidth>1&&(i.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(i.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(i.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(i.flatShading=!0),this.visible===!1&&(i.visible=!1),this.toneMapped===!1&&(i.toneMapped=!1),this.fog===!1&&(i.fog=!1),Object.keys(this.userData).length>0&&(i.userData=this.userData);function r(s){const o=[];for(const a in s){const l=s[a];delete l.metadata,o.push(l)}return o}if(n){const s=r(e.textures),o=r(e.images);s.length>0&&(i.textures=s),o.length>0&&(i.images=o)}return i}fromJSON(e,n){if(e.uuid!==void 0&&(this.uuid=e.uuid),e.name!==void 0&&(this.name=e.name),e.color!==void 0&&this.color!==void 0&&this.color.setHex(e.color),e.roughness!==void 0&&(this.roughness=e.roughness),e.metalness!==void 0&&(this.metalness=e.metalness),e.sheen!==void 0&&(this.sheen=e.sheen),e.sheenColor!==void 0&&(this.sheenColor=new Ke().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(this.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(e.emissive),e.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(e.specular),e.specularIntensity!==void 0&&(this.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(this.shininess=e.shininess),e.clearcoat!==void 0&&(this.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=e.clearcoatRoughness),e.dispersion!==void 0&&(this.dispersion=e.dispersion),e.iridescence!==void 0&&(this.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(this.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=e.iridescenceThicknessRange),e.transmission!==void 0&&(this.transmission=e.transmission),e.thickness!==void 0&&(this.thickness=e.thickness),e.attenuationDistance!==void 0&&(this.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(this.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(this.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(this.fog=e.fog),e.flatShading!==void 0&&(this.flatShading=e.flatShading),e.blending!==void 0&&(this.blending=e.blending),e.combine!==void 0&&(this.combine=e.combine),e.side!==void 0&&(this.side=e.side),e.shadowSide!==void 0&&(this.shadowSide=e.shadowSide),e.opacity!==void 0&&(this.opacity=e.opacity),e.transparent!==void 0&&(this.transparent=e.transparent),e.alphaTest!==void 0&&(this.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(this.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(this.depthFunc=e.depthFunc),e.depthTest!==void 0&&(this.depthTest=e.depthTest),e.depthWrite!==void 0&&(this.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(this.colorWrite=e.colorWrite),e.blendSrc!==void 0&&(this.blendSrc=e.blendSrc),e.blendDst!==void 0&&(this.blendDst=e.blendDst),e.blendEquation!==void 0&&(this.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(this.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(this.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(this.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(this.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(this.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(this.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(this.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(this.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(this.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(this.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(this.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(this.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(this.rotation=e.rotation),e.linewidth!==void 0&&(this.linewidth=e.linewidth),e.dashSize!==void 0&&(this.dashSize=e.dashSize),e.gapSize!==void 0&&(this.gapSize=e.gapSize),e.scale!==void 0&&(this.scale=e.scale),e.polygonOffset!==void 0&&(this.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(this.dithering=e.dithering),e.alphaToCoverage!==void 0&&(this.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(this.forceSinglePass=e.forceSinglePass),e.allowOverride!==void 0&&(this.allowOverride=e.allowOverride),e.visible!==void 0&&(this.visible=e.visible),e.toneMapped!==void 0&&(this.toneMapped=e.toneMapped),e.userData!==void 0&&(this.userData=e.userData),e.vertexColors!==void 0&&(typeof e.vertexColors=="number"?this.vertexColors=e.vertexColors>0:this.vertexColors=e.vertexColors),e.size!==void 0&&(this.size=e.size),e.sizeAttenuation!==void 0&&(this.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(this.map=n[e.map]||null),e.matcap!==void 0&&(this.matcap=n[e.matcap]||null),e.alphaMap!==void 0&&(this.alphaMap=n[e.alphaMap]||null),e.bumpMap!==void 0&&(this.bumpMap=n[e.bumpMap]||null),e.bumpScale!==void 0&&(this.bumpScale=e.bumpScale),e.normalMap!==void 0&&(this.normalMap=n[e.normalMap]||null),e.normalMapType!==void 0&&(this.normalMapType=e.normalMapType),e.normalScale!==void 0){let i=e.normalScale;Array.isArray(i)===!1&&(i=[i,i]),this.normalScale=new ze().fromArray(i)}return e.displacementMap!==void 0&&(this.displacementMap=n[e.displacementMap]||null),e.displacementScale!==void 0&&(this.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(this.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(this.roughnessMap=n[e.roughnessMap]||null),e.metalnessMap!==void 0&&(this.metalnessMap=n[e.metalnessMap]||null),e.emissiveMap!==void 0&&(this.emissiveMap=n[e.emissiveMap]||null),e.emissiveIntensity!==void 0&&(this.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(this.specularMap=n[e.specularMap]||null),e.specularIntensityMap!==void 0&&(this.specularIntensityMap=n[e.specularIntensityMap]||null),e.specularColorMap!==void 0&&(this.specularColorMap=n[e.specularColorMap]||null),e.envMap!==void 0&&(this.envMap=n[e.envMap]||null),e.envMapRotation!==void 0&&this.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(this.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(this.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(this.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(this.lightMap=n[e.lightMap]||null),e.lightMapIntensity!==void 0&&(this.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(this.aoMap=n[e.aoMap]||null),e.aoMapIntensity!==void 0&&(this.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(this.gradientMap=n[e.gradientMap]||null),e.clearcoatMap!==void 0&&(this.clearcoatMap=n[e.clearcoatMap]||null),e.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=n[e.clearcoatRoughnessMap]||null),e.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=n[e.clearcoatNormalMap]||null),e.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new ze().fromArray(e.clearcoatNormalScale)),e.iridescenceMap!==void 0&&(this.iridescenceMap=n[e.iridescenceMap]||null),e.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=n[e.iridescenceThicknessMap]||null),e.transmissionMap!==void 0&&(this.transmissionMap=n[e.transmissionMap]||null),e.thicknessMap!==void 0&&(this.thicknessMap=n[e.thicknessMap]||null),e.anisotropyMap!==void 0&&(this.anisotropyMap=n[e.anisotropyMap]||null),e.sheenColorMap!==void 0&&(this.sheenColorMap=n[e.sheenColorMap]||null),e.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=n[e.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;const n=e.clippingPlanes;let i=null;if(n!==null){const r=n.length;i=new Array(r);for(let s=0;s!==r;++s)i[s]=n[s].clone()}return this.clippingPlanes=i,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}}const wi=new U,Vu=new U,xa=new U,Wi=new U,Hu=new U,Sa=new U,Gu=new U;class ya{constructor(e=new U,n=new U(0,0,-1)){this.origin=e,this.direction=n}set(e,n){return this.origin.copy(e),this.direction.copy(n),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,n){return n.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,wi)),this}closestPointToPoint(e,n){n.subVectors(e,this.origin);const i=n.dot(this.direction);return i<0?n.copy(this.origin):n.copy(this.origin).addScaledVector(this.direction,i)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){const n=wi.subVectors(e,this.origin).dot(this.direction);return n<0?this.origin.distanceToSquared(e):(wi.copy(this.origin).addScaledVector(this.direction,n),wi.distanceToSquared(e))}distanceSqToSegment(e,n,i,r){Vu.copy(e).add(n).multiplyScalar(.5),xa.copy(n).sub(e).normalize(),Wi.copy(this.origin).sub(Vu);const s=e.distanceTo(n)*.5,o=-this.direction.dot(xa),a=Wi.dot(this.direction),l=-Wi.dot(xa),c=Wi.lengthSq(),d=Math.abs(1-o*o);let h,u,p,g;if(d>0)if(h=o*l-a,u=o*a-l,g=s*d,h>=0)if(u>=-g)if(u<=g){const M=1/d;h*=M,u*=M,p=h*(h+o*u+2*a)+u*(o*h+u+2*l)+c}else u=s,h=Math.max(0,-(o*u+a)),p=-h*h+u*(u+2*l)+c;else u=-s,h=Math.max(0,-(o*u+a)),p=-h*h+u*(u+2*l)+c;else u<=-g?(h=Math.max(0,-(-o*s+a)),u=h>0?-s:Math.min(Math.max(-s,-l),s),p=-h*h+u*(u+2*l)+c):u<=g?(h=0,u=Math.min(Math.max(-s,-l),s),p=u*(u+2*l)+c):(h=Math.max(0,-(o*s+a)),u=h>0?s:Math.min(Math.max(-s,-l),s),p=-h*h+u*(u+2*l)+c);else u=o>0?-s:s,h=Math.max(0,-(o*u+a)),p=-h*h+u*(u+2*l)+c;return i&&i.copy(this.origin).addScaledVector(this.direction,h),r&&r.copy(Vu).addScaledVector(xa,u),p}intersectSphere(e,n){wi.subVectors(e.center,this.origin);const i=wi.dot(this.direction),r=wi.dot(wi)-i*i,s=e.radius*e.radius;if(r>s)return null;const o=Math.sqrt(s-r),a=i-o,l=i+o;return l<0?null:a<0?this.at(l,n):this.at(a,n)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){const n=e.normal.dot(this.direction);if(n===0)return e.distanceToPoint(this.origin)===0?0:null;const i=-(this.origin.dot(e.normal)+e.constant)/n;return i>=0?i:null}intersectPlane(e,n){const i=this.distanceToPlane(e);return i===null?null:this.at(i,n)}intersectsPlane(e){const n=e.distanceToPoint(this.origin);return n===0||e.normal.dot(this.direction)*n<0}intersectBox(e,n){let i,r,s,o,a,l;const c=1/this.direction.x,d=1/this.direction.y,h=1/this.direction.z,u=this.origin;return c>=0?(i=(e.min.x-u.x)*c,r=(e.max.x-u.x)*c):(i=(e.max.x-u.x)*c,r=(e.min.x-u.x)*c),d>=0?(s=(e.min.y-u.y)*d,o=(e.max.y-u.y)*d):(s=(e.max.y-u.y)*d,o=(e.min.y-u.y)*d),i>o||s>r||((s>i||isNaN(i))&&(i=s),(o<r||isNaN(r))&&(r=o),h>=0?(a=(e.min.z-u.z)*h,l=(e.max.z-u.z)*h):(a=(e.max.z-u.z)*h,l=(e.min.z-u.z)*h),i>l||a>r)||((a>i||i!==i)&&(i=a),(l<r||r!==r)&&(r=l),r<0)?null:this.at(i>=0?i:r,n)}intersectsBox(e){return this.intersectBox(e,wi)!==null}intersectTriangle(e,n,i,r,s){Hu.subVectors(n,e),Sa.subVectors(i,e),Gu.crossVectors(Hu,Sa);let o=this.direction.dot(Gu),a;if(o>0){if(r)return null;a=1}else if(o<0)a=-1,o=-o;else return null;Wi.subVectors(this.origin,e);const l=a*this.direction.dot(Sa.crossVectors(Wi,Sa));if(l<0)return null;const c=a*this.direction.dot(Hu.cross(Wi));if(c<0||l+c>o)return null;const d=-a*Wi.dot(Gu);return d<0?null:this.at(d/o,s)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class Wu extends Tr{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Ke(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new zi,this.combine=Uh,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}}const vp=new vt,wr=new ya,Ma=new eo,xp=new U,Ea=new U,Ta=new U,wa=new U,Xu=new U,Aa=new U,Sp=new U,Ra=new U;class Ln extends Ut{constructor(e=new Xt,n=new Wu){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=n,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,n){return super.copy(e,n),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){const n=this.geometry.morphAttributes,i=Object.keys(n);if(i.length>0){const r=n[i[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,o=r.length;s<o;s++){const a=r[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=s}}}}getVertexPosition(e,n){const i=this.geometry,r=i.attributes.position,s=i.morphAttributes.position,o=i.morphTargetsRelative;n.fromBufferAttribute(r,e);const a=this.morphTargetInfluences;if(s&&a){Aa.set(0,0,0);for(let l=0,c=s.length;l<c;l++){const d=a[l],h=s[l];d!==0&&(Xu.fromBufferAttribute(h,e),o?Aa.addScaledVector(Xu,d):Aa.addScaledVector(Xu.sub(n),d))}n.add(Aa)}return n}raycast(e,n){const i=this.geometry,r=this.material,s=this.matrixWorld;r!==void 0&&(i.boundingSphere===null&&i.computeBoundingSphere(),Ma.copy(i.boundingSphere),Ma.applyMatrix4(s),wr.copy(e.ray).recast(e.near),!(Ma.containsPoint(wr.origin)===!1&&(wr.intersectSphere(Ma,xp)===null||wr.origin.distanceToSquared(xp)>(e.far-e.near)**2))&&(vp.copy(s).invert(),wr.copy(e.ray).applyMatrix4(vp),!(i.boundingBox!==null&&wr.intersectsBox(i.boundingBox)===!1)&&this._computeIntersections(e,n,wr)))}_computeIntersections(e,n,i){let r;const s=this.geometry,o=this.material,a=s.index,l=s.attributes.position,c=s.attributes.uv,d=s.attributes.uv1,h=s.attributes.normal,u=s.groups,p=s.drawRange;if(a!==null)if(Array.isArray(o))for(let g=0,M=u.length;g<M;g++){const m=u[g],f=o[m.materialIndex],x=Math.max(m.start,p.start),y=Math.min(a.count,Math.min(m.start+m.count,p.start+p.count));for(let S=x,w=y;S<w;S+=3){const T=a.getX(S),b=a.getX(S+1),_=a.getX(S+2);r=ba(this,f,e,i,c,d,h,T,b,_),r&&(r.faceIndex=Math.floor(S/3),r.face.materialIndex=m.materialIndex,n.push(r))}}else{const g=Math.max(0,p.start),M=Math.min(a.count,p.start+p.count);for(let m=g,f=M;m<f;m+=3){const x=a.getX(m),y=a.getX(m+1),S=a.getX(m+2);r=ba(this,o,e,i,c,d,h,x,y,S),r&&(r.faceIndex=Math.floor(m/3),n.push(r))}}else if(l!==void 0)if(Array.isArray(o))for(let g=0,M=u.length;g<M;g++){const m=u[g],f=o[m.materialIndex],x=Math.max(m.start,p.start),y=Math.min(l.count,Math.min(m.start+m.count,p.start+p.count));for(let S=x,w=y;S<w;S+=3){const T=S,b=S+1,_=S+2;r=ba(this,f,e,i,c,d,h,T,b,_),r&&(r.faceIndex=Math.floor(S/3),r.face.materialIndex=m.materialIndex,n.push(r))}}else{const g=Math.max(0,p.start),M=Math.min(l.count,p.start+p.count);for(let m=g,f=M;m<f;m+=3){const x=m,y=m+1,S=m+2;r=ba(this,o,e,i,c,d,h,x,y,S),r&&(r.faceIndex=Math.floor(m/3),n.push(r))}}}}function cx(t,e,n,i,r,s,o,a){let l;if(e.side===rn?l=i.intersectTriangle(o,s,r,!0,a):l=i.intersectTriangle(r,s,o,e.side===$n,a),l===null)return null;Ra.copy(a),Ra.applyMatrix4(t.matrixWorld);const c=n.ray.origin.distanceTo(Ra);return c<n.near||c>n.far?null:{distance:c,point:Ra.clone(),object:t}}function ba(t,e,n,i,r,s,o,a,l,c){t.getVertexPosition(a,Ea),t.getVertexPosition(l,Ta),t.getVertexPosition(c,wa);const d=cx(t,e,n,i,Ea,Ta,wa,Sp);if(d){const h=new U;Gn.getBarycoord(Sp,Ea,Ta,wa,h),r&&(d.uv=Gn.getInterpolatedAttribute(r,a,l,c,h,new ze)),s&&(d.uv1=Gn.getInterpolatedAttribute(s,a,l,c,h,new ze)),o&&(d.normal=Gn.getInterpolatedAttribute(o,a,l,c,h,new U),d.normal.dot(i.direction)>0&&d.normal.multiplyScalar(-1));const u={a,b:l,c,normal:new U,materialIndex:0};Gn.getNormal(Ea,Ta,wa,u.normal),d.face=u,d.barycoord=h}return d}class yp extends on{constructor(e=null,n=1,i=1,r,s,o,a,l,c=Wt,d=Wt,h,u){super(null,o,a,l,c,d,r,s,h,u),this.isDataTexture=!0,this.image={data:e,width:n,height:i},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}const Yu=new U,ux=new U,fx=new Ve;class Xi{constructor(e=new U(1,0,0),n=0){this.isPlane=!0,this.normal=e,this.constant=n}set(e,n){return this.normal.copy(e),this.constant=n,this}setComponents(e,n,i,r){return this.normal.set(e,n,i),this.constant=r,this}setFromNormalAndCoplanarPoint(e,n){return this.normal.copy(e),this.constant=-n.dot(this.normal),this}setFromCoplanarPoints(e,n,i){const r=Yu.subVectors(i,n).cross(ux.subVectors(e,n)).normalize();return this.setFromNormalAndCoplanarPoint(r,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){const e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,n){return n.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,n,i=!0){const r=e.delta(Yu),s=this.normal.dot(r);if(s===0)return this.distanceToPoint(e.start)===0?n.copy(e.start):null;const o=-(e.start.dot(this.normal)+this.constant)/s;return i===!0&&(o<0||o>1)?null:n.copy(e.start).addScaledVector(r,o)}intersectsLine(e){const n=this.distanceToPoint(e.start),i=this.distanceToPoint(e.end);return n<0&&i>0||i<0&&n>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,n){const i=n||fx.getNormalMatrix(e),r=this.coplanarPoint(Yu).applyMatrix4(e),s=this.normal.applyMatrix3(i).normalize();return this.constant=-r.dot(s),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}}const Ar=new eo,dx=new ze(.5,.5),Ca=new U;class Ku{constructor(e=new Xi,n=new Xi,i=new Xi,r=new Xi,s=new Xi,o=new Xi){this.planes=[e,n,i,r,s,o]}set(e,n,i,r,s,o){const a=this.planes;return a[0].copy(e),a[1].copy(n),a[2].copy(i),a[3].copy(r),a[4].copy(s),a[5].copy(o),this}copy(e){const n=this.planes;for(let i=0;i<6;i++)n[i].copy(e.planes[i]);return this}setFromProjectionMatrix(e,n=ii,i=!1){const r=this.planes,s=e.elements,o=s[0],a=s[1],l=s[2],c=s[3],d=s[4],h=s[5],u=s[6],p=s[7],g=s[8],M=s[9],m=s[10],f=s[11],x=s[12],y=s[13],S=s[14],w=s[15];if(r[0].setComponents(c-o,p-d,f-g,w-x).normalize(),r[1].setComponents(c+o,p+d,f+g,w+x).normalize(),r[2].setComponents(c+a,p+h,f+M,w+y).normalize(),r[3].setComponents(c-a,p-h,f-M,w-y).normalize(),i)r[4].setComponents(l,u,m,S).normalize(),r[5].setComponents(c-l,p-u,f-m,w-S).normalize();else if(r[4].setComponents(c-l,p-u,f-m,w-S).normalize(),n===ii)r[5].setComponents(c+l,p+u,f+m,w+S).normalize();else if(n===Ks)r[5].setComponents(l,u,m,S).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+n);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),Ar.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{const n=e.geometry;n.boundingSphere===null&&n.computeBoundingSphere(),Ar.copy(n.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(Ar)}intersectsSprite(e){Ar.center.set(0,0,0);const n=dx.distanceTo(e.center);return Ar.radius=.7071067811865476+n,Ar.applyMatrix4(e.matrixWorld),this.intersectsSphere(Ar)}intersectsSphere(e){const n=this.planes,i=e.center,r=-e.radius;for(let s=0;s<6;s++)if(n[s].distanceToPoint(i)<r)return!1;return!0}intersectsBox(e){const n=this.planes;for(let i=0;i<6;i++){const r=n[i];if(Ca.x=r.normal.x>0?e.max.x:e.min.x,Ca.y=r.normal.y>0?e.max.y:e.min.y,Ca.z=r.normal.z>0?e.max.z:e.min.z,r.distanceToPoint(Ca)<0)return!1}return!0}containsPoint(e){const n=this.planes;for(let i=0;i<6;i++)if(n[i].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}class no extends Tr{constructor(e){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new Ke(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}}const Pa=new U,La=new U,Mp=new vt,io=new ya,Da=new eo,Zu=new U,Ep=new U;class hx extends Ut{constructor(e=new Xt,n=new no){super(),this.isLine=!0,this.type="Line",this.geometry=e,this.material=n,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,n){return super.copy(e,n),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){const e=this.geometry;if(e.index===null){const n=e.attributes.position,i=[0];for(let r=1,s=n.count;r<s;r++)Pa.fromBufferAttribute(n,r-1),La.fromBufferAttribute(n,r),i[r]=i[r-1],i[r]+=Pa.distanceTo(La);e.setAttribute("lineDistance",new Jt(i,1))}else Ne("Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(e,n){const i=this.geometry,r=this.matrixWorld,s=e.params.Line.threshold,o=i.drawRange;if(i.boundingSphere===null&&i.computeBoundingSphere(),Da.copy(i.boundingSphere),Da.applyMatrix4(r),Da.radius+=s,e.ray.intersectsSphere(Da)===!1)return;Mp.copy(r).invert(),io.copy(e.ray).applyMatrix4(Mp);const a=s/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a,c=this.isLineSegments?2:1,d=i.index,u=i.attributes.position;if(d!==null){const p=Math.max(0,o.start),g=Math.min(d.count,o.start+o.count);for(let M=p,m=g-1;M<m;M+=c){const f=d.getX(M),x=d.getX(M+1),y=Ia(this,e,io,l,f,x,M);y&&n.push(y)}if(this.isLineLoop){const M=d.getX(g-1),m=d.getX(p),f=Ia(this,e,io,l,M,m,g-1);f&&n.push(f)}}else{const p=Math.max(0,o.start),g=Math.min(u.count,o.start+o.count);for(let M=p,m=g-1;M<m;M+=c){const f=Ia(this,e,io,l,M,M+1,M);f&&n.push(f)}if(this.isLineLoop){const M=Ia(this,e,io,l,g-1,p,g-1);M&&n.push(M)}}}updateMorphTargets(){const n=this.geometry.morphAttributes,i=Object.keys(n);if(i.length>0){const r=n[i[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,o=r.length;s<o;s++){const a=r[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=s}}}}}function Ia(t,e,n,i,r,s,o){const a=t.geometry.attributes.position;if(Pa.fromBufferAttribute(a,r),La.fromBufferAttribute(a,s),n.distanceSqToSegment(Pa,La,Zu,Ep)>i)return;Zu.applyMatrix4(t.matrixWorld);const c=e.ray.origin.distanceTo(Zu);if(!(c<e.near||c>e.far))return{distance:c,point:Ep.clone().applyMatrix4(t.matrixWorld),index:o,face:null,faceIndex:null,barycoord:null,object:t}}const Tp=new U,wp=new U;class Na extends hx{constructor(e,n){super(e,n),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){const e=this.geometry;if(e.index===null){const n=e.attributes.position,i=[];for(let r=0,s=n.count;r<s;r+=2)Tp.fromBufferAttribute(n,r),wp.fromBufferAttribute(n,r+1),i[r]=r===0?0:i[r-1],i[r+1]=i[r]+Tp.distanceTo(wp);e.setAttribute("lineDistance",new Jt(i,1))}else Ne("LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}}class qu extends Tr{constructor(e){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new Ke(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}}const Ap=new vt,Qu=new ya,Ua=new eo,Fa=new U;class px extends Ut{constructor(e=new Xt,n=new qu){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=n,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,n){return super.copy(e,n),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}raycast(e,n){const i=this.geometry,r=this.matrixWorld,s=e.params.Points.threshold,o=i.drawRange;if(i.boundingSphere===null&&i.computeBoundingSphere(),Ua.copy(i.boundingSphere),Ua.applyMatrix4(r),Ua.radius+=s,e.ray.intersectsSphere(Ua)===!1)return;Ap.copy(r).invert(),Qu.copy(e.ray).applyMatrix4(Ap);const a=s/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a,c=i.index,h=i.attributes.position;if(c!==null){const u=Math.max(0,o.start),p=Math.min(c.count,o.start+o.count);for(let g=u,M=p;g<M;g++){const m=c.getX(g);Fa.fromBufferAttribute(h,m),Rp(Fa,m,l,r,e,n,this)}}else{const u=Math.max(0,o.start),p=Math.min(h.count,o.start+o.count);for(let g=u,M=p;g<M;g++)Fa.fromBufferAttribute(h,g),Rp(Fa,g,l,r,e,n,this)}}updateMorphTargets(){const n=this.geometry.morphAttributes,i=Object.keys(n);if(i.length>0){const r=n[i[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,o=r.length;s<o;s++){const a=r[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=s}}}}}function Rp(t,e,n,i,r,s,o){const a=Qu.distanceSqToPoint(t);if(a<n){const l=new U;Qu.closestPointToPoint(t,l),l.applyMatrix4(i);const c=r.ray.origin.distanceTo(l);if(c<r.near||c>r.far)return;s.push({distance:c,distanceToRay:Math.sqrt(a),point:l,index:e,face:null,faceIndex:null,barycoord:null,object:o})}}class bp extends on{constructor(e=[],n=vr,i,r,s,o,a,l,c,d){super(e,n,i,r,s,o,a,l,c,d),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}}class as extends on{constructor(e,n,i=ti,r,s,o,a=Wt,l=Wt,c,d=xi,h=1){if(d!==xi&&d!==Sr)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");const u={width:e,height:n,depth:h};super(u,r,s,o,a,l,d,i,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new wu(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){const n=super.toJSON(e);return this.compareFunction!==null&&(n.compareFunction=this.compareFunction),n}}class mx extends as{constructor(e,n=ti,i=vr,r,s,o=Wt,a=Wt,l,c=xi){const d={width:e,height:e,depth:1},h=[d,d,d,d,d,d];super(e,e,n,i,r,s,o,a,l,c),this.image=h,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}}class Cp extends on{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}}class ls extends Xt{constructor(e=1,n=1,i=1,r=1,s=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:n,depth:i,widthSegments:r,heightSegments:s,depthSegments:o};const a=this;r=Math.floor(r),s=Math.floor(s),o=Math.floor(o);const l=[],c=[],d=[],h=[];let u=0,p=0;g("z","y","x",-1,-1,i,n,e,o,s,0),g("z","y","x",1,-1,i,n,-e,o,s,1),g("x","z","y",1,1,e,i,n,r,o,2),g("x","z","y",1,-1,e,i,-n,r,o,3),g("x","y","z",1,-1,e,n,i,r,s,4),g("x","y","z",-1,-1,e,n,-i,r,s,5),this.setIndex(l),this.setAttribute("position",new Jt(c,3)),this.setAttribute("normal",new Jt(d,3)),this.setAttribute("uv",new Jt(h,2));function g(M,m,f,x,y,S,w,T,b,_,A){const C=S/b,P=w/_,D=S/2,W=w/2,Z=T/2,B=b+1,X=_+1;let H=0,L=0;const k=new U;for(let Y=0;Y<X;Y++){const $=Y*P-W;for(let oe=0;oe<B;oe++){const Be=oe*C-D;k[M]=Be*x,k[m]=$*y,k[f]=Z,c.push(k.x,k.y,k.z),k[M]=0,k[m]=0,k[f]=T>0?1:-1,d.push(k.x,k.y,k.z),h.push(oe/b),h.push(1-Y/_),H+=1}}for(let Y=0;Y<_;Y++)for(let $=0;$<b;$++){const oe=u+$+B*Y,Be=u+$+B*(Y+1),Qe=u+($+1)+B*(Y+1),He=u+($+1)+B*Y;l.push(oe,Be,He),l.push(Be,Qe,He),L+=6}a.addGroup(p,L,A),p+=L,u+=H}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new ls(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}}class ro extends Xt{constructor(e=1,n=1,i=1,r=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:n,widthSegments:i,heightSegments:r};const s=e/2,o=n/2,a=Math.floor(i),l=Math.floor(r),c=a+1,d=l+1,h=e/a,u=n/l,p=[],g=[],M=[],m=[];for(let f=0;f<d;f++){const x=f*u-o;for(let y=0;y<c;y++){const S=y*h-s;g.push(S,-x,0),M.push(0,0,1),m.push(y/a),m.push(1-f/l)}}for(let f=0;f<l;f++)for(let x=0;x<a;x++){const y=x+c*f,S=x+c*(f+1),w=x+1+c*(f+1),T=x+1+c*f;p.push(y,S,T),p.push(S,w,T)}this.setIndex(p),this.setAttribute("position",new Jt(g,3)),this.setAttribute("normal",new Jt(M,3)),this.setAttribute("uv",new Jt(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new ro(e.width,e.height,e.widthSegments,e.heightSegments)}}class gx extends Xt{constructor(e=null){if(super(),this.type="WireframeGeometry",this.parameters={geometry:e},e!==null){const n=[],i=new Set,r=new U,s=new U;if(e.index!==null){const o=e.attributes.position,a=e.index;let l=e.groups;l.length===0&&(l=[{start:0,count:a.count,materialIndex:0}]);for(let c=0,d=l.length;c<d;++c){const h=l[c],u=h.start,p=h.count;for(let g=u,M=u+p;g<M;g+=3)for(let m=0;m<3;m++){const f=a.getX(g+m),x=a.getX(g+(m+1)%3);r.fromBufferAttribute(o,f),s.fromBufferAttribute(o,x),Pp(r,s,i)===!0&&(n.push(r.x,r.y,r.z),n.push(s.x,s.y,s.z))}}}else{const o=e.attributes.position;for(let a=0,l=o.count/3;a<l;a++)for(let c=0;c<3;c++){const d=3*a+c,h=3*a+(c+1)%3;r.fromBufferAttribute(o,d),s.fromBufferAttribute(o,h),Pp(r,s,i)===!0&&(n.push(r.x,r.y,r.z),n.push(s.x,s.y,s.z))}}this.setAttribute("position",new Jt(n,3))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}}function Pp(t,e,n){const i=`${t.x},${t.y},${t.z}-${e.x},${e.y},${e.z}`,r=`${e.x},${e.y},${e.z}-${t.x},${t.y},${t.z}`;return n.has(i)===!0||n.has(r)===!0?!1:(n.add(i),n.add(r),!0)}function cs(t){const e={};for(const n in t){e[n]={};for(const i in t[n]){const r=t[n][i];if(Lp(r))r.isRenderTargetTexture?(Ne("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[n][i]=null):e[n][i]=r.clone();else if(Array.isArray(r))if(Lp(r[0])){const s=[];for(let o=0,a=r.length;o<a;o++)s[o]=r[o].clone();e[n][i]=s}else e[n][i]=r.slice();else e[n][i]=r}}return e}function an(t){const e={};for(let n=0;n<t.length;n++){const i=cs(t[n]);for(const r in i)e[r]=i[r]}return e}function Lp(t){return t&&(t.isColor||t.isMatrix3||t.isMatrix4||t.isVector2||t.isVector3||t.isVector4||t.isTexture||t.isQuaternion)}function _x(t){const e=[];for(let n=0;n<t.length;n++)e.push(t[n].clone());return e}function Dp(t){const e=t.getRenderTarget();return e===null?t.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:$e.workingColorSpace}const vx={clone:cs,merge:an};var xx=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Sx=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class si extends Tr{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=xx,this.fragmentShader=Sx,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=cs(e.uniforms),this.uniformsGroups=_x(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){const n=super.toJSON(e);n.glslVersion=this.glslVersion,n.uniforms={};for(const r in this.uniforms){const o=this.uniforms[r].value;o&&o.isTexture?n.uniforms[r]={type:"t",value:o.toJSON(e).uuid}:o&&o.isColor?n.uniforms[r]={type:"c",value:o.getHex()}:o&&o.isVector2?n.uniforms[r]={type:"v2",value:o.toArray()}:o&&o.isVector3?n.uniforms[r]={type:"v3",value:o.toArray()}:o&&o.isVector4?n.uniforms[r]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?n.uniforms[r]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?n.uniforms[r]={type:"m4",value:o.toArray()}:n.uniforms[r]={value:o}}Object.keys(this.defines).length>0&&(n.defines=this.defines),n.vertexShader=this.vertexShader,n.fragmentShader=this.fragmentShader,n.lights=this.lights,n.clipping=this.clipping;const i={};for(const r in this.extensions)this.extensions[r]===!0&&(i[r]=!0);return Object.keys(i).length>0&&(n.extensions=i),n}fromJSON(e,n){if(super.fromJSON(e,n),e.uniforms!==void 0)for(const i in e.uniforms){const r=e.uniforms[i];switch(this.uniforms[i]={},r.type){case"t":this.uniforms[i].value=n[r.value]||null;break;case"c":this.uniforms[i].value=new Ke().setHex(r.value);break;case"v2":this.uniforms[i].value=new ze().fromArray(r.value);break;case"v3":this.uniforms[i].value=new U().fromArray(r.value);break;case"v4":this.uniforms[i].value=new St().fromArray(r.value);break;case"m3":this.uniforms[i].value=new Ve().fromArray(r.value);break;case"m4":this.uniforms[i].value=new vt().fromArray(r.value);break;default:this.uniforms[i].value=r.value}}if(e.defines!==void 0&&(this.defines=e.defines),e.vertexShader!==void 0&&(this.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(this.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(this.glslVersion=e.glslVersion),e.extensions!==void 0)for(const i in e.extensions)this.extensions[i]=e.extensions[i];return e.lights!==void 0&&(this.lights=e.lights),e.clipping!==void 0&&(this.clipping=e.clipping),this}}class Ip extends si{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}}class yx extends Tr{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new Ke(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Ke(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=_u,this.normalScale=new ze(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new zi,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class Mx extends Tr{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=Dv,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}}class Ex extends Tr{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}}class Np extends Ut{constructor(e,n=1){super(),this.isLight=!0,this.type="Light",this.color=new Ke(e),this.intensity=n}dispose(){this.dispatchEvent({type:"dispose"})}copy(e,n){return super.copy(e,n),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){const n=super.toJSON(e);return n.object.color=this.color.getHex(),n.object.intensity=this.intensity,n}}class Tx extends Np{constructor(e,n,i){super(e,i),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(Ut.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Ke(n)}copy(e,n){return super.copy(e,n),this.groundColor.copy(e.groundColor),this}toJSON(e){const n=super.toJSON(e);return n.object.groundColor=this.groundColor.getHex(),n}}const Ju=new vt,Up=new U,Fp=new U;class wx{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new ze(512,512),this.mapType=sn,this.map=null,this.mapPass=null,this.matrix=new vt,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Ku,this._frameExtents=new ze(1,1),this._viewportCount=1,this._viewports=[new St(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){const n=this.camera,i=this.matrix;Up.setFromMatrixPosition(e.matrixWorld),n.position.copy(Up),Fp.setFromMatrixPosition(e.target.matrixWorld),n.lookAt(Fp),n.updateMatrixWorld(),Ju.multiplyMatrices(n.projectionMatrix,n.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Ju,n.coordinateSystem,n.reversedDepth),n.coordinateSystem===Ks||n.reversedDepth?i.set(.5,0,0,.5,0,.5,0,.5,0,0,1,0,0,0,0,1):i.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),i.multiply(Ju)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){const e={};return this.intensity!==1&&(e.intensity=this.intensity),this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}}const Oa=new U,Ba=new Bi,oi=new U;class Op extends Ut{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new vt,this.projectionMatrix=new vt,this.projectionMatrixInverse=new vt,this.coordinateSystem=ii,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,n){return super.copy(e,n),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(Oa,Ba,oi),oi.x===1&&oi.y===1&&oi.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Oa,Ba,oi.set(1,1,1)).invert()}updateWorldMatrix(e,n,i=!1){super.updateWorldMatrix(e,n,i),this.matrixWorld.decompose(Oa,Ba,oi),oi.x===1&&oi.y===1&&oi.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Oa,Ba,oi.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}}const Yi=new U,Bp=new ze,kp=new ze;class Dn extends Op{constructor(e=50,n=1,i=.1,r=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=i,this.far=r,this.focus=10,this.aspect=n,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,n){return super.copy(e,n),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){const n=.5*this.getFilmHeight()/e;this.fov=yu*2*Math.atan(n),this.updateProjectionMatrix()}getFocalLength(){const e=Math.tan(ua*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return yu*2*Math.atan(Math.tan(ua*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,n,i){Yi.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(Yi.x,Yi.y).multiplyScalar(-e/Yi.z),Yi.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),i.set(Yi.x,Yi.y).multiplyScalar(-e/Yi.z)}getViewSize(e,n){return this.getViewBounds(e,Bp,kp),n.subVectors(kp,Bp)}setViewOffset(e,n,i,r,s,o){this.aspect=e/n,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=n,this.view.offsetX=i,this.view.offsetY=r,this.view.width=s,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=this.near;let n=e*Math.tan(ua*.5*this.fov)/this.zoom,i=2*n,r=this.aspect*i,s=-.5*r;const o=this.view;if(this.view!==null&&this.view.enabled){const l=o.fullWidth,c=o.fullHeight;s+=o.offsetX*r/l,n-=o.offsetY*i/c,r*=o.width/l,i*=o.height/c}const a=this.filmOffset;a!==0&&(s+=e*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(s,s+r,n,n-i,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const n=super.toJSON(e);return n.object.fov=this.fov,n.object.zoom=this.zoom,n.object.near=this.near,n.object.far=this.far,n.object.focus=this.focus,n.object.aspect=this.aspect,this.view!==null&&(n.object.view=Object.assign({},this.view)),n.object.filmGauge=this.filmGauge,n.object.filmOffset=this.filmOffset,n}}class ju extends Op{constructor(e=-1,n=1,i=1,r=-1,s=.1,o=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=n,this.top=i,this.bottom=r,this.near=s,this.far=o,this.updateProjectionMatrix()}copy(e,n){return super.copy(e,n),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,n,i,r,s,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=n,this.view.offsetX=i,this.view.offsetY=r,this.view.width=s,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=(this.right-this.left)/(2*this.zoom),n=(this.top-this.bottom)/(2*this.zoom),i=(this.right+this.left)/2,r=(this.top+this.bottom)/2;let s=i-e,o=i+e,a=r+n,l=r-n;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,d=(this.top-this.bottom)/this.view.fullHeight/this.zoom;s+=c*this.view.offsetX,o=s+c*this.view.width,a-=d*this.view.offsetY,l=a-d*this.view.height}this.projectionMatrix.makeOrthographic(s,o,a,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const n=super.toJSON(e);return n.object.zoom=this.zoom,n.object.left=this.left,n.object.right=this.right,n.object.top=this.top,n.object.bottom=this.bottom,n.object.near=this.near,n.object.far=this.far,this.view!==null&&(n.object.view=Object.assign({},this.view)),n}}class Ax extends wx{constructor(){super(new ju(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class Rx extends Np{constructor(e,n){super(e,n),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Ut.DEFAULT_UP),this.updateMatrix(),this.target=new Ut,this.shadow=new Ax}dispose(){super.dispose(),this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}toJSON(e){const n=super.toJSON(e);return n.object.shadow=this.shadow.toJSON(),n.object.target=this.target.uuid,n}}const us=-90,fs=1;class bx extends Ut{constructor(e,n,i){super(),this.type="CubeCamera",this.renderTarget=i,this.coordinateSystem=null,this.activeMipmapLevel=0;const r=new Dn(us,fs,e,n);r.layers=this.layers,this.add(r);const s=new Dn(us,fs,e,n);s.layers=this.layers,this.add(s);const o=new Dn(us,fs,e,n);o.layers=this.layers,this.add(o);const a=new Dn(us,fs,e,n);a.layers=this.layers,this.add(a);const l=new Dn(us,fs,e,n);l.layers=this.layers,this.add(l);const c=new Dn(us,fs,e,n);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){const e=this.coordinateSystem,n=this.children.concat(),[i,r,s,o,a,l]=n;for(const c of n)this.remove(c);if(e===ii)i.up.set(0,1,0),i.lookAt(1,0,0),r.up.set(0,1,0),r.lookAt(-1,0,0),s.up.set(0,0,-1),s.lookAt(0,1,0),o.up.set(0,0,1),o.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===Ks)i.up.set(0,-1,0),i.lookAt(-1,0,0),r.up.set(0,-1,0),r.lookAt(1,0,0),s.up.set(0,0,1),s.lookAt(0,1,0),o.up.set(0,0,-1),o.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(const c of n)this.add(c),c.updateMatrixWorld()}update(e,n){this.parent===null&&this.updateMatrixWorld();const{renderTarget:i,activeMipmapLevel:r}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());const[s,o,a,l,c,d]=this.children,h=e.getRenderTarget(),u=e.getActiveCubeFace(),p=e.getActiveMipmapLevel(),g=e.xr.enabled;e.xr.enabled=!1;const M=i.texture.generateMipmaps;i.texture.generateMipmaps=!1;let m=!1;e.isWebGLRenderer===!0?m=e.state.buffers.depth.getReversed():m=e.reversedDepthBuffer,e.setRenderTarget(i,0,r),m&&e.autoClear===!1&&e.clearDepth(),e.render(n,s),e.setRenderTarget(i,1,r),m&&e.autoClear===!1&&e.clearDepth(),e.render(n,o),e.setRenderTarget(i,2,r),m&&e.autoClear===!1&&e.clearDepth(),e.render(n,a),e.setRenderTarget(i,3,r),m&&e.autoClear===!1&&e.clearDepth(),e.render(n,l),e.setRenderTarget(i,4,r),m&&e.autoClear===!1&&e.clearDepth(),e.render(n,c),i.texture.generateMipmaps=M,e.setRenderTarget(i,5,r),m&&e.autoClear===!1&&e.clearDepth(),e.render(n,d),e.setRenderTarget(h,u,p),e.xr.enabled=g,i.texture.needsPMREMUpdate=!0}}class Cx extends Dn{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}}class zp{constructor(e=1,n=0,i=0){this.radius=e,this.phi=n,this.theta=i}set(e,n,i){return this.radius=e,this.phi=n,this.theta=i,this}copy(e){return this.radius=e.radius,this.phi=e.phi,this.theta=e.theta,this}makeSafe(){return this.phi=Je(this.phi,1e-6,Math.PI-1e-6),this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,n,i){return this.radius=Math.sqrt(e*e+n*n+i*i),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(e,i),this.phi=Math.acos(Je(n/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}}const bh=class bh{constructor(e,n,i,r){this.elements=[1,0,0,1],e!==void 0&&this.set(e,n,i,r)}identity(){return this.set(1,0,0,1),this}fromArray(e,n=0){for(let i=0;i<4;i++)this.elements[i]=e[i+n];return this}set(e,n,i,r){const s=this.elements;return s[0]=e,s[2]=n,s[1]=i,s[3]=r,this}};bh.prototype.isMatrix2=!0;let Vp=bh;class Px extends Na{constructor(e=10,n=10,i=4473924,r=8947848){i=new Ke(i),r=new Ke(r);const s=n/2,o=e/n,a=e/2,l=[],c=[];for(let u=0,p=0,g=-a;u<=n;u++,g+=o){l.push(-a,0,g,a,0,g),l.push(g,0,-a,g,0,a);const M=u===s?i:r;M.toArray(c,p),p+=3,M.toArray(c,p),p+=3,M.toArray(c,p),p+=3,M.toArray(c,p),p+=3}const d=new Xt;d.setAttribute("position",new Jt(l,3)),d.setAttribute("color",new Jt(c,3));const h=new no({vertexColors:!0,toneMapped:!1});super(d,h),this.type="GridHelper"}dispose(){this.geometry.dispose(),this.material.dispose()}}class Lx extends Na{constructor(e=1){const n=[0,0,0,e,0,0,0,0,0,0,e,0,0,0,0,0,0,e],i=[1,0,0,1,.6,0,0,1,0,.6,1,0,0,0,1,0,.6,1],r=new Xt;r.setAttribute("position",new Jt(n,3)),r.setAttribute("color",new Jt(i,3));const s=new no({vertexColors:!0,toneMapped:!1});super(r,s),this.type="AxesHelper"}setColors(e,n,i){const r=new Ke,s=this.geometry.attributes.color.array;return r.set(e),r.toArray(s,0),r.toArray(s,3),r.set(n),r.toArray(s,6),r.toArray(s,9),r.set(i),r.toArray(s,12),r.toArray(s,15),this.geometry.attributes.color.needsUpdate=!0,this}dispose(){this.geometry.dispose(),this.material.dispose()}}class Dx extends Oi{constructor(e,n=null){super(),this.object=e,this.domElement=n,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(e){if(e===void 0){Ne("Controls: connect() now requires an element.");return}this.domElement!==null&&this.disconnect(),this.domElement=e}disconnect(){}dispose(){}update(){}}function Hp(t,e,n,i){const r=Ix(i);switch(n){case Zh:return t*e;case Oc:return t*e/r.components*r.byteLength;case Bc:return t*e/r.components*r.byteLength;case yr:return t*e*2/r.components*r.byteLength;case kc:return t*e*2/r.components*r.byteLength;case qh:return t*e*3/r.components*r.byteLength;case bn:return t*e*4/r.components*r.byteLength;case zc:return t*e*4/r.components*r.byteLength;case ta:case na:return Math.floor((t+3)/4)*Math.floor((e+3)/4)*8;case ia:case ra:return Math.floor((t+3)/4)*Math.floor((e+3)/4)*16;case Hc:case Wc:return Math.max(t,16)*Math.max(e,8)/4;case Vc:case Gc:return Math.max(t,8)*Math.max(e,8)/2;case Xc:case Yc:case Zc:case qc:return Math.floor((t+3)/4)*Math.floor((e+3)/4)*8;case Kc:case sa:case Qc:return Math.floor((t+3)/4)*Math.floor((e+3)/4)*16;case Jc:return Math.floor((t+3)/4)*Math.floor((e+3)/4)*16;case jc:return Math.floor((t+4)/5)*Math.floor((e+3)/4)*16;case $c:return Math.floor((t+4)/5)*Math.floor((e+4)/5)*16;case eu:return Math.floor((t+5)/6)*Math.floor((e+4)/5)*16;case tu:return Math.floor((t+5)/6)*Math.floor((e+5)/6)*16;case nu:return Math.floor((t+7)/8)*Math.floor((e+4)/5)*16;case iu:return Math.floor((t+7)/8)*Math.floor((e+5)/6)*16;case ru:return Math.floor((t+7)/8)*Math.floor((e+7)/8)*16;case su:return Math.floor((t+9)/10)*Math.floor((e+4)/5)*16;case ou:return Math.floor((t+9)/10)*Math.floor((e+5)/6)*16;case au:return Math.floor((t+9)/10)*Math.floor((e+7)/8)*16;case lu:return Math.floor((t+9)/10)*Math.floor((e+9)/10)*16;case cu:return Math.floor((t+11)/12)*Math.floor((e+9)/10)*16;case uu:return Math.floor((t+11)/12)*Math.floor((e+11)/12)*16;case fu:case du:case hu:return Math.ceil(t/4)*Math.ceil(e/4)*16;case pu:case mu:return Math.ceil(t/4)*Math.ceil(e/4)*8;case oa:case gu:return Math.ceil(t/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${n} format.`)}function Ix(t){switch(t){case sn:case Wh:return{byteLength:1,components:1};case Xs:case Xh:case vi:return{byteLength:2,components:1};case Uc:case Fc:return{byteLength:2,components:4};case ti:case Nc:case ni:return{byteLength:4,components:1};case Yh:case Kh:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${t}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:xc}})),typeof window<"u"&&(window.__THREE__?Ne("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=xc);/**
 * @license
 * Copyright 2010-2026 Three.js Authors
 * SPDX-License-Identifier: MIT
 */function Gp(){let t=null,e=!1,n=null,i=null;function r(s,o){n(s,o),i=t.requestAnimationFrame(r)}return{start:function(){e!==!0&&n!==null&&t!==null&&(i=t.requestAnimationFrame(r),e=!0)},stop:function(){t!==null&&t.cancelAnimationFrame(i),e=!1},setAnimationLoop:function(s){n=s},setContext:function(s){t=s}}}function Nx(t){const e=new WeakMap;function n(a,l){const c=a.array,d=a.usage,h=c.byteLength,u=t.createBuffer();t.bindBuffer(l,u),t.bufferData(l,c,d),a.onUploadCallback();let p;if(c instanceof Float32Array)p=t.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)p=t.HALF_FLOAT;else if(c instanceof Uint16Array)a.isFloat16BufferAttribute?p=t.HALF_FLOAT:p=t.UNSIGNED_SHORT;else if(c instanceof Int16Array)p=t.SHORT;else if(c instanceof Uint32Array)p=t.UNSIGNED_INT;else if(c instanceof Int32Array)p=t.INT;else if(c instanceof Int8Array)p=t.BYTE;else if(c instanceof Uint8Array)p=t.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)p=t.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:u,type:p,bytesPerElement:c.BYTES_PER_ELEMENT,version:a.version,size:h}}function i(a,l,c){const d=l.array,h=l.updateRanges;if(t.bindBuffer(c,a),h.length===0)t.bufferSubData(c,0,d);else{h.sort((p,g)=>p.start-g.start);let u=0;for(let p=1;p<h.length;p++){const g=h[u],M=h[p];M.start<=g.start+g.count+1?g.count=Math.max(g.count,M.start+M.count-g.start):(++u,h[u]=M)}h.length=u+1;for(let p=0,g=h.length;p<g;p++){const M=h[p];t.bufferSubData(c,M.start*d.BYTES_PER_ELEMENT,d,M.start,M.count)}l.clearUpdateRanges()}l.onUploadCallback()}function r(a){return a.isInterleavedBufferAttribute&&(a=a.data),e.get(a)}function s(a){a.isInterleavedBufferAttribute&&(a=a.data);const l=e.get(a);l&&(t.deleteBuffer(l.buffer),e.delete(a))}function o(a,l){if(a.isInterleavedBufferAttribute&&(a=a.data),a.isGLBufferAttribute){const d=e.get(a);(!d||d.version<a.version)&&e.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}const c=e.get(a);if(c===void 0)e.set(a,n(a,l));else if(c.version<a.version){if(c.size!==a.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(c.buffer,a,l),c.version=a.version}}return{get:r,remove:s,update:o}}var Ux=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Fx=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,Ox=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,Bx=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,kx=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,zx=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Vx=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,Hx=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Gx=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,Wx=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Xx=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Yx=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Kx=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Zx=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,qx=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Qx=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,Jx=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,jx=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,$x=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,eS=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,tS=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,nS=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,iS=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,rS=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,sS=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,oS=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,aS=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,lS=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,cS=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,uS=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,fS="gl_FragColor = linearToOutputTexel( gl_FragColor );",dS=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,hS=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,pS=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,mS=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,gS=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,_S=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,vS=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,xS=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,SS=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,yS=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,MS=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,ES=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,TS=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,wS=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,AS=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,RS=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,bS=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,CS=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,PS=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,LS=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,DS=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,IS=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
		vec3 iridescenceFresnelDielectric;
		vec3 iridescenceFresnelMetallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
vec3 BRDF_GGX_Multiscatter( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 singleScatter = BRDF_GGX( lightDir, viewDir, normal, material );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 dfgV = texture2D( dfgLUT, vec2( material.roughness, dotNV ) ).rg;
	vec2 dfgL = texture2D( dfgLUT, vec2( material.roughness, dotNL ) ).rg;
	vec3 FssEss_V = material.specularColorBlended * dfgV.x + material.specularF90 * dfgV.y;
	vec3 FssEss_L = material.specularColorBlended * dfgL.x + material.specularF90 * dfgL.y;
	float Ess_V = dfgV.x + dfgV.y;
	float Ess_L = dfgL.x + dfgL.y;
	float Ems_V = 1.0 - Ess_V;
	float Ems_L = 1.0 - Ess_L;
	vec3 Favg = material.specularColorBlended + ( 1.0 - material.specularColorBlended ) * 0.047619;
	vec3 Fms = FssEss_V * FssEss_L * Favg / ( 1.0 - Ems_V * Ems_L * Favg + EPSILON );
	float compensationFactor = Ems_V * Ems_L;
	vec3 multiScatter = Fms * compensationFactor;
	return singleScatter + multiScatter;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX_Multiscatter( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnelDielectric, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceFresnelMetallic, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,NS=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( material.iridescenceFresnelDielectric, material.iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,US=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,FS=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,OS=`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,BS=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,kS=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,zS=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,VS=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,HS=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,GS=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,WS=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,XS=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,YS=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,KS=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,ZS=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,qS=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,QS=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,JS=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,jS=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,$S=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,ey=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,ty=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,ny=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,iy=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,ry=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,sy=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,oy=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,ay=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,ly=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,cy=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,uy=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,fy=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,dy=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,hy=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,py=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,my=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,gy=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,_y=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,vy=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,xy=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,Sy=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,yy=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,My=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,Ey=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,Ty=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,wy=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,Ay=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Ry=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,by=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,Cy=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,Py=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,Ly=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Dy=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Iy=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,Ny=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const Xe={alphahash_fragment:Ux,alphahash_pars_fragment:Fx,alphamap_fragment:Ox,alphamap_pars_fragment:Bx,alphatest_fragment:kx,alphatest_pars_fragment:zx,aomap_fragment:Vx,aomap_pars_fragment:Hx,batching_pars_vertex:Gx,batching_vertex:Wx,begin_vertex:Xx,beginnormal_vertex:Yx,bsdfs:Kx,iridescence_fragment:Zx,bumpmap_pars_fragment:qx,clipping_planes_fragment:Qx,clipping_planes_pars_fragment:Jx,clipping_planes_pars_vertex:jx,clipping_planes_vertex:$x,color_fragment:eS,color_pars_fragment:tS,color_pars_vertex:nS,color_vertex:iS,common:rS,cube_uv_reflection_fragment:sS,defaultnormal_vertex:oS,displacementmap_pars_vertex:aS,displacementmap_vertex:lS,emissivemap_fragment:cS,emissivemap_pars_fragment:uS,colorspace_fragment:fS,colorspace_pars_fragment:dS,envmap_fragment:hS,envmap_common_pars_fragment:pS,envmap_pars_fragment:mS,envmap_pars_vertex:gS,envmap_physical_pars_fragment:RS,envmap_vertex:_S,fog_vertex:vS,fog_pars_vertex:xS,fog_fragment:SS,fog_pars_fragment:yS,gradientmap_pars_fragment:MS,lightmap_pars_fragment:ES,lights_lambert_fragment:TS,lights_lambert_pars_fragment:wS,lights_pars_begin:AS,lights_toon_fragment:bS,lights_toon_pars_fragment:CS,lights_phong_fragment:PS,lights_phong_pars_fragment:LS,lights_physical_fragment:DS,lights_physical_pars_fragment:IS,lights_fragment_begin:NS,lights_fragment_maps:US,lights_fragment_end:FS,lightprobes_pars_fragment:OS,logdepthbuf_fragment:BS,logdepthbuf_pars_fragment:kS,logdepthbuf_pars_vertex:zS,logdepthbuf_vertex:VS,map_fragment:HS,map_pars_fragment:GS,map_particle_fragment:WS,map_particle_pars_fragment:XS,metalnessmap_fragment:YS,metalnessmap_pars_fragment:KS,morphinstance_vertex:ZS,morphcolor_vertex:qS,morphnormal_vertex:QS,morphtarget_pars_vertex:JS,morphtarget_vertex:jS,normal_fragment_begin:$S,normal_fragment_maps:ey,normal_pars_fragment:ty,normal_pars_vertex:ny,normal_vertex:iy,normalmap_pars_fragment:ry,clearcoat_normal_fragment_begin:sy,clearcoat_normal_fragment_maps:oy,clearcoat_pars_fragment:ay,iridescence_pars_fragment:ly,opaque_fragment:cy,packing:uy,premultiplied_alpha_fragment:fy,project_vertex:dy,dithering_fragment:hy,dithering_pars_fragment:py,roughnessmap_fragment:my,roughnessmap_pars_fragment:gy,shadowmap_pars_fragment:_y,shadowmap_pars_vertex:vy,shadowmap_vertex:xy,shadowmask_pars_fragment:Sy,skinbase_vertex:yy,skinning_pars_vertex:My,skinning_vertex:Ey,skinnormal_vertex:Ty,specularmap_fragment:wy,specularmap_pars_fragment:Ay,tonemapping_fragment:Ry,tonemapping_pars_fragment:by,transmission_fragment:Cy,transmission_pars_fragment:Py,uv_pars_fragment:Ly,uv_pars_vertex:Dy,uv_vertex:Iy,worldpos_vertex:Ny,background_vert:`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,background_frag:`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,backgroundCube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,backgroundCube_frag:`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,cube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,cube_frag:`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,depth_vert:`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,depth_frag:`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,distance_vert:`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,distance_frag:`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,equirect_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,equirect_frag:`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,linedashed_vert:`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,linedashed_frag:`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,meshbasic_vert:`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,meshbasic_frag:`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshlambert_vert:`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshlambert_frag:`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshmatcap_vert:`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,meshmatcap_frag:`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshnormal_vert:`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,meshnormal_frag:`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,meshphong_vert:`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshphong_frag:`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshphysical_vert:`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,meshphysical_frag:`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshtoon_vert:`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshtoon_frag:`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,points_vert:`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,points_frag:`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,shadow_vert:`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,shadow_frag:`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,sprite_vert:`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,sprite_frag:`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`},pe={common:{diffuse:{value:new Ke(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Ve},alphaMap:{value:null},alphaMapTransform:{value:new Ve},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Ve}},envmap:{envMap:{value:null},envMapRotation:{value:new Ve},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Ve}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Ve}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Ve},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Ve},normalScale:{value:new ze(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Ve},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Ve}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Ve}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Ve}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Ke(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new U},probesMax:{value:new U},probesResolution:{value:new U}},points:{diffuse:{value:new Ke(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Ve},alphaTest:{value:0},uvTransform:{value:new Ve}},sprite:{diffuse:{value:new Ke(16777215)},opacity:{value:1},center:{value:new ze(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Ve},alphaMap:{value:null},alphaMapTransform:{value:new Ve},alphaTest:{value:0}}},ai={basic:{uniforms:an([pe.common,pe.specularmap,pe.envmap,pe.aomap,pe.lightmap,pe.fog]),vertexShader:Xe.meshbasic_vert,fragmentShader:Xe.meshbasic_frag},lambert:{uniforms:an([pe.common,pe.specularmap,pe.envmap,pe.aomap,pe.lightmap,pe.emissivemap,pe.bumpmap,pe.normalmap,pe.displacementmap,pe.fog,pe.lights,{emissive:{value:new Ke(0)},envMapIntensity:{value:1}}]),vertexShader:Xe.meshlambert_vert,fragmentShader:Xe.meshlambert_frag},phong:{uniforms:an([pe.common,pe.specularmap,pe.envmap,pe.aomap,pe.lightmap,pe.emissivemap,pe.bumpmap,pe.normalmap,pe.displacementmap,pe.fog,pe.lights,{emissive:{value:new Ke(0)},specular:{value:new Ke(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Xe.meshphong_vert,fragmentShader:Xe.meshphong_frag},standard:{uniforms:an([pe.common,pe.envmap,pe.aomap,pe.lightmap,pe.emissivemap,pe.bumpmap,pe.normalmap,pe.displacementmap,pe.roughnessmap,pe.metalnessmap,pe.fog,pe.lights,{emissive:{value:new Ke(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Xe.meshphysical_vert,fragmentShader:Xe.meshphysical_frag},toon:{uniforms:an([pe.common,pe.aomap,pe.lightmap,pe.emissivemap,pe.bumpmap,pe.normalmap,pe.displacementmap,pe.gradientmap,pe.fog,pe.lights,{emissive:{value:new Ke(0)}}]),vertexShader:Xe.meshtoon_vert,fragmentShader:Xe.meshtoon_frag},matcap:{uniforms:an([pe.common,pe.bumpmap,pe.normalmap,pe.displacementmap,pe.fog,{matcap:{value:null}}]),vertexShader:Xe.meshmatcap_vert,fragmentShader:Xe.meshmatcap_frag},points:{uniforms:an([pe.points,pe.fog]),vertexShader:Xe.points_vert,fragmentShader:Xe.points_frag},dashed:{uniforms:an([pe.common,pe.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Xe.linedashed_vert,fragmentShader:Xe.linedashed_frag},depth:{uniforms:an([pe.common,pe.displacementmap]),vertexShader:Xe.depth_vert,fragmentShader:Xe.depth_frag},normal:{uniforms:an([pe.common,pe.bumpmap,pe.normalmap,pe.displacementmap,{opacity:{value:1}}]),vertexShader:Xe.meshnormal_vert,fragmentShader:Xe.meshnormal_frag},sprite:{uniforms:an([pe.sprite,pe.fog]),vertexShader:Xe.sprite_vert,fragmentShader:Xe.sprite_frag},background:{uniforms:{uvTransform:{value:new Ve},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Xe.background_vert,fragmentShader:Xe.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Ve}},vertexShader:Xe.backgroundCube_vert,fragmentShader:Xe.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Xe.cube_vert,fragmentShader:Xe.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Xe.equirect_vert,fragmentShader:Xe.equirect_frag},distance:{uniforms:an([pe.common,pe.displacementmap,{referencePosition:{value:new U},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Xe.distance_vert,fragmentShader:Xe.distance_frag},shadow:{uniforms:an([pe.lights,pe.fog,{color:{value:new Ke(0)},opacity:{value:1}}]),vertexShader:Xe.shadow_vert,fragmentShader:Xe.shadow_frag}};ai.physical={uniforms:an([ai.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Ve},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Ve},clearcoatNormalScale:{value:new ze(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Ve},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Ve},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Ve},sheen:{value:0},sheenColor:{value:new Ke(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Ve},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Ve},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Ve},transmissionSamplerSize:{value:new ze},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Ve},attenuationDistance:{value:0},attenuationColor:{value:new Ke(0)},specularColor:{value:new Ke(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Ve},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Ve},anisotropyVector:{value:new ze},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Ve}}]),vertexShader:Xe.meshphysical_vert,fragmentShader:Xe.meshphysical_frag};const ka={r:0,b:0,g:0},Uy=new vt,Wp=new Ve;Wp.set(-1,0,0,0,1,0,0,0,1);function Fy(t,e,n,i,r,s){const o=new Ke(0);let a=r===!0?0:1,l,c,d=null,h=0,u=null;function p(x){let y=x.isScene===!0?x.background:null;if(y&&y.isTexture){const S=x.backgroundBlurriness>0;y=e.get(y,S)}return y}function g(x){let y=!1;const S=p(x);S===null?m(o,a):S&&S.isColor&&(m(S,1),y=!0);const w=t.xr.getEnvironmentBlendMode();w==="additive"?n.buffers.color.setClear(0,0,0,1,s):w==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,s),(t.autoClear||y)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),t.clear(t.autoClearColor,t.autoClearDepth,t.autoClearStencil))}function M(x,y){const S=p(y);S&&(S.isCubeTexture||S.mapping===$o)?(c===void 0&&(c=new Ln(new ls(1,1,1),new si({name:"BackgroundCubeMaterial",uniforms:cs(ai.backgroundCube.uniforms),vertexShader:ai.backgroundCube.vertexShader,fragmentShader:ai.backgroundCube.fragmentShader,side:rn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(w,T,b){this.matrixWorld.copyPosition(b.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(c)),c.material.uniforms.envMap.value=S,c.material.uniforms.backgroundBlurriness.value=y.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=y.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(Uy.makeRotationFromEuler(y.backgroundRotation)).transpose(),S.isCubeTexture&&S.isRenderTargetTexture===!1&&c.material.uniforms.backgroundRotation.value.premultiply(Wp),c.material.toneMapped=$e.getTransfer(S.colorSpace)!==ot,(d!==S||h!==S.version||u!==t.toneMapping)&&(c.material.needsUpdate=!0,d=S,h=S.version,u=t.toneMapping),c.layers.enableAll(),x.unshift(c,c.geometry,c.material,0,0,null)):S&&S.isTexture&&(l===void 0&&(l=new Ln(new ro(2,2),new si({name:"BackgroundMaterial",uniforms:cs(ai.background.uniforms),vertexShader:ai.background.vertexShader,fragmentShader:ai.background.fragmentShader,side:$n,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(l)),l.material.uniforms.t2D.value=S,l.material.uniforms.backgroundIntensity.value=y.backgroundIntensity,l.material.toneMapped=$e.getTransfer(S.colorSpace)!==ot,S.matrixAutoUpdate===!0&&S.updateMatrix(),l.material.uniforms.uvTransform.value.copy(S.matrix),(d!==S||h!==S.version||u!==t.toneMapping)&&(l.material.needsUpdate=!0,d=S,h=S.version,u=t.toneMapping),l.layers.enableAll(),x.unshift(l,l.geometry,l.material,0,0,null))}function m(x,y){x.getRGB(ka,Dp(t)),n.buffers.color.setClear(ka.r,ka.g,ka.b,y,s)}function f(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return o},setClearColor:function(x,y=1){o.set(x),a=y,m(o,a)},getClearAlpha:function(){return a},setClearAlpha:function(x){a=x,m(o,a)},render:g,addToRenderList:M,dispose:f}}function Oy(t,e){const n=t.getParameter(t.MAX_VERTEX_ATTRIBS),i={},r=u(null);let s=r,o=!1;function a(P,D,W,Z,B){let X=!1;const H=h(P,Z,W,D);s!==H&&(s=H,c(s.object)),X=p(P,Z,W,B),X&&g(P,Z,W,B),B!==null&&e.update(B,t.ELEMENT_ARRAY_BUFFER),(X||o)&&(o=!1,S(P,D,W,Z),B!==null&&t.bindBuffer(t.ELEMENT_ARRAY_BUFFER,e.get(B).buffer))}function l(){return t.createVertexArray()}function c(P){return t.bindVertexArray(P)}function d(P){return t.deleteVertexArray(P)}function h(P,D,W,Z){const B=Z.wireframe===!0;let X=i[D.id];X===void 0&&(X={},i[D.id]=X);const H=P.isInstancedMesh===!0?P.id:0;let L=X[H];L===void 0&&(L={},X[H]=L);let k=L[W.id];k===void 0&&(k={},L[W.id]=k);let Y=k[B];return Y===void 0&&(Y=u(l()),k[B]=Y),Y}function u(P){const D=[],W=[],Z=[];for(let B=0;B<n;B++)D[B]=0,W[B]=0,Z[B]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:D,enabledAttributes:W,attributeDivisors:Z,object:P,attributes:{},index:null}}function p(P,D,W,Z){const B=s.attributes,X=D.attributes;let H=0;const L=W.getAttributes();for(const k in L)if(L[k].location>=0){const $=B[k];let oe=X[k];if(oe===void 0&&(k==="instanceMatrix"&&P.instanceMatrix&&(oe=P.instanceMatrix),k==="instanceColor"&&P.instanceColor&&(oe=P.instanceColor)),$===void 0||$.attribute!==oe||oe&&$.data!==oe.data)return!0;H++}return s.attributesNum!==H||s.index!==Z}function g(P,D,W,Z){const B={},X=D.attributes;let H=0;const L=W.getAttributes();for(const k in L)if(L[k].location>=0){let $=X[k];$===void 0&&(k==="instanceMatrix"&&P.instanceMatrix&&($=P.instanceMatrix),k==="instanceColor"&&P.instanceColor&&($=P.instanceColor));const oe={};oe.attribute=$,$&&$.data&&(oe.data=$.data),B[k]=oe,H++}s.attributes=B,s.attributesNum=H,s.index=Z}function M(){const P=s.newAttributes;for(let D=0,W=P.length;D<W;D++)P[D]=0}function m(P){f(P,0)}function f(P,D){const W=s.newAttributes,Z=s.enabledAttributes,B=s.attributeDivisors;W[P]=1,Z[P]===0&&(t.enableVertexAttribArray(P),Z[P]=1),B[P]!==D&&(t.vertexAttribDivisor(P,D),B[P]=D)}function x(){const P=s.newAttributes,D=s.enabledAttributes;for(let W=0,Z=D.length;W<Z;W++)D[W]!==P[W]&&(t.disableVertexAttribArray(W),D[W]=0)}function y(P,D,W,Z,B,X,H){H===!0?t.vertexAttribIPointer(P,D,W,B,X):t.vertexAttribPointer(P,D,W,Z,B,X)}function S(P,D,W,Z){M();const B=Z.attributes,X=W.getAttributes(),H=D.defaultAttributeValues;for(const L in X){const k=X[L];if(k.location>=0){let Y=B[L];if(Y===void 0&&(L==="instanceMatrix"&&P.instanceMatrix&&(Y=P.instanceMatrix),L==="instanceColor"&&P.instanceColor&&(Y=P.instanceColor)),Y!==void 0){const $=Y.normalized,oe=Y.itemSize,Be=e.get(Y);if(Be===void 0)continue;const Qe=Be.buffer,He=Be.type,q=Be.bytesPerElement,se=He===t.INT||He===t.UNSIGNED_INT||Y.gpuType===Nc;if(Y.isInterleavedBufferAttribute){const ie=Y.data,be=ie.stride,ke=Y.offset;if(ie.isInstancedInterleavedBuffer){for(let Ce=0;Ce<k.locationSize;Ce++)f(k.location+Ce,ie.meshPerAttribute);P.isInstancedMesh!==!0&&Z._maxInstanceCount===void 0&&(Z._maxInstanceCount=ie.meshPerAttribute*ie.count)}else for(let Ce=0;Ce<k.locationSize;Ce++)m(k.location+Ce);t.bindBuffer(t.ARRAY_BUFFER,Qe);for(let Ce=0;Ce<k.locationSize;Ce++)y(k.location+Ce,oe/k.locationSize,He,$,be*q,(ke+oe/k.locationSize*Ce)*q,se)}else{if(Y.isInstancedBufferAttribute){for(let ie=0;ie<k.locationSize;ie++)f(k.location+ie,Y.meshPerAttribute);P.isInstancedMesh!==!0&&Z._maxInstanceCount===void 0&&(Z._maxInstanceCount=Y.meshPerAttribute*Y.count)}else for(let ie=0;ie<k.locationSize;ie++)m(k.location+ie);t.bindBuffer(t.ARRAY_BUFFER,Qe);for(let ie=0;ie<k.locationSize;ie++)y(k.location+ie,oe/k.locationSize,He,$,oe*q,oe/k.locationSize*ie*q,se)}}else if(H!==void 0){const $=H[L];if($!==void 0)switch($.length){case 2:t.vertexAttrib2fv(k.location,$);break;case 3:t.vertexAttrib3fv(k.location,$);break;case 4:t.vertexAttrib4fv(k.location,$);break;default:t.vertexAttrib1fv(k.location,$)}}}}x()}function w(){A();for(const P in i){const D=i[P];for(const W in D){const Z=D[W];for(const B in Z){const X=Z[B];for(const H in X)d(X[H].object),delete X[H];delete Z[B]}}delete i[P]}}function T(P){if(i[P.id]===void 0)return;const D=i[P.id];for(const W in D){const Z=D[W];for(const B in Z){const X=Z[B];for(const H in X)d(X[H].object),delete X[H];delete Z[B]}}delete i[P.id]}function b(P){for(const D in i){const W=i[D];for(const Z in W){const B=W[Z];if(B[P.id]===void 0)continue;const X=B[P.id];for(const H in X)d(X[H].object),delete X[H];delete B[P.id]}}}function _(P){for(const D in i){const W=i[D],Z=P.isInstancedMesh===!0?P.id:0,B=W[Z];if(B!==void 0){for(const X in B){const H=B[X];for(const L in H)d(H[L].object),delete H[L];delete B[X]}delete W[Z],Object.keys(W).length===0&&delete i[D]}}}function A(){C(),o=!0,s!==r&&(s=r,c(s.object))}function C(){r.geometry=null,r.program=null,r.wireframe=!1}return{setup:a,reset:A,resetDefaultState:C,dispose:w,releaseStatesOfGeometry:T,releaseStatesOfObject:_,releaseStatesOfProgram:b,initAttributes:M,enableAttribute:m,disableUnusedAttributes:x}}function By(t,e,n){let i;function r(l){i=l}function s(l,c){t.drawArrays(i,l,c),n.update(c,i,1)}function o(l,c,d){d!==0&&(t.drawArraysInstanced(i,l,c,d),n.update(c,i,d))}function a(l,c,d){if(d===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,l,0,c,0,d);let u=0;for(let p=0;p<d;p++)u+=c[p];n.update(u,i,1)}this.setMode=r,this.render=s,this.renderInstances=o,this.renderMultiDraw=a}function ky(t,e,n,i){let r;function s(){if(r!==void 0)return r;if(e.has("EXT_texture_filter_anisotropic")===!0){const b=e.get("EXT_texture_filter_anisotropic");r=t.getParameter(b.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else r=0;return r}function o(b){return!(b!==bn&&i.convert(b)!==t.getParameter(t.IMPLEMENTATION_COLOR_READ_FORMAT))}function a(b){const _=b===vi&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(b!==sn&&i.convert(b)!==t.getParameter(t.IMPLEMENTATION_COLOR_READ_TYPE)&&b!==ni&&!_)}function l(b){if(b==="highp"){if(t.getShaderPrecisionFormat(t.VERTEX_SHADER,t.HIGH_FLOAT).precision>0&&t.getShaderPrecisionFormat(t.FRAGMENT_SHADER,t.HIGH_FLOAT).precision>0)return"highp";b="mediump"}return b==="mediump"&&t.getShaderPrecisionFormat(t.VERTEX_SHADER,t.MEDIUM_FLOAT).precision>0&&t.getShaderPrecisionFormat(t.FRAGMENT_SHADER,t.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=n.precision!==void 0?n.precision:"highp";const d=l(c);d!==c&&(Ne("WebGLRenderer:",c,"not supported, using",d,"instead."),c=d);const h=n.logarithmicDepthBuffer===!0,u=n.reversedDepthBuffer===!0&&e.has("EXT_clip_control");n.reversedDepthBuffer===!0&&u===!1&&Ne("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");const p=t.getParameter(t.MAX_TEXTURE_IMAGE_UNITS),g=t.getParameter(t.MAX_VERTEX_TEXTURE_IMAGE_UNITS),M=t.getParameter(t.MAX_TEXTURE_SIZE),m=t.getParameter(t.MAX_CUBE_MAP_TEXTURE_SIZE),f=t.getParameter(t.MAX_VERTEX_ATTRIBS),x=t.getParameter(t.MAX_VERTEX_UNIFORM_VECTORS),y=t.getParameter(t.MAX_VARYING_VECTORS),S=t.getParameter(t.MAX_FRAGMENT_UNIFORM_VECTORS),w=t.getParameter(t.MAX_SAMPLES),T=t.getParameter(t.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:s,getMaxPrecision:l,textureFormatReadable:o,textureTypeReadable:a,precision:c,logarithmicDepthBuffer:h,reversedDepthBuffer:u,maxTextures:p,maxVertexTextures:g,maxTextureSize:M,maxCubemapSize:m,maxAttributes:f,maxVertexUniforms:x,maxVaryings:y,maxFragmentUniforms:S,maxSamples:w,samples:T}}function zy(t){const e=this;let n=null,i=0,r=!1,s=!1;const o=new Xi,a=new Ve,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(h,u){const p=h.length!==0||u||i!==0||r;return r=u,i=h.length,p},this.beginShadows=function(){s=!0,d(null)},this.endShadows=function(){s=!1},this.setGlobalState=function(h,u){n=d(h,u,0)},this.setState=function(h,u,p){const g=h.clippingPlanes,M=h.clipIntersection,m=h.clipShadows,f=t.get(h);if(!r||g===null||g.length===0||s&&!m)s?d(null):c();else{const x=s?0:i,y=x*4;let S=f.clippingState||null;l.value=S,S=d(g,u,y,p);for(let w=0;w!==y;++w)S[w]=n[w];f.clippingState=S,this.numIntersection=M?this.numPlanes:0,this.numPlanes+=x}};function c(){l.value!==n&&(l.value=n,l.needsUpdate=i>0),e.numPlanes=i,e.numIntersection=0}function d(h,u,p,g){const M=h!==null?h.length:0;let m=null;if(M!==0){if(m=l.value,g!==!0||m===null){const f=p+M*4,x=u.matrixWorldInverse;a.getNormalMatrix(x),(m===null||m.length<f)&&(m=new Float32Array(f));for(let y=0,S=p;y!==M;++y,S+=4)o.copy(h[y]).applyMatrix4(x,a),o.normal.toArray(m,S),m[S+3]=o.constant}l.value=m,l.needsUpdate=!0}return e.numPlanes=M,e.numIntersection=0,m}}const Ki=4,Xp=[.125,.215,.35,.446,.526,.582],Rr=20,Vy=256,so=new ju,Yp=new Ke;let $u=null,ef=0,tf=0,nf=!1;const Hy=new U;class Kp{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._sigmas=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,n=0,i=.1,r=100,s={}){const{size:o=256,position:a=Hy}=s;$u=this._renderer.getRenderTarget(),ef=this._renderer.getActiveCubeFace(),tf=this._renderer.getActiveMipmapLevel(),nf=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(o);const l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(e,i,r,l,a),n>0&&this._blur(l,0,0,n),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(e,n=null){return this._fromTexture(e,n)}fromCubemap(e,n=null){return this._fromTexture(e,n)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Qp(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=qp(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget($u,ef,tf),this._renderer.xr.enabled=nf,e.scissorTest=!1,ds(e,0,0,e.width,e.height)}_fromTexture(e,n){e.mapping===vr||e.mapping===Kr?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),$u=this._renderer.getRenderTarget(),ef=this._renderer.getActiveCubeFace(),tf=this._renderer.getActiveMipmapLevel(),nf=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const i=n||this._allocateTargets();return this._textureToCubeUV(e,i),this._applyPMREM(i),this._cleanup(i),i}_allocateTargets(){const e=3*Math.max(this._cubeSize,112),n=4*this._cubeSize,i={magFilter:Dt,minFilter:Dt,generateMipmaps:!1,type:vi,format:bn,colorSpace:aa,depthBuffer:!1},r=Zp(e,n,i);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==n){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Zp(e,n,i);const{_lodMax:s}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods,sigmas:this._sigmas}=Gy(s)),this._blurMaterial=Xy(s,e,n),this._ggxMaterial=Wy(s,e,n)}return r}_compileMaterial(e){const n=new Ln(new Xt,e);this._renderer.compile(n,so)}_sceneToCubeUV(e,n,i,r,s){const l=new Dn(90,1,n,i),c=[1,-1,1,1,1,1],d=[1,1,1,-1,-1,-1],h=this._renderer,u=h.autoClear,p=h.toneMapping;h.getClearColor(Yp),h.toneMapping=ei,h.autoClear=!1,h.state.buffers.depth.getReversed()&&(h.setRenderTarget(r),h.clearDepth(),h.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new Ln(new ls,new Wu({name:"PMREM.Background",side:rn,depthWrite:!1,depthTest:!1})));const M=this._backgroundBox,m=M.material;let f=!1;const x=e.background;x?x.isColor&&(m.color.copy(x),e.background=null,f=!0):(m.color.copy(Yp),f=!0);for(let y=0;y<6;y++){const S=y%3;S===0?(l.up.set(0,c[y],0),l.position.set(s.x,s.y,s.z),l.lookAt(s.x+d[y],s.y,s.z)):S===1?(l.up.set(0,0,c[y]),l.position.set(s.x,s.y,s.z),l.lookAt(s.x,s.y+d[y],s.z)):(l.up.set(0,c[y],0),l.position.set(s.x,s.y,s.z),l.lookAt(s.x,s.y,s.z+d[y]));const w=this._cubeSize;ds(r,S*w,y>2?w:0,w,w),h.setRenderTarget(r),f&&h.render(M,l),h.render(e,l)}h.toneMapping=p,h.autoClear=u,e.background=x}_textureToCubeUV(e,n){const i=this._renderer,r=e.mapping===vr||e.mapping===Kr;r?(this._cubemapMaterial===null&&(this._cubemapMaterial=Qp()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=qp());const s=r?this._cubemapMaterial:this._equirectMaterial,o=this._lodMeshes[0];o.material=s;const a=s.uniforms;a.envMap.value=e;const l=this._cubeSize;ds(n,0,0,3*l,2*l),i.setRenderTarget(n),i.render(o,so)}_applyPMREM(e){const n=this._renderer,i=n.autoClear;n.autoClear=!1;const r=this._lodMeshes.length;for(let s=1;s<r;s++)this._applyGGXFilter(e,s-1,s);n.autoClear=i}_applyGGXFilter(e,n,i){const r=this._renderer,s=this._pingPongRenderTarget,o=this._ggxMaterial,a=this._lodMeshes[i];a.material=o;const l=o.uniforms,c=i/(this._lodMeshes.length-1),d=n/(this._lodMeshes.length-1),h=Math.sqrt(c*c-d*d),u=0+c*1.25,p=h*u,{_lodMax:g}=this,M=this._sizeLods[i],m=3*M*(i>g-Ki?i-g+Ki:0),f=4*(this._cubeSize-M);l.envMap.value=e.texture,l.roughness.value=p,l.mipInt.value=g-n,ds(s,m,f,3*M,2*M),r.setRenderTarget(s),r.render(a,so),l.envMap.value=s.texture,l.roughness.value=0,l.mipInt.value=g-i,ds(e,m,f,3*M,2*M),r.setRenderTarget(e),r.render(a,so)}_blur(e,n,i,r,s){const o=this._pingPongRenderTarget;this._halfBlur(e,o,n,i,r,"latitudinal",s),this._halfBlur(o,e,i,i,r,"longitudinal",s)}_halfBlur(e,n,i,r,s,o,a){const l=this._renderer,c=this._blurMaterial;o!=="latitudinal"&&o!=="longitudinal"&&tt("blur direction must be either latitudinal or longitudinal!");const d=3,h=this._lodMeshes[r];h.material=c;const u=c.uniforms,p=this._sizeLods[i]-1,g=isFinite(s)?Math.PI/(2*p):2*Math.PI/(2*Rr-1),M=s/g,m=isFinite(s)?1+Math.floor(d*M):Rr;m>Rr&&Ne(`sigmaRadians, ${s}, is too large and will clip, as it requested ${m} samples when the maximum is set to ${Rr}`);const f=[];let x=0;for(let b=0;b<Rr;++b){const _=b/M,A=Math.exp(-_*_/2);f.push(A),b===0?x+=A:b<m&&(x+=2*A)}for(let b=0;b<f.length;b++)f[b]=f[b]/x;u.envMap.value=e.texture,u.samples.value=m,u.weights.value=f,u.latitudinal.value=o==="latitudinal",a&&(u.poleAxis.value=a);const{_lodMax:y}=this;u.dTheta.value=g,u.mipInt.value=y-i;const S=this._sizeLods[r],w=3*S*(r>y-Ki?r-y+Ki:0),T=4*(this._cubeSize-S);ds(n,w,T,3*S,2*S),l.setRenderTarget(n),l.render(h,so)}}function Gy(t){const e=[],n=[],i=[];let r=t;const s=t-Ki+1+Xp.length;for(let o=0;o<s;o++){const a=Math.pow(2,r);e.push(a);let l=1/a;o>t-Ki?l=Xp[o-t+Ki-1]:o===0&&(l=0),n.push(l);const c=1/(a-2),d=-c,h=1+c,u=[d,d,h,d,h,h,d,d,h,h,d,h],p=6,g=6,M=3,m=2,f=1,x=new Float32Array(M*g*p),y=new Float32Array(m*g*p),S=new Float32Array(f*g*p);for(let T=0;T<p;T++){const b=T%3*2/3-1,_=T>2?0:-1,A=[b,_,0,b+2/3,_,0,b+2/3,_+1,0,b,_,0,b+2/3,_+1,0,b,_+1,0];x.set(A,M*g*T),y.set(u,m*g*T);const C=[T,T,T,T,T,T];S.set(C,f*g*T)}const w=new Xt;w.setAttribute("position",new bt(x,M)),w.setAttribute("uv",new bt(y,m)),w.setAttribute("faceIndex",new bt(S,f)),i.push(new Ln(w,null)),r>Ki&&r--}return{lodMeshes:i,sizeLods:e,sigmas:n}}function Zp(t,e,n){const i=new ri(t,e,n);return i.texture.mapping=$o,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function ds(t,e,n,i,r){t.viewport.set(e,n,i,r),t.scissor.set(e,n,i,r)}function Wy(t,e,n){return new si({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:Vy,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${t}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:za(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:_i,depthTest:!1,depthWrite:!1})}function Xy(t,e,n){const i=new Float32Array(Rr),r=new U(0,1,0);return new si({name:"SphericalGaussianBlur",defines:{n:Rr,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${t}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:i},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:r}},vertexShader:za(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:_i,depthTest:!1,depthWrite:!1})}function qp(){return new si({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:za(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:_i,depthTest:!1,depthWrite:!1})}function Qp(){return new si({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:za(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:_i,depthTest:!1,depthWrite:!1})}function za(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}class Jp extends ri{constructor(e=1,n={}){super(e,e,n),this.isWebGLCubeRenderTarget=!0;const i={width:e,height:e,depth:1},r=[i,i,i,i,i,i];this.texture=new bp(r),this._setTextureOptions(n),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,n){this.texture.type=n.type,this.texture.colorSpace=n.colorSpace,this.texture.generateMipmaps=n.generateMipmaps,this.texture.minFilter=n.minFilter,this.texture.magFilter=n.magFilter;const i={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},r=new ls(5,5,5),s=new si({name:"CubemapFromEquirect",uniforms:cs(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:rn,blending:_i});s.uniforms.tEquirect.value=n;const o=new Ln(r,s),a=n.minFilter;return n.minFilter===xr&&(n.minFilter=Dt),new bx(1,10,this).update(e,o),n.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(e,n=!0,i=!0,r=!0){const s=e.getRenderTarget();for(let o=0;o<6;o++)e.setRenderTarget(this,o),e.clear(n,i,r);e.setRenderTarget(s)}}function Yy(t){let e=new WeakMap,n=new WeakMap,i=null;function r(u,p=!1){return u==null?null:p?o(u):s(u)}function s(u){if(u&&u.isTexture){const p=u.mapping;if(p===Cc||p===Pc)if(e.has(u)){const g=e.get(u).texture;return a(g,u.mapping)}else{const g=u.image;if(g&&g.height>0){const M=new Jp(g.height);return M.fromEquirectangularTexture(t,u),e.set(u,M),u.addEventListener("dispose",c),a(M.texture,u.mapping)}else return null}}return u}function o(u){if(u&&u.isTexture){const p=u.mapping,g=p===Cc||p===Pc,M=p===vr||p===Kr;if(g||M){let m=n.get(u);const f=m!==void 0?m.texture.pmremVersion:0;if(u.isRenderTargetTexture&&u.pmremVersion!==f)return i===null&&(i=new Kp(t)),m=g?i.fromEquirectangular(u,m):i.fromCubemap(u,m),m.texture.pmremVersion=u.pmremVersion,n.set(u,m),m.texture;if(m!==void 0)return m.texture;{const x=u.image;return g&&x&&x.height>0||M&&x&&l(x)?(i===null&&(i=new Kp(t)),m=g?i.fromEquirectangular(u):i.fromCubemap(u),m.texture.pmremVersion=u.pmremVersion,n.set(u,m),u.addEventListener("dispose",d),m.texture):null}}}return u}function a(u,p){return p===Cc?u.mapping=vr:p===Pc&&(u.mapping=Kr),u}function l(u){let p=0;const g=6;for(let M=0;M<g;M++)u[M]!==void 0&&p++;return p===g}function c(u){const p=u.target;p.removeEventListener("dispose",c);const g=e.get(p);g!==void 0&&(e.delete(p),g.dispose())}function d(u){const p=u.target;p.removeEventListener("dispose",d);const g=n.get(p);g!==void 0&&(n.delete(p),g.dispose())}function h(){e=new WeakMap,n=new WeakMap,i!==null&&(i.dispose(),i=null)}return{get:r,dispose:h}}function Ky(t){const e={};function n(i){if(e[i]!==void 0)return e[i];const r=t.getExtension(i);return e[i]=r,r}return{has:function(i){return n(i)!==null},init:function(){n("EXT_color_buffer_float"),n("WEBGL_clip_cull_distance"),n("OES_texture_float_linear"),n("EXT_color_buffer_half_float"),n("WEBGL_multisampled_render_to_texture"),n("WEBGL_render_shared_exponent")},get:function(i){const r=n(i);return r===null&&qr("WebGLRenderer: "+i+" extension not supported."),r}}}function Zy(t,e,n,i){const r={},s=new WeakMap;function o(h){const u=h.target;u.index!==null&&e.remove(u.index);for(const g in u.attributes)e.remove(u.attributes[g]);u.removeEventListener("dispose",o),delete r[u.id];const p=s.get(u);p&&(e.remove(p),s.delete(u)),i.releaseStatesOfGeometry(u),u.isInstancedBufferGeometry===!0&&delete u._maxInstanceCount,n.memory.geometries--}function a(h,u){return r[u.id]===!0||(u.addEventListener("dispose",o),r[u.id]=!0,n.memory.geometries++),u}function l(h){const u=h.attributes;for(const p in u)e.update(u[p],t.ARRAY_BUFFER)}function c(h){const u=[],p=h.index,g=h.attributes.position;let M=0;if(g===void 0)return;if(p!==null){const x=p.array;M=p.version;for(let y=0,S=x.length;y<S;y+=3){const w=x[y+0],T=x[y+1],b=x[y+2];u.push(w,T,T,b,b,w)}}else{const x=g.array;M=g.version;for(let y=0,S=x.length/3-1;y<S;y+=3){const w=y+0,T=y+1,b=y+2;u.push(w,T,T,b,b,w)}}const m=new(g.count>=65535?_p:gp)(u,1);m.version=M;const f=s.get(h);f&&e.remove(f),s.set(h,m)}function d(h){const u=s.get(h);if(u){const p=h.index;p!==null&&u.version<p.version&&c(h)}else c(h);return s.get(h)}return{get:a,update:l,getWireframeAttribute:d}}function qy(t,e,n){let i;function r(h){i=h}let s,o;function a(h){s=h.type,o=h.bytesPerElement}function l(h,u){t.drawElements(i,u,s,h*o),n.update(u,i,1)}function c(h,u,p){p!==0&&(t.drawElementsInstanced(i,u,s,h*o,p),n.update(u,i,p))}function d(h,u,p){if(p===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,u,0,s,h,0,p);let M=0;for(let m=0;m<p;m++)M+=u[m];n.update(M,i,1)}this.setMode=r,this.setIndex=a,this.render=l,this.renderInstances=c,this.renderMultiDraw=d}function Qy(t){const e={geometries:0,textures:0},n={frame:0,calls:0,triangles:0,points:0,lines:0};function i(s,o,a){switch(n.calls++,o){case t.TRIANGLES:n.triangles+=a*(s/3);break;case t.LINES:n.lines+=a*(s/2);break;case t.LINE_STRIP:n.lines+=a*(s-1);break;case t.LINE_LOOP:n.lines+=a*s;break;case t.POINTS:n.points+=a*s;break;default:tt("WebGLInfo: Unknown draw mode:",o);break}}function r(){n.calls=0,n.triangles=0,n.points=0,n.lines=0}return{memory:e,render:n,programs:null,autoReset:!0,reset:r,update:i}}function Jy(t,e,n){const i=new WeakMap,r=new St;function s(o,a,l){const c=o.morphTargetInfluences,d=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,h=d!==void 0?d.length:0;let u=i.get(a);if(u===void 0||u.count!==h){let A=function(){b.dispose(),i.delete(a),a.removeEventListener("dispose",A)};u!==void 0&&u.texture.dispose();const p=a.morphAttributes.position!==void 0,g=a.morphAttributes.normal!==void 0,M=a.morphAttributes.color!==void 0,m=a.morphAttributes.position||[],f=a.morphAttributes.normal||[],x=a.morphAttributes.color||[];let y=0;p===!0&&(y=1),g===!0&&(y=2),M===!0&&(y=3);let S=a.attributes.position.count*y,w=1;S>e.maxTextureSize&&(w=Math.ceil(S/e.maxTextureSize),S=e.maxTextureSize);const T=new Float32Array(S*w*4*h),b=new rp(T,S,w,h);b.type=ni,b.needsUpdate=!0;const _=y*4;for(let C=0;C<h;C++){const P=m[C],D=f[C],W=x[C],Z=S*w*4*C;for(let B=0;B<P.count;B++){const X=B*_;p===!0&&(r.fromBufferAttribute(P,B),T[Z+X+0]=r.x,T[Z+X+1]=r.y,T[Z+X+2]=r.z,T[Z+X+3]=0),g===!0&&(r.fromBufferAttribute(D,B),T[Z+X+4]=r.x,T[Z+X+5]=r.y,T[Z+X+6]=r.z,T[Z+X+7]=0),M===!0&&(r.fromBufferAttribute(W,B),T[Z+X+8]=r.x,T[Z+X+9]=r.y,T[Z+X+10]=r.z,T[Z+X+11]=W.itemSize===4?r.w:1)}}u={count:h,texture:b,size:new ze(S,w)},i.set(a,u),a.addEventListener("dispose",A)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)l.getUniforms().setValue(t,"morphTexture",o.morphTexture,n);else{let p=0;for(let M=0;M<c.length;M++)p+=c[M];const g=a.morphTargetsRelative?1:1-p;l.getUniforms().setValue(t,"morphTargetBaseInfluence",g),l.getUniforms().setValue(t,"morphTargetInfluences",c)}l.getUniforms().setValue(t,"morphTargetsTexture",u.texture,n),l.getUniforms().setValue(t,"morphTargetsTextureSize",u.size)}return{update:s}}function jy(t,e,n,i,r){let s=new WeakMap;function o(c){const d=r.render.frame,h=c.geometry,u=e.get(c,h);if(s.get(u)!==d&&(e.update(u),s.set(u,d)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),s.get(c)!==d&&(n.update(c.instanceMatrix,t.ARRAY_BUFFER),c.instanceColor!==null&&n.update(c.instanceColor,t.ARRAY_BUFFER),s.set(c,d))),c.isSkinnedMesh){const p=c.skeleton;s.get(p)!==d&&(p.update(),s.set(p,d))}return u}function a(){s=new WeakMap}function l(c){const d=c.target;d.removeEventListener("dispose",l),i.releaseStatesOfObject(d),n.remove(d.instanceMatrix),d.instanceColor!==null&&n.remove(d.instanceColor)}return{update:o,dispose:a}}const $y={[Fh]:"LINEAR_TONE_MAPPING",[Oh]:"REINHARD_TONE_MAPPING",[Bh]:"CINEON_TONE_MAPPING",[kh]:"ACES_FILMIC_TONE_MAPPING",[Vh]:"AGX_TONE_MAPPING",[Hh]:"NEUTRAL_TONE_MAPPING",[zh]:"CUSTOM_TONE_MAPPING"};function eM(t,e,n,i,r,s){const o=new ri(e,n,{type:t,depthBuffer:r,stencilBuffer:s,samples:i?4:0,depthTexture:r?new as(e,n):void 0}),a=new ri(e,n,{type:vi,depthBuffer:!1,stencilBuffer:!1}),l=new Xt;l.setAttribute("position",new Jt([-1,3,0,-1,-1,0,3,-1,0],3)),l.setAttribute("uv",new Jt([0,2,0,0,2,0],2));const c=new Ip({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),d=new Ln(l,c),h=new ju(-1,1,1,-1,0,1);let u=null,p=null,g=!1,M,m=null,f=[],x=!1;this.setSize=function(y,S){o.setSize(y,S),a.setSize(y,S);for(let w=0;w<f.length;w++){const T=f[w];T.setSize&&T.setSize(y,S)}},this.setEffects=function(y){f=y,x=f.length>0&&f[0].isRenderPass===!0;const S=o.width,w=o.height;for(let T=0;T<f.length;T++){const b=f[T];b.setSize&&b.setSize(S,w)}},this.begin=function(y,S){if(g||y.toneMapping===ei&&f.length===0)return!1;if(m=S,S!==null){const w=S.width,T=S.height;(o.width!==w||o.height!==T)&&this.setSize(w,T)}return x===!1&&y.setRenderTarget(o),M=y.toneMapping,y.toneMapping=ei,!0},this.hasRenderPass=function(){return x},this.end=function(y,S){y.toneMapping=M,g=!0;let w=o,T=a;for(let b=0;b<f.length;b++){const _=f[b];if(_.enabled!==!1&&(_.render(y,T,w,S),_.needsSwap!==!1)){const A=w;w=T,T=A}}if(u!==y.outputColorSpace||p!==y.toneMapping){u=y.outputColorSpace,p=y.toneMapping,c.defines={},$e.getTransfer(u)===ot&&(c.defines.SRGB_TRANSFER="");const b=$y[p];b&&(c.defines[b]=""),c.needsUpdate=!0}c.uniforms.tDiffuse.value=w.texture,y.setRenderTarget(m),y.render(d,h),m=null,g=!1},this.isCompositing=function(){return g},this.dispose=function(){o.depthTexture&&o.depthTexture.dispose(),o.dispose(),a.dispose(),l.dispose(),c.dispose()}}const jp=new on,rf=new as(1,1),$p=new rp,em=new sp,tm=new bp,nm=[],im=[],rm=new Float32Array(16),sm=new Float32Array(9),om=new Float32Array(4);function hs(t,e,n){const i=t[0];if(i<=0||i>0)return t;const r=e*n;let s=nm[r];if(s===void 0&&(s=new Float32Array(r),nm[r]=s),e!==0){i.toArray(s,0);for(let o=1,a=0;o!==e;++o)a+=n,t[o].toArray(s,a)}return s}function Ft(t,e){if(t.length!==e.length)return!1;for(let n=0,i=t.length;n<i;n++)if(t[n]!==e[n])return!1;return!0}function Ot(t,e){for(let n=0,i=e.length;n<i;n++)t[n]=e[n]}function Va(t,e){let n=im[e];n===void 0&&(n=new Int32Array(e),im[e]=n);for(let i=0;i!==e;++i)n[i]=t.allocateTextureUnit();return n}function tM(t,e){const n=this.cache;n[0]!==e&&(t.uniform1f(this.addr,e),n[0]=e)}function nM(t,e){const n=this.cache;if(e.x!==void 0)(n[0]!==e.x||n[1]!==e.y)&&(t.uniform2f(this.addr,e.x,e.y),n[0]=e.x,n[1]=e.y);else{if(Ft(n,e))return;t.uniform2fv(this.addr,e),Ot(n,e)}}function iM(t,e){const n=this.cache;if(e.x!==void 0)(n[0]!==e.x||n[1]!==e.y||n[2]!==e.z)&&(t.uniform3f(this.addr,e.x,e.y,e.z),n[0]=e.x,n[1]=e.y,n[2]=e.z);else if(e.r!==void 0)(n[0]!==e.r||n[1]!==e.g||n[2]!==e.b)&&(t.uniform3f(this.addr,e.r,e.g,e.b),n[0]=e.r,n[1]=e.g,n[2]=e.b);else{if(Ft(n,e))return;t.uniform3fv(this.addr,e),Ot(n,e)}}function rM(t,e){const n=this.cache;if(e.x!==void 0)(n[0]!==e.x||n[1]!==e.y||n[2]!==e.z||n[3]!==e.w)&&(t.uniform4f(this.addr,e.x,e.y,e.z,e.w),n[0]=e.x,n[1]=e.y,n[2]=e.z,n[3]=e.w);else{if(Ft(n,e))return;t.uniform4fv(this.addr,e),Ot(n,e)}}function sM(t,e){const n=this.cache,i=e.elements;if(i===void 0){if(Ft(n,e))return;t.uniformMatrix2fv(this.addr,!1,e),Ot(n,e)}else{if(Ft(n,i))return;om.set(i),t.uniformMatrix2fv(this.addr,!1,om),Ot(n,i)}}function oM(t,e){const n=this.cache,i=e.elements;if(i===void 0){if(Ft(n,e))return;t.uniformMatrix3fv(this.addr,!1,e),Ot(n,e)}else{if(Ft(n,i))return;sm.set(i),t.uniformMatrix3fv(this.addr,!1,sm),Ot(n,i)}}function aM(t,e){const n=this.cache,i=e.elements;if(i===void 0){if(Ft(n,e))return;t.uniformMatrix4fv(this.addr,!1,e),Ot(n,e)}else{if(Ft(n,i))return;rm.set(i),t.uniformMatrix4fv(this.addr,!1,rm),Ot(n,i)}}function lM(t,e){const n=this.cache;n[0]!==e&&(t.uniform1i(this.addr,e),n[0]=e)}function cM(t,e){const n=this.cache;if(e.x!==void 0)(n[0]!==e.x||n[1]!==e.y)&&(t.uniform2i(this.addr,e.x,e.y),n[0]=e.x,n[1]=e.y);else{if(Ft(n,e))return;t.uniform2iv(this.addr,e),Ot(n,e)}}function uM(t,e){const n=this.cache;if(e.x!==void 0)(n[0]!==e.x||n[1]!==e.y||n[2]!==e.z)&&(t.uniform3i(this.addr,e.x,e.y,e.z),n[0]=e.x,n[1]=e.y,n[2]=e.z);else{if(Ft(n,e))return;t.uniform3iv(this.addr,e),Ot(n,e)}}function fM(t,e){const n=this.cache;if(e.x!==void 0)(n[0]!==e.x||n[1]!==e.y||n[2]!==e.z||n[3]!==e.w)&&(t.uniform4i(this.addr,e.x,e.y,e.z,e.w),n[0]=e.x,n[1]=e.y,n[2]=e.z,n[3]=e.w);else{if(Ft(n,e))return;t.uniform4iv(this.addr,e),Ot(n,e)}}function dM(t,e){const n=this.cache;n[0]!==e&&(t.uniform1ui(this.addr,e),n[0]=e)}function hM(t,e){const n=this.cache;if(e.x!==void 0)(n[0]!==e.x||n[1]!==e.y)&&(t.uniform2ui(this.addr,e.x,e.y),n[0]=e.x,n[1]=e.y);else{if(Ft(n,e))return;t.uniform2uiv(this.addr,e),Ot(n,e)}}function pM(t,e){const n=this.cache;if(e.x!==void 0)(n[0]!==e.x||n[1]!==e.y||n[2]!==e.z)&&(t.uniform3ui(this.addr,e.x,e.y,e.z),n[0]=e.x,n[1]=e.y,n[2]=e.z);else{if(Ft(n,e))return;t.uniform3uiv(this.addr,e),Ot(n,e)}}function mM(t,e){const n=this.cache;if(e.x!==void 0)(n[0]!==e.x||n[1]!==e.y||n[2]!==e.z||n[3]!==e.w)&&(t.uniform4ui(this.addr,e.x,e.y,e.z,e.w),n[0]=e.x,n[1]=e.y,n[2]=e.z,n[3]=e.w);else{if(Ft(n,e))return;t.uniform4uiv(this.addr,e),Ot(n,e)}}function gM(t,e,n){const i=this.cache,r=n.allocateTextureUnit();i[0]!==r&&(t.uniform1i(this.addr,r),i[0]=r);let s;this.type===t.SAMPLER_2D_SHADOW?(rf.compareFunction=n.isReversedDepthBuffer()?xu:vu,s=rf):s=jp,n.setTexture2D(e||s,r)}function _M(t,e,n){const i=this.cache,r=n.allocateTextureUnit();i[0]!==r&&(t.uniform1i(this.addr,r),i[0]=r),n.setTexture3D(e||em,r)}function vM(t,e,n){const i=this.cache,r=n.allocateTextureUnit();i[0]!==r&&(t.uniform1i(this.addr,r),i[0]=r),n.setTextureCube(e||tm,r)}function xM(t,e,n){const i=this.cache,r=n.allocateTextureUnit();i[0]!==r&&(t.uniform1i(this.addr,r),i[0]=r),n.setTexture2DArray(e||$p,r)}function SM(t){switch(t){case 5126:return tM;case 35664:return nM;case 35665:return iM;case 35666:return rM;case 35674:return sM;case 35675:return oM;case 35676:return aM;case 5124:case 35670:return lM;case 35667:case 35671:return cM;case 35668:case 35672:return uM;case 35669:case 35673:return fM;case 5125:return dM;case 36294:return hM;case 36295:return pM;case 36296:return mM;case 35678:case 36198:case 36298:case 36306:case 35682:return gM;case 35679:case 36299:case 36307:return _M;case 35680:case 36300:case 36308:case 36293:return vM;case 36289:case 36303:case 36311:case 36292:return xM}}function yM(t,e){t.uniform1fv(this.addr,e)}function MM(t,e){const n=hs(e,this.size,2);t.uniform2fv(this.addr,n)}function EM(t,e){const n=hs(e,this.size,3);t.uniform3fv(this.addr,n)}function TM(t,e){const n=hs(e,this.size,4);t.uniform4fv(this.addr,n)}function wM(t,e){const n=hs(e,this.size,4);t.uniformMatrix2fv(this.addr,!1,n)}function AM(t,e){const n=hs(e,this.size,9);t.uniformMatrix3fv(this.addr,!1,n)}function RM(t,e){const n=hs(e,this.size,16);t.uniformMatrix4fv(this.addr,!1,n)}function bM(t,e){t.uniform1iv(this.addr,e)}function CM(t,e){t.uniform2iv(this.addr,e)}function PM(t,e){t.uniform3iv(this.addr,e)}function LM(t,e){t.uniform4iv(this.addr,e)}function DM(t,e){t.uniform1uiv(this.addr,e)}function IM(t,e){t.uniform2uiv(this.addr,e)}function NM(t,e){t.uniform3uiv(this.addr,e)}function UM(t,e){t.uniform4uiv(this.addr,e)}function FM(t,e,n){const i=this.cache,r=e.length,s=Va(n,r);Ft(i,s)||(t.uniform1iv(this.addr,s),Ot(i,s));let o;this.type===t.SAMPLER_2D_SHADOW?o=rf:o=jp;for(let a=0;a!==r;++a)n.setTexture2D(e[a]||o,s[a])}function OM(t,e,n){const i=this.cache,r=e.length,s=Va(n,r);Ft(i,s)||(t.uniform1iv(this.addr,s),Ot(i,s));for(let o=0;o!==r;++o)n.setTexture3D(e[o]||em,s[o])}function BM(t,e,n){const i=this.cache,r=e.length,s=Va(n,r);Ft(i,s)||(t.uniform1iv(this.addr,s),Ot(i,s));for(let o=0;o!==r;++o)n.setTextureCube(e[o]||tm,s[o])}function kM(t,e,n){const i=this.cache,r=e.length,s=Va(n,r);Ft(i,s)||(t.uniform1iv(this.addr,s),Ot(i,s));for(let o=0;o!==r;++o)n.setTexture2DArray(e[o]||$p,s[o])}function zM(t){switch(t){case 5126:return yM;case 35664:return MM;case 35665:return EM;case 35666:return TM;case 35674:return wM;case 35675:return AM;case 35676:return RM;case 5124:case 35670:return bM;case 35667:case 35671:return CM;case 35668:case 35672:return PM;case 35669:case 35673:return LM;case 5125:return DM;case 36294:return IM;case 36295:return NM;case 36296:return UM;case 35678:case 36198:case 36298:case 36306:case 35682:return FM;case 35679:case 36299:case 36307:return OM;case 35680:case 36300:case 36308:case 36293:return BM;case 36289:case 36303:case 36311:case 36292:return kM}}class VM{constructor(e,n,i){this.id=e,this.addr=i,this.cache=[],this.type=n.type,this.setValue=SM(n.type)}}class HM{constructor(e,n,i){this.id=e,this.addr=i,this.cache=[],this.type=n.type,this.size=n.size,this.setValue=zM(n.type)}}class GM{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,n,i){const r=this.seq;for(let s=0,o=r.length;s!==o;++s){const a=r[s];a.setValue(e,n[a.id],i)}}}const sf=/(\w+)(\])?(\[|\.)?/g;function am(t,e){t.seq.push(e),t.map[e.id]=e}function WM(t,e,n){const i=t.name,r=i.length;for(sf.lastIndex=0;;){const s=sf.exec(i),o=sf.lastIndex;let a=s[1];const l=s[2]==="]",c=s[3];if(l&&(a=a|0),c===void 0||c==="["&&o+2===r){am(n,c===void 0?new VM(a,t,e):new HM(a,t,e));break}else{let h=n.map[a];h===void 0&&(h=new GM(a),am(n,h)),n=h}}}class Ha{constructor(e,n){this.seq=[],this.map={};const i=e.getProgramParameter(n,e.ACTIVE_UNIFORMS);for(let o=0;o<i;++o){const a=e.getActiveUniform(n,o),l=e.getUniformLocation(n,a.name);WM(a,l,this)}const r=[],s=[];for(const o of this.seq)o.type===e.SAMPLER_2D_SHADOW||o.type===e.SAMPLER_CUBE_SHADOW||o.type===e.SAMPLER_2D_ARRAY_SHADOW?r.push(o):s.push(o);r.length>0&&(this.seq=r.concat(s))}setValue(e,n,i,r){const s=this.map[n];s!==void 0&&s.setValue(e,i,r)}setOptional(e,n,i){const r=n[i];r!==void 0&&this.setValue(e,i,r)}static upload(e,n,i,r){for(let s=0,o=n.length;s!==o;++s){const a=n[s],l=i[a.id];l.needsUpdate!==!1&&a.setValue(e,l.value,r)}}static seqWithValue(e,n){const i=[];for(let r=0,s=e.length;r!==s;++r){const o=e[r];o.id in n&&i.push(o)}return i}}function lm(t,e,n){const i=t.createShader(e);return t.shaderSource(i,n),t.compileShader(i),i}const XM=37297;let YM=0;function KM(t,e){const n=t.split(`
`),i=[],r=Math.max(e-6,0),s=Math.min(e+6,n.length);for(let o=r;o<s;o++){const a=o+1;i.push(`${a===e?">":" "} ${a}: ${n[o]}`)}return i.join(`
`)}const cm=new Ve;function ZM(t){$e._getMatrix(cm,$e.workingColorSpace,t);const e=`mat3( ${cm.elements.map(n=>n.toFixed(4))} )`;switch($e.getTransfer(t)){case la:return[e,"LinearTransferOETF"];case ot:return[e,"sRGBTransferOETF"];default:return Ne("WebGLProgram: Unsupported color space: ",t),[e,"LinearTransferOETF"]}}function um(t,e,n){const i=t.getShaderParameter(e,t.COMPILE_STATUS),s=(t.getShaderInfoLog(e)||"").trim();if(i&&s==="")return"";const o=/ERROR: 0:(\d+)/.exec(s);if(o){const a=parseInt(o[1]);return n.toUpperCase()+`

`+s+`

`+KM(t.getShaderSource(e),a)}else return s}function qM(t,e){const n=ZM(e);return[`vec4 ${t}( vec4 value ) {`,`	return ${n[1]}( vec4( value.rgb * ${n[0]}, value.a ) );`,"}"].join(`
`)}const QM={[Fh]:"Linear",[Oh]:"Reinhard",[Bh]:"Cineon",[kh]:"ACESFilmic",[Vh]:"AgX",[Hh]:"Neutral",[zh]:"Custom"};function JM(t,e){const n=QM[e];return n===void 0?(Ne("WebGLProgram: Unsupported toneMapping:",e),"vec3 "+t+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+t+"( vec3 color ) { return "+n+"ToneMapping( color ); }"}const Ga=new U;function jM(){$e.getLuminanceCoefficients(Ga);const t=Ga.x.toFixed(4),e=Ga.y.toFixed(4),n=Ga.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${t}, ${e}, ${n} );`,"	return dot( weights, rgb );","}"].join(`
`)}function $M(t){return[t.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",t.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(oo).join(`
`)}function e1(t){const e=[];for(const n in t){const i=t[n];i!==!1&&e.push("#define "+n+" "+i)}return e.join(`
`)}function t1(t,e){const n={},i=t.getProgramParameter(e,t.ACTIVE_ATTRIBUTES);for(let r=0;r<i;r++){const s=t.getActiveAttrib(e,r),o=s.name;let a=1;s.type===t.FLOAT_MAT2&&(a=2),s.type===t.FLOAT_MAT3&&(a=3),s.type===t.FLOAT_MAT4&&(a=4),n[o]={type:s.type,location:t.getAttribLocation(e,o),locationSize:a}}return n}function oo(t){return t!==""}function fm(t,e){const n=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return t.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,n).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function dm(t,e){return t.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}const n1=/^[ \t]*#include +<([\w\d./]+)>/gm;function of(t){return t.replace(n1,r1)}const i1=new Map;function r1(t,e){let n=Xe[e];if(n===void 0){const i=i1.get(e);if(i!==void 0)n=Xe[i],Ne('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,i);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+e+">")}return of(n)}const s1=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function hm(t){return t.replace(s1,o1)}function o1(t,e,n,i){let r="";for(let s=parseInt(e);s<parseInt(n);s++)r+=i.replace(/\[\s*i\s*\]/g,"[ "+s+" ]").replace(/UNROLLED_LOOP_INDEX/g,s);return r}function pm(t){let e=`precision ${t.precision} float;
	precision ${t.precision} int;
	precision ${t.precision} sampler2D;
	precision ${t.precision} samplerCube;
	precision ${t.precision} sampler3D;
	precision ${t.precision} sampler2DArray;
	precision ${t.precision} sampler2DShadow;
	precision ${t.precision} samplerCubeShadow;
	precision ${t.precision} sampler2DArrayShadow;
	precision ${t.precision} isampler2D;
	precision ${t.precision} isampler3D;
	precision ${t.precision} isamplerCube;
	precision ${t.precision} isampler2DArray;
	precision ${t.precision} usampler2D;
	precision ${t.precision} usampler3D;
	precision ${t.precision} usamplerCube;
	precision ${t.precision} usampler2DArray;
	`;return t.precision==="highp"?e+=`
#define HIGH_PRECISION`:t.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:t.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}const a1={[jo]:"SHADOWMAP_TYPE_PCF",[Ws]:"SHADOWMAP_TYPE_VSM"};function l1(t){return a1[t.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}const c1={[vr]:"ENVMAP_TYPE_CUBE",[Kr]:"ENVMAP_TYPE_CUBE",[$o]:"ENVMAP_TYPE_CUBE_UV"};function u1(t){return t.envMap===!1?"ENVMAP_TYPE_CUBE":c1[t.envMapMode]||"ENVMAP_TYPE_CUBE"}const f1={[Kr]:"ENVMAP_MODE_REFRACTION"};function d1(t){return t.envMap===!1?"ENVMAP_MODE_REFLECTION":f1[t.envMapMode]||"ENVMAP_MODE_REFLECTION"}const h1={[Uh]:"ENVMAP_BLENDING_MULTIPLY",[Cv]:"ENVMAP_BLENDING_MIX",[Pv]:"ENVMAP_BLENDING_ADD"};function p1(t){return t.envMap===!1?"ENVMAP_BLENDING_NONE":h1[t.combine]||"ENVMAP_BLENDING_NONE"}function m1(t){const e=t.envMapCubeUVHeight;if(e===null)return null;const n=Math.log2(e)-2,i=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,n),7*16)),texelHeight:i,maxMip:n}}function g1(t,e,n,i){const r=t.getContext(),s=n.defines;let o=n.vertexShader,a=n.fragmentShader;const l=l1(n),c=u1(n),d=d1(n),h=p1(n),u=m1(n),p=$M(n),g=e1(s),M=r.createProgram();let m,f,x=n.glslVersion?"#version "+n.glslVersion+`
`:"";n.isRawShaderMaterial?(m=["#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,g].filter(oo).join(`
`),m.length>0&&(m+=`
`),f=["#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,g].filter(oo).join(`
`),f.length>0&&(f+=`
`)):(m=[pm(n),"#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,g,n.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",n.batching?"#define USE_BATCHING":"",n.batchingColor?"#define USE_BATCHING_COLOR":"",n.instancing?"#define USE_INSTANCING":"",n.instancingColor?"#define USE_INSTANCING_COLOR":"",n.instancingMorph?"#define USE_INSTANCING_MORPH":"",n.useFog&&n.fog?"#define USE_FOG":"",n.useFog&&n.fogExp2?"#define FOG_EXP2":"",n.map?"#define USE_MAP":"",n.envMap?"#define USE_ENVMAP":"",n.envMap?"#define "+d:"",n.lightMap?"#define USE_LIGHTMAP":"",n.aoMap?"#define USE_AOMAP":"",n.bumpMap?"#define USE_BUMPMAP":"",n.normalMap?"#define USE_NORMALMAP":"",n.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",n.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",n.displacementMap?"#define USE_DISPLACEMENTMAP":"",n.emissiveMap?"#define USE_EMISSIVEMAP":"",n.anisotropy?"#define USE_ANISOTROPY":"",n.anisotropyMap?"#define USE_ANISOTROPYMAP":"",n.clearcoatMap?"#define USE_CLEARCOATMAP":"",n.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",n.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",n.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",n.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",n.specularMap?"#define USE_SPECULARMAP":"",n.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",n.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",n.roughnessMap?"#define USE_ROUGHNESSMAP":"",n.metalnessMap?"#define USE_METALNESSMAP":"",n.alphaMap?"#define USE_ALPHAMAP":"",n.alphaHash?"#define USE_ALPHAHASH":"",n.transmission?"#define USE_TRANSMISSION":"",n.transmissionMap?"#define USE_TRANSMISSIONMAP":"",n.thicknessMap?"#define USE_THICKNESSMAP":"",n.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",n.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",n.mapUv?"#define MAP_UV "+n.mapUv:"",n.alphaMapUv?"#define ALPHAMAP_UV "+n.alphaMapUv:"",n.lightMapUv?"#define LIGHTMAP_UV "+n.lightMapUv:"",n.aoMapUv?"#define AOMAP_UV "+n.aoMapUv:"",n.emissiveMapUv?"#define EMISSIVEMAP_UV "+n.emissiveMapUv:"",n.bumpMapUv?"#define BUMPMAP_UV "+n.bumpMapUv:"",n.normalMapUv?"#define NORMALMAP_UV "+n.normalMapUv:"",n.displacementMapUv?"#define DISPLACEMENTMAP_UV "+n.displacementMapUv:"",n.metalnessMapUv?"#define METALNESSMAP_UV "+n.metalnessMapUv:"",n.roughnessMapUv?"#define ROUGHNESSMAP_UV "+n.roughnessMapUv:"",n.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+n.anisotropyMapUv:"",n.clearcoatMapUv?"#define CLEARCOATMAP_UV "+n.clearcoatMapUv:"",n.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+n.clearcoatNormalMapUv:"",n.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+n.clearcoatRoughnessMapUv:"",n.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+n.iridescenceMapUv:"",n.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+n.iridescenceThicknessMapUv:"",n.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+n.sheenColorMapUv:"",n.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+n.sheenRoughnessMapUv:"",n.specularMapUv?"#define SPECULARMAP_UV "+n.specularMapUv:"",n.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+n.specularColorMapUv:"",n.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+n.specularIntensityMapUv:"",n.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+n.transmissionMapUv:"",n.thicknessMapUv?"#define THICKNESSMAP_UV "+n.thicknessMapUv:"",n.vertexTangents&&n.flatShading===!1?"#define USE_TANGENT":"",n.vertexNormals?"#define HAS_NORMAL":"",n.vertexColors?"#define USE_COLOR":"",n.vertexAlphas?"#define USE_COLOR_ALPHA":"",n.vertexUv1s?"#define USE_UV1":"",n.vertexUv2s?"#define USE_UV2":"",n.vertexUv3s?"#define USE_UV3":"",n.pointsUvs?"#define USE_POINTS_UV":"",n.flatShading?"#define FLAT_SHADED":"",n.skinning?"#define USE_SKINNING":"",n.morphTargets?"#define USE_MORPHTARGETS":"",n.morphNormals&&n.flatShading===!1?"#define USE_MORPHNORMALS":"",n.morphColors?"#define USE_MORPHCOLORS":"",n.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+n.morphTextureStride:"",n.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+n.morphTargetsCount:"",n.doubleSided?"#define DOUBLE_SIDED":"",n.flipSided?"#define FLIP_SIDED":"",n.shadowMapEnabled?"#define USE_SHADOWMAP":"",n.shadowMapEnabled?"#define "+l:"",n.sizeAttenuation?"#define USE_SIZEATTENUATION":"",n.numLightProbes>0?"#define USE_LIGHT_PROBES":"",n.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",n.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(oo).join(`
`),f=[pm(n),"#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,g,n.useFog&&n.fog?"#define USE_FOG":"",n.useFog&&n.fogExp2?"#define FOG_EXP2":"",n.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",n.map?"#define USE_MAP":"",n.matcap?"#define USE_MATCAP":"",n.envMap?"#define USE_ENVMAP":"",n.envMap?"#define "+c:"",n.envMap?"#define "+d:"",n.envMap?"#define "+h:"",u?"#define CUBEUV_TEXEL_WIDTH "+u.texelWidth:"",u?"#define CUBEUV_TEXEL_HEIGHT "+u.texelHeight:"",u?"#define CUBEUV_MAX_MIP "+u.maxMip+".0":"",n.lightMap?"#define USE_LIGHTMAP":"",n.aoMap?"#define USE_AOMAP":"",n.bumpMap?"#define USE_BUMPMAP":"",n.normalMap?"#define USE_NORMALMAP":"",n.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",n.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",n.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",n.emissiveMap?"#define USE_EMISSIVEMAP":"",n.anisotropy?"#define USE_ANISOTROPY":"",n.anisotropyMap?"#define USE_ANISOTROPYMAP":"",n.clearcoat?"#define USE_CLEARCOAT":"",n.clearcoatMap?"#define USE_CLEARCOATMAP":"",n.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",n.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",n.dispersion?"#define USE_DISPERSION":"",n.iridescence?"#define USE_IRIDESCENCE":"",n.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",n.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",n.specularMap?"#define USE_SPECULARMAP":"",n.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",n.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",n.roughnessMap?"#define USE_ROUGHNESSMAP":"",n.metalnessMap?"#define USE_METALNESSMAP":"",n.alphaMap?"#define USE_ALPHAMAP":"",n.alphaTest?"#define USE_ALPHATEST":"",n.alphaHash?"#define USE_ALPHAHASH":"",n.sheen?"#define USE_SHEEN":"",n.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",n.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",n.transmission?"#define USE_TRANSMISSION":"",n.transmissionMap?"#define USE_TRANSMISSIONMAP":"",n.thicknessMap?"#define USE_THICKNESSMAP":"",n.vertexTangents&&n.flatShading===!1?"#define USE_TANGENT":"",n.vertexColors||n.instancingColor?"#define USE_COLOR":"",n.vertexAlphas||n.batchingColor?"#define USE_COLOR_ALPHA":"",n.vertexUv1s?"#define USE_UV1":"",n.vertexUv2s?"#define USE_UV2":"",n.vertexUv3s?"#define USE_UV3":"",n.pointsUvs?"#define USE_POINTS_UV":"",n.gradientMap?"#define USE_GRADIENTMAP":"",n.flatShading?"#define FLAT_SHADED":"",n.doubleSided?"#define DOUBLE_SIDED":"",n.flipSided?"#define FLIP_SIDED":"",n.shadowMapEnabled?"#define USE_SHADOWMAP":"",n.shadowMapEnabled?"#define "+l:"",n.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",n.numLightProbes>0?"#define USE_LIGHT_PROBES":"",n.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",n.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",n.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",n.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",n.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",n.toneMapping!==ei?"#define TONE_MAPPING":"",n.toneMapping!==ei?Xe.tonemapping_pars_fragment:"",n.toneMapping!==ei?JM("toneMapping",n.toneMapping):"",n.dithering?"#define DITHERING":"",n.opaque?"#define OPAQUE":"",Xe.colorspace_pars_fragment,qM("linearToOutputTexel",n.outputColorSpace),jM(),n.useDepthPacking?"#define DEPTH_PACKING "+n.depthPacking:"",`
`].filter(oo).join(`
`)),o=of(o),o=fm(o,n),o=dm(o,n),a=of(a),a=fm(a,n),a=dm(a,n),o=hm(o),a=hm(a),n.isRawShaderMaterial!==!0&&(x=`#version 300 es
`,m=[p,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,f=["#define varying in",n.glslVersion===Su?"":"layout(location = 0) out highp vec4 pc_fragColor;",n.glslVersion===Su?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+f);const y=x+m+o,S=x+f+a,w=lm(r,r.VERTEX_SHADER,y),T=lm(r,r.FRAGMENT_SHADER,S);r.attachShader(M,w),r.attachShader(M,T),n.index0AttributeName!==void 0?r.bindAttribLocation(M,0,n.index0AttributeName):n.hasPositionAttribute===!0&&r.bindAttribLocation(M,0,"position"),r.linkProgram(M);function b(P){if(t.debug.checkShaderErrors){const D=r.getProgramInfoLog(M)||"",W=r.getShaderInfoLog(w)||"",Z=r.getShaderInfoLog(T)||"",B=D.trim(),X=W.trim(),H=Z.trim();let L=!0,k=!0;if(r.getProgramParameter(M,r.LINK_STATUS)===!1)if(L=!1,typeof t.debug.onShaderError=="function")t.debug.onShaderError(r,M,w,T);else{const Y=um(r,w,"vertex"),$=um(r,T,"fragment");tt("WebGLProgram: Shader Error "+r.getError()+" - VALIDATE_STATUS "+r.getProgramParameter(M,r.VALIDATE_STATUS)+`

Material Name: `+P.name+`
Material Type: `+P.type+`

Program Info Log: `+B+`
`+Y+`
`+$)}else B!==""?Ne("WebGLProgram: Program Info Log:",B):(X===""||H==="")&&(k=!1);k&&(P.diagnostics={runnable:L,programLog:B,vertexShader:{log:X,prefix:m},fragmentShader:{log:H,prefix:f}})}r.deleteShader(w),r.deleteShader(T),_=new Ha(r,M),A=t1(r,M)}let _;this.getUniforms=function(){return _===void 0&&b(this),_};let A;this.getAttributes=function(){return A===void 0&&b(this),A};let C=n.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return C===!1&&(C=r.getProgramParameter(M,XM)),C},this.destroy=function(){i.releaseStatesOfProgram(this),r.deleteProgram(M),this.program=void 0},this.type=n.shaderType,this.name=n.shaderName,this.id=YM++,this.cacheKey=e,this.usedTimes=1,this.program=M,this.vertexShader=w,this.fragmentShader=T,this}let _1=0;class v1{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,n,i){const r=this._getShaderCacheForMaterial(e);return r.has(n)===!1&&(r.add(n),n.usedTimes++),r.has(i)===!1&&(r.add(i),i.usedTimes++),this}remove(e){const n=this.materialCache.get(e);for(const i of n)i.usedTimes--,i.usedTimes===0&&this.shaderCache.delete(i.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){const n=this.materialCache;let i=n.get(e);return i===void 0&&(i=new Set,n.set(e,i)),i}_getShaderStage(e){const n=this.shaderCache;let i=n.get(e);return i===void 0&&(i=new x1(e),n.set(e,i)),i}}class x1{constructor(e){this.id=_1++,this.code=e,this.usedTimes=0}}function S1(t){return t===yr||t===sa||t===oa}function y1(t,e,n,i,r,s){const o=new lp,a=new v1,l=new Set,c=[],d=new Map,h=i.logarithmicDepthBuffer;let u=i.precision;const p={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function g(_){return l.add(_),_===0?"uv":`uv${_}`}function M(_,A,C,P,D,W){const Z=P.fog,B=D.geometry,X=_.isMeshStandardMaterial||_.isMeshLambertMaterial||_.isMeshPhongMaterial?P.environment:null,H=_.isMeshStandardMaterial||_.isMeshLambertMaterial&&!_.envMap||_.isMeshPhongMaterial&&!_.envMap,L=e.get(_.envMap||X,H),k=L&&L.mapping===$o?L.image.height:null,Y=p[_.type];_.precision!==null&&(u=i.getMaxPrecision(_.precision),u!==_.precision&&Ne("WebGLProgram.getParameters:",_.precision,"not supported, using",u,"instead."));const $=B.morphAttributes.position||B.morphAttributes.normal||B.morphAttributes.color,oe=$!==void 0?$.length:0;let Be=0;B.morphAttributes.position!==void 0&&(Be=1),B.morphAttributes.normal!==void 0&&(Be=2),B.morphAttributes.color!==void 0&&(Be=3);let Qe,He,q,se;if(Y){const Te=ai[Y];Qe=Te.vertexShader,He=Te.fragmentShader}else{Qe=_.vertexShader,He=_.fragmentShader;const Te=a.getVertexShaderStage(_),At=a.getFragmentShaderStage(_);a.update(_,Te,At),q=Te.id,se=At.id}const ie=t.getRenderTarget(),be=t.state.buffers.depth.getReversed(),ke=D.isInstancedMesh===!0,Ce=D.isBatchedMesh===!0,lt=!!_.map,Ye=!!_.matcap,st=!!L,et=!!_.aoMap,je=!!_.lightMap,it=!!_.bumpMap&&_.wireframe===!1,wt=!!_.normalMap,ce=!!_.displacementMap,Me=!!_.emissiveMap,Fe=!!_.metalnessMap,Oe=!!_.roughnessMap,I=_.anisotropy>0,Ze=_.clearcoat>0,De=_.dispersion>0,R=_.iridescence>0,v=_.sheen>0,O=_.transmission>0,G=I&&!!_.anisotropyMap,Q=Ze&&!!_.clearcoatMap,ae=Ze&&!!_.clearcoatNormalMap,ue=Ze&&!!_.clearcoatRoughnessMap,j=R&&!!_.iridescenceMap,J=R&&!!_.iridescenceThicknessMap,le=v&&!!_.sheenColorMap,Ee=v&&!!_.sheenRoughnessMap,me=!!_.specularMap,de=!!_.specularColorMap,Ie=!!_.specularIntensityMap,Ue=O&&!!_.transmissionMap,Ge=O&&!!_.thicknessMap,N=!!_.gradientMap,fe=!!_.alphaMap,ee=_.alphaTest>0,he=!!_.alphaHash,ve=!!_.extensions;let te=ei;_.toneMapped&&(ie===null||ie.isXRRenderTarget===!0)&&(te=t.toneMapping);const Re={shaderID:Y,shaderType:_.type,shaderName:_.name,vertexShader:Qe,fragmentShader:He,defines:_.defines,customVertexShaderID:q,customFragmentShaderID:se,isRawShaderMaterial:_.isRawShaderMaterial===!0,glslVersion:_.glslVersion,precision:u,batching:Ce,batchingColor:Ce&&D._colorsTexture!==null,instancing:ke,instancingColor:ke&&D.instanceColor!==null,instancingMorph:ke&&D.morphTexture!==null,outputColorSpace:ie===null?t.outputColorSpace:ie.isXRRenderTarget===!0?ie.texture.colorSpace:$e.workingColorSpace,alphaToCoverage:!!_.alphaToCoverage,map:lt,matcap:Ye,envMap:st,envMapMode:st&&L.mapping,envMapCubeUVHeight:k,aoMap:et,lightMap:je,bumpMap:it,normalMap:wt,displacementMap:ce,emissiveMap:Me,normalMapObjectSpace:wt&&_.normalMapType===Iv,normalMapTangentSpace:wt&&_.normalMapType===_u,packedNormalMap:wt&&_.normalMapType===_u&&S1(_.normalMap.format),metalnessMap:Fe,roughnessMap:Oe,anisotropy:I,anisotropyMap:G,clearcoat:Ze,clearcoatMap:Q,clearcoatNormalMap:ae,clearcoatRoughnessMap:ue,dispersion:De,iridescence:R,iridescenceMap:j,iridescenceThicknessMap:J,sheen:v,sheenColorMap:le,sheenRoughnessMap:Ee,specularMap:me,specularColorMap:de,specularIntensityMap:Ie,transmission:O,transmissionMap:Ue,thicknessMap:Ge,gradientMap:N,opaque:_.transparent===!1&&_.blending===Xr&&_.alphaToCoverage===!1,alphaMap:fe,alphaTest:ee,alphaHash:he,combine:_.combine,mapUv:lt&&g(_.map.channel),aoMapUv:et&&g(_.aoMap.channel),lightMapUv:je&&g(_.lightMap.channel),bumpMapUv:it&&g(_.bumpMap.channel),normalMapUv:wt&&g(_.normalMap.channel),displacementMapUv:ce&&g(_.displacementMap.channel),emissiveMapUv:Me&&g(_.emissiveMap.channel),metalnessMapUv:Fe&&g(_.metalnessMap.channel),roughnessMapUv:Oe&&g(_.roughnessMap.channel),anisotropyMapUv:G&&g(_.anisotropyMap.channel),clearcoatMapUv:Q&&g(_.clearcoatMap.channel),clearcoatNormalMapUv:ae&&g(_.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:ue&&g(_.clearcoatRoughnessMap.channel),iridescenceMapUv:j&&g(_.iridescenceMap.channel),iridescenceThicknessMapUv:J&&g(_.iridescenceThicknessMap.channel),sheenColorMapUv:le&&g(_.sheenColorMap.channel),sheenRoughnessMapUv:Ee&&g(_.sheenRoughnessMap.channel),specularMapUv:me&&g(_.specularMap.channel),specularColorMapUv:de&&g(_.specularColorMap.channel),specularIntensityMapUv:Ie&&g(_.specularIntensityMap.channel),transmissionMapUv:Ue&&g(_.transmissionMap.channel),thicknessMapUv:Ge&&g(_.thicknessMap.channel),alphaMapUv:fe&&g(_.alphaMap.channel),vertexTangents:!!B.attributes.tangent&&(wt||I),vertexNormals:!!B.attributes.normal,vertexColors:_.vertexColors,vertexAlphas:_.vertexColors===!0&&!!B.attributes.color&&B.attributes.color.itemSize===4,pointsUvs:D.isPoints===!0&&!!B.attributes.uv&&(lt||fe),fog:!!Z,useFog:_.fog===!0,fogExp2:!!Z&&Z.isFogExp2,flatShading:_.wireframe===!1&&(_.flatShading===!0||B.attributes.normal===void 0&&wt===!1&&(_.isMeshLambertMaterial||_.isMeshPhongMaterial||_.isMeshStandardMaterial||_.isMeshPhysicalMaterial)),sizeAttenuation:_.sizeAttenuation===!0,logarithmicDepthBuffer:h,reversedDepthBuffer:be,skinning:D.isSkinnedMesh===!0,hasPositionAttribute:B.attributes.position!==void 0,morphTargets:B.morphAttributes.position!==void 0,morphNormals:B.morphAttributes.normal!==void 0,morphColors:B.morphAttributes.color!==void 0,morphTargetsCount:oe,morphTextureStride:Be,numDirLights:A.directional.length,numPointLights:A.point.length,numSpotLights:A.spot.length,numSpotLightMaps:A.spotLightMap.length,numRectAreaLights:A.rectArea.length,numHemiLights:A.hemi.length,numDirLightShadows:A.directionalShadowMap.length,numPointLightShadows:A.pointShadowMap.length,numSpotLightShadows:A.spotShadowMap.length,numSpotLightShadowsWithMaps:A.numSpotLightShadowsWithMaps,numLightProbes:A.numLightProbes,numLightProbeGrids:W.length,numClippingPlanes:s.numPlanes,numClipIntersection:s.numIntersection,dithering:_.dithering,shadowMapEnabled:t.shadowMap.enabled&&C.length>0,shadowMapType:t.shadowMap.type,toneMapping:te,decodeVideoTexture:lt&&_.map.isVideoTexture===!0&&$e.getTransfer(_.map.colorSpace)===ot,decodeVideoTextureEmissive:Me&&_.emissiveMap.isVideoTexture===!0&&$e.getTransfer(_.emissiveMap.colorSpace)===ot,premultipliedAlpha:_.premultipliedAlpha,doubleSided:_.side===Rn,flipSided:_.side===rn,useDepthPacking:_.depthPacking>=0,depthPacking:_.depthPacking||0,index0AttributeName:_.index0AttributeName,extensionClipCullDistance:ve&&_.extensions.clipCullDistance===!0&&n.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(ve&&_.extensions.multiDraw===!0||Ce)&&n.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:_.customProgramCacheKey()};return Re.vertexUv1s=l.has(1),Re.vertexUv2s=l.has(2),Re.vertexUv3s=l.has(3),l.clear(),Re}function m(_){const A=[];if(_.shaderID?A.push(_.shaderID):(A.push(_.customVertexShaderID),A.push(_.customFragmentShaderID)),_.defines!==void 0)for(const C in _.defines)A.push(C),A.push(_.defines[C]);return _.isRawShaderMaterial===!1&&(f(A,_),x(A,_),A.push(t.outputColorSpace)),A.push(_.customProgramCacheKey),A.join()}function f(_,A){_.push(A.precision),_.push(A.outputColorSpace),_.push(A.envMapMode),_.push(A.envMapCubeUVHeight),_.push(A.mapUv),_.push(A.alphaMapUv),_.push(A.lightMapUv),_.push(A.aoMapUv),_.push(A.bumpMapUv),_.push(A.normalMapUv),_.push(A.displacementMapUv),_.push(A.emissiveMapUv),_.push(A.metalnessMapUv),_.push(A.roughnessMapUv),_.push(A.anisotropyMapUv),_.push(A.clearcoatMapUv),_.push(A.clearcoatNormalMapUv),_.push(A.clearcoatRoughnessMapUv),_.push(A.iridescenceMapUv),_.push(A.iridescenceThicknessMapUv),_.push(A.sheenColorMapUv),_.push(A.sheenRoughnessMapUv),_.push(A.specularMapUv),_.push(A.specularColorMapUv),_.push(A.specularIntensityMapUv),_.push(A.transmissionMapUv),_.push(A.thicknessMapUv),_.push(A.combine),_.push(A.fogExp2),_.push(A.sizeAttenuation),_.push(A.morphTargetsCount),_.push(A.morphAttributeCount),_.push(A.numDirLights),_.push(A.numPointLights),_.push(A.numSpotLights),_.push(A.numSpotLightMaps),_.push(A.numHemiLights),_.push(A.numRectAreaLights),_.push(A.numDirLightShadows),_.push(A.numPointLightShadows),_.push(A.numSpotLightShadows),_.push(A.numSpotLightShadowsWithMaps),_.push(A.numLightProbes),_.push(A.shadowMapType),_.push(A.toneMapping),_.push(A.numClippingPlanes),_.push(A.numClipIntersection),_.push(A.depthPacking)}function x(_,A){o.disableAll(),A.instancing&&o.enable(0),A.instancingColor&&o.enable(1),A.instancingMorph&&o.enable(2),A.matcap&&o.enable(3),A.envMap&&o.enable(4),A.normalMapObjectSpace&&o.enable(5),A.normalMapTangentSpace&&o.enable(6),A.clearcoat&&o.enable(7),A.iridescence&&o.enable(8),A.alphaTest&&o.enable(9),A.vertexColors&&o.enable(10),A.vertexAlphas&&o.enable(11),A.vertexUv1s&&o.enable(12),A.vertexUv2s&&o.enable(13),A.vertexUv3s&&o.enable(14),A.vertexTangents&&o.enable(15),A.anisotropy&&o.enable(16),A.alphaHash&&o.enable(17),A.batching&&o.enable(18),A.dispersion&&o.enable(19),A.batchingColor&&o.enable(20),A.gradientMap&&o.enable(21),A.packedNormalMap&&o.enable(22),A.vertexNormals&&o.enable(23),_.push(o.mask),o.disableAll(),A.fog&&o.enable(0),A.useFog&&o.enable(1),A.flatShading&&o.enable(2),A.logarithmicDepthBuffer&&o.enable(3),A.reversedDepthBuffer&&o.enable(4),A.skinning&&o.enable(5),A.morphTargets&&o.enable(6),A.morphNormals&&o.enable(7),A.morphColors&&o.enable(8),A.premultipliedAlpha&&o.enable(9),A.shadowMapEnabled&&o.enable(10),A.doubleSided&&o.enable(11),A.flipSided&&o.enable(12),A.useDepthPacking&&o.enable(13),A.dithering&&o.enable(14),A.transmission&&o.enable(15),A.sheen&&o.enable(16),A.opaque&&o.enable(17),A.pointsUvs&&o.enable(18),A.decodeVideoTexture&&o.enable(19),A.decodeVideoTextureEmissive&&o.enable(20),A.alphaToCoverage&&o.enable(21),A.numLightProbeGrids>0&&o.enable(22),A.hasPositionAttribute&&o.enable(23),_.push(o.mask)}function y(_){const A=p[_.type];let C;if(A){const P=ai[A];C=vx.clone(P.uniforms)}else C=_.uniforms;return C}function S(_,A){let C=d.get(A);return C!==void 0?++C.usedTimes:(C=new g1(t,A,_,r),c.push(C),d.set(A,C)),C}function w(_){if(--_.usedTimes===0){const A=c.indexOf(_);c[A]=c[c.length-1],c.pop(),d.delete(_.cacheKey),_.destroy()}}function T(_){a.remove(_)}function b(){a.dispose()}return{getParameters:M,getProgramCacheKey:m,getUniforms:y,acquireProgram:S,releaseProgram:w,releaseShaderCache:T,programs:c,dispose:b}}function M1(){let t=new WeakMap;function e(o){return t.has(o)}function n(o){let a=t.get(o);return a===void 0&&(a={},t.set(o,a)),a}function i(o){t.delete(o)}function r(o,a,l){t.get(o)[a]=l}function s(){t=new WeakMap}return{has:e,get:n,remove:i,update:r,dispose:s}}function E1(t,e){return t.groupOrder!==e.groupOrder?t.groupOrder-e.groupOrder:t.renderOrder!==e.renderOrder?t.renderOrder-e.renderOrder:t.material.id!==e.material.id?t.material.id-e.material.id:t.materialVariant!==e.materialVariant?t.materialVariant-e.materialVariant:t.z!==e.z?t.z-e.z:t.id-e.id}function mm(t,e){return t.groupOrder!==e.groupOrder?t.groupOrder-e.groupOrder:t.renderOrder!==e.renderOrder?t.renderOrder-e.renderOrder:t.z!==e.z?e.z-t.z:t.id-e.id}function gm(){const t=[];let e=0;const n=[],i=[],r=[];function s(){e=0,n.length=0,i.length=0,r.length=0}function o(u){let p=0;return u.isInstancedMesh&&(p+=2),u.isSkinnedMesh&&(p+=1),p}function a(u,p,g,M,m,f){let x=t[e];return x===void 0?(x={id:u.id,object:u,geometry:p,material:g,materialVariant:o(u),groupOrder:M,renderOrder:u.renderOrder,z:m,group:f},t[e]=x):(x.id=u.id,x.object=u,x.geometry=p,x.material=g,x.materialVariant=o(u),x.groupOrder=M,x.renderOrder=u.renderOrder,x.z=m,x.group=f),e++,x}function l(u,p,g,M,m,f){const x=a(u,p,g,M,m,f);g.transmission>0?i.push(x):g.transparent===!0?r.push(x):n.push(x)}function c(u,p,g,M,m,f){const x=a(u,p,g,M,m,f);g.transmission>0?i.unshift(x):g.transparent===!0?r.unshift(x):n.unshift(x)}function d(u,p,g){n.length>1&&n.sort(u||E1),i.length>1&&i.sort(p||mm),r.length>1&&r.sort(p||mm),g&&(n.reverse(),i.reverse(),r.reverse())}function h(){for(let u=e,p=t.length;u<p;u++){const g=t[u];if(g.id===null)break;g.id=null,g.object=null,g.geometry=null,g.material=null,g.group=null}}return{opaque:n,transmissive:i,transparent:r,init:s,push:l,unshift:c,finish:h,sort:d}}function T1(){let t=new WeakMap;function e(i,r){const s=t.get(i);let o;return s===void 0?(o=new gm,t.set(i,[o])):r>=s.length?(o=new gm,s.push(o)):o=s[r],o}function n(){t=new WeakMap}return{get:e,dispose:n}}function w1(){const t={};return{get:function(e){if(t[e.id]!==void 0)return t[e.id];let n;switch(e.type){case"DirectionalLight":n={direction:new U,color:new Ke};break;case"SpotLight":n={position:new U,direction:new U,color:new Ke,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":n={position:new U,color:new Ke,distance:0,decay:0};break;case"HemisphereLight":n={direction:new U,skyColor:new Ke,groundColor:new Ke};break;case"RectAreaLight":n={color:new Ke,position:new U,halfWidth:new U,halfHeight:new U};break}return t[e.id]=n,n}}}function A1(){const t={};return{get:function(e){if(t[e.id]!==void 0)return t[e.id];let n;switch(e.type){case"DirectionalLight":n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ze};break;case"SpotLight":n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ze};break;case"PointLight":n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ze,shadowCameraNear:1,shadowCameraFar:1e3};break}return t[e.id]=n,n}}}let R1=0;function b1(t,e){return(e.castShadow?2:0)-(t.castShadow?2:0)+(e.map?1:0)-(t.map?1:0)}function C1(t){const e=new w1,n=A1(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)i.probe.push(new U);const r=new U,s=new vt,o=new vt;function a(c){let d=0,h=0,u=0;for(let A=0;A<9;A++)i.probe[A].set(0,0,0);let p=0,g=0,M=0,m=0,f=0,x=0,y=0,S=0,w=0,T=0,b=0;c.sort(b1);for(let A=0,C=c.length;A<C;A++){const P=c[A],D=P.color,W=P.intensity,Z=P.distance;let B=null;if(P.shadow&&P.shadow.map&&(P.shadow.map.texture.format===yr?B=P.shadow.map.texture:B=P.shadow.map.depthTexture||P.shadow.map.texture),P.isAmbientLight)d+=D.r*W,h+=D.g*W,u+=D.b*W;else if(P.isLightProbe){for(let X=0;X<9;X++)i.probe[X].addScaledVector(P.sh.coefficients[X],W);b++}else if(P.isDirectionalLight){const X=e.get(P);if(X.color.copy(P.color).multiplyScalar(P.intensity),P.castShadow){const H=P.shadow,L=n.get(P);L.shadowIntensity=H.intensity,L.shadowBias=H.bias,L.shadowNormalBias=H.normalBias,L.shadowRadius=H.radius,L.shadowMapSize=H.mapSize,i.directionalShadow[p]=L,i.directionalShadowMap[p]=B,i.directionalShadowMatrix[p]=P.shadow.matrix,x++}i.directional[p]=X,p++}else if(P.isSpotLight){const X=e.get(P);X.position.setFromMatrixPosition(P.matrixWorld),X.color.copy(D).multiplyScalar(W),X.distance=Z,X.coneCos=Math.cos(P.angle),X.penumbraCos=Math.cos(P.angle*(1-P.penumbra)),X.decay=P.decay,i.spot[M]=X;const H=P.shadow;if(P.map&&(i.spotLightMap[w]=P.map,w++,H.updateMatrices(P),P.castShadow&&T++),i.spotLightMatrix[M]=H.matrix,P.castShadow){const L=n.get(P);L.shadowIntensity=H.intensity,L.shadowBias=H.bias,L.shadowNormalBias=H.normalBias,L.shadowRadius=H.radius,L.shadowMapSize=H.mapSize,i.spotShadow[M]=L,i.spotShadowMap[M]=B,S++}M++}else if(P.isRectAreaLight){const X=e.get(P);X.color.copy(D).multiplyScalar(W),X.halfWidth.set(P.width*.5,0,0),X.halfHeight.set(0,P.height*.5,0),i.rectArea[m]=X,m++}else if(P.isPointLight){const X=e.get(P);if(X.color.copy(P.color).multiplyScalar(P.intensity),X.distance=P.distance,X.decay=P.decay,P.castShadow){const H=P.shadow,L=n.get(P);L.shadowIntensity=H.intensity,L.shadowBias=H.bias,L.shadowNormalBias=H.normalBias,L.shadowRadius=H.radius,L.shadowMapSize=H.mapSize,L.shadowCameraNear=H.camera.near,L.shadowCameraFar=H.camera.far,i.pointShadow[g]=L,i.pointShadowMap[g]=B,i.pointShadowMatrix[g]=P.shadow.matrix,y++}i.point[g]=X,g++}else if(P.isHemisphereLight){const X=e.get(P);X.skyColor.copy(P.color).multiplyScalar(W),X.groundColor.copy(P.groundColor).multiplyScalar(W),i.hemi[f]=X,f++}}m>0&&(t.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=pe.LTC_FLOAT_1,i.rectAreaLTC2=pe.LTC_FLOAT_2):(i.rectAreaLTC1=pe.LTC_HALF_1,i.rectAreaLTC2=pe.LTC_HALF_2)),i.ambient[0]=d,i.ambient[1]=h,i.ambient[2]=u;const _=i.hash;(_.directionalLength!==p||_.pointLength!==g||_.spotLength!==M||_.rectAreaLength!==m||_.hemiLength!==f||_.numDirectionalShadows!==x||_.numPointShadows!==y||_.numSpotShadows!==S||_.numSpotMaps!==w||_.numLightProbes!==b)&&(i.directional.length=p,i.spot.length=M,i.rectArea.length=m,i.point.length=g,i.hemi.length=f,i.directionalShadow.length=x,i.directionalShadowMap.length=x,i.pointShadow.length=y,i.pointShadowMap.length=y,i.spotShadow.length=S,i.spotShadowMap.length=S,i.directionalShadowMatrix.length=x,i.pointShadowMatrix.length=y,i.spotLightMatrix.length=S+w-T,i.spotLightMap.length=w,i.numSpotLightShadowsWithMaps=T,i.numLightProbes=b,_.directionalLength=p,_.pointLength=g,_.spotLength=M,_.rectAreaLength=m,_.hemiLength=f,_.numDirectionalShadows=x,_.numPointShadows=y,_.numSpotShadows=S,_.numSpotMaps=w,_.numLightProbes=b,i.version=R1++)}function l(c,d){let h=0,u=0,p=0,g=0,M=0;const m=d.matrixWorldInverse;for(let f=0,x=c.length;f<x;f++){const y=c[f];if(y.isDirectionalLight){const S=i.directional[h];S.direction.setFromMatrixPosition(y.matrixWorld),r.setFromMatrixPosition(y.target.matrixWorld),S.direction.sub(r),S.direction.transformDirection(m),h++}else if(y.isSpotLight){const S=i.spot[p];S.position.setFromMatrixPosition(y.matrixWorld),S.position.applyMatrix4(m),S.direction.setFromMatrixPosition(y.matrixWorld),r.setFromMatrixPosition(y.target.matrixWorld),S.direction.sub(r),S.direction.transformDirection(m),p++}else if(y.isRectAreaLight){const S=i.rectArea[g];S.position.setFromMatrixPosition(y.matrixWorld),S.position.applyMatrix4(m),o.identity(),s.copy(y.matrixWorld),s.premultiply(m),o.extractRotation(s),S.halfWidth.set(y.width*.5,0,0),S.halfHeight.set(0,y.height*.5,0),S.halfWidth.applyMatrix4(o),S.halfHeight.applyMatrix4(o),g++}else if(y.isPointLight){const S=i.point[u];S.position.setFromMatrixPosition(y.matrixWorld),S.position.applyMatrix4(m),u++}else if(y.isHemisphereLight){const S=i.hemi[M];S.direction.setFromMatrixPosition(y.matrixWorld),S.direction.transformDirection(m),M++}}}return{setup:a,setupView:l,state:i}}function _m(t){const e=new C1(t),n=[],i=[],r=[];function s(u){h.camera=u,n.length=0,i.length=0,r.length=0}function o(u){n.push(u)}function a(u){i.push(u)}function l(u){r.push(u)}function c(){e.setup(n)}function d(u){e.setupView(n,u)}const h={lightsArray:n,shadowsArray:i,lightProbeGridArray:r,camera:null,lights:e,transmissionRenderTarget:{},textureUnits:0};return{init:s,state:h,setupLights:c,setupLightsView:d,pushLight:o,pushShadow:a,pushLightProbeGrid:l}}function P1(t){let e=new WeakMap;function n(r,s=0){const o=e.get(r);let a;return o===void 0?(a=new _m(t),e.set(r,[a])):s>=o.length?(a=new _m(t),o.push(a)):a=o[s],a}function i(){e=new WeakMap}return{get:n,dispose:i}}const L1=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,D1=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,I1=[new U(1,0,0),new U(-1,0,0),new U(0,1,0),new U(0,-1,0),new U(0,0,1),new U(0,0,-1)],N1=[new U(0,-1,0),new U(0,-1,0),new U(0,0,1),new U(0,0,-1),new U(0,-1,0),new U(0,-1,0)],vm=new vt,ao=new U,af=new U;function U1(t,e,n){let i=new Ku;const r=new ze,s=new ze,o=new St,a=new Mx,l=new Ex,c={},d=n.maxTextureSize,h={[$n]:rn,[rn]:$n,[Rn]:Rn},u=new si({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new ze},radius:{value:4}},vertexShader:L1,fragmentShader:D1}),p=u.clone();p.defines.HORIZONTAL_PASS=1;const g=new Xt;g.setAttribute("position",new bt(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const M=new Ln(g,u),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=jo;let f=this.type;this.render=function(T,b,_){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||T.length===0)return;this.type===uv&&(Ne("WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead."),this.type=jo);const A=t.getRenderTarget(),C=t.getActiveCubeFace(),P=t.getActiveMipmapLevel(),D=t.state;D.setBlending(_i),D.buffers.depth.getReversed()===!0?D.buffers.color.setClear(0,0,0,0):D.buffers.color.setClear(1,1,1,1),D.buffers.depth.setTest(!0),D.setScissorTest(!1);const W=f!==this.type;W&&b.traverse(function(Z){Z.material&&(Array.isArray(Z.material)?Z.material.forEach(B=>B.needsUpdate=!0):Z.material.needsUpdate=!0)});for(let Z=0,B=T.length;Z<B;Z++){const X=T[Z],H=X.shadow;if(H===void 0){Ne("WebGLShadowMap:",X,"has no shadow.");continue}if(H.autoUpdate===!1&&H.needsUpdate===!1)continue;r.copy(H.mapSize);const L=H.getFrameExtents();r.multiply(L),s.copy(H.mapSize),(r.x>d||r.y>d)&&(r.x>d&&(s.x=Math.floor(d/L.x),r.x=s.x*L.x,H.mapSize.x=s.x),r.y>d&&(s.y=Math.floor(d/L.y),r.y=s.y*L.y,H.mapSize.y=s.y));const k=t.state.buffers.depth.getReversed();if(H.camera._reversedDepth=k,H.map===null||W===!0){if(H.map!==null&&(H.map.depthTexture!==null&&(H.map.depthTexture.dispose(),H.map.depthTexture=null),H.map.dispose()),this.type===Ws){if(X.isPointLight){Ne("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}H.map=new ri(r.x,r.y,{format:yr,type:vi,minFilter:Dt,magFilter:Dt,generateMipmaps:!1}),H.map.texture.name=X.name+".shadowMap",H.map.depthTexture=new as(r.x,r.y,ni),H.map.depthTexture.name=X.name+".shadowMapDepth",H.map.depthTexture.format=xi,H.map.depthTexture.compareFunction=null,H.map.depthTexture.minFilter=Wt,H.map.depthTexture.magFilter=Wt}else X.isPointLight?(H.map=new Jp(r.x),H.map.depthTexture=new mx(r.x,ti)):(H.map=new ri(r.x,r.y),H.map.depthTexture=new as(r.x,r.y,ti)),H.map.depthTexture.name=X.name+".shadowMap",H.map.depthTexture.format=xi,this.type===jo?(H.map.depthTexture.compareFunction=k?xu:vu,H.map.depthTexture.minFilter=Dt,H.map.depthTexture.magFilter=Dt):(H.map.depthTexture.compareFunction=null,H.map.depthTexture.minFilter=Wt,H.map.depthTexture.magFilter=Wt);H.camera.updateProjectionMatrix()}const Y=H.map.isWebGLCubeRenderTarget?6:1;for(let $=0;$<Y;$++){if(H.map.isWebGLCubeRenderTarget)t.setRenderTarget(H.map,$),t.clear();else{$===0&&(t.setRenderTarget(H.map),t.clear());const oe=H.getViewport($);o.set(s.x*oe.x,s.y*oe.y,s.x*oe.z,s.y*oe.w),D.viewport(o)}if(X.isPointLight){const oe=H.camera,Be=H.matrix,Qe=X.distance||oe.far;Qe!==oe.far&&(oe.far=Qe,oe.updateProjectionMatrix()),ao.setFromMatrixPosition(X.matrixWorld),oe.position.copy(ao),af.copy(oe.position),af.add(I1[$]),oe.up.copy(N1[$]),oe.lookAt(af),oe.updateMatrixWorld(),Be.makeTranslation(-ao.x,-ao.y,-ao.z),vm.multiplyMatrices(oe.projectionMatrix,oe.matrixWorldInverse),H._frustum.setFromProjectionMatrix(vm,oe.coordinateSystem,oe.reversedDepth)}else H.updateMatrices(X);i=H.getFrustum(),S(b,_,H.camera,X,this.type)}H.isPointLightShadow!==!0&&this.type===Ws&&x(H,_),H.needsUpdate=!1}f=this.type,m.needsUpdate=!1,t.setRenderTarget(A,C,P)};function x(T,b){const _=e.update(M);u.defines.VSM_SAMPLES!==T.blurSamples&&(u.defines.VSM_SAMPLES=T.blurSamples,p.defines.VSM_SAMPLES=T.blurSamples,u.needsUpdate=!0,p.needsUpdate=!0),T.mapPass===null&&(T.mapPass=new ri(r.x,r.y,{format:yr,type:vi})),u.uniforms.shadow_pass.value=T.map.depthTexture,u.uniforms.resolution.value=T.mapSize,u.uniforms.radius.value=T.radius,t.setRenderTarget(T.mapPass),t.clear(),t.renderBufferDirect(b,null,_,u,M,null),p.uniforms.shadow_pass.value=T.mapPass.texture,p.uniforms.resolution.value=T.mapSize,p.uniforms.radius.value=T.radius,t.setRenderTarget(T.map),t.clear(),t.renderBufferDirect(b,null,_,p,M,null)}function y(T,b,_,A){let C=null;const P=_.isPointLight===!0?T.customDistanceMaterial:T.customDepthMaterial;if(P!==void 0)C=P;else if(C=_.isPointLight===!0?l:a,t.localClippingEnabled&&b.clipShadows===!0&&Array.isArray(b.clippingPlanes)&&b.clippingPlanes.length!==0||b.displacementMap&&b.displacementScale!==0||b.alphaMap&&b.alphaTest>0||b.map&&b.alphaTest>0||b.alphaToCoverage===!0){const D=C.uuid,W=b.uuid;let Z=c[D];Z===void 0&&(Z={},c[D]=Z);let B=Z[W];B===void 0&&(B=C.clone(),Z[W]=B,b.addEventListener("dispose",w)),C=B}if(C.visible=b.visible,C.wireframe=b.wireframe,A===Ws?C.side=b.shadowSide!==null?b.shadowSide:b.side:C.side=b.shadowSide!==null?b.shadowSide:h[b.side],C.alphaMap=b.alphaMap,C.alphaTest=b.alphaToCoverage===!0?.5:b.alphaTest,C.map=b.map,C.clipShadows=b.clipShadows,C.clippingPlanes=b.clippingPlanes,C.clipIntersection=b.clipIntersection,C.displacementMap=b.displacementMap,C.displacementScale=b.displacementScale,C.displacementBias=b.displacementBias,C.wireframeLinewidth=b.wireframeLinewidth,C.linewidth=b.linewidth,_.isPointLight===!0&&C.isMeshDistanceMaterial===!0){const D=t.properties.get(C);D.light=_}return C}function S(T,b,_,A,C){if(T.visible===!1)return;if(T.layers.test(b.layers)&&(T.isMesh||T.isLine||T.isPoints)&&(T.castShadow||T.receiveShadow&&C===Ws)&&(!T.frustumCulled||i.intersectsObject(T))){T.modelViewMatrix.multiplyMatrices(_.matrixWorldInverse,T.matrixWorld);const W=e.update(T),Z=T.material;if(Array.isArray(Z)){const B=W.groups;for(let X=0,H=B.length;X<H;X++){const L=B[X],k=Z[L.materialIndex];if(k&&k.visible){const Y=y(T,k,A,C);T.onBeforeShadow(t,T,b,_,W,Y,L),t.renderBufferDirect(_,null,W,Y,T,L),T.onAfterShadow(t,T,b,_,W,Y,L)}}}else if(Z.visible){const B=y(T,Z,A,C);T.onBeforeShadow(t,T,b,_,W,B,null),t.renderBufferDirect(_,null,W,B,T,null),T.onAfterShadow(t,T,b,_,W,B,null)}}const D=T.children;for(let W=0,Z=D.length;W<Z;W++)S(D[W],b,_,A,C)}function w(T){T.target.removeEventListener("dispose",w);for(const _ in c){const A=c[_],C=T.target.uuid;C in A&&(A[C].dispose(),delete A[C])}}}function F1(t,e){function n(){let N=!1;const fe=new St;let ee=null;const he=new St(0,0,0,0);return{setMask:function(ve){ee!==ve&&!N&&(t.colorMask(ve,ve,ve,ve),ee=ve)},setLocked:function(ve){N=ve},setClear:function(ve,te,Re,Te,At){At===!0&&(ve*=Te,te*=Te,Re*=Te),fe.set(ve,te,Re,Te),he.equals(fe)===!1&&(t.clearColor(ve,te,Re,Te),he.copy(fe))},reset:function(){N=!1,ee=null,he.set(-1,0,0,0)}}}function i(){let N=!1,fe=!1,ee=null,he=null,ve=null;return{setReversed:function(te){if(fe!==te){const Re=e.get("EXT_clip_control");te?Re.clipControlEXT(Re.LOWER_LEFT_EXT,Re.ZERO_TO_ONE_EXT):Re.clipControlEXT(Re.LOWER_LEFT_EXT,Re.NEGATIVE_ONE_TO_ONE_EXT),fe=te;const Te=ve;ve=null,this.setClear(Te)}},getReversed:function(){return fe},setTest:function(te){te?ie(t.DEPTH_TEST):be(t.DEPTH_TEST)},setMask:function(te){ee!==te&&!N&&(t.depthMask(te),ee=te)},setFunc:function(te){if(fe&&(te=Gv[te]),he!==te){switch(te){case Mc:t.depthFunc(t.NEVER);break;case Ec:t.depthFunc(t.ALWAYS);break;case Tc:t.depthFunc(t.LESS);break;case Yr:t.depthFunc(t.LEQUAL);break;case wc:t.depthFunc(t.EQUAL);break;case Ac:t.depthFunc(t.GEQUAL);break;case Rc:t.depthFunc(t.GREATER);break;case bc:t.depthFunc(t.NOTEQUAL);break;default:t.depthFunc(t.LEQUAL)}he=te}},setLocked:function(te){N=te},setClear:function(te){ve!==te&&(ve=te,fe&&(te=1-te),t.clearDepth(te))},reset:function(){N=!1,ee=null,he=null,ve=null,fe=!1}}}function r(){let N=!1,fe=null,ee=null,he=null,ve=null,te=null,Re=null,Te=null,At=null;return{setTest:function(pt){N||(pt?ie(t.STENCIL_TEST):be(t.STENCIL_TEST))},setMask:function(pt){fe!==pt&&!N&&(t.stencilMask(pt),fe=pt)},setFunc:function(pt,pi,mi){(ee!==pt||he!==pi||ve!==mi)&&(t.stencilFunc(pt,pi,mi),ee=pt,he=pi,ve=mi)},setOp:function(pt,pi,mi){(te!==pt||Re!==pi||Te!==mi)&&(t.stencilOp(pt,pi,mi),te=pt,Re=pi,Te=mi)},setLocked:function(pt){N=pt},setClear:function(pt){At!==pt&&(t.clearStencil(pt),At=pt)},reset:function(){N=!1,fe=null,ee=null,he=null,ve=null,te=null,Re=null,Te=null,At=null}}}const s=new n,o=new i,a=new r,l=new WeakMap,c=new WeakMap;let d={},h={},u={},p=new WeakMap,g=[],M=null,m=!1,f=null,x=null,y=null,S=null,w=null,T=null,b=null,_=new Ke(0,0,0),A=0,C=!1,P=null,D=null,W=null,Z=null,B=null;const X=t.getParameter(t.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let H=!1,L=0;const k=t.getParameter(t.VERSION);k.indexOf("WebGL")!==-1?(L=parseFloat(/^WebGL (\d)/.exec(k)[1]),H=L>=1):k.indexOf("OpenGL ES")!==-1&&(L=parseFloat(/^OpenGL ES (\d)/.exec(k)[1]),H=L>=2);let Y=null,$={};const oe=t.getParameter(t.SCISSOR_BOX),Be=t.getParameter(t.VIEWPORT),Qe=new St().fromArray(oe),He=new St().fromArray(Be);function q(N,fe,ee,he){const ve=new Uint8Array(4),te=t.createTexture();t.bindTexture(N,te),t.texParameteri(N,t.TEXTURE_MIN_FILTER,t.NEAREST),t.texParameteri(N,t.TEXTURE_MAG_FILTER,t.NEAREST);for(let Re=0;Re<ee;Re++)N===t.TEXTURE_3D||N===t.TEXTURE_2D_ARRAY?t.texImage3D(fe,0,t.RGBA,1,1,he,0,t.RGBA,t.UNSIGNED_BYTE,ve):t.texImage2D(fe+Re,0,t.RGBA,1,1,0,t.RGBA,t.UNSIGNED_BYTE,ve);return te}const se={};se[t.TEXTURE_2D]=q(t.TEXTURE_2D,t.TEXTURE_2D,1),se[t.TEXTURE_CUBE_MAP]=q(t.TEXTURE_CUBE_MAP,t.TEXTURE_CUBE_MAP_POSITIVE_X,6),se[t.TEXTURE_2D_ARRAY]=q(t.TEXTURE_2D_ARRAY,t.TEXTURE_2D_ARRAY,1,1),se[t.TEXTURE_3D]=q(t.TEXTURE_3D,t.TEXTURE_3D,1,1),s.setClear(0,0,0,1),o.setClear(1),a.setClear(0),ie(t.DEPTH_TEST),o.setFunc(Yr),it(!1),wt(Lh),ie(t.CULL_FACE),et(_i);function ie(N){d[N]!==!0&&(t.enable(N),d[N]=!0)}function be(N){d[N]!==!1&&(t.disable(N),d[N]=!1)}function ke(N,fe){return u[N]!==fe?(t.bindFramebuffer(N,fe),u[N]=fe,N===t.DRAW_FRAMEBUFFER&&(u[t.FRAMEBUFFER]=fe),N===t.FRAMEBUFFER&&(u[t.DRAW_FRAMEBUFFER]=fe),!0):!1}function Ce(N,fe){let ee=g,he=!1;if(N){ee=p.get(fe),ee===void 0&&(ee=[],p.set(fe,ee));const ve=N.textures;if(ee.length!==ve.length||ee[0]!==t.COLOR_ATTACHMENT0){for(let te=0,Re=ve.length;te<Re;te++)ee[te]=t.COLOR_ATTACHMENT0+te;ee.length=ve.length,he=!0}}else ee[0]!==t.BACK&&(ee[0]=t.BACK,he=!0);he&&t.drawBuffers(ee)}function lt(N){return M!==N?(t.useProgram(N),M=N,!0):!1}const Ye={[_r]:t.FUNC_ADD,[dv]:t.FUNC_SUBTRACT,[hv]:t.FUNC_REVERSE_SUBTRACT};Ye[pv]=t.MIN,Ye[mv]=t.MAX;const st={[gv]:t.ZERO,[_v]:t.ONE,[vv]:t.SRC_COLOR,[Sc]:t.SRC_ALPHA,[Tv]:t.SRC_ALPHA_SATURATE,[Mv]:t.DST_COLOR,[Sv]:t.DST_ALPHA,[xv]:t.ONE_MINUS_SRC_COLOR,[yc]:t.ONE_MINUS_SRC_ALPHA,[Ev]:t.ONE_MINUS_DST_COLOR,[yv]:t.ONE_MINUS_DST_ALPHA,[wv]:t.CONSTANT_COLOR,[Av]:t.ONE_MINUS_CONSTANT_COLOR,[Rv]:t.CONSTANT_ALPHA,[bv]:t.ONE_MINUS_CONSTANT_ALPHA};function et(N,fe,ee,he,ve,te,Re,Te,At,pt){if(N===_i){m===!0&&(be(t.BLEND),m=!1);return}if(m===!1&&(ie(t.BLEND),m=!0),N!==fv){if(N!==f||pt!==C){if((x!==_r||w!==_r)&&(t.blendEquation(t.FUNC_ADD),x=_r,w=_r),pt)switch(N){case Xr:t.blendFuncSeparate(t.ONE,t.ONE_MINUS_SRC_ALPHA,t.ONE,t.ONE_MINUS_SRC_ALPHA);break;case Dh:t.blendFunc(t.ONE,t.ONE);break;case Ih:t.blendFuncSeparate(t.ZERO,t.ONE_MINUS_SRC_COLOR,t.ZERO,t.ONE);break;case Nh:t.blendFuncSeparate(t.DST_COLOR,t.ONE_MINUS_SRC_ALPHA,t.ZERO,t.ONE);break;default:tt("WebGLState: Invalid blending: ",N);break}else switch(N){case Xr:t.blendFuncSeparate(t.SRC_ALPHA,t.ONE_MINUS_SRC_ALPHA,t.ONE,t.ONE_MINUS_SRC_ALPHA);break;case Dh:t.blendFuncSeparate(t.SRC_ALPHA,t.ONE,t.ONE,t.ONE);break;case Ih:tt("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case Nh:tt("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:tt("WebGLState: Invalid blending: ",N);break}y=null,S=null,T=null,b=null,_.set(0,0,0),A=0,f=N,C=pt}return}ve=ve||fe,te=te||ee,Re=Re||he,(fe!==x||ve!==w)&&(t.blendEquationSeparate(Ye[fe],Ye[ve]),x=fe,w=ve),(ee!==y||he!==S||te!==T||Re!==b)&&(t.blendFuncSeparate(st[ee],st[he],st[te],st[Re]),y=ee,S=he,T=te,b=Re),(Te.equals(_)===!1||At!==A)&&(t.blendColor(Te.r,Te.g,Te.b,At),_.copy(Te),A=At),f=N,C=!1}function je(N,fe){N.side===Rn?be(t.CULL_FACE):ie(t.CULL_FACE);let ee=N.side===rn;fe&&(ee=!ee),it(ee),N.blending===Xr&&N.transparent===!1?et(_i):et(N.blending,N.blendEquation,N.blendSrc,N.blendDst,N.blendEquationAlpha,N.blendSrcAlpha,N.blendDstAlpha,N.blendColor,N.blendAlpha,N.premultipliedAlpha),o.setFunc(N.depthFunc),o.setTest(N.depthTest),o.setMask(N.depthWrite),s.setMask(N.colorWrite);const he=N.stencilWrite;a.setTest(he),he&&(a.setMask(N.stencilWriteMask),a.setFunc(N.stencilFunc,N.stencilRef,N.stencilFuncMask),a.setOp(N.stencilFail,N.stencilZFail,N.stencilZPass)),Me(N.polygonOffset,N.polygonOffsetFactor,N.polygonOffsetUnits),N.alphaToCoverage===!0?ie(t.SAMPLE_ALPHA_TO_COVERAGE):be(t.SAMPLE_ALPHA_TO_COVERAGE)}function it(N){P!==N&&(N?t.frontFace(t.CW):t.frontFace(t.CCW),P=N)}function wt(N){N!==lv?(ie(t.CULL_FACE),N!==D&&(N===Lh?t.cullFace(t.BACK):N===cv?t.cullFace(t.FRONT):t.cullFace(t.FRONT_AND_BACK))):be(t.CULL_FACE),D=N}function ce(N){N!==W&&(H&&t.lineWidth(N),W=N)}function Me(N,fe,ee){N?(ie(t.POLYGON_OFFSET_FILL),(Z!==fe||B!==ee)&&(Z=fe,B=ee,o.getReversed()&&(fe=-fe),t.polygonOffset(fe,ee))):be(t.POLYGON_OFFSET_FILL)}function Fe(N){N?ie(t.SCISSOR_TEST):be(t.SCISSOR_TEST)}function Oe(N){N===void 0&&(N=t.TEXTURE0+X-1),Y!==N&&(t.activeTexture(N),Y=N)}function I(N,fe,ee){ee===void 0&&(Y===null?ee=t.TEXTURE0+X-1:ee=Y);let he=$[ee];he===void 0&&(he={type:void 0,texture:void 0},$[ee]=he),(he.type!==N||he.texture!==fe)&&(Y!==ee&&(t.activeTexture(ee),Y=ee),t.bindTexture(N,fe||se[N]),he.type=N,he.texture=fe)}function Ze(){const N=$[Y];N!==void 0&&N.type!==void 0&&(t.bindTexture(N.type,null),N.type=void 0,N.texture=void 0)}function De(){try{t.compressedTexImage2D(...arguments)}catch(N){tt("WebGLState:",N)}}function R(){try{t.compressedTexImage3D(...arguments)}catch(N){tt("WebGLState:",N)}}function v(){try{t.texSubImage2D(...arguments)}catch(N){tt("WebGLState:",N)}}function O(){try{t.texSubImage3D(...arguments)}catch(N){tt("WebGLState:",N)}}function G(){try{t.compressedTexSubImage2D(...arguments)}catch(N){tt("WebGLState:",N)}}function Q(){try{t.compressedTexSubImage3D(...arguments)}catch(N){tt("WebGLState:",N)}}function ae(){try{t.texStorage2D(...arguments)}catch(N){tt("WebGLState:",N)}}function ue(){try{t.texStorage3D(...arguments)}catch(N){tt("WebGLState:",N)}}function j(){try{t.texImage2D(...arguments)}catch(N){tt("WebGLState:",N)}}function J(){try{t.texImage3D(...arguments)}catch(N){tt("WebGLState:",N)}}function le(N){return h[N]!==void 0?h[N]:t.getParameter(N)}function Ee(N,fe){h[N]!==fe&&(t.pixelStorei(N,fe),h[N]=fe)}function me(N){Qe.equals(N)===!1&&(t.scissor(N.x,N.y,N.z,N.w),Qe.copy(N))}function de(N){He.equals(N)===!1&&(t.viewport(N.x,N.y,N.z,N.w),He.copy(N))}function Ie(N,fe){let ee=c.get(fe);ee===void 0&&(ee=new WeakMap,c.set(fe,ee));let he=ee.get(N);he===void 0&&(he=t.getUniformBlockIndex(fe,N.name),ee.set(N,he))}function Ue(N,fe){const he=c.get(fe).get(N);l.get(fe)!==he&&(t.uniformBlockBinding(fe,he,N.__bindingPointIndex),l.set(fe,he))}function Ge(){t.disable(t.BLEND),t.disable(t.CULL_FACE),t.disable(t.DEPTH_TEST),t.disable(t.POLYGON_OFFSET_FILL),t.disable(t.SCISSOR_TEST),t.disable(t.STENCIL_TEST),t.disable(t.SAMPLE_ALPHA_TO_COVERAGE),t.blendEquation(t.FUNC_ADD),t.blendFunc(t.ONE,t.ZERO),t.blendFuncSeparate(t.ONE,t.ZERO,t.ONE,t.ZERO),t.blendColor(0,0,0,0),t.colorMask(!0,!0,!0,!0),t.clearColor(0,0,0,0),t.depthMask(!0),t.depthFunc(t.LESS),o.setReversed(!1),t.clearDepth(1),t.stencilMask(4294967295),t.stencilFunc(t.ALWAYS,0,4294967295),t.stencilOp(t.KEEP,t.KEEP,t.KEEP),t.clearStencil(0),t.cullFace(t.BACK),t.frontFace(t.CCW),t.polygonOffset(0,0),t.activeTexture(t.TEXTURE0),t.bindFramebuffer(t.FRAMEBUFFER,null),t.bindFramebuffer(t.DRAW_FRAMEBUFFER,null),t.bindFramebuffer(t.READ_FRAMEBUFFER,null),t.useProgram(null),t.lineWidth(1),t.scissor(0,0,t.canvas.width,t.canvas.height),t.viewport(0,0,t.canvas.width,t.canvas.height),t.pixelStorei(t.PACK_ALIGNMENT,4),t.pixelStorei(t.UNPACK_ALIGNMENT,4),t.pixelStorei(t.UNPACK_FLIP_Y_WEBGL,!1),t.pixelStorei(t.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),t.pixelStorei(t.UNPACK_COLORSPACE_CONVERSION_WEBGL,t.BROWSER_DEFAULT_WEBGL),t.pixelStorei(t.PACK_ROW_LENGTH,0),t.pixelStorei(t.PACK_SKIP_PIXELS,0),t.pixelStorei(t.PACK_SKIP_ROWS,0),t.pixelStorei(t.UNPACK_ROW_LENGTH,0),t.pixelStorei(t.UNPACK_IMAGE_HEIGHT,0),t.pixelStorei(t.UNPACK_SKIP_PIXELS,0),t.pixelStorei(t.UNPACK_SKIP_ROWS,0),t.pixelStorei(t.UNPACK_SKIP_IMAGES,0),d={},h={},Y=null,$={},u={},p=new WeakMap,g=[],M=null,m=!1,f=null,x=null,y=null,S=null,w=null,T=null,b=null,_=new Ke(0,0,0),A=0,C=!1,P=null,D=null,W=null,Z=null,B=null,Qe.set(0,0,t.canvas.width,t.canvas.height),He.set(0,0,t.canvas.width,t.canvas.height),s.reset(),o.reset(),a.reset()}return{buffers:{color:s,depth:o,stencil:a},enable:ie,disable:be,bindFramebuffer:ke,drawBuffers:Ce,useProgram:lt,setBlending:et,setMaterial:je,setFlipSided:it,setCullFace:wt,setLineWidth:ce,setPolygonOffset:Me,setScissorTest:Fe,activeTexture:Oe,bindTexture:I,unbindTexture:Ze,compressedTexImage2D:De,compressedTexImage3D:R,texImage2D:j,texImage3D:J,pixelStorei:Ee,getParameter:le,updateUBOMapping:Ie,uniformBlockBinding:Ue,texStorage2D:ae,texStorage3D:ue,texSubImage2D:v,texSubImage3D:O,compressedTexSubImage2D:G,compressedTexSubImage3D:Q,scissor:me,viewport:de,reset:Ge}}function O1(t,e,n,i,r,s,o){const a=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new ze,d=new WeakMap,h=new Set;let u;const p=new WeakMap;let g=!1;try{g=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function M(R,v){return g?new OffscreenCanvas(R,v):ca("canvas")}function m(R,v,O){let G=1;const Q=De(R);if((Q.width>O||Q.height>O)&&(G=O/Math.max(Q.width,Q.height)),G<1)if(typeof HTMLImageElement<"u"&&R instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&R instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&R instanceof ImageBitmap||typeof VideoFrame<"u"&&R instanceof VideoFrame){const ae=Math.floor(G*Q.width),ue=Math.floor(G*Q.height);u===void 0&&(u=M(ae,ue));const j=v?M(ae,ue):u;return j.width=ae,j.height=ue,j.getContext("2d").drawImage(R,0,0,ae,ue),Ne("WebGLRenderer: Texture has been resized from ("+Q.width+"x"+Q.height+") to ("+ae+"x"+ue+")."),j}else return"data"in R&&Ne("WebGLRenderer: Image in DataTexture is too big ("+Q.width+"x"+Q.height+")."),R;return R}function f(R){return R.generateMipmaps}function x(R){t.generateMipmap(R)}function y(R){return R.isWebGLCubeRenderTarget?t.TEXTURE_CUBE_MAP:R.isWebGL3DRenderTarget?t.TEXTURE_3D:R.isWebGLArrayRenderTarget||R.isCompressedArrayTexture?t.TEXTURE_2D_ARRAY:t.TEXTURE_2D}function S(R,v,O,G,Q,ae=!1){if(R!==null){if(t[R]!==void 0)return t[R];Ne("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+R+"'")}let ue;G&&(ue=e.get("EXT_texture_norm16"),ue||Ne("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let j=v;if(v===t.RED&&(O===t.FLOAT&&(j=t.R32F),O===t.HALF_FLOAT&&(j=t.R16F),O===t.UNSIGNED_BYTE&&(j=t.R8),O===t.UNSIGNED_SHORT&&ue&&(j=ue.R16_EXT),O===t.SHORT&&ue&&(j=ue.R16_SNORM_EXT)),v===t.RED_INTEGER&&(O===t.UNSIGNED_BYTE&&(j=t.R8UI),O===t.UNSIGNED_SHORT&&(j=t.R16UI),O===t.UNSIGNED_INT&&(j=t.R32UI),O===t.BYTE&&(j=t.R8I),O===t.SHORT&&(j=t.R16I),O===t.INT&&(j=t.R32I)),v===t.RG&&(O===t.FLOAT&&(j=t.RG32F),O===t.HALF_FLOAT&&(j=t.RG16F),O===t.UNSIGNED_BYTE&&(j=t.RG8),O===t.UNSIGNED_SHORT&&ue&&(j=ue.RG16_EXT),O===t.SHORT&&ue&&(j=ue.RG16_SNORM_EXT)),v===t.RG_INTEGER&&(O===t.UNSIGNED_BYTE&&(j=t.RG8UI),O===t.UNSIGNED_SHORT&&(j=t.RG16UI),O===t.UNSIGNED_INT&&(j=t.RG32UI),O===t.BYTE&&(j=t.RG8I),O===t.SHORT&&(j=t.RG16I),O===t.INT&&(j=t.RG32I)),v===t.RGB_INTEGER&&(O===t.UNSIGNED_BYTE&&(j=t.RGB8UI),O===t.UNSIGNED_SHORT&&(j=t.RGB16UI),O===t.UNSIGNED_INT&&(j=t.RGB32UI),O===t.BYTE&&(j=t.RGB8I),O===t.SHORT&&(j=t.RGB16I),O===t.INT&&(j=t.RGB32I)),v===t.RGBA_INTEGER&&(O===t.UNSIGNED_BYTE&&(j=t.RGBA8UI),O===t.UNSIGNED_SHORT&&(j=t.RGBA16UI),O===t.UNSIGNED_INT&&(j=t.RGBA32UI),O===t.BYTE&&(j=t.RGBA8I),O===t.SHORT&&(j=t.RGBA16I),O===t.INT&&(j=t.RGBA32I)),v===t.RGB&&(O===t.UNSIGNED_SHORT&&ue&&(j=ue.RGB16_EXT),O===t.SHORT&&ue&&(j=ue.RGB16_SNORM_EXT),O===t.UNSIGNED_INT_5_9_9_9_REV&&(j=t.RGB9_E5),O===t.UNSIGNED_INT_10F_11F_11F_REV&&(j=t.R11F_G11F_B10F)),v===t.RGBA){const J=ae?la:$e.getTransfer(Q);O===t.FLOAT&&(j=t.RGBA32F),O===t.HALF_FLOAT&&(j=t.RGBA16F),O===t.UNSIGNED_BYTE&&(j=J===ot?t.SRGB8_ALPHA8:t.RGBA8),O===t.UNSIGNED_SHORT&&ue&&(j=ue.RGBA16_EXT),O===t.SHORT&&ue&&(j=ue.RGBA16_SNORM_EXT),O===t.UNSIGNED_SHORT_4_4_4_4&&(j=t.RGBA4),O===t.UNSIGNED_SHORT_5_5_5_1&&(j=t.RGB5_A1)}return(j===t.R16F||j===t.R32F||j===t.RG16F||j===t.RG32F||j===t.RGBA16F||j===t.RGBA32F)&&e.get("EXT_color_buffer_float"),j}function w(R,v){let O;return R?v===null||v===ti||v===Ys?O=t.DEPTH24_STENCIL8:v===ni?O=t.DEPTH32F_STENCIL8:v===Xs&&(O=t.DEPTH24_STENCIL8,Ne("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):v===null||v===ti||v===Ys?O=t.DEPTH_COMPONENT24:v===ni?O=t.DEPTH_COMPONENT32F:v===Xs&&(O=t.DEPTH_COMPONENT16),O}function T(R,v){return f(R)===!0||R.isFramebufferTexture&&R.minFilter!==Wt&&R.minFilter!==Dt?Math.log2(Math.max(v.width,v.height))+1:R.mipmaps!==void 0&&R.mipmaps.length>0?R.mipmaps.length:R.isCompressedTexture&&Array.isArray(R.image)?v.mipmaps.length:1}function b(R){const v=R.target;v.removeEventListener("dispose",b),A(v),v.isVideoTexture&&d.delete(v),v.isHTMLTexture&&h.delete(v)}function _(R){const v=R.target;v.removeEventListener("dispose",_),P(v)}function A(R){const v=i.get(R);if(v.__webglInit===void 0)return;const O=R.source,G=p.get(O);if(G){const Q=G[v.__cacheKey];Q.usedTimes--,Q.usedTimes===0&&C(R),Object.keys(G).length===0&&p.delete(O)}i.remove(R)}function C(R){const v=i.get(R);t.deleteTexture(v.__webglTexture);const O=R.source,G=p.get(O);delete G[v.__cacheKey],o.memory.textures--}function P(R){const v=i.get(R);if(R.depthTexture&&(R.depthTexture.dispose(),i.remove(R.depthTexture)),R.isWebGLCubeRenderTarget)for(let G=0;G<6;G++){if(Array.isArray(v.__webglFramebuffer[G]))for(let Q=0;Q<v.__webglFramebuffer[G].length;Q++)t.deleteFramebuffer(v.__webglFramebuffer[G][Q]);else t.deleteFramebuffer(v.__webglFramebuffer[G]);v.__webglDepthbuffer&&t.deleteRenderbuffer(v.__webglDepthbuffer[G])}else{if(Array.isArray(v.__webglFramebuffer))for(let G=0;G<v.__webglFramebuffer.length;G++)t.deleteFramebuffer(v.__webglFramebuffer[G]);else t.deleteFramebuffer(v.__webglFramebuffer);if(v.__webglDepthbuffer&&t.deleteRenderbuffer(v.__webglDepthbuffer),v.__webglMultisampledFramebuffer&&t.deleteFramebuffer(v.__webglMultisampledFramebuffer),v.__webglColorRenderbuffer)for(let G=0;G<v.__webglColorRenderbuffer.length;G++)v.__webglColorRenderbuffer[G]&&t.deleteRenderbuffer(v.__webglColorRenderbuffer[G]);v.__webglDepthRenderbuffer&&t.deleteRenderbuffer(v.__webglDepthRenderbuffer)}const O=R.textures;for(let G=0,Q=O.length;G<Q;G++){const ae=i.get(O[G]);ae.__webglTexture&&(t.deleteTexture(ae.__webglTexture),o.memory.textures--),i.remove(O[G])}i.remove(R)}let D=0;function W(){D=0}function Z(){return D}function B(R){D=R}function X(){const R=D;return R>=r.maxTextures&&Ne("WebGLTextures: Trying to use "+R+" texture units while this GPU supports only "+r.maxTextures),D+=1,R}function H(R){const v=[];return v.push(R.wrapS),v.push(R.wrapT),v.push(R.wrapR||0),v.push(R.magFilter),v.push(R.minFilter),v.push(R.anisotropy),v.push(R.internalFormat),v.push(R.format),v.push(R.type),v.push(R.generateMipmaps),v.push(R.premultiplyAlpha),v.push(R.flipY),v.push(R.unpackAlignment),v.push(R.colorSpace),v.join()}function L(R,v){const O=i.get(R);if(R.isVideoTexture&&I(R),R.isRenderTargetTexture===!1&&R.isExternalTexture!==!0&&R.version>0&&O.__version!==R.version){const G=R.image;if(G===null)Ne("WebGLRenderer: Texture marked for update but no image data found.");else if(G.complete===!1)Ne("WebGLRenderer: Texture marked for update but image is incomplete");else{be(O,R,v);return}}else R.isExternalTexture&&(O.__webglTexture=R.sourceTexture?R.sourceTexture:null);n.bindTexture(t.TEXTURE_2D,O.__webglTexture,t.TEXTURE0+v)}function k(R,v){const O=i.get(R);if(R.isRenderTargetTexture===!1&&R.version>0&&O.__version!==R.version){be(O,R,v);return}else R.isExternalTexture&&(O.__webglTexture=R.sourceTexture?R.sourceTexture:null);n.bindTexture(t.TEXTURE_2D_ARRAY,O.__webglTexture,t.TEXTURE0+v)}function Y(R,v){const O=i.get(R);if(R.isRenderTargetTexture===!1&&R.version>0&&O.__version!==R.version){be(O,R,v);return}n.bindTexture(t.TEXTURE_3D,O.__webglTexture,t.TEXTURE0+v)}function $(R,v){const O=i.get(R);if(R.isCubeDepthTexture!==!0&&R.version>0&&O.__version!==R.version){ke(O,R,v);return}n.bindTexture(t.TEXTURE_CUBE_MAP,O.__webglTexture,t.TEXTURE0+v)}const oe={[Lc]:t.REPEAT,[fn]:t.CLAMP_TO_EDGE,[Dc]:t.MIRRORED_REPEAT},Be={[Wt]:t.NEAREST,[Lv]:t.NEAREST_MIPMAP_NEAREST,[ea]:t.NEAREST_MIPMAP_LINEAR,[Dt]:t.LINEAR,[Ic]:t.LINEAR_MIPMAP_NEAREST,[xr]:t.LINEAR_MIPMAP_LINEAR},Qe={[Nv]:t.NEVER,[kv]:t.ALWAYS,[Uv]:t.LESS,[vu]:t.LEQUAL,[Fv]:t.EQUAL,[xu]:t.GEQUAL,[Ov]:t.GREATER,[Bv]:t.NOTEQUAL};function He(R,v){if(v.type===ni&&e.has("OES_texture_float_linear")===!1&&(v.magFilter===Dt||v.magFilter===Ic||v.magFilter===ea||v.magFilter===xr||v.minFilter===Dt||v.minFilter===Ic||v.minFilter===ea||v.minFilter===xr)&&Ne("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),t.texParameteri(R,t.TEXTURE_WRAP_S,oe[v.wrapS]),t.texParameteri(R,t.TEXTURE_WRAP_T,oe[v.wrapT]),(R===t.TEXTURE_3D||R===t.TEXTURE_2D_ARRAY)&&t.texParameteri(R,t.TEXTURE_WRAP_R,oe[v.wrapR]),t.texParameteri(R,t.TEXTURE_MAG_FILTER,Be[v.magFilter]),t.texParameteri(R,t.TEXTURE_MIN_FILTER,Be[v.minFilter]),v.compareFunction&&(t.texParameteri(R,t.TEXTURE_COMPARE_MODE,t.COMPARE_REF_TO_TEXTURE),t.texParameteri(R,t.TEXTURE_COMPARE_FUNC,Qe[v.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(v.magFilter===Wt||v.minFilter!==ea&&v.minFilter!==xr||v.type===ni&&e.has("OES_texture_float_linear")===!1)return;if(v.anisotropy>1||i.get(v).__currentAnisotropy){const O=e.get("EXT_texture_filter_anisotropic");t.texParameterf(R,O.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(v.anisotropy,r.getMaxAnisotropy())),i.get(v).__currentAnisotropy=v.anisotropy}}}function q(R,v){let O=!1;R.__webglInit===void 0&&(R.__webglInit=!0,v.addEventListener("dispose",b));const G=v.source;let Q=p.get(G);Q===void 0&&(Q={},p.set(G,Q));const ae=H(v);if(ae!==R.__cacheKey){Q[ae]===void 0&&(Q[ae]={texture:t.createTexture(),usedTimes:0},o.memory.textures++,O=!0),Q[ae].usedTimes++;const ue=Q[R.__cacheKey];ue!==void 0&&(Q[R.__cacheKey].usedTimes--,ue.usedTimes===0&&C(v)),R.__cacheKey=ae,R.__webglTexture=Q[ae].texture}return O}function se(R,v,O){return Math.floor(Math.floor(R/O)/v)}function ie(R,v,O,G){const ae=R.updateRanges;if(ae.length===0)n.texSubImage2D(t.TEXTURE_2D,0,0,0,v.width,v.height,O,G,v.data);else{ae.sort((Ee,me)=>Ee.start-me.start);let ue=0;for(let Ee=1;Ee<ae.length;Ee++){const me=ae[ue],de=ae[Ee],Ie=me.start+me.count,Ue=se(de.start,v.width,4),Ge=se(me.start,v.width,4);de.start<=Ie+1&&Ue===Ge&&se(de.start+de.count-1,v.width,4)===Ue?me.count=Math.max(me.count,de.start+de.count-me.start):(++ue,ae[ue]=de)}ae.length=ue+1;const j=n.getParameter(t.UNPACK_ROW_LENGTH),J=n.getParameter(t.UNPACK_SKIP_PIXELS),le=n.getParameter(t.UNPACK_SKIP_ROWS);n.pixelStorei(t.UNPACK_ROW_LENGTH,v.width);for(let Ee=0,me=ae.length;Ee<me;Ee++){const de=ae[Ee],Ie=Math.floor(de.start/4),Ue=Math.ceil(de.count/4),Ge=Ie%v.width,N=Math.floor(Ie/v.width),fe=Ue,ee=1;n.pixelStorei(t.UNPACK_SKIP_PIXELS,Ge),n.pixelStorei(t.UNPACK_SKIP_ROWS,N),n.texSubImage2D(t.TEXTURE_2D,0,Ge,N,fe,ee,O,G,v.data)}R.clearUpdateRanges(),n.pixelStorei(t.UNPACK_ROW_LENGTH,j),n.pixelStorei(t.UNPACK_SKIP_PIXELS,J),n.pixelStorei(t.UNPACK_SKIP_ROWS,le)}}function be(R,v,O){let G=t.TEXTURE_2D;(v.isDataArrayTexture||v.isCompressedArrayTexture)&&(G=t.TEXTURE_2D_ARRAY),v.isData3DTexture&&(G=t.TEXTURE_3D);const Q=q(R,v),ae=v.source;n.bindTexture(G,R.__webglTexture,t.TEXTURE0+O);const ue=i.get(ae);if(ae.version!==ue.__version||Q===!0){if(n.activeTexture(t.TEXTURE0+O),(typeof ImageBitmap<"u"&&v.image instanceof ImageBitmap)===!1){const ee=$e.getPrimaries($e.workingColorSpace),he=v.colorSpace===Fi?null:$e.getPrimaries(v.colorSpace),ve=v.colorSpace===Fi||ee===he?t.NONE:t.BROWSER_DEFAULT_WEBGL;n.pixelStorei(t.UNPACK_FLIP_Y_WEBGL,v.flipY),n.pixelStorei(t.UNPACK_PREMULTIPLY_ALPHA_WEBGL,v.premultiplyAlpha),n.pixelStorei(t.UNPACK_COLORSPACE_CONVERSION_WEBGL,ve)}n.pixelStorei(t.UNPACK_ALIGNMENT,v.unpackAlignment);let J=m(v.image,!1,r.maxTextureSize);J=Ze(v,J);const le=s.convert(v.format,v.colorSpace),Ee=s.convert(v.type);let me=S(v.internalFormat,le,Ee,v.normalized,v.colorSpace,v.isVideoTexture);He(G,v);let de;const Ie=v.mipmaps,Ue=v.isVideoTexture!==!0,Ge=ue.__version===void 0||Q===!0,N=ae.dataReady,fe=T(v,J);if(v.isDepthTexture)me=w(v.format===Sr,v.type),Ge&&(Ue?n.texStorage2D(t.TEXTURE_2D,1,me,J.width,J.height):n.texImage2D(t.TEXTURE_2D,0,me,J.width,J.height,0,le,Ee,null));else if(v.isDataTexture)if(Ie.length>0){Ue&&Ge&&n.texStorage2D(t.TEXTURE_2D,fe,me,Ie[0].width,Ie[0].height);for(let ee=0,he=Ie.length;ee<he;ee++)de=Ie[ee],Ue?N&&n.texSubImage2D(t.TEXTURE_2D,ee,0,0,de.width,de.height,le,Ee,de.data):n.texImage2D(t.TEXTURE_2D,ee,me,de.width,de.height,0,le,Ee,de.data);v.generateMipmaps=!1}else Ue?(Ge&&n.texStorage2D(t.TEXTURE_2D,fe,me,J.width,J.height),N&&ie(v,J,le,Ee)):n.texImage2D(t.TEXTURE_2D,0,me,J.width,J.height,0,le,Ee,J.data);else if(v.isCompressedTexture)if(v.isCompressedArrayTexture){Ue&&Ge&&n.texStorage3D(t.TEXTURE_2D_ARRAY,fe,me,Ie[0].width,Ie[0].height,J.depth);for(let ee=0,he=Ie.length;ee<he;ee++)if(de=Ie[ee],v.format!==bn)if(le!==null)if(Ue){if(N)if(v.layerUpdates.size>0){const ve=Hp(de.width,de.height,v.format,v.type);for(const te of v.layerUpdates){const Re=de.data.subarray(te*ve/de.data.BYTES_PER_ELEMENT,(te+1)*ve/de.data.BYTES_PER_ELEMENT);n.compressedTexSubImage3D(t.TEXTURE_2D_ARRAY,ee,0,0,te,de.width,de.height,1,le,Re)}v.clearLayerUpdates()}else n.compressedTexSubImage3D(t.TEXTURE_2D_ARRAY,ee,0,0,0,de.width,de.height,J.depth,le,de.data)}else n.compressedTexImage3D(t.TEXTURE_2D_ARRAY,ee,me,de.width,de.height,J.depth,0,de.data,0,0);else Ne("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Ue?N&&n.texSubImage3D(t.TEXTURE_2D_ARRAY,ee,0,0,0,de.width,de.height,J.depth,le,Ee,de.data):n.texImage3D(t.TEXTURE_2D_ARRAY,ee,me,de.width,de.height,J.depth,0,le,Ee,de.data)}else{Ue&&Ge&&n.texStorage2D(t.TEXTURE_2D,fe,me,Ie[0].width,Ie[0].height);for(let ee=0,he=Ie.length;ee<he;ee++)de=Ie[ee],v.format!==bn?le!==null?Ue?N&&n.compressedTexSubImage2D(t.TEXTURE_2D,ee,0,0,de.width,de.height,le,de.data):n.compressedTexImage2D(t.TEXTURE_2D,ee,me,de.width,de.height,0,de.data):Ne("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Ue?N&&n.texSubImage2D(t.TEXTURE_2D,ee,0,0,de.width,de.height,le,Ee,de.data):n.texImage2D(t.TEXTURE_2D,ee,me,de.width,de.height,0,le,Ee,de.data)}else if(v.isDataArrayTexture)if(Ue){if(Ge&&n.texStorage3D(t.TEXTURE_2D_ARRAY,fe,me,J.width,J.height,J.depth),N)if(v.layerUpdates.size>0){const ee=Hp(J.width,J.height,v.format,v.type);for(const he of v.layerUpdates){const ve=J.data.subarray(he*ee/J.data.BYTES_PER_ELEMENT,(he+1)*ee/J.data.BYTES_PER_ELEMENT);n.texSubImage3D(t.TEXTURE_2D_ARRAY,0,0,0,he,J.width,J.height,1,le,Ee,ve)}v.clearLayerUpdates()}else n.texSubImage3D(t.TEXTURE_2D_ARRAY,0,0,0,0,J.width,J.height,J.depth,le,Ee,J.data)}else n.texImage3D(t.TEXTURE_2D_ARRAY,0,me,J.width,J.height,J.depth,0,le,Ee,J.data);else if(v.isData3DTexture)Ue?(Ge&&n.texStorage3D(t.TEXTURE_3D,fe,me,J.width,J.height,J.depth),N&&n.texSubImage3D(t.TEXTURE_3D,0,0,0,0,J.width,J.height,J.depth,le,Ee,J.data)):n.texImage3D(t.TEXTURE_3D,0,me,J.width,J.height,J.depth,0,le,Ee,J.data);else if(v.isFramebufferTexture){if(Ge)if(Ue)n.texStorage2D(t.TEXTURE_2D,fe,me,J.width,J.height);else{let ee=J.width,he=J.height;for(let ve=0;ve<fe;ve++)n.texImage2D(t.TEXTURE_2D,ve,me,ee,he,0,le,Ee,null),ee>>=1,he>>=1}}else if(v.isHTMLTexture){if("texElementImage2D"in t){const ee=t.canvas;if(ee.hasAttribute("layoutsubtree")||ee.setAttribute("layoutsubtree","true"),J.parentNode!==ee){ee.appendChild(J),h.add(v),ee.onpaint=he=>{const ve=he.changedElements;for(const te of h)ve.includes(te.image)&&(te.needsUpdate=!0)},ee.requestPaint();return}if(t.texElementImage2D.length===3)t.texElementImage2D(t.TEXTURE_2D,t.RGBA8,J);else{const ve=t.RGBA,te=t.RGBA,Re=t.UNSIGNED_BYTE;t.texElementImage2D(t.TEXTURE_2D,0,ve,te,Re,J)}t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE)}}else if(Ie.length>0){if(Ue&&Ge){const ee=De(Ie[0]);n.texStorage2D(t.TEXTURE_2D,fe,me,ee.width,ee.height)}for(let ee=0,he=Ie.length;ee<he;ee++)de=Ie[ee],Ue?N&&n.texSubImage2D(t.TEXTURE_2D,ee,0,0,le,Ee,de):n.texImage2D(t.TEXTURE_2D,ee,me,le,Ee,de);v.generateMipmaps=!1}else if(Ue){if(Ge){const ee=De(J);n.texStorage2D(t.TEXTURE_2D,fe,me,ee.width,ee.height)}N&&n.texSubImage2D(t.TEXTURE_2D,0,0,0,le,Ee,J)}else n.texImage2D(t.TEXTURE_2D,0,me,le,Ee,J);f(v)&&x(G),ue.__version=ae.version,v.onUpdate&&v.onUpdate(v)}R.__version=v.version}function ke(R,v,O){if(v.image.length!==6)return;const G=q(R,v),Q=v.source;n.bindTexture(t.TEXTURE_CUBE_MAP,R.__webglTexture,t.TEXTURE0+O);const ae=i.get(Q);if(Q.version!==ae.__version||G===!0){n.activeTexture(t.TEXTURE0+O);const ue=$e.getPrimaries($e.workingColorSpace),j=v.colorSpace===Fi?null:$e.getPrimaries(v.colorSpace),J=v.colorSpace===Fi||ue===j?t.NONE:t.BROWSER_DEFAULT_WEBGL;n.pixelStorei(t.UNPACK_FLIP_Y_WEBGL,v.flipY),n.pixelStorei(t.UNPACK_PREMULTIPLY_ALPHA_WEBGL,v.premultiplyAlpha),n.pixelStorei(t.UNPACK_ALIGNMENT,v.unpackAlignment),n.pixelStorei(t.UNPACK_COLORSPACE_CONVERSION_WEBGL,J);const le=v.isCompressedTexture||v.image[0].isCompressedTexture,Ee=v.image[0]&&v.image[0].isDataTexture,me=[];for(let te=0;te<6;te++)!le&&!Ee?me[te]=m(v.image[te],!0,r.maxCubemapSize):me[te]=Ee?v.image[te].image:v.image[te],me[te]=Ze(v,me[te]);const de=me[0],Ie=s.convert(v.format,v.colorSpace),Ue=s.convert(v.type),Ge=S(v.internalFormat,Ie,Ue,v.normalized,v.colorSpace),N=v.isVideoTexture!==!0,fe=ae.__version===void 0||G===!0,ee=Q.dataReady;let he=T(v,de);He(t.TEXTURE_CUBE_MAP,v);let ve;if(le){N&&fe&&n.texStorage2D(t.TEXTURE_CUBE_MAP,he,Ge,de.width,de.height);for(let te=0;te<6;te++){ve=me[te].mipmaps;for(let Re=0;Re<ve.length;Re++){const Te=ve[Re];v.format!==bn?Ie!==null?N?ee&&n.compressedTexSubImage2D(t.TEXTURE_CUBE_MAP_POSITIVE_X+te,Re,0,0,Te.width,Te.height,Ie,Te.data):n.compressedTexImage2D(t.TEXTURE_CUBE_MAP_POSITIVE_X+te,Re,Ge,Te.width,Te.height,0,Te.data):Ne("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):N?ee&&n.texSubImage2D(t.TEXTURE_CUBE_MAP_POSITIVE_X+te,Re,0,0,Te.width,Te.height,Ie,Ue,Te.data):n.texImage2D(t.TEXTURE_CUBE_MAP_POSITIVE_X+te,Re,Ge,Te.width,Te.height,0,Ie,Ue,Te.data)}}}else{if(ve=v.mipmaps,N&&fe){ve.length>0&&he++;const te=De(me[0]);n.texStorage2D(t.TEXTURE_CUBE_MAP,he,Ge,te.width,te.height)}for(let te=0;te<6;te++)if(Ee){N?ee&&n.texSubImage2D(t.TEXTURE_CUBE_MAP_POSITIVE_X+te,0,0,0,me[te].width,me[te].height,Ie,Ue,me[te].data):n.texImage2D(t.TEXTURE_CUBE_MAP_POSITIVE_X+te,0,Ge,me[te].width,me[te].height,0,Ie,Ue,me[te].data);for(let Re=0;Re<ve.length;Re++){const At=ve[Re].image[te].image;N?ee&&n.texSubImage2D(t.TEXTURE_CUBE_MAP_POSITIVE_X+te,Re+1,0,0,At.width,At.height,Ie,Ue,At.data):n.texImage2D(t.TEXTURE_CUBE_MAP_POSITIVE_X+te,Re+1,Ge,At.width,At.height,0,Ie,Ue,At.data)}}else{N?ee&&n.texSubImage2D(t.TEXTURE_CUBE_MAP_POSITIVE_X+te,0,0,0,Ie,Ue,me[te]):n.texImage2D(t.TEXTURE_CUBE_MAP_POSITIVE_X+te,0,Ge,Ie,Ue,me[te]);for(let Re=0;Re<ve.length;Re++){const Te=ve[Re];N?ee&&n.texSubImage2D(t.TEXTURE_CUBE_MAP_POSITIVE_X+te,Re+1,0,0,Ie,Ue,Te.image[te]):n.texImage2D(t.TEXTURE_CUBE_MAP_POSITIVE_X+te,Re+1,Ge,Ie,Ue,Te.image[te])}}}f(v)&&x(t.TEXTURE_CUBE_MAP),ae.__version=Q.version,v.onUpdate&&v.onUpdate(v)}R.__version=v.version}function Ce(R,v,O,G,Q,ae){const ue=s.convert(O.format,O.colorSpace),j=s.convert(O.type),J=S(O.internalFormat,ue,j,O.normalized,O.colorSpace),le=i.get(v),Ee=i.get(O);if(Ee.__renderTarget=v,!le.__hasExternalTextures){const me=Math.max(1,v.width>>ae),de=Math.max(1,v.height>>ae);Q===t.TEXTURE_3D||Q===t.TEXTURE_2D_ARRAY?n.texImage3D(Q,ae,J,me,de,v.depth,0,ue,j,null):n.texImage2D(Q,ae,J,me,de,0,ue,j,null)}n.bindFramebuffer(t.FRAMEBUFFER,R),Oe(v)?a.framebufferTexture2DMultisampleEXT(t.FRAMEBUFFER,G,Q,Ee.__webglTexture,0,Fe(v)):(Q===t.TEXTURE_2D||Q>=t.TEXTURE_CUBE_MAP_POSITIVE_X&&Q<=t.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&t.framebufferTexture2D(t.FRAMEBUFFER,G,Q,Ee.__webglTexture,ae),n.bindFramebuffer(t.FRAMEBUFFER,null)}function lt(R,v,O){if(t.bindRenderbuffer(t.RENDERBUFFER,R),v.depthBuffer){const G=v.depthTexture,Q=G&&G.isDepthTexture?G.type:null,ae=w(v.stencilBuffer,Q),ue=v.stencilBuffer?t.DEPTH_STENCIL_ATTACHMENT:t.DEPTH_ATTACHMENT;Oe(v)?a.renderbufferStorageMultisampleEXT(t.RENDERBUFFER,Fe(v),ae,v.width,v.height):O?t.renderbufferStorageMultisample(t.RENDERBUFFER,Fe(v),ae,v.width,v.height):t.renderbufferStorage(t.RENDERBUFFER,ae,v.width,v.height),t.framebufferRenderbuffer(t.FRAMEBUFFER,ue,t.RENDERBUFFER,R)}else{const G=v.textures;for(let Q=0;Q<G.length;Q++){const ae=G[Q],ue=s.convert(ae.format,ae.colorSpace),j=s.convert(ae.type),J=S(ae.internalFormat,ue,j,ae.normalized,ae.colorSpace);Oe(v)?a.renderbufferStorageMultisampleEXT(t.RENDERBUFFER,Fe(v),J,v.width,v.height):O?t.renderbufferStorageMultisample(t.RENDERBUFFER,Fe(v),J,v.width,v.height):t.renderbufferStorage(t.RENDERBUFFER,J,v.width,v.height)}}t.bindRenderbuffer(t.RENDERBUFFER,null)}function Ye(R,v,O){const G=v.isWebGLCubeRenderTarget===!0;if(n.bindFramebuffer(t.FRAMEBUFFER,R),!(v.depthTexture&&v.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");const Q=i.get(v.depthTexture);if(Q.__renderTarget=v,(!Q.__webglTexture||v.depthTexture.image.width!==v.width||v.depthTexture.image.height!==v.height)&&(v.depthTexture.image.width=v.width,v.depthTexture.image.height=v.height,v.depthTexture.needsUpdate=!0),G){if(Q.__webglInit===void 0&&(Q.__webglInit=!0,v.depthTexture.addEventListener("dispose",b)),Q.__webglTexture===void 0){Q.__webglTexture=t.createTexture(),n.bindTexture(t.TEXTURE_CUBE_MAP,Q.__webglTexture),He(t.TEXTURE_CUBE_MAP,v.depthTexture);const le=s.convert(v.depthTexture.format),Ee=s.convert(v.depthTexture.type);let me;v.depthTexture.format===xi?me=t.DEPTH_COMPONENT24:v.depthTexture.format===Sr&&(me=t.DEPTH24_STENCIL8);for(let de=0;de<6;de++)t.texImage2D(t.TEXTURE_CUBE_MAP_POSITIVE_X+de,0,me,v.width,v.height,0,le,Ee,null)}}else L(v.depthTexture,0);const ae=Q.__webglTexture,ue=Fe(v),j=G?t.TEXTURE_CUBE_MAP_POSITIVE_X+O:t.TEXTURE_2D,J=v.depthTexture.format===Sr?t.DEPTH_STENCIL_ATTACHMENT:t.DEPTH_ATTACHMENT;if(v.depthTexture.format===xi)Oe(v)?a.framebufferTexture2DMultisampleEXT(t.FRAMEBUFFER,J,j,ae,0,ue):t.framebufferTexture2D(t.FRAMEBUFFER,J,j,ae,0);else if(v.depthTexture.format===Sr)Oe(v)?a.framebufferTexture2DMultisampleEXT(t.FRAMEBUFFER,J,j,ae,0,ue):t.framebufferTexture2D(t.FRAMEBUFFER,J,j,ae,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function st(R){const v=i.get(R),O=R.isWebGLCubeRenderTarget===!0;if(v.__boundDepthTexture!==R.depthTexture){const G=R.depthTexture;if(v.__depthDisposeCallback&&v.__depthDisposeCallback(),G){const Q=()=>{delete v.__boundDepthTexture,delete v.__depthDisposeCallback,G.removeEventListener("dispose",Q)};G.addEventListener("dispose",Q),v.__depthDisposeCallback=Q}v.__boundDepthTexture=G}if(R.depthTexture&&!v.__autoAllocateDepthBuffer)if(O)for(let G=0;G<6;G++)Ye(v.__webglFramebuffer[G],R,G);else{const G=R.texture.mipmaps;G&&G.length>0?Ye(v.__webglFramebuffer[0],R,0):Ye(v.__webglFramebuffer,R,0)}else if(O){v.__webglDepthbuffer=[];for(let G=0;G<6;G++)if(n.bindFramebuffer(t.FRAMEBUFFER,v.__webglFramebuffer[G]),v.__webglDepthbuffer[G]===void 0)v.__webglDepthbuffer[G]=t.createRenderbuffer(),lt(v.__webglDepthbuffer[G],R,!1);else{const Q=R.stencilBuffer?t.DEPTH_STENCIL_ATTACHMENT:t.DEPTH_ATTACHMENT,ae=v.__webglDepthbuffer[G];t.bindRenderbuffer(t.RENDERBUFFER,ae),t.framebufferRenderbuffer(t.FRAMEBUFFER,Q,t.RENDERBUFFER,ae)}}else{const G=R.texture.mipmaps;if(G&&G.length>0?n.bindFramebuffer(t.FRAMEBUFFER,v.__webglFramebuffer[0]):n.bindFramebuffer(t.FRAMEBUFFER,v.__webglFramebuffer),v.__webglDepthbuffer===void 0)v.__webglDepthbuffer=t.createRenderbuffer(),lt(v.__webglDepthbuffer,R,!1);else{const Q=R.stencilBuffer?t.DEPTH_STENCIL_ATTACHMENT:t.DEPTH_ATTACHMENT,ae=v.__webglDepthbuffer;t.bindRenderbuffer(t.RENDERBUFFER,ae),t.framebufferRenderbuffer(t.FRAMEBUFFER,Q,t.RENDERBUFFER,ae)}}n.bindFramebuffer(t.FRAMEBUFFER,null)}function et(R,v,O){const G=i.get(R);v!==void 0&&Ce(G.__webglFramebuffer,R,R.texture,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,0),O!==void 0&&st(R)}function je(R){const v=R.texture,O=i.get(R),G=i.get(v);R.addEventListener("dispose",_);const Q=R.textures,ae=R.isWebGLCubeRenderTarget===!0,ue=Q.length>1;if(ue||(G.__webglTexture===void 0&&(G.__webglTexture=t.createTexture()),G.__version=v.version,o.memory.textures++),ae){O.__webglFramebuffer=[];for(let j=0;j<6;j++)if(v.mipmaps&&v.mipmaps.length>0){O.__webglFramebuffer[j]=[];for(let J=0;J<v.mipmaps.length;J++)O.__webglFramebuffer[j][J]=t.createFramebuffer()}else O.__webglFramebuffer[j]=t.createFramebuffer()}else{if(v.mipmaps&&v.mipmaps.length>0){O.__webglFramebuffer=[];for(let j=0;j<v.mipmaps.length;j++)O.__webglFramebuffer[j]=t.createFramebuffer()}else O.__webglFramebuffer=t.createFramebuffer();if(ue)for(let j=0,J=Q.length;j<J;j++){const le=i.get(Q[j]);le.__webglTexture===void 0&&(le.__webglTexture=t.createTexture(),o.memory.textures++)}if(R.samples>0&&Oe(R)===!1){O.__webglMultisampledFramebuffer=t.createFramebuffer(),O.__webglColorRenderbuffer=[],n.bindFramebuffer(t.FRAMEBUFFER,O.__webglMultisampledFramebuffer);for(let j=0;j<Q.length;j++){const J=Q[j];O.__webglColorRenderbuffer[j]=t.createRenderbuffer(),t.bindRenderbuffer(t.RENDERBUFFER,O.__webglColorRenderbuffer[j]);const le=s.convert(J.format,J.colorSpace),Ee=s.convert(J.type),me=S(J.internalFormat,le,Ee,J.normalized,J.colorSpace,R.isXRRenderTarget===!0),de=Fe(R);t.renderbufferStorageMultisample(t.RENDERBUFFER,de,me,R.width,R.height),t.framebufferRenderbuffer(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0+j,t.RENDERBUFFER,O.__webglColorRenderbuffer[j])}t.bindRenderbuffer(t.RENDERBUFFER,null),R.depthBuffer&&(O.__webglDepthRenderbuffer=t.createRenderbuffer(),lt(O.__webglDepthRenderbuffer,R,!0)),n.bindFramebuffer(t.FRAMEBUFFER,null)}}if(ae){n.bindTexture(t.TEXTURE_CUBE_MAP,G.__webglTexture),He(t.TEXTURE_CUBE_MAP,v);for(let j=0;j<6;j++)if(v.mipmaps&&v.mipmaps.length>0)for(let J=0;J<v.mipmaps.length;J++)Ce(O.__webglFramebuffer[j][J],R,v,t.COLOR_ATTACHMENT0,t.TEXTURE_CUBE_MAP_POSITIVE_X+j,J);else Ce(O.__webglFramebuffer[j],R,v,t.COLOR_ATTACHMENT0,t.TEXTURE_CUBE_MAP_POSITIVE_X+j,0);f(v)&&x(t.TEXTURE_CUBE_MAP),n.unbindTexture()}else if(ue){for(let j=0,J=Q.length;j<J;j++){const le=Q[j],Ee=i.get(le);let me=t.TEXTURE_2D;(R.isWebGL3DRenderTarget||R.isWebGLArrayRenderTarget)&&(me=R.isWebGL3DRenderTarget?t.TEXTURE_3D:t.TEXTURE_2D_ARRAY),n.bindTexture(me,Ee.__webglTexture),He(me,le),Ce(O.__webglFramebuffer,R,le,t.COLOR_ATTACHMENT0+j,me,0),f(le)&&x(me)}n.unbindTexture()}else{let j=t.TEXTURE_2D;if((R.isWebGL3DRenderTarget||R.isWebGLArrayRenderTarget)&&(j=R.isWebGL3DRenderTarget?t.TEXTURE_3D:t.TEXTURE_2D_ARRAY),n.bindTexture(j,G.__webglTexture),He(j,v),v.mipmaps&&v.mipmaps.length>0)for(let J=0;J<v.mipmaps.length;J++)Ce(O.__webglFramebuffer[J],R,v,t.COLOR_ATTACHMENT0,j,J);else Ce(O.__webglFramebuffer,R,v,t.COLOR_ATTACHMENT0,j,0);f(v)&&x(j),n.unbindTexture()}R.depthBuffer&&st(R)}function it(R){const v=R.textures;for(let O=0,G=v.length;O<G;O++){const Q=v[O];if(f(Q)){const ae=y(R),ue=i.get(Q).__webglTexture;n.bindTexture(ae,ue),x(ae),n.unbindTexture()}}}const wt=[],ce=[];function Me(R){if(R.samples>0){if(Oe(R)===!1){const v=R.textures,O=R.width,G=R.height;let Q=t.COLOR_BUFFER_BIT;const ae=R.stencilBuffer?t.DEPTH_STENCIL_ATTACHMENT:t.DEPTH_ATTACHMENT,ue=i.get(R),j=v.length>1;if(j)for(let le=0;le<v.length;le++)n.bindFramebuffer(t.FRAMEBUFFER,ue.__webglMultisampledFramebuffer),t.framebufferRenderbuffer(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0+le,t.RENDERBUFFER,null),n.bindFramebuffer(t.FRAMEBUFFER,ue.__webglFramebuffer),t.framebufferTexture2D(t.DRAW_FRAMEBUFFER,t.COLOR_ATTACHMENT0+le,t.TEXTURE_2D,null,0);n.bindFramebuffer(t.READ_FRAMEBUFFER,ue.__webglMultisampledFramebuffer);const J=R.texture.mipmaps;J&&J.length>0?n.bindFramebuffer(t.DRAW_FRAMEBUFFER,ue.__webglFramebuffer[0]):n.bindFramebuffer(t.DRAW_FRAMEBUFFER,ue.__webglFramebuffer);for(let le=0;le<v.length;le++){if(R.resolveDepthBuffer&&(R.depthBuffer&&(Q|=t.DEPTH_BUFFER_BIT),R.stencilBuffer&&R.resolveStencilBuffer&&(Q|=t.STENCIL_BUFFER_BIT)),j){t.framebufferRenderbuffer(t.READ_FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.RENDERBUFFER,ue.__webglColorRenderbuffer[le]);const Ee=i.get(v[le]).__webglTexture;t.framebufferTexture2D(t.DRAW_FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,Ee,0)}t.blitFramebuffer(0,0,O,G,0,0,O,G,Q,t.NEAREST),l===!0&&(wt.length=0,ce.length=0,wt.push(t.COLOR_ATTACHMENT0+le),R.depthBuffer&&R.resolveDepthBuffer===!1&&(wt.push(ae),ce.push(ae),t.invalidateFramebuffer(t.DRAW_FRAMEBUFFER,ce)),t.invalidateFramebuffer(t.READ_FRAMEBUFFER,wt))}if(n.bindFramebuffer(t.READ_FRAMEBUFFER,null),n.bindFramebuffer(t.DRAW_FRAMEBUFFER,null),j)for(let le=0;le<v.length;le++){n.bindFramebuffer(t.FRAMEBUFFER,ue.__webglMultisampledFramebuffer),t.framebufferRenderbuffer(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0+le,t.RENDERBUFFER,ue.__webglColorRenderbuffer[le]);const Ee=i.get(v[le]).__webglTexture;n.bindFramebuffer(t.FRAMEBUFFER,ue.__webglFramebuffer),t.framebufferTexture2D(t.DRAW_FRAMEBUFFER,t.COLOR_ATTACHMENT0+le,t.TEXTURE_2D,Ee,0)}n.bindFramebuffer(t.DRAW_FRAMEBUFFER,ue.__webglMultisampledFramebuffer)}else if(R.depthBuffer&&R.resolveDepthBuffer===!1&&l){const v=R.stencilBuffer?t.DEPTH_STENCIL_ATTACHMENT:t.DEPTH_ATTACHMENT;t.invalidateFramebuffer(t.DRAW_FRAMEBUFFER,[v])}}}function Fe(R){return Math.min(r.maxSamples,R.samples)}function Oe(R){const v=i.get(R);return R.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&v.__useRenderToTexture!==!1}function I(R){const v=o.render.frame;d.get(R)!==v&&(d.set(R,v),R.update())}function Ze(R,v){const O=R.colorSpace,G=R.format,Q=R.type;return R.isCompressedTexture===!0||R.isVideoTexture===!0||O!==aa&&O!==Fi&&($e.getTransfer(O)===ot?(G!==bn||Q!==sn)&&Ne("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):tt("WebGLTextures: Unsupported texture color space:",O)),v}function De(R){return typeof HTMLImageElement<"u"&&R instanceof HTMLImageElement?(c.width=R.naturalWidth||R.width,c.height=R.naturalHeight||R.height):typeof VideoFrame<"u"&&R instanceof VideoFrame?(c.width=R.displayWidth,c.height=R.displayHeight):(c.width=R.width,c.height=R.height),c}this.allocateTextureUnit=X,this.resetTextureUnits=W,this.getTextureUnits=Z,this.setTextureUnits=B,this.setTexture2D=L,this.setTexture2DArray=k,this.setTexture3D=Y,this.setTextureCube=$,this.rebindTextures=et,this.setupRenderTarget=je,this.updateRenderTargetMipmap=it,this.updateMultisampleRenderTarget=Me,this.setupDepthRenderbuffer=st,this.setupFrameBufferTexture=Ce,this.useMultisampledRTT=Oe,this.isReversedDepthBuffer=function(){return n.buffers.depth.getReversed()}}function B1(t,e){function n(i,r=Fi){let s;const o=$e.getTransfer(r);if(i===sn)return t.UNSIGNED_BYTE;if(i===Uc)return t.UNSIGNED_SHORT_4_4_4_4;if(i===Fc)return t.UNSIGNED_SHORT_5_5_5_1;if(i===Yh)return t.UNSIGNED_INT_5_9_9_9_REV;if(i===Kh)return t.UNSIGNED_INT_10F_11F_11F_REV;if(i===Wh)return t.BYTE;if(i===Xh)return t.SHORT;if(i===Xs)return t.UNSIGNED_SHORT;if(i===Nc)return t.INT;if(i===ti)return t.UNSIGNED_INT;if(i===ni)return t.FLOAT;if(i===vi)return t.HALF_FLOAT;if(i===Zh)return t.ALPHA;if(i===qh)return t.RGB;if(i===bn)return t.RGBA;if(i===xi)return t.DEPTH_COMPONENT;if(i===Sr)return t.DEPTH_STENCIL;if(i===Oc)return t.RED;if(i===Bc)return t.RED_INTEGER;if(i===yr)return t.RG;if(i===kc)return t.RG_INTEGER;if(i===zc)return t.RGBA_INTEGER;if(i===ta||i===na||i===ia||i===ra)if(o===ot)if(s=e.get("WEBGL_compressed_texture_s3tc_srgb"),s!==null){if(i===ta)return s.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===na)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===ia)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===ra)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(s=e.get("WEBGL_compressed_texture_s3tc"),s!==null){if(i===ta)return s.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===na)return s.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===ia)return s.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===ra)return s.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===Vc||i===Hc||i===Gc||i===Wc)if(s=e.get("WEBGL_compressed_texture_pvrtc"),s!==null){if(i===Vc)return s.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===Hc)return s.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===Gc)return s.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===Wc)return s.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===Xc||i===Yc||i===Kc||i===Zc||i===qc||i===sa||i===Qc)if(s=e.get("WEBGL_compressed_texture_etc"),s!==null){if(i===Xc||i===Yc)return o===ot?s.COMPRESSED_SRGB8_ETC2:s.COMPRESSED_RGB8_ETC2;if(i===Kc)return o===ot?s.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:s.COMPRESSED_RGBA8_ETC2_EAC;if(i===Zc)return s.COMPRESSED_R11_EAC;if(i===qc)return s.COMPRESSED_SIGNED_R11_EAC;if(i===sa)return s.COMPRESSED_RG11_EAC;if(i===Qc)return s.COMPRESSED_SIGNED_RG11_EAC}else return null;if(i===Jc||i===jc||i===$c||i===eu||i===tu||i===nu||i===iu||i===ru||i===su||i===ou||i===au||i===lu||i===cu||i===uu)if(s=e.get("WEBGL_compressed_texture_astc"),s!==null){if(i===Jc)return o===ot?s.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:s.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===jc)return o===ot?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:s.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===$c)return o===ot?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:s.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===eu)return o===ot?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:s.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===tu)return o===ot?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:s.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===nu)return o===ot?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:s.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===iu)return o===ot?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:s.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===ru)return o===ot?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:s.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===su)return o===ot?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:s.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===ou)return o===ot?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:s.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===au)return o===ot?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:s.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===lu)return o===ot?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:s.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===cu)return o===ot?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:s.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===uu)return o===ot?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:s.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===fu||i===du||i===hu)if(s=e.get("EXT_texture_compression_bptc"),s!==null){if(i===fu)return o===ot?s.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:s.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===du)return s.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===hu)return s.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===pu||i===mu||i===oa||i===gu)if(s=e.get("EXT_texture_compression_rgtc"),s!==null){if(i===pu)return s.COMPRESSED_RED_RGTC1_EXT;if(i===mu)return s.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===oa)return s.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===gu)return s.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===Ys?t.UNSIGNED_INT_24_8:t[i]!==void 0?t[i]:null}return{convert:n}}const k1=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,z1=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class V1{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,n){if(this.texture===null){const i=new Cp(e.texture);(e.depthNear!==n.depthNear||e.depthFar!==n.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=i}}getMesh(e){if(this.texture!==null&&this.mesh===null){const n=e.cameras[0].viewport,i=new si({vertexShader:k1,fragmentShader:z1,uniforms:{depthColor:{value:this.texture},depthWidth:{value:n.z},depthHeight:{value:n.w}}});this.mesh=new Ln(new ro(20,20),i)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class H1 extends Oi{constructor(e,n){super();const i=this;let r=null,s=1,o=null,a="local-floor",l=1,c=null,d=null,h=null,u=null,p=null,g=null;const M=typeof XRWebGLBinding<"u",m=new V1,f={},x=n.getContextAttributes();let y=null,S=null;const w=[],T=[],b=new ze;let _=null;const A=new Dn;A.viewport=new St;const C=new Dn;C.viewport=new St;const P=[A,C],D=new Cx;let W=null,Z=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(q){let se=w[q];return se===void 0&&(se=new Cu,w[q]=se),se.getTargetRaySpace()},this.getControllerGrip=function(q){let se=w[q];return se===void 0&&(se=new Cu,w[q]=se),se.getGripSpace()},this.getHand=function(q){let se=w[q];return se===void 0&&(se=new Cu,w[q]=se),se.getHandSpace()};function B(q){const se=T.indexOf(q.inputSource);if(se===-1)return;const ie=w[se];ie!==void 0&&(ie.update(q.inputSource,q.frame,c||o),ie.dispatchEvent({type:q.type,data:q.inputSource}))}function X(){r.removeEventListener("select",B),r.removeEventListener("selectstart",B),r.removeEventListener("selectend",B),r.removeEventListener("squeeze",B),r.removeEventListener("squeezestart",B),r.removeEventListener("squeezeend",B),r.removeEventListener("end",X),r.removeEventListener("inputsourceschange",H);for(let q=0;q<w.length;q++){const se=T[q];se!==null&&(T[q]=null,w[q].disconnect(se))}W=null,Z=null,m.reset();for(const q in f)delete f[q];e.setRenderTarget(y),p=null,u=null,h=null,r=null,S=null,He.stop(),i.isPresenting=!1,e.setPixelRatio(_),e.setSize(b.width,b.height,!1),i.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(q){s=q,i.isPresenting===!0&&Ne("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(q){a=q,i.isPresenting===!0&&Ne("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||o},this.setReferenceSpace=function(q){c=q},this.getBaseLayer=function(){return u!==null?u:p},this.getBinding=function(){return h===null&&M&&(h=new XRWebGLBinding(r,n)),h},this.getFrame=function(){return g},this.getSession=function(){return r},this.setSession=async function(q){if(r=q,r!==null){if(y=e.getRenderTarget(),r.addEventListener("select",B),r.addEventListener("selectstart",B),r.addEventListener("selectend",B),r.addEventListener("squeeze",B),r.addEventListener("squeezestart",B),r.addEventListener("squeezeend",B),r.addEventListener("end",X),r.addEventListener("inputsourceschange",H),x.xrCompatible!==!0&&await n.makeXRCompatible(),_=e.getPixelRatio(),e.getSize(b),M&&"createProjectionLayer"in XRWebGLBinding.prototype){let ie=null,be=null,ke=null;x.depth&&(ke=x.stencil?n.DEPTH24_STENCIL8:n.DEPTH_COMPONENT24,ie=x.stencil?Sr:xi,be=x.stencil?Ys:ti);const Ce={colorFormat:n.RGBA8,depthFormat:ke,scaleFactor:s};h=this.getBinding(),u=h.createProjectionLayer(Ce),r.updateRenderState({layers:[u]}),e.setPixelRatio(1),e.setSize(u.textureWidth,u.textureHeight,!1),S=new ri(u.textureWidth,u.textureHeight,{format:bn,type:sn,depthTexture:new as(u.textureWidth,u.textureHeight,be,void 0,void 0,void 0,void 0,void 0,void 0,ie),stencilBuffer:x.stencil,colorSpace:e.outputColorSpace,samples:x.antialias?4:0,resolveDepthBuffer:u.ignoreDepthValues===!1,resolveStencilBuffer:u.ignoreDepthValues===!1})}else{const ie={antialias:x.antialias,alpha:!0,depth:x.depth,stencil:x.stencil,framebufferScaleFactor:s};p=new XRWebGLLayer(r,n,ie),r.updateRenderState({baseLayer:p}),e.setPixelRatio(1),e.setSize(p.framebufferWidth,p.framebufferHeight,!1),S=new ri(p.framebufferWidth,p.framebufferHeight,{format:bn,type:sn,colorSpace:e.outputColorSpace,stencilBuffer:x.stencil,resolveDepthBuffer:p.ignoreDepthValues===!1,resolveStencilBuffer:p.ignoreDepthValues===!1})}S.isXRRenderTarget=!0,this.setFoveation(l),c=null,o=await r.requestReferenceSpace(a),He.setContext(r),He.start(),i.isPresenting=!0,i.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(r!==null)return r.environmentBlendMode},this.getDepthTexture=function(){return m.getDepthTexture()};function H(q){for(let se=0;se<q.removed.length;se++){const ie=q.removed[se],be=T.indexOf(ie);be>=0&&(T[be]=null,w[be].disconnect(ie))}for(let se=0;se<q.added.length;se++){const ie=q.added[se];let be=T.indexOf(ie);if(be===-1){for(let Ce=0;Ce<w.length;Ce++)if(Ce>=T.length){T.push(ie),be=Ce;break}else if(T[Ce]===null){T[Ce]=ie,be=Ce;break}if(be===-1)break}const ke=w[be];ke&&ke.connect(ie)}}const L=new U,k=new U;function Y(q,se,ie){L.setFromMatrixPosition(se.matrixWorld),k.setFromMatrixPosition(ie.matrixWorld);const be=L.distanceTo(k),ke=se.projectionMatrix.elements,Ce=ie.projectionMatrix.elements,lt=ke[14]/(ke[10]-1),Ye=ke[14]/(ke[10]+1),st=(ke[9]+1)/ke[5],et=(ke[9]-1)/ke[5],je=(ke[8]-1)/ke[0],it=(Ce[8]+1)/Ce[0],wt=lt*je,ce=lt*it,Me=be/(-je+it),Fe=Me*-je;if(se.matrixWorld.decompose(q.position,q.quaternion,q.scale),q.translateX(Fe),q.translateZ(Me),q.matrixWorld.compose(q.position,q.quaternion,q.scale),q.matrixWorldInverse.copy(q.matrixWorld).invert(),ke[10]===-1)q.projectionMatrix.copy(se.projectionMatrix),q.projectionMatrixInverse.copy(se.projectionMatrixInverse);else{const Oe=lt+Me,I=Ye+Me,Ze=wt-Fe,De=ce+(be-Fe),R=st*Ye/I*Oe,v=et*Ye/I*Oe;q.projectionMatrix.makePerspective(Ze,De,R,v,Oe,I),q.projectionMatrixInverse.copy(q.projectionMatrix).invert()}}function $(q,se){se===null?q.matrixWorld.copy(q.matrix):q.matrixWorld.multiplyMatrices(se.matrixWorld,q.matrix),q.matrixWorldInverse.copy(q.matrixWorld).invert()}this.updateCamera=function(q){if(r===null)return;let se=q.near,ie=q.far;m.texture!==null&&(m.depthNear>0&&(se=m.depthNear),m.depthFar>0&&(ie=m.depthFar)),D.near=C.near=A.near=se,D.far=C.far=A.far=ie,(W!==D.near||Z!==D.far)&&(r.updateRenderState({depthNear:D.near,depthFar:D.far}),W=D.near,Z=D.far),D.layers.mask=q.layers.mask|6,A.layers.mask=D.layers.mask&-5,C.layers.mask=D.layers.mask&-3;const be=q.parent,ke=D.cameras;$(D,be);for(let Ce=0;Ce<ke.length;Ce++)$(ke[Ce],be);ke.length===2?Y(D,A,C):D.projectionMatrix.copy(A.projectionMatrix),oe(q,D,be)};function oe(q,se,ie){ie===null?q.matrix.copy(se.matrixWorld):(q.matrix.copy(ie.matrixWorld),q.matrix.invert(),q.matrix.multiply(se.matrixWorld)),q.matrix.decompose(q.position,q.quaternion,q.scale),q.updateMatrixWorld(!0),q.projectionMatrix.copy(se.projectionMatrix),q.projectionMatrixInverse.copy(se.projectionMatrixInverse),q.isPerspectiveCamera&&(q.fov=yu*2*Math.atan(1/q.projectionMatrix.elements[5]),q.zoom=1)}this.getCamera=function(){return D},this.getFoveation=function(){if(!(u===null&&p===null))return l},this.setFoveation=function(q){l=q,u!==null&&(u.fixedFoveation=q),p!==null&&p.fixedFoveation!==void 0&&(p.fixedFoveation=q)},this.hasDepthSensing=function(){return m.texture!==null},this.getDepthSensingMesh=function(){return m.getMesh(D)},this.getCameraTexture=function(q){return f[q]};let Be=null;function Qe(q,se){if(d=se.getViewerPose(c||o),g=se,d!==null){const ie=d.views;p!==null&&(e.setRenderTargetFramebuffer(S,p.framebuffer),e.setRenderTarget(S));let be=!1;ie.length!==D.cameras.length&&(D.cameras.length=0,be=!0);for(let Ye=0;Ye<ie.length;Ye++){const st=ie[Ye];let et=null;if(p!==null)et=p.getViewport(st);else{const it=h.getViewSubImage(u,st);et=it.viewport,Ye===0&&(e.setRenderTargetTextures(S,it.colorTexture,it.depthStencilTexture),e.setRenderTarget(S))}let je=P[Ye];je===void 0&&(je=new Dn,je.layers.enable(Ye),je.viewport=new St,P[Ye]=je),je.matrix.fromArray(st.transform.matrix),je.matrix.decompose(je.position,je.quaternion,je.scale),je.projectionMatrix.fromArray(st.projectionMatrix),je.projectionMatrixInverse.copy(je.projectionMatrix).invert(),je.viewport.set(et.x,et.y,et.width,et.height),Ye===0&&(D.matrix.copy(je.matrix),D.matrix.decompose(D.position,D.quaternion,D.scale)),be===!0&&D.cameras.push(je)}const ke=r.enabledFeatures;if(ke&&ke.includes("depth-sensing")&&r.depthUsage=="gpu-optimized"&&M){h=i.getBinding();const Ye=h.getDepthInformation(ie[0]);Ye&&Ye.isValid&&Ye.texture&&m.init(Ye,r.renderState)}if(ke&&ke.includes("camera-access")&&M){e.state.unbindTexture(),h=i.getBinding();for(let Ye=0;Ye<ie.length;Ye++){const st=ie[Ye].camera;if(st){let et=f[st];et||(et=new Cp,f[st]=et);const je=h.getCameraImage(st);et.sourceTexture=je}}}}for(let ie=0;ie<w.length;ie++){const be=T[ie],ke=w[ie];be!==null&&ke!==void 0&&ke.update(be,se,c||o)}Be&&Be(q,se),se.detectedPlanes&&i.dispatchEvent({type:"planesdetected",data:se}),g=null}const He=new Gp;He.setAnimationLoop(Qe),this.setAnimationLoop=function(q){Be=q},this.dispose=function(){}}}const G1=new vt,xm=new Ve;xm.set(-1,0,0,0,1,0,0,0,1);function W1(t,e){function n(m,f){m.matrixAutoUpdate===!0&&m.updateMatrix(),f.value.copy(m.matrix)}function i(m,f){f.color.getRGB(m.fogColor.value,Dp(t)),f.isFog?(m.fogNear.value=f.near,m.fogFar.value=f.far):f.isFogExp2&&(m.fogDensity.value=f.density)}function r(m,f,x,y,S){f.isNodeMaterial?f.uniformsNeedUpdate=!1:f.isMeshBasicMaterial?s(m,f):f.isMeshLambertMaterial?(s(m,f),f.envMap&&(m.envMapIntensity.value=f.envMapIntensity)):f.isMeshToonMaterial?(s(m,f),h(m,f)):f.isMeshPhongMaterial?(s(m,f),d(m,f),f.envMap&&(m.envMapIntensity.value=f.envMapIntensity)):f.isMeshStandardMaterial?(s(m,f),u(m,f),f.isMeshPhysicalMaterial&&p(m,f,S)):f.isMeshMatcapMaterial?(s(m,f),g(m,f)):f.isMeshDepthMaterial?s(m,f):f.isMeshDistanceMaterial?(s(m,f),M(m,f)):f.isMeshNormalMaterial?s(m,f):f.isLineBasicMaterial?(o(m,f),f.isLineDashedMaterial&&a(m,f)):f.isPointsMaterial?l(m,f,x,y):f.isSpriteMaterial?c(m,f):f.isShadowMaterial?(m.color.value.copy(f.color),m.opacity.value=f.opacity):f.isShaderMaterial&&(f.uniformsNeedUpdate=!1)}function s(m,f){m.opacity.value=f.opacity,f.color&&m.diffuse.value.copy(f.color),f.emissive&&m.emissive.value.copy(f.emissive).multiplyScalar(f.emissiveIntensity),f.map&&(m.map.value=f.map,n(f.map,m.mapTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,n(f.alphaMap,m.alphaMapTransform)),f.bumpMap&&(m.bumpMap.value=f.bumpMap,n(f.bumpMap,m.bumpMapTransform),m.bumpScale.value=f.bumpScale,f.side===rn&&(m.bumpScale.value*=-1)),f.normalMap&&(m.normalMap.value=f.normalMap,n(f.normalMap,m.normalMapTransform),m.normalScale.value.copy(f.normalScale),f.side===rn&&m.normalScale.value.negate()),f.displacementMap&&(m.displacementMap.value=f.displacementMap,n(f.displacementMap,m.displacementMapTransform),m.displacementScale.value=f.displacementScale,m.displacementBias.value=f.displacementBias),f.emissiveMap&&(m.emissiveMap.value=f.emissiveMap,n(f.emissiveMap,m.emissiveMapTransform)),f.specularMap&&(m.specularMap.value=f.specularMap,n(f.specularMap,m.specularMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest);const x=e.get(f),y=x.envMap,S=x.envMapRotation;y&&(m.envMap.value=y,m.envMapRotation.value.setFromMatrix4(G1.makeRotationFromEuler(S)).transpose(),y.isCubeTexture&&y.isRenderTargetTexture===!1&&m.envMapRotation.value.premultiply(xm),m.reflectivity.value=f.reflectivity,m.ior.value=f.ior,m.refractionRatio.value=f.refractionRatio),f.lightMap&&(m.lightMap.value=f.lightMap,m.lightMapIntensity.value=f.lightMapIntensity,n(f.lightMap,m.lightMapTransform)),f.aoMap&&(m.aoMap.value=f.aoMap,m.aoMapIntensity.value=f.aoMapIntensity,n(f.aoMap,m.aoMapTransform))}function o(m,f){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,f.map&&(m.map.value=f.map,n(f.map,m.mapTransform))}function a(m,f){m.dashSize.value=f.dashSize,m.totalSize.value=f.dashSize+f.gapSize,m.scale.value=f.scale}function l(m,f,x,y){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,m.size.value=f.size*x,m.scale.value=y*.5,f.map&&(m.map.value=f.map,n(f.map,m.uvTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,n(f.alphaMap,m.alphaMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest)}function c(m,f){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,m.rotation.value=f.rotation,f.map&&(m.map.value=f.map,n(f.map,m.mapTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,n(f.alphaMap,m.alphaMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest)}function d(m,f){m.specular.value.copy(f.specular),m.shininess.value=Math.max(f.shininess,1e-4)}function h(m,f){f.gradientMap&&(m.gradientMap.value=f.gradientMap)}function u(m,f){m.metalness.value=f.metalness,f.metalnessMap&&(m.metalnessMap.value=f.metalnessMap,n(f.metalnessMap,m.metalnessMapTransform)),m.roughness.value=f.roughness,f.roughnessMap&&(m.roughnessMap.value=f.roughnessMap,n(f.roughnessMap,m.roughnessMapTransform)),f.envMap&&(m.envMapIntensity.value=f.envMapIntensity)}function p(m,f,x){m.ior.value=f.ior,f.sheen>0&&(m.sheenColor.value.copy(f.sheenColor).multiplyScalar(f.sheen),m.sheenRoughness.value=f.sheenRoughness,f.sheenColorMap&&(m.sheenColorMap.value=f.sheenColorMap,n(f.sheenColorMap,m.sheenColorMapTransform)),f.sheenRoughnessMap&&(m.sheenRoughnessMap.value=f.sheenRoughnessMap,n(f.sheenRoughnessMap,m.sheenRoughnessMapTransform))),f.clearcoat>0&&(m.clearcoat.value=f.clearcoat,m.clearcoatRoughness.value=f.clearcoatRoughness,f.clearcoatMap&&(m.clearcoatMap.value=f.clearcoatMap,n(f.clearcoatMap,m.clearcoatMapTransform)),f.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=f.clearcoatRoughnessMap,n(f.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),f.clearcoatNormalMap&&(m.clearcoatNormalMap.value=f.clearcoatNormalMap,n(f.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(f.clearcoatNormalScale),f.side===rn&&m.clearcoatNormalScale.value.negate())),f.dispersion>0&&(m.dispersion.value=f.dispersion),f.iridescence>0&&(m.iridescence.value=f.iridescence,m.iridescenceIOR.value=f.iridescenceIOR,m.iridescenceThicknessMinimum.value=f.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=f.iridescenceThicknessRange[1],f.iridescenceMap&&(m.iridescenceMap.value=f.iridescenceMap,n(f.iridescenceMap,m.iridescenceMapTransform)),f.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=f.iridescenceThicknessMap,n(f.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),f.transmission>0&&(m.transmission.value=f.transmission,m.transmissionSamplerMap.value=x.texture,m.transmissionSamplerSize.value.set(x.width,x.height),f.transmissionMap&&(m.transmissionMap.value=f.transmissionMap,n(f.transmissionMap,m.transmissionMapTransform)),m.thickness.value=f.thickness,f.thicknessMap&&(m.thicknessMap.value=f.thicknessMap,n(f.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=f.attenuationDistance,m.attenuationColor.value.copy(f.attenuationColor)),f.anisotropy>0&&(m.anisotropyVector.value.set(f.anisotropy*Math.cos(f.anisotropyRotation),f.anisotropy*Math.sin(f.anisotropyRotation)),f.anisotropyMap&&(m.anisotropyMap.value=f.anisotropyMap,n(f.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=f.specularIntensity,m.specularColor.value.copy(f.specularColor),f.specularColorMap&&(m.specularColorMap.value=f.specularColorMap,n(f.specularColorMap,m.specularColorMapTransform)),f.specularIntensityMap&&(m.specularIntensityMap.value=f.specularIntensityMap,n(f.specularIntensityMap,m.specularIntensityMapTransform))}function g(m,f){f.matcap&&(m.matcap.value=f.matcap)}function M(m,f){const x=e.get(f).light;m.referencePosition.value.setFromMatrixPosition(x.matrixWorld),m.nearDistance.value=x.shadow.camera.near,m.farDistance.value=x.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:r}}function X1(t,e,n,i){let r={},s={},o=[];const a=t.getParameter(t.MAX_UNIFORM_BUFFER_BINDINGS);function l(S,w){const T=w.program;i.uniformBlockBinding(S,T)}function c(S,w){let T=r[S.id];T===void 0&&(m(S),T=d(S),r[S.id]=T,S.addEventListener("dispose",x));const b=w.program;i.updateUBOMapping(S,b);const _=e.render.frame;s[S.id]!==_&&(u(S),s[S.id]=_)}function d(S){const w=h();S.__bindingPointIndex=w;const T=t.createBuffer(),b=S.__size,_=S.usage;return t.bindBuffer(t.UNIFORM_BUFFER,T),t.bufferData(t.UNIFORM_BUFFER,b,_),t.bindBuffer(t.UNIFORM_BUFFER,null),t.bindBufferBase(t.UNIFORM_BUFFER,w,T),T}function h(){for(let S=0;S<a;S++)if(o.indexOf(S)===-1)return o.push(S),S;return tt("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function u(S){const w=r[S.id],T=S.uniforms,b=S.__cache;t.bindBuffer(t.UNIFORM_BUFFER,w);for(let _=0,A=T.length;_<A;_++){const C=T[_];if(Array.isArray(C))for(let P=0,D=C.length;P<D;P++)p(C[P],_,P,b);else p(C,_,0,b)}t.bindBuffer(t.UNIFORM_BUFFER,null)}function p(S,w,T,b){if(M(S,w,T,b)===!0){const _=S.__offset,A=S.value;if(Array.isArray(A)){let C=0;for(let P=0;P<A.length;P++){const D=A[P],W=f(D);g(D,S.__data,C),typeof D!="number"&&typeof D!="boolean"&&!D.isMatrix3&&!ArrayBuffer.isView(D)&&(C+=W.storage/Float32Array.BYTES_PER_ELEMENT)}}else g(A,S.__data,0);t.bufferSubData(t.UNIFORM_BUFFER,_,S.__data)}}function g(S,w,T){typeof S=="number"||typeof S=="boolean"?w[0]=S:S.isMatrix3?(w[0]=S.elements[0],w[1]=S.elements[1],w[2]=S.elements[2],w[3]=0,w[4]=S.elements[3],w[5]=S.elements[4],w[6]=S.elements[5],w[7]=0,w[8]=S.elements[6],w[9]=S.elements[7],w[10]=S.elements[8],w[11]=0):ArrayBuffer.isView(S)?w.set(new S.constructor(S.buffer,S.byteOffset,w.length)):S.toArray(w,T)}function M(S,w,T,b){const _=S.value,A=w+"_"+T;if(b[A]===void 0)return typeof _=="number"||typeof _=="boolean"?b[A]=_:ArrayBuffer.isView(_)?b[A]=_.slice():b[A]=_.clone(),!0;{const C=b[A];if(typeof _=="number"||typeof _=="boolean"){if(C!==_)return b[A]=_,!0}else{if(ArrayBuffer.isView(_))return!0;if(C.equals(_)===!1)return C.copy(_),!0}}return!1}function m(S){const w=S.uniforms;let T=0;const b=16;for(let A=0,C=w.length;A<C;A++){const P=Array.isArray(w[A])?w[A]:[w[A]];for(let D=0,W=P.length;D<W;D++){const Z=P[D],B=Array.isArray(Z.value)?Z.value:[Z.value];for(let X=0,H=B.length;X<H;X++){const L=B[X],k=f(L),Y=T%b,$=Y%k.boundary,oe=Y+$;T+=$,oe!==0&&b-oe<k.storage&&(T+=b-oe),Z.__data=new Float32Array(k.storage/Float32Array.BYTES_PER_ELEMENT),Z.__offset=T,T+=k.storage}}}const _=T%b;return _>0&&(T+=b-_),S.__size=T,S.__cache={},this}function f(S){const w={boundary:0,storage:0};return typeof S=="number"||typeof S=="boolean"?(w.boundary=4,w.storage=4):S.isVector2?(w.boundary=8,w.storage=8):S.isVector3||S.isColor?(w.boundary=16,w.storage=12):S.isVector4?(w.boundary=16,w.storage=16):S.isMatrix3?(w.boundary=48,w.storage=48):S.isMatrix4?(w.boundary=64,w.storage=64):S.isTexture?Ne("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(S)?(w.boundary=16,w.storage=S.byteLength):Ne("WebGLRenderer: Unsupported uniform value type.",S),w}function x(S){const w=S.target;w.removeEventListener("dispose",x);const T=o.indexOf(w.__bindingPointIndex);o.splice(T,1),t.deleteBuffer(r[w.id]),delete r[w.id],delete s[w.id]}function y(){for(const S in r)t.deleteBuffer(r[S]);o=[],r={},s={}}return{bind:l,update:c,dispose:y}}const Y1=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]);let li=null;function K1(){return li===null&&(li=new yp(Y1,16,16,yr,vi),li.name="DFG_LUT",li.minFilter=Dt,li.magFilter=Dt,li.wrapS=fn,li.wrapT=fn,li.generateMipmaps=!1,li.needsUpdate=!0),li}class Z1{constructor(e={}){const{canvas:n=Vv(),context:i=null,depth:r=!0,stencil:s=!1,alpha:o=!1,antialias:a=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:d="default",failIfMajorPerformanceCaveat:h=!1,reversedDepthBuffer:u=!1,outputBufferType:p=sn}=e;this.isWebGLRenderer=!0;let g;if(i!==null){if(typeof WebGLRenderingContext<"u"&&i instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");g=i.getContextAttributes().alpha}else g=o;const M=p,m=new Set([zc,kc,Bc]),f=new Set([sn,ti,Xs,Ys,Uc,Fc]),x=new Uint32Array(4),y=new Int32Array(4),S=new U;let w=null,T=null;const b=[],_=[];let A=null;this.domElement=n,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=ei,this.toneMappingExposure=1,this.transmissionResolutionScale=1;const C=this;let P=!1,D=null,W=null,Z=null,B=null;this._outputColorSpace=Cn;let X=0,H=0,L=null,k=-1,Y=null;const $=new St,oe=new St;let Be=null;const Qe=new Ke(0);let He=0,q=n.width,se=n.height,ie=1,be=null,ke=null;const Ce=new St(0,0,q,se),lt=new St(0,0,q,se);let Ye=!1;const st=new Ku;let et=!1,je=!1;const it=new vt,wt=new U,ce=new St,Me={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let Fe=!1;function Oe(){return L===null?ie:1}let I=i;function Ze(E,F){return n.getContext(E,F)}try{const E={alpha:!0,depth:r,stencil:s,antialias:a,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:d,failIfMajorPerformanceCaveat:h};if("setAttribute"in n&&n.setAttribute("data-engine",`three.js r${xc}`),n.addEventListener("webglcontextlost",At,!1),n.addEventListener("webglcontextrestored",pt,!1),n.addEventListener("webglcontextcreationerror",pi,!1),I===null){const F="webgl2";if(I=Ze(F,E),I===null)throw Ze(F)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}}catch(E){throw tt("WebGLRenderer: "+E.message),E}let De,R,v,O,G,Q,ae,ue,j,J,le,Ee,me,de,Ie,Ue,Ge,N,fe,ee,he,ve,te;function Re(){De=new Ky(I),De.init(),he=new B1(I,De),R=new ky(I,De,e,he),v=new F1(I,De),R.reversedDepthBuffer&&u&&v.buffers.depth.setReversed(!0),W=I.createFramebuffer(),Z=I.createFramebuffer(),B=I.createFramebuffer(),O=new Qy(I),G=new M1,Q=new O1(I,De,v,G,R,he,O),ae=new Yy(C),ue=new Nx(I),ve=new Oy(I,ue),j=new Zy(I,ue,O,ve),J=new jy(I,j,ue,ve,O),N=new Jy(I,R,Q),Ie=new zy(G),le=new y1(C,ae,De,R,ve,Ie),Ee=new W1(C,G),me=new T1,de=new P1(De),Ge=new Fy(C,ae,v,J,g,l),Ue=new U1(C,J,R),te=new X1(I,O,R,v),fe=new By(I,De,O),ee=new qy(I,De,O),O.programs=le.programs,C.capabilities=R,C.extensions=De,C.properties=G,C.renderLists=me,C.shadowMap=Ue,C.state=v,C.info=O}Re(),M!==sn&&(A=new eM(M,n.width,n.height,a,r,s));const Te=new H1(C,I);this.xr=Te,this.getContext=function(){return I},this.getContextAttributes=function(){return I.getContextAttributes()},this.forceContextLoss=function(){const E=De.get("WEBGL_lose_context");E&&E.loseContext()},this.forceContextRestore=function(){const E=De.get("WEBGL_lose_context");E&&E.restoreContext()},this.getPixelRatio=function(){return ie},this.setPixelRatio=function(E){E!==void 0&&(ie=E,this.setSize(q,se,!1))},this.getSize=function(E){return E.set(q,se)},this.setSize=function(E,F,K=!0){if(Te.isPresenting){Ne("WebGLRenderer: Can't change size while VR device is presenting.");return}q=E,se=F,n.width=Math.floor(E*ie),n.height=Math.floor(F*ie),K===!0&&(n.style.width=E+"px",n.style.height=F+"px"),A!==null&&A.setSize(n.width,n.height),this.setViewport(0,0,E,F)},this.getDrawingBufferSize=function(E){return E.set(q*ie,se*ie).floor()},this.setDrawingBufferSize=function(E,F,K){q=E,se=F,ie=K,n.width=Math.floor(E*K),n.height=Math.floor(F*K),this.setViewport(0,0,E,F)},this.setEffects=function(E){if(M===sn){tt("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(E){for(let F=0;F<E.length;F++)if(E[F].isOutputPass===!0){Ne("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}A.setEffects(E||[])},this.getCurrentViewport=function(E){return E.copy($)},this.getViewport=function(E){return E.copy(Ce)},this.setViewport=function(E,F,K,z){E.isVector4?Ce.set(E.x,E.y,E.z,E.w):Ce.set(E,F,K,z),v.viewport($.copy(Ce).multiplyScalar(ie).round())},this.getScissor=function(E){return E.copy(lt)},this.setScissor=function(E,F,K,z){E.isVector4?lt.set(E.x,E.y,E.z,E.w):lt.set(E,F,K,z),v.scissor(oe.copy(lt).multiplyScalar(ie).round())},this.getScissorTest=function(){return Ye},this.setScissorTest=function(E){v.setScissorTest(Ye=E)},this.setOpaqueSort=function(E){be=E},this.setTransparentSort=function(E){ke=E},this.getClearColor=function(E){return E.copy(Ge.getClearColor())},this.setClearColor=function(){Ge.setClearColor(...arguments)},this.getClearAlpha=function(){return Ge.getClearAlpha()},this.setClearAlpha=function(){Ge.setClearAlpha(...arguments)},this.clear=function(E=!0,F=!0,K=!0){let z=0;if(E){let V=!1;if(L!==null){const _e=L.texture.format;V=m.has(_e)}if(V){const _e=L.texture.type,ye=f.has(_e),ge=Ge.getClearColor(),we=Ge.getClearAlpha(),Pe=ge.r,We=ge.g,qe=ge.b;ye?(x[0]=Pe,x[1]=We,x[2]=qe,x[3]=we,I.clearBufferuiv(I.COLOR,0,x)):(y[0]=Pe,y[1]=We,y[2]=qe,y[3]=we,I.clearBufferiv(I.COLOR,0,y))}else z|=I.COLOR_BUFFER_BIT}F&&(z|=I.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),K&&(z|=I.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),z!==0&&I.clear(z)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(E){E.setRenderer(this),D=E},this.dispose=function(){n.removeEventListener("webglcontextlost",At,!1),n.removeEventListener("webglcontextrestored",pt,!1),n.removeEventListener("webglcontextcreationerror",pi,!1),Ge.dispose(),me.dispose(),de.dispose(),G.dispose(),ae.dispose(),J.dispose(),ve.dispose(),te.dispose(),le.dispose(),Te.dispose(),Te.removeEventListener("sessionstart",ev),Te.removeEventListener("sessionend",tv),Hr.stop()};function At(E){E.preventDefault(),$h("WebGLRenderer: Context Lost."),P=!0}function pt(){$h("WebGLRenderer: Context Restored."),P=!1;const E=O.autoReset,F=Ue.enabled,K=Ue.autoUpdate,z=Ue.needsUpdate,V=Ue.type;Re(),O.autoReset=E,Ue.enabled=F,Ue.autoUpdate=K,Ue.needsUpdate=z,Ue.type=V}function pi(E){tt("WebGLRenderer: A WebGL context could not be created. Reason: ",E.statusMessage)}function mi(E){const F=E.target;F.removeEventListener("dispose",mi),DA(F)}function DA(E){IA(E),G.remove(E)}function IA(E){const F=G.get(E).programs;F!==void 0&&(F.forEach(function(K){le.releaseProgram(K)}),E.isShaderMaterial&&le.releaseShaderCache(E))}this.renderBufferDirect=function(E,F,K,z,V,_e){F===null&&(F=Me);const ye=V.isMesh&&V.matrixWorld.determinantAffine()<0,ge=FA(E,F,K,z,V);v.setMaterial(z,ye);let we=K.index,Pe=1;if(z.wireframe===!0){if(we=j.getWireframeAttribute(K),we===void 0)return;Pe=2}const We=K.drawRange,qe=K.attributes.position;let Le=We.start*Pe,ut=(We.start+We.count)*Pe;_e!==null&&(Le=Math.max(Le,_e.start*Pe),ut=Math.min(ut,(_e.start+_e.count)*Pe)),we!==null?(Le=Math.max(Le,0),ut=Math.min(ut,we.count)):qe!=null&&(Le=Math.max(Le,0),ut=Math.min(ut,qe.count));const Pt=ut-Le;if(Pt<0||Pt===1/0)return;ve.setup(V,z,ge,K,we);let Rt,ft=fe;if(we!==null&&(Rt=ue.get(we),ft=ee,ft.setIndex(Rt)),V.isMesh)z.wireframe===!0?(v.setLineWidth(z.wireframeLinewidth*Oe()),ft.setMode(I.LINES)):ft.setMode(I.TRIANGLES);else if(V.isLine){let nn=z.linewidth;nn===void 0&&(nn=1),v.setLineWidth(nn*Oe()),V.isLineSegments?ft.setMode(I.LINES):V.isLineLoop?ft.setMode(I.LINE_LOOP):ft.setMode(I.LINE_STRIP)}else V.isPoints?ft.setMode(I.POINTS):V.isSprite&&ft.setMode(I.TRIANGLES);if(V.isBatchedMesh)if(De.get("WEBGL_multi_draw"))ft.renderMultiDraw(V._multiDrawStarts,V._multiDrawCounts,V._multiDrawCount);else{const nn=V._multiDrawStarts,xe=V._multiDrawCounts,An=V._multiDrawCount,rt=we?ue.get(we).bytesPerElement:1,zn=G.get(z).currentProgram.getUniforms();for(let gi=0;gi<An;gi++)zn.setValue(I,"_gl_DrawID",gi),ft.render(nn[gi]/rt,xe[gi])}else if(V.isInstancedMesh)ft.renderInstances(Le,Pt,V.count);else if(K.isInstancedBufferGeometry){const nn=K._maxInstanceCount!==void 0?K._maxInstanceCount:1/0,xe=Math.min(K.instanceCount,nn);ft.renderInstances(Le,Pt,xe)}else ft.render(Le,Pt)};function $_(E,F,K){E.transparent===!0&&E.side===Rn&&E.forceSinglePass===!1?(E.side=rn,E.needsUpdate=!0,vc(E,F,K),E.side=$n,E.needsUpdate=!0,vc(E,F,K),E.side=Rn):vc(E,F,K)}this.compile=function(E,F,K=null){K===null&&(K=E),T=de.get(K),T.init(F),_.push(T),K.traverseVisible(function(V){V.isLight&&V.layers.test(F.layers)&&(T.pushLight(V),V.castShadow&&T.pushShadow(V))}),E!==K&&E.traverseVisible(function(V){V.isLight&&V.layers.test(F.layers)&&(T.pushLight(V),V.castShadow&&T.pushShadow(V))}),T.setupLights();const z=new Set;return E.traverse(function(V){if(!(V.isMesh||V.isPoints||V.isLine||V.isSprite))return;const _e=V.material;if(_e)if(Array.isArray(_e))for(let ye=0;ye<_e.length;ye++){const ge=_e[ye];$_(ge,K,V),z.add(ge)}else $_(_e,K,V),z.add(_e)}),T=_.pop(),z},this.compileAsync=function(E,F,K=null){const z=this.compile(E,F,K);return new Promise(V=>{function _e(){if(z.forEach(function(ye){G.get(ye).currentProgram.isReady()&&z.delete(ye)}),z.size===0){V(E);return}setTimeout(_e,10)}De.get("KHR_parallel_shader_compile")!==null?_e():setTimeout(_e,10)})};let Ch=null;function NA(E){Ch&&Ch(E)}function ev(){Hr.stop()}function tv(){Hr.start()}const Hr=new Gp;Hr.setAnimationLoop(NA),typeof self<"u"&&Hr.setContext(self),this.setAnimationLoop=function(E){Ch=E,Te.setAnimationLoop(E),E===null?Hr.stop():Hr.start()},Te.addEventListener("sessionstart",ev),Te.addEventListener("sessionend",tv),this.render=function(E,F){if(F!==void 0&&F.isCamera!==!0){tt("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(P===!0)return;D!==null&&D.renderStart(E,F);const K=Te.enabled===!0&&Te.isPresenting===!0,z=A!==null&&(L===null||K)&&A.begin(C,L);if(E.matrixWorldAutoUpdate===!0&&E.updateMatrixWorld(),F.parent===null&&F.matrixWorldAutoUpdate===!0&&F.updateMatrixWorld(),Te.enabled===!0&&Te.isPresenting===!0&&(A===null||A.isCompositing()===!1)&&(Te.cameraAutoUpdate===!0&&Te.updateCamera(F),F=Te.getCamera()),E.isScene===!0&&E.onBeforeRender(C,E,F,L),T=de.get(E,_.length),T.init(F),T.state.textureUnits=Q.getTextureUnits(),_.push(T),it.multiplyMatrices(F.projectionMatrix,F.matrixWorldInverse),st.setFromProjectionMatrix(it,ii,F.reversedDepth),je=this.localClippingEnabled,et=Ie.init(this.clippingPlanes,je),w=me.get(E,b.length),w.init(),b.push(w),Te.enabled===!0&&Te.isPresenting===!0){const ye=C.xr.getDepthSensingMesh();ye!==null&&Ph(ye,F,-1/0,C.sortObjects)}Ph(E,F,0,C.sortObjects),w.finish(),C.sortObjects===!0&&w.sort(be,ke,F.reversedDepth),Fe=Te.enabled===!1||Te.isPresenting===!1||Te.hasDepthSensing()===!1,Fe&&Ge.addToRenderList(w,E),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),et===!0&&Ie.beginShadows();const V=T.state.shadowsArray;if(Ue.render(V,E,F),et===!0&&Ie.endShadows(),(z&&A.hasRenderPass())===!1){const ye=w.opaque,ge=w.transmissive;if(T.setupLights(),F.isArrayCamera){const we=F.cameras;if(ge.length>0)for(let Pe=0,We=we.length;Pe<We;Pe++){const qe=we[Pe];iv(ye,ge,E,qe)}Fe&&Ge.render(E);for(let Pe=0,We=we.length;Pe<We;Pe++){const qe=we[Pe];nv(w,E,qe,qe.viewport)}}else ge.length>0&&iv(ye,ge,E,F),Fe&&Ge.render(E),nv(w,E,F)}L!==null&&H===0&&(Q.updateMultisampleRenderTarget(L),Q.updateRenderTargetMipmap(L)),z&&A.end(C),E.isScene===!0&&E.onAfterRender(C,E,F),ve.resetDefaultState(),k=-1,Y=null,_.pop(),_.length>0?(T=_[_.length-1],Q.setTextureUnits(T.state.textureUnits),et===!0&&Ie.setGlobalState(C.clippingPlanes,T.state.camera)):T=null,b.pop(),b.length>0?w=b[b.length-1]:w=null,D!==null&&D.renderEnd()};function Ph(E,F,K,z){if(E.visible===!1)return;if(E.layers.test(F.layers)){if(E.isGroup)K=E.renderOrder;else if(E.isLOD)E.autoUpdate===!0&&E.update(F);else if(E.isLightProbeGrid)T.pushLightProbeGrid(E);else if(E.isLight)T.pushLight(E),E.castShadow&&T.pushShadow(E);else if(E.isSprite){if(!E.frustumCulled||st.intersectsSprite(E)){z&&ce.setFromMatrixPosition(E.matrixWorld).applyMatrix4(it);const ye=J.update(E),ge=E.material;ge.visible&&w.push(E,ye,ge,K,ce.z,null)}}else if((E.isMesh||E.isLine||E.isPoints)&&(!E.frustumCulled||st.intersectsObject(E))){const ye=J.update(E),ge=E.material;if(z&&(E.boundingSphere!==void 0?(E.boundingSphere===null&&E.computeBoundingSphere(),ce.copy(E.boundingSphere.center)):(ye.boundingSphere===null&&ye.computeBoundingSphere(),ce.copy(ye.boundingSphere.center)),ce.applyMatrix4(E.matrixWorld).applyMatrix4(it)),Array.isArray(ge)){const we=ye.groups;for(let Pe=0,We=we.length;Pe<We;Pe++){const qe=we[Pe],Le=ge[qe.materialIndex];Le&&Le.visible&&w.push(E,ye,Le,K,ce.z,qe)}}else ge.visible&&w.push(E,ye,ge,K,ce.z,null)}}const _e=E.children;for(let ye=0,ge=_e.length;ye<ge;ye++)Ph(_e[ye],F,K,z)}function nv(E,F,K,z){const{opaque:V,transmissive:_e,transparent:ye}=E;T.setupLightsView(K),et===!0&&Ie.setGlobalState(C.clippingPlanes,K),z&&v.viewport($.copy(z)),V.length>0&&_c(V,F,K),_e.length>0&&_c(_e,F,K),ye.length>0&&_c(ye,F,K),v.buffers.depth.setTest(!0),v.buffers.depth.setMask(!0),v.buffers.color.setMask(!0),v.setPolygonOffset(!1)}function iv(E,F,K,z){if((K.isScene===!0?K.overrideMaterial:null)!==null)return;if(T.state.transmissionRenderTarget[z.id]===void 0){const Le=De.has("EXT_color_buffer_half_float")||De.has("EXT_color_buffer_float");T.state.transmissionRenderTarget[z.id]=new ri(1,1,{generateMipmaps:!0,type:Le?vi:sn,minFilter:xr,samples:Math.max(4,R.samples),stencilBuffer:s,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:$e.workingColorSpace})}const _e=T.state.transmissionRenderTarget[z.id],ye=z.viewport||$;_e.setSize(ye.z*C.transmissionResolutionScale,ye.w*C.transmissionResolutionScale);const ge=C.getRenderTarget(),we=C.getActiveCubeFace(),Pe=C.getActiveMipmapLevel();C.setRenderTarget(_e),C.getClearColor(Qe),He=C.getClearAlpha(),He<1&&C.setClearColor(16777215,.5),C.clear(),Fe&&Ge.render(K);const We=C.toneMapping;C.toneMapping=ei;const qe=z.viewport;if(z.viewport!==void 0&&(z.viewport=void 0),T.setupLightsView(z),et===!0&&Ie.setGlobalState(C.clippingPlanes,z),_c(E,K,z),Q.updateMultisampleRenderTarget(_e),Q.updateRenderTargetMipmap(_e),De.has("WEBGL_multisampled_render_to_texture")===!1){let Le=!1;for(let ut=0,Pt=F.length;ut<Pt;ut++){const Rt=F[ut],{object:ft,geometry:nn,material:xe,group:An}=Rt;if(xe.side===Rn&&ft.layers.test(z.layers)){const rt=xe.side;xe.side=rn,xe.needsUpdate=!0,rv(ft,K,z,nn,xe,An),xe.side=rt,xe.needsUpdate=!0,Le=!0}}Le===!0&&(Q.updateMultisampleRenderTarget(_e),Q.updateRenderTargetMipmap(_e))}C.setRenderTarget(ge,we,Pe),C.setClearColor(Qe,He),qe!==void 0&&(z.viewport=qe),C.toneMapping=We}function _c(E,F,K){const z=F.isScene===!0?F.overrideMaterial:null;for(let V=0,_e=E.length;V<_e;V++){const ye=E[V],{object:ge,geometry:we,group:Pe}=ye;let We=ye.material;We.allowOverride===!0&&z!==null&&(We=z),ge.layers.test(K.layers)&&rv(ge,F,K,we,We,Pe)}}function rv(E,F,K,z,V,_e){E.onBeforeRender(C,F,K,z,V,_e),E.modelViewMatrix.multiplyMatrices(K.matrixWorldInverse,E.matrixWorld),E.normalMatrix.getNormalMatrix(E.modelViewMatrix),V.onBeforeRender(C,F,K,z,E,_e),V.transparent===!0&&V.side===Rn&&V.forceSinglePass===!1?(V.side=rn,V.needsUpdate=!0,C.renderBufferDirect(K,F,z,V,E,_e),V.side=$n,V.needsUpdate=!0,C.renderBufferDirect(K,F,z,V,E,_e),V.side=Rn):C.renderBufferDirect(K,F,z,V,E,_e),E.onAfterRender(C,F,K,z,V,_e)}function vc(E,F,K){F.isScene!==!0&&(F=Me);const z=G.get(E),V=T.state.lights,_e=T.state.shadowsArray,ye=V.state.version,ge=le.getParameters(E,V.state,_e,F,K,T.state.lightProbeGridArray),we=le.getProgramCacheKey(ge);let Pe=z.programs;z.environment=E.isMeshStandardMaterial||E.isMeshLambertMaterial||E.isMeshPhongMaterial?F.environment:null,z.fog=F.fog;const We=E.isMeshStandardMaterial||E.isMeshLambertMaterial&&!E.envMap||E.isMeshPhongMaterial&&!E.envMap;z.envMap=ae.get(E.envMap||z.environment,We),z.envMapRotation=z.environment!==null&&E.envMap===null?F.environmentRotation:E.envMapRotation,Pe===void 0&&(E.addEventListener("dispose",mi),Pe=new Map,z.programs=Pe);let qe=Pe.get(we);if(qe!==void 0){if(z.currentProgram===qe&&z.lightsStateVersion===ye)return ov(E,ge),qe}else ge.uniforms=le.getUniforms(E),D!==null&&E.isNodeMaterial&&D.build(E,K,ge),E.onBeforeCompile(ge,C),qe=le.acquireProgram(ge,we),Pe.set(we,qe),z.uniforms=ge.uniforms;const Le=z.uniforms;return(!E.isShaderMaterial&&!E.isRawShaderMaterial||E.clipping===!0)&&(Le.clippingPlanes=Ie.uniform),ov(E,ge),z.needsLights=BA(E),z.lightsStateVersion=ye,z.needsLights&&(Le.ambientLightColor.value=V.state.ambient,Le.lightProbe.value=V.state.probe,Le.directionalLights.value=V.state.directional,Le.directionalLightShadows.value=V.state.directionalShadow,Le.spotLights.value=V.state.spot,Le.spotLightShadows.value=V.state.spotShadow,Le.rectAreaLights.value=V.state.rectArea,Le.ltc_1.value=V.state.rectAreaLTC1,Le.ltc_2.value=V.state.rectAreaLTC2,Le.pointLights.value=V.state.point,Le.pointLightShadows.value=V.state.pointShadow,Le.hemisphereLights.value=V.state.hemi,Le.directionalShadowMatrix.value=V.state.directionalShadowMatrix,Le.spotLightMatrix.value=V.state.spotLightMatrix,Le.spotLightMap.value=V.state.spotLightMap,Le.pointShadowMatrix.value=V.state.pointShadowMatrix),z.lightProbeGrid=T.state.lightProbeGridArray.length>0,z.currentProgram=qe,z.uniformsList=null,qe}function sv(E){if(E.uniformsList===null){const F=E.currentProgram.getUniforms();E.uniformsList=Ha.seqWithValue(F.seq,E.uniforms)}return E.uniformsList}function ov(E,F){const K=G.get(E);K.outputColorSpace=F.outputColorSpace,K.batching=F.batching,K.batchingColor=F.batchingColor,K.instancing=F.instancing,K.instancingColor=F.instancingColor,K.instancingMorph=F.instancingMorph,K.skinning=F.skinning,K.morphTargets=F.morphTargets,K.morphNormals=F.morphNormals,K.morphColors=F.morphColors,K.morphTargetsCount=F.morphTargetsCount,K.numClippingPlanes=F.numClippingPlanes,K.numIntersection=F.numClipIntersection,K.vertexAlphas=F.vertexAlphas,K.vertexTangents=F.vertexTangents,K.toneMapping=F.toneMapping}function UA(E,F){if(E.length===0)return null;if(E.length===1)return E[0].texture!==null?E[0]:null;S.setFromMatrixPosition(F.matrixWorld);for(let K=0,z=E.length;K<z;K++){const V=E[K];if(V.texture!==null&&V.boundingBox.containsPoint(S))return V}return null}function FA(E,F,K,z,V){F.isScene!==!0&&(F=Me),Q.resetTextureUnits();const _e=F.fog,ye=z.isMeshStandardMaterial||z.isMeshLambertMaterial||z.isMeshPhongMaterial?F.environment:null,ge=L===null?C.outputColorSpace:L.isXRRenderTarget===!0?L.texture.colorSpace:$e.workingColorSpace,we=z.isMeshStandardMaterial||z.isMeshLambertMaterial&&!z.envMap||z.isMeshPhongMaterial&&!z.envMap,Pe=ae.get(z.envMap||ye,we),We=z.vertexColors===!0&&!!K.attributes.color&&K.attributes.color.itemSize===4,qe=!!K.attributes.tangent&&(!!z.normalMap||z.anisotropy>0),Le=!!K.morphAttributes.position,ut=!!K.morphAttributes.normal,Pt=!!K.morphAttributes.color;let Rt=ei;z.toneMapped&&(L===null||L.isXRRenderTarget===!0)&&(Rt=C.toneMapping);const ft=K.morphAttributes.position||K.morphAttributes.normal||K.morphAttributes.color,nn=ft!==void 0?ft.length:0,xe=G.get(z),An=T.state.lights;if(et===!0&&(je===!0||E!==Y)){const mt=E===Y&&z.id===k;Ie.setState(z,E,mt)}let rt=!1;z.version===xe.__version?(xe.needsLights&&xe.lightsStateVersion!==An.state.version||xe.outputColorSpace!==ge||V.isBatchedMesh&&xe.batching===!1||!V.isBatchedMesh&&xe.batching===!0||V.isBatchedMesh&&xe.batchingColor===!0&&V.colorTexture===null||V.isBatchedMesh&&xe.batchingColor===!1&&V.colorTexture!==null||V.isInstancedMesh&&xe.instancing===!1||!V.isInstancedMesh&&xe.instancing===!0||V.isSkinnedMesh&&xe.skinning===!1||!V.isSkinnedMesh&&xe.skinning===!0||V.isInstancedMesh&&xe.instancingColor===!0&&V.instanceColor===null||V.isInstancedMesh&&xe.instancingColor===!1&&V.instanceColor!==null||V.isInstancedMesh&&xe.instancingMorph===!0&&V.morphTexture===null||V.isInstancedMesh&&xe.instancingMorph===!1&&V.morphTexture!==null||xe.envMap!==Pe||z.fog===!0&&xe.fog!==_e||xe.numClippingPlanes!==void 0&&(xe.numClippingPlanes!==Ie.numPlanes||xe.numIntersection!==Ie.numIntersection)||xe.vertexAlphas!==We||xe.vertexTangents!==qe||xe.morphTargets!==Le||xe.morphNormals!==ut||xe.morphColors!==Pt||xe.toneMapping!==Rt||xe.morphTargetsCount!==nn||!!xe.lightProbeGrid!=T.state.lightProbeGridArray.length>0)&&(rt=!0):(rt=!0,xe.__version=z.version);let zn=xe.currentProgram;rt===!0&&(zn=vc(z,F,V),D&&z.isNodeMaterial&&D.onUpdateProgram(z,zn,xe));let gi=!1,pr=!1,Hs=!1;const dt=zn.getUniforms(),Lt=xe.uniforms;if(v.useProgram(zn.program)&&(gi=!0,pr=!0,Hs=!0),z.id!==k&&(k=z.id,pr=!0),xe.needsLights){const mt=UA(T.state.lightProbeGridArray,V);xe.lightProbeGrid!==mt&&(xe.lightProbeGrid=mt,pr=!0)}if(gi||Y!==E){v.buffers.depth.getReversed()&&E.reversedDepth!==!0&&(E._reversedDepth=!0,E.updateProjectionMatrix()),dt.setValue(I,"projectionMatrix",E.projectionMatrix),dt.setValue(I,"viewMatrix",E.matrixWorldInverse);const gr=dt.map.cameraPosition;gr!==void 0&&gr.setValue(I,wt.setFromMatrixPosition(E.matrixWorld)),R.logarithmicDepthBuffer&&dt.setValue(I,"logDepthBufFC",2/(Math.log(E.far+1)/Math.LN2)),(z.isMeshPhongMaterial||z.isMeshToonMaterial||z.isMeshLambertMaterial||z.isMeshBasicMaterial||z.isMeshStandardMaterial||z.isShaderMaterial)&&dt.setValue(I,"isOrthographic",E.isOrthographicCamera===!0),Y!==E&&(Y=E,pr=!0,Hs=!0)}if(xe.needsLights&&(An.state.directionalShadowMap.length>0&&dt.setValue(I,"directionalShadowMap",An.state.directionalShadowMap,Q),An.state.spotShadowMap.length>0&&dt.setValue(I,"spotShadowMap",An.state.spotShadowMap,Q),An.state.pointShadowMap.length>0&&dt.setValue(I,"pointShadowMap",An.state.pointShadowMap,Q)),V.isSkinnedMesh){dt.setOptional(I,V,"bindMatrix"),dt.setOptional(I,V,"bindMatrixInverse");const mt=V.skeleton;mt&&(mt.boneTexture===null&&mt.computeBoneTexture(),dt.setValue(I,"boneTexture",mt.boneTexture,Q))}V.isBatchedMesh&&(dt.setOptional(I,V,"batchingTexture"),dt.setValue(I,"batchingTexture",V._matricesTexture,Q),dt.setOptional(I,V,"batchingIdTexture"),dt.setValue(I,"batchingIdTexture",V._indirectTexture,Q),dt.setOptional(I,V,"batchingColorTexture"),V._colorsTexture!==null&&dt.setValue(I,"batchingColorTexture",V._colorsTexture,Q));const mr=K.morphAttributes;if((mr.position!==void 0||mr.normal!==void 0||mr.color!==void 0)&&N.update(V,K,zn),(pr||xe.receiveShadow!==V.receiveShadow)&&(xe.receiveShadow=V.receiveShadow,dt.setValue(I,"receiveShadow",V.receiveShadow)),(z.isMeshStandardMaterial||z.isMeshLambertMaterial||z.isMeshPhongMaterial)&&z.envMap===null&&F.environment!==null&&(Lt.envMapIntensity.value=F.environmentIntensity),Lt.dfgLUT!==void 0&&(Lt.dfgLUT.value=K1()),pr){if(dt.setValue(I,"toneMappingExposure",C.toneMappingExposure),xe.needsLights&&OA(Lt,Hs),_e&&z.fog===!0&&Ee.refreshFogUniforms(Lt,_e),Ee.refreshMaterialUniforms(Lt,z,ie,se,T.state.transmissionRenderTarget[E.id]),xe.needsLights&&xe.lightProbeGrid){const mt=xe.lightProbeGrid;Lt.probesSH.value=mt.texture,Lt.probesMin.value.copy(mt.boundingBox.min),Lt.probesMax.value.copy(mt.boundingBox.max),Lt.probesResolution.value.copy(mt.resolution)}Ha.upload(I,sv(xe),Lt,Q)}if(z.isShaderMaterial&&z.uniformsNeedUpdate===!0&&(Ha.upload(I,sv(xe),Lt,Q),z.uniformsNeedUpdate=!1),z.isSpriteMaterial&&dt.setValue(I,"center",V.center),dt.setValue(I,"modelViewMatrix",V.modelViewMatrix),dt.setValue(I,"normalMatrix",V.normalMatrix),dt.setValue(I,"modelMatrix",V.matrixWorld),z.uniformsGroups!==void 0){const mt=z.uniformsGroups;for(let gr=0,Gs=mt.length;gr<Gs;gr++){const av=mt[gr];te.update(av,zn),te.bind(av,zn)}}return zn}function OA(E,F){E.ambientLightColor.needsUpdate=F,E.lightProbe.needsUpdate=F,E.directionalLights.needsUpdate=F,E.directionalLightShadows.needsUpdate=F,E.pointLights.needsUpdate=F,E.pointLightShadows.needsUpdate=F,E.spotLights.needsUpdate=F,E.spotLightShadows.needsUpdate=F,E.rectAreaLights.needsUpdate=F,E.hemisphereLights.needsUpdate=F}function BA(E){return E.isMeshLambertMaterial||E.isMeshToonMaterial||E.isMeshPhongMaterial||E.isMeshStandardMaterial||E.isShadowMaterial||E.isShaderMaterial&&E.lights===!0}this.getActiveCubeFace=function(){return X},this.getActiveMipmapLevel=function(){return H},this.getRenderTarget=function(){return L},this.setRenderTargetTextures=function(E,F,K){const z=G.get(E);z.__autoAllocateDepthBuffer=E.resolveDepthBuffer===!1,z.__autoAllocateDepthBuffer===!1&&(z.__useRenderToTexture=!1),G.get(E.texture).__webglTexture=F,G.get(E.depthTexture).__webglTexture=z.__autoAllocateDepthBuffer?void 0:K,z.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(E,F){const K=G.get(E);K.__webglFramebuffer=F,K.__useDefaultFramebuffer=F===void 0},this.setRenderTarget=function(E,F=0,K=0){L=E,X=F,H=K;let z=null,V=!1,_e=!1;if(E){const ge=G.get(E);if(ge.__useDefaultFramebuffer!==void 0){v.bindFramebuffer(I.FRAMEBUFFER,ge.__webglFramebuffer),$.copy(E.viewport),oe.copy(E.scissor),Be=E.scissorTest,v.viewport($),v.scissor(oe),v.setScissorTest(Be),k=-1;return}else if(ge.__webglFramebuffer===void 0)Q.setupRenderTarget(E);else if(ge.__hasExternalTextures)Q.rebindTextures(E,G.get(E.texture).__webglTexture,G.get(E.depthTexture).__webglTexture);else if(E.depthBuffer){const We=E.depthTexture;if(ge.__boundDepthTexture!==We){if(We!==null&&G.has(We)&&(E.width!==We.image.width||E.height!==We.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");Q.setupDepthRenderbuffer(E)}}const we=E.texture;(we.isData3DTexture||we.isDataArrayTexture||we.isCompressedArrayTexture)&&(_e=!0);const Pe=G.get(E).__webglFramebuffer;E.isWebGLCubeRenderTarget?(Array.isArray(Pe[F])?z=Pe[F][K]:z=Pe[F],V=!0):E.samples>0&&Q.useMultisampledRTT(E)===!1?z=G.get(E).__webglMultisampledFramebuffer:Array.isArray(Pe)?z=Pe[K]:z=Pe,$.copy(E.viewport),oe.copy(E.scissor),Be=E.scissorTest}else $.copy(Ce).multiplyScalar(ie).floor(),oe.copy(lt).multiplyScalar(ie).floor(),Be=Ye;if(K!==0&&(z=W),v.bindFramebuffer(I.FRAMEBUFFER,z)&&v.drawBuffers(E,z),v.viewport($),v.scissor(oe),v.setScissorTest(Be),V){const ge=G.get(E.texture);I.framebufferTexture2D(I.FRAMEBUFFER,I.COLOR_ATTACHMENT0,I.TEXTURE_CUBE_MAP_POSITIVE_X+F,ge.__webglTexture,K)}else if(_e){const ge=F;for(let we=0;we<E.textures.length;we++){const Pe=G.get(E.textures[we]);I.framebufferTextureLayer(I.FRAMEBUFFER,I.COLOR_ATTACHMENT0+we,Pe.__webglTexture,K,ge)}}else if(E!==null&&K!==0){const ge=G.get(E.texture);I.framebufferTexture2D(I.FRAMEBUFFER,I.COLOR_ATTACHMENT0,I.TEXTURE_2D,ge.__webglTexture,K)}k=-1},this.readRenderTargetPixels=function(E,F,K,z,V,_e,ye,ge=0){if(!(E&&E.isWebGLRenderTarget)){tt("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let we=G.get(E).__webglFramebuffer;if(E.isWebGLCubeRenderTarget&&ye!==void 0&&(we=we[ye]),we){v.bindFramebuffer(I.FRAMEBUFFER,we);try{const Pe=E.textures[ge],We=Pe.format,qe=Pe.type;if(E.textures.length>1&&I.readBuffer(I.COLOR_ATTACHMENT0+ge),!R.textureFormatReadable(We)){tt("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!R.textureTypeReadable(qe)){tt("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}F>=0&&F<=E.width-z&&K>=0&&K<=E.height-V&&I.readPixels(F,K,z,V,he.convert(We),he.convert(qe),_e)}finally{const Pe=L!==null?G.get(L).__webglFramebuffer:null;v.bindFramebuffer(I.FRAMEBUFFER,Pe)}}},this.readRenderTargetPixelsAsync=async function(E,F,K,z,V,_e,ye,ge=0){if(!(E&&E.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let we=G.get(E).__webglFramebuffer;if(E.isWebGLCubeRenderTarget&&ye!==void 0&&(we=we[ye]),we)if(F>=0&&F<=E.width-z&&K>=0&&K<=E.height-V){v.bindFramebuffer(I.FRAMEBUFFER,we);const Pe=E.textures[ge],We=Pe.format,qe=Pe.type;if(E.textures.length>1&&I.readBuffer(I.COLOR_ATTACHMENT0+ge),!R.textureFormatReadable(We))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!R.textureTypeReadable(qe))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");const Le=I.createBuffer();I.bindBuffer(I.PIXEL_PACK_BUFFER,Le),I.bufferData(I.PIXEL_PACK_BUFFER,_e.byteLength,I.STREAM_READ),I.readPixels(F,K,z,V,he.convert(We),he.convert(qe),0);const ut=L!==null?G.get(L).__webglFramebuffer:null;v.bindFramebuffer(I.FRAMEBUFFER,ut);const Pt=I.fenceSync(I.SYNC_GPU_COMMANDS_COMPLETE,0);return I.flush(),await Hv(I,Pt,4),I.bindBuffer(I.PIXEL_PACK_BUFFER,Le),I.getBufferSubData(I.PIXEL_PACK_BUFFER,0,_e),I.deleteBuffer(Le),I.deleteSync(Pt),_e}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(E,F=null,K=0){const z=Math.pow(2,-K),V=Math.floor(E.image.width*z),_e=Math.floor(E.image.height*z),ye=F!==null?F.x:0,ge=F!==null?F.y:0;Q.setTexture2D(E,0),I.copyTexSubImage2D(I.TEXTURE_2D,K,0,0,ye,ge,V,_e),v.unbindTexture()},this.copyTextureToTexture=function(E,F,K=null,z=null,V=0,_e=0){let ye,ge,we,Pe,We,qe,Le,ut,Pt;const Rt=E.isCompressedTexture?E.mipmaps[_e]:E.image;if(K!==null)ye=K.max.x-K.min.x,ge=K.max.y-K.min.y,we=K.isBox3?K.max.z-K.min.z:1,Pe=K.min.x,We=K.min.y,qe=K.isBox3?K.min.z:0;else{const Lt=Math.pow(2,-V);ye=Math.floor(Rt.width*Lt),ge=Math.floor(Rt.height*Lt),E.isDataArrayTexture?we=Rt.depth:E.isData3DTexture?we=Math.floor(Rt.depth*Lt):we=1,Pe=0,We=0,qe=0}z!==null?(Le=z.x,ut=z.y,Pt=z.z):(Le=0,ut=0,Pt=0);const ft=he.convert(F.format),nn=he.convert(F.type);let xe;F.isData3DTexture?(Q.setTexture3D(F,0),xe=I.TEXTURE_3D):F.isDataArrayTexture||F.isCompressedArrayTexture?(Q.setTexture2DArray(F,0),xe=I.TEXTURE_2D_ARRAY):(Q.setTexture2D(F,0),xe=I.TEXTURE_2D),v.activeTexture(I.TEXTURE0),v.pixelStorei(I.UNPACK_FLIP_Y_WEBGL,F.flipY),v.pixelStorei(I.UNPACK_PREMULTIPLY_ALPHA_WEBGL,F.premultiplyAlpha),v.pixelStorei(I.UNPACK_ALIGNMENT,F.unpackAlignment);const An=v.getParameter(I.UNPACK_ROW_LENGTH),rt=v.getParameter(I.UNPACK_IMAGE_HEIGHT),zn=v.getParameter(I.UNPACK_SKIP_PIXELS),gi=v.getParameter(I.UNPACK_SKIP_ROWS),pr=v.getParameter(I.UNPACK_SKIP_IMAGES);v.pixelStorei(I.UNPACK_ROW_LENGTH,Rt.width),v.pixelStorei(I.UNPACK_IMAGE_HEIGHT,Rt.height),v.pixelStorei(I.UNPACK_SKIP_PIXELS,Pe),v.pixelStorei(I.UNPACK_SKIP_ROWS,We),v.pixelStorei(I.UNPACK_SKIP_IMAGES,qe);const Hs=E.isDataArrayTexture||E.isData3DTexture,dt=F.isDataArrayTexture||F.isData3DTexture;if(E.isDepthTexture){const Lt=G.get(E),mr=G.get(F),mt=G.get(Lt.__renderTarget),gr=G.get(mr.__renderTarget);v.bindFramebuffer(I.READ_FRAMEBUFFER,mt.__webglFramebuffer),v.bindFramebuffer(I.DRAW_FRAMEBUFFER,gr.__webglFramebuffer);for(let Gs=0;Gs<we;Gs++)Hs&&(I.framebufferTextureLayer(I.READ_FRAMEBUFFER,I.COLOR_ATTACHMENT0,G.get(E).__webglTexture,V,qe+Gs),I.framebufferTextureLayer(I.DRAW_FRAMEBUFFER,I.COLOR_ATTACHMENT0,G.get(F).__webglTexture,_e,Pt+Gs)),I.blitFramebuffer(Pe,We,ye,ge,Le,ut,ye,ge,I.DEPTH_BUFFER_BIT,I.NEAREST);v.bindFramebuffer(I.READ_FRAMEBUFFER,null),v.bindFramebuffer(I.DRAW_FRAMEBUFFER,null)}else if(V!==0||E.isRenderTargetTexture||G.has(E)){const Lt=G.get(E),mr=G.get(F);v.bindFramebuffer(I.READ_FRAMEBUFFER,Z),v.bindFramebuffer(I.DRAW_FRAMEBUFFER,B);for(let mt=0;mt<we;mt++)Hs?I.framebufferTextureLayer(I.READ_FRAMEBUFFER,I.COLOR_ATTACHMENT0,Lt.__webglTexture,V,qe+mt):I.framebufferTexture2D(I.READ_FRAMEBUFFER,I.COLOR_ATTACHMENT0,I.TEXTURE_2D,Lt.__webglTexture,V),dt?I.framebufferTextureLayer(I.DRAW_FRAMEBUFFER,I.COLOR_ATTACHMENT0,mr.__webglTexture,_e,Pt+mt):I.framebufferTexture2D(I.DRAW_FRAMEBUFFER,I.COLOR_ATTACHMENT0,I.TEXTURE_2D,mr.__webglTexture,_e),V!==0?I.blitFramebuffer(Pe,We,ye,ge,Le,ut,ye,ge,I.COLOR_BUFFER_BIT,I.NEAREST):dt?I.copyTexSubImage3D(xe,_e,Le,ut,Pt+mt,Pe,We,ye,ge):I.copyTexSubImage2D(xe,_e,Le,ut,Pe,We,ye,ge);v.bindFramebuffer(I.READ_FRAMEBUFFER,null),v.bindFramebuffer(I.DRAW_FRAMEBUFFER,null)}else dt?E.isDataTexture||E.isData3DTexture?I.texSubImage3D(xe,_e,Le,ut,Pt,ye,ge,we,ft,nn,Rt.data):F.isCompressedArrayTexture?I.compressedTexSubImage3D(xe,_e,Le,ut,Pt,ye,ge,we,ft,Rt.data):I.texSubImage3D(xe,_e,Le,ut,Pt,ye,ge,we,ft,nn,Rt):E.isDataTexture?I.texSubImage2D(I.TEXTURE_2D,_e,Le,ut,ye,ge,ft,nn,Rt.data):E.isCompressedTexture?I.compressedTexSubImage2D(I.TEXTURE_2D,_e,Le,ut,Rt.width,Rt.height,ft,Rt.data):I.texSubImage2D(I.TEXTURE_2D,_e,Le,ut,ye,ge,ft,nn,Rt);v.pixelStorei(I.UNPACK_ROW_LENGTH,An),v.pixelStorei(I.UNPACK_IMAGE_HEIGHT,rt),v.pixelStorei(I.UNPACK_SKIP_PIXELS,zn),v.pixelStorei(I.UNPACK_SKIP_ROWS,gi),v.pixelStorei(I.UNPACK_SKIP_IMAGES,pr),_e===0&&F.generateMipmaps&&I.generateMipmap(xe),v.unbindTexture()},this.initRenderTarget=function(E){G.get(E).__webglFramebuffer===void 0&&Q.setupRenderTarget(E)},this.initTexture=function(E){E.isCubeTexture?Q.setTextureCube(E,0):E.isData3DTexture?Q.setTexture3D(E,0):E.isDataArrayTexture||E.isCompressedArrayTexture?Q.setTexture2DArray(E,0):Q.setTexture2D(E,0),v.unbindTexture()},this.resetState=function(){X=0,H=0,L=null,v.reset(),ve.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return ii}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;const n=this.getContext();n.drawingBufferColorSpace=$e._getDrawingBufferColorSpace(e),n.unpackColorSpace=$e._getUnpackColorSpace()}}const Sm={type:"change"},lf={type:"start"},ym={type:"end"},Wa=new ya,Mm=new Xi,q1=Math.cos(70*Xv.DEG2RAD),Bt=new U,hn=2*Math.PI,ct={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},cf=1e-6;class Q1 extends Dx{constructor(e,n=null){super(e,n),this.state=ct.NONE,this.target=new U,this.cursor=new U,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.keyRotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:Gr.ROTATE,MIDDLE:Gr.DOLLY,RIGHT:Gr.PAN},this.touches={ONE:Wr.ROTATE,TWO:Wr.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._cursorStyle="auto",this._domElementKeyEvents=null,this._lastPosition=new U,this._lastQuaternion=new Bi,this._lastTargetPosition=new U,this._quat=new Bi().setFromUnitVectors(e.up,new U(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new zp,this._sphericalDelta=new zp,this._scale=1,this._panOffset=new U,this._rotateStart=new ze,this._rotateEnd=new ze,this._rotateDelta=new ze,this._panStart=new ze,this._panEnd=new ze,this._panDelta=new ze,this._dollyStart=new ze,this._dollyEnd=new ze,this._dollyDelta=new ze,this._dollyDirection=new U,this._mouse=new ze,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=j1.bind(this),this._onPointerDown=J1.bind(this),this._onPointerUp=$1.bind(this),this._onContextMenu=oE.bind(this),this._onMouseWheel=nE.bind(this),this._onKeyDown=iE.bind(this),this._onTouchStart=rE.bind(this),this._onTouchMove=sE.bind(this),this._onMouseDown=eE.bind(this),this._onMouseMove=tE.bind(this),this._interceptControlDown=aE.bind(this),this._interceptControlUp=lE.bind(this),this.domElement!==null&&this.connect(this.domElement),this.update()}set cursorStyle(e){this._cursorStyle=e,e==="grab"?this.domElement.style.cursor="grab":this.domElement.style.cursor="auto"}get cursorStyle(){return this._cursorStyle}connect(e){super.connect(e),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}disconnect(){this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents(),this.domElement.getRootNode().removeEventListener("keydown",this._interceptControlDown,{capture:!0}),this.domElement.style.touchAction=""}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(e){e.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=e}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(Sm),this.update(),this.state=ct.NONE}pan(e,n){this._pan(e,n),this.update()}dollyIn(e){this._dollyIn(e),this.update()}dollyOut(e){this._dollyOut(e),this.update()}rotateLeft(e){this._rotateLeft(e),this.update()}rotateUp(e){this._rotateUp(e),this.update()}update(e=null){const n=this.object.position;Bt.copy(n).sub(this.target),Bt.applyQuaternion(this._quat),this._spherical.setFromVector3(Bt),this.autoRotate&&this.state===ct.NONE&&this._rotateLeft(this._getAutoRotationAngle(e)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let i=this.minAzimuthAngle,r=this.maxAzimuthAngle;isFinite(i)&&isFinite(r)&&(i<-Math.PI?i+=hn:i>Math.PI&&(i-=hn),r<-Math.PI?r+=hn:r>Math.PI&&(r-=hn),i<=r?this._spherical.theta=Math.max(i,Math.min(r,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(i+r)/2?Math.max(i,this._spherical.theta):Math.min(r,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let s=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{const o=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),s=o!=this._spherical.radius}if(Bt.setFromSpherical(this._spherical),Bt.applyQuaternion(this._quatInverse),n.copy(this.target).add(Bt),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let o=null;if(this.object.isPerspectiveCamera){const a=Bt.length();o=this._clampDistance(a*this._scale);const l=a-o;this.object.position.addScaledVector(this._dollyDirection,l),this.object.updateMatrixWorld(),s=!!l}else if(this.object.isOrthographicCamera){const a=new U(this._mouse.x,this._mouse.y,0);a.unproject(this.object);const l=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),s=l!==this.object.zoom;const c=new U(this._mouse.x,this._mouse.y,0);c.unproject(this.object),this.object.position.sub(c).add(a),this.object.updateMatrixWorld(),o=Bt.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;o!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(o).add(this.object.position):(Wa.origin.copy(this.object.position),Wa.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(Wa.direction))<q1?this.object.lookAt(this.target):(Mm.setFromNormalAndCoplanarPoint(this.object.up,this.target),Wa.intersectPlane(Mm,this.target))))}else if(this.object.isOrthographicCamera){const o=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),o!==this.object.zoom&&(this.object.updateProjectionMatrix(),s=!0)}return this._scale=1,this._performCursorZoom=!1,s||this._lastPosition.distanceToSquared(this.object.position)>cf||8*(1-this._lastQuaternion.dot(this.object.quaternion))>cf||this._lastTargetPosition.distanceToSquared(this.target)>cf?(this.dispatchEvent(Sm),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(e){return e!==null?hn/60*this.autoRotateSpeed*e:hn/60/60*this.autoRotateSpeed}_getZoomScale(e){const n=Math.abs(e*.01);return Math.pow(.95,this.zoomSpeed*n)}_rotateLeft(e){this._sphericalDelta.theta-=e}_rotateUp(e){this._sphericalDelta.phi-=e}_panLeft(e,n){Bt.setFromMatrixColumn(n,0),Bt.multiplyScalar(-e),this._panOffset.add(Bt)}_panUp(e,n){this.screenSpacePanning===!0?Bt.setFromMatrixColumn(n,1):(Bt.setFromMatrixColumn(n,0),Bt.crossVectors(this.object.up,Bt)),Bt.multiplyScalar(e),this._panOffset.add(Bt)}_pan(e,n){const i=this.domElement;if(this.object.isPerspectiveCamera){const r=this.object.position;Bt.copy(r).sub(this.target);let s=Bt.length();s*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*e*s/i.clientHeight,this.object.matrix),this._panUp(2*n*s/i.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(e*(this.object.right-this.object.left)/this.object.zoom/i.clientWidth,this.object.matrix),this._panUp(n*(this.object.top-this.object.bottom)/this.object.zoom/i.clientHeight,this.object.matrix)):(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1)}_dollyOut(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_dollyIn(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_updateZoomParameters(e,n){if(!this.zoomToCursor)return;this._performCursorZoom=!0;const i=this.domElement.getBoundingClientRect(),r=e-i.left,s=n-i.top,o=i.width,a=i.height;this._mouse.x=r/o*2-1,this._mouse.y=-(s/a)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(e){return Math.max(this.minDistance,Math.min(this.maxDistance,e))}_handleMouseDownRotate(e){this._rotateStart.set(e.clientX,e.clientY)}_handleMouseDownDolly(e){this._updateZoomParameters(e.clientX,e.clientX),this._dollyStart.set(e.clientX,e.clientY)}_handleMouseDownPan(e){this._panStart.set(e.clientX,e.clientY)}_handleMouseMoveRotate(e){this._rotateEnd.set(e.clientX,e.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);const n=this.domElement;this._rotateLeft(hn*this._rotateDelta.x/n.clientHeight),this._rotateUp(hn*this._rotateDelta.y/n.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(e){this._dollyEnd.set(e.clientX,e.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(e){this._panEnd.set(e.clientX,e.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(e){this._updateZoomParameters(e.clientX,e.clientY),e.deltaY<0?this._dollyIn(this._getZoomScale(e.deltaY)):e.deltaY>0&&this._dollyOut(this._getZoomScale(e.deltaY)),this.update()}_handleKeyDown(e){let n=!1;switch(e.code){case this.keys.UP:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(hn*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,this.keyPanSpeed),n=!0;break;case this.keys.BOTTOM:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(-hn*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,-this.keyPanSpeed),n=!0;break;case this.keys.LEFT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(hn*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(this.keyPanSpeed,0),n=!0;break;case this.keys.RIGHT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(-hn*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(-this.keyPanSpeed,0),n=!0;break}n&&(e.preventDefault(),this.update())}_handleTouchStartRotate(e){if(this._pointers.length===1)this._rotateStart.set(e.pageX,e.pageY);else{const n=this._getSecondPointerPosition(e),i=.5*(e.pageX+n.x),r=.5*(e.pageY+n.y);this._rotateStart.set(i,r)}}_handleTouchStartPan(e){if(this._pointers.length===1)this._panStart.set(e.pageX,e.pageY);else{const n=this._getSecondPointerPosition(e),i=.5*(e.pageX+n.x),r=.5*(e.pageY+n.y);this._panStart.set(i,r)}}_handleTouchStartDolly(e){const n=this._getSecondPointerPosition(e),i=e.pageX-n.x,r=e.pageY-n.y,s=Math.sqrt(i*i+r*r);this._dollyStart.set(0,s)}_handleTouchStartDollyPan(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enablePan&&this._handleTouchStartPan(e)}_handleTouchStartDollyRotate(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enableRotate&&this._handleTouchStartRotate(e)}_handleTouchMoveRotate(e){if(this._pointers.length==1)this._rotateEnd.set(e.pageX,e.pageY);else{const i=this._getSecondPointerPosition(e),r=.5*(e.pageX+i.x),s=.5*(e.pageY+i.y);this._rotateEnd.set(r,s)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);const n=this.domElement;this._rotateLeft(hn*this._rotateDelta.x/n.clientHeight),this._rotateUp(hn*this._rotateDelta.y/n.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(e){if(this._pointers.length===1)this._panEnd.set(e.pageX,e.pageY);else{const n=this._getSecondPointerPosition(e),i=.5*(e.pageX+n.x),r=.5*(e.pageY+n.y);this._panEnd.set(i,r)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(e){const n=this._getSecondPointerPosition(e),i=e.pageX-n.x,r=e.pageY-n.y,s=Math.sqrt(i*i+r*r);this._dollyEnd.set(0,s),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);const o=(e.pageX+n.x)*.5,a=(e.pageY+n.y)*.5;this._updateZoomParameters(o,a)}_handleTouchMoveDollyPan(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enablePan&&this._handleTouchMovePan(e)}_handleTouchMoveDollyRotate(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enableRotate&&this._handleTouchMoveRotate(e)}_addPointer(e){this._pointers.push(e.pointerId)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let n=0;n<this._pointers.length;n++)if(this._pointers[n]==e.pointerId){this._pointers.splice(n,1);return}}_isTrackingPointer(e){for(let n=0;n<this._pointers.length;n++)if(this._pointers[n]==e.pointerId)return!0;return!1}_trackPointer(e){let n=this._pointerPositions[e.pointerId];n===void 0&&(n=new ze,this._pointerPositions[e.pointerId]=n),n.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){const n=e.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[n]}_customWheelEvent(e){const n=e.deltaMode,i={clientX:e.clientX,clientY:e.clientY,deltaY:e.deltaY};switch(n){case 1:i.deltaY*=16;break;case 2:i.deltaY*=100;break}return e.ctrlKey&&!this._controlActive&&(i.deltaY*=10),i}}function J1(t){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(t.pointerId),this.domElement.ownerDocument.addEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.addEventListener("pointerup",this._onPointerUp)),!this._isTrackingPointer(t)&&(this._addPointer(t),t.pointerType==="touch"?this._onTouchStart(t):this._onMouseDown(t),this._cursorStyle==="grab"&&(this.domElement.style.cursor="grabbing")))}function j1(t){this.enabled!==!1&&(t.pointerType==="touch"?this._onTouchMove(t):this._onMouseMove(t))}function $1(t){switch(this._removePointer(t),this._pointers.length){case 0:this.domElement.releasePointerCapture(t.pointerId),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(ym),this.state=ct.NONE,this._cursorStyle==="grab"&&(this.domElement.style.cursor="grab");break;case 1:const e=this._pointers[0],n=this._pointerPositions[e];this._onTouchStart({pointerId:e,pageX:n.x,pageY:n.y});break}}function eE(t){let e;switch(t.button){case 0:e=this.mouseButtons.LEFT;break;case 1:e=this.mouseButtons.MIDDLE;break;case 2:e=this.mouseButtons.RIGHT;break;default:e=-1}switch(e){case Gr.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(t),this.state=ct.DOLLY;break;case Gr.ROTATE:if(t.ctrlKey||t.metaKey||t.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(t),this.state=ct.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(t),this.state=ct.ROTATE}break;case Gr.PAN:if(t.ctrlKey||t.metaKey||t.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(t),this.state=ct.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(t),this.state=ct.PAN}break;default:this.state=ct.NONE}this.state!==ct.NONE&&this.dispatchEvent(lf)}function tE(t){switch(this.state){case ct.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(t);break;case ct.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(t);break;case ct.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(t);break}}function nE(t){this.enabled===!1||this.enableZoom===!1||this.state!==ct.NONE||(t.preventDefault(),this.dispatchEvent(lf),this._handleMouseWheel(this._customWheelEvent(t)),this.dispatchEvent(ym))}function iE(t){this.enabled!==!1&&this._handleKeyDown(t)}function rE(t){switch(this._trackPointer(t),this._pointers.length){case 1:switch(this.touches.ONE){case Wr.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(t),this.state=ct.TOUCH_ROTATE;break;case Wr.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(t),this.state=ct.TOUCH_PAN;break;default:this.state=ct.NONE}break;case 2:switch(this.touches.TWO){case Wr.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(t),this.state=ct.TOUCH_DOLLY_PAN;break;case Wr.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(t),this.state=ct.TOUCH_DOLLY_ROTATE;break;default:this.state=ct.NONE}break;default:this.state=ct.NONE}this.state!==ct.NONE&&this.dispatchEvent(lf)}function sE(t){switch(this._trackPointer(t),this.state){case ct.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(t),this.update();break;case ct.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(t),this.update();break;case ct.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(t),this.update();break;case ct.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(t),this.update();break;default:this.state=ct.NONE}}function oE(t){this.enabled!==!1&&t.preventDefault()}function aE(t){t.key==="Control"&&(this._controlActive=!0,this.domElement.getRootNode().addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}function lE(t){t.key==="Control"&&(this._controlActive=!1,this.domElement.getRootNode().removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}function cE(t){const n=ne.useRef(null),[i,r]=ne.useState({w:0,h:0}),s=ne.useRef(null),o=ne.useRef(null),a=ne.useRef(null),l=ne.useCallback((c,d)=>{r(h=>h.w===c&&h.h===d?h:{w:c,h:d})},[]);return ne.useLayoutEffect(()=>{const c=n.current;if(!c||c===a.current)return;const d=c.getBoundingClientRect();(d.width>0||d.height>0)&&(a.current=c,l(d.width,d.height))}),ne.useEffect(()=>{var h;const c=n.current;if(c===o.current||((h=s.current)==null||h.disconnect(),s.current=null,o.current=c,!c))return;const d=new ResizeObserver(u=>{for(const p of u)l(p.contentRect.width,p.contentRect.height)});s.current=d,d.observe(c)}),ne.useEffect(()=>()=>{var c;return(c=s.current)==null?void 0:c.disconnect()},[]),{ref:n,size:i}}const uf="__cairnPlotSettingsChannels__",Xa=globalThis[uf]??(globalThis[uf]=new Map);function uE(t,e){const n=Xa.get(t);if(n)for(const i of[...n])i({type:"patch",settings:e})}function fE(t,e){let n=Xa.get(t);return n||(n=new Set,Xa.set(t,n)),n.add(e),()=>{n.delete(e),n.size===0&&Xa.delete(t)}}function dE(t,e){return fE(t,n=>e(n.settings))}const ff="__cairnPlotSettingsPeers__",Ya=globalThis[ff]??(globalThis[ff]=new Map);function hE(t,e){let n=Ya.get(t);return n||(n=new Set,Ya.set(t,n)),n.add(e),()=>{n.delete(e),n.size===0&&Ya.delete(t)}}function pE(t,e){for(const n of Ya.get(t)??[]){if(n===e)continue;const i=n();if(i)return i}return null}function mE(t,e){let n=null,i=null;const r=l=>{i=l,n={...n??{},...l}},s=dE(t,l=>{if(i===l)return;r(l);const c=l["scene3d.camera"];c&&e(c)}),o=()=>n,a=hE(t,o);return{set(l){const c={"scene3d.camera":l};r(c),uE(t,c)},seed(){var c;const l=(c=pE(t,o))==null?void 0:c["scene3d.camera"];l&&e(l)},dispose(){s(),a()}}}const Em=16,Xn=new Map,Ka=new Set;let df=!1;function gE(){if(df)return;df=!0;const t=()=>{Ka.clear(),df=!1};typeof requestAnimationFrame=="function"?requestAnimationFrame(t):queueMicrotask(t)}function Tm(t){Ka.add(t),gE()}function _E(t){if(!(Xn.size<=Em))for(const e of Array.from(Xn.keys())){if(Xn.size<=Em)break;if(e===t||Ka.has(e))continue;const n=Xn.get(e);Xn.delete(e),n==null||n.park()}}function Za(t,e){Xn.delete(t),Xn.set(t,{park:e}),Tm(t),_E(t)}function wm(t){const e=Xn.get(t);e&&(Xn.delete(t),Xn.set(t,e),Tm(t))}function Am(t){Xn.delete(t),Ka.delete(t)}let Rm=null;function vE(){Rm=[]}function xE(){return Rm??[]}const SE=500;let hf=!1,bm=[];function yE(){if(typeof window>"u")return 0;let t=null;try{t=new URLSearchParams(location.search).get("paneRenderLog")}catch{}const n=window.__cairnPaneRenderLog;return t==="2"||n===2||n==="2"?2:t==="1"||n===1||n===!0||t==="true"?1:0}let Cm=[];const ME=new Map;let qa=[];function EE(){try{if(typeof performance<"u"&&typeof performance.now=="function")return performance.now()}catch{}return Date.now()}function Pm(t,e){if(!hf||qa.length>=SE)return;const n={kind:t,t:EE(),detail:e};qa.push(n),console.warn(`cairn-plot paneRenderLog: CONTEXT-LOSS event [${t}] @ ${n.t.toFixed(0)}ms — captured on window.__cairnContextLossEvents.`,n)}function TE(){if(hf)return!0;const t=yE();if(t===0)return!1;hf=!0,ME.clear(),vE();const e=window;bm=e.__cairnPaneRenderLogSuspects??[],Cm=e.__cairnPaneRenderLogHueAnomalies??[],qa=e.__cairnContextLossEvents??[],e.__cairnPaneRenderLogSuspects=bm,e.__cairnPaneRenderLogHueAnomalies=Cm,e.__cairnContextLossEvents=qa;const n=e;return(n.__cairnPaneRenderLogGetters??(n.__cairnPaneRenderLogGetters=[])).push(()=>xE()),e.__cairnPaneRenderLogRecords=()=>(n.__cairnPaneRenderLogGetters??[]).map(i=>i()).sort((i,r)=>r.length-i.length)[0]??[],console.info(`cairn-plot: paneRenderLog capture ARMED (level ${t}) — orange-suspect presents on window.__cairnPaneRenderLogSuspects, context-loss events on window.__cairnContextLossEvents`+(t>=2?", DEEP color anomalies on window.__cairnPaneRenderLogHueAnomalies (extra 8×8 sample per present)":"")+" (full render buffer: window.__cairnPaneRenderLogRecords())."),!0}TE();const wE=1200;function Lm(t){return typeof t=="string"&&t!=="data:,"&&t.startsWith("data:image/")&&t.length>100}const Dm=.05;function Im(t,e){e==="turntable"?(t.minPolarAngle=Dm,t.maxPolarAngle=Math.PI-Dm):(t.minPolarAngle=0,t.maxPolarAngle=Math.PI),t.update()}function Qa(t){const{background:e,fov:n=50,near:i=.01,far:r=1e3,sync:s=null,showAxes:o=!1,showPlanes:a=!1,cameraMode:l="orbital",opaqueBackground:c=!1,onFrame:d}=t,{ref:h,size:u}=cE(),p=ne.useRef(null),g=ne.useRef(null),M=ne.useRef(null),m=ne.useRef(null),f=ne.useRef(null),x=ne.useRef(null),y=ne.useRef(null),S=ne.useRef([]),w=ne.useRef(null),T=ne.useRef(!1),b=ne.useRef(o),_=ne.useRef(a),A=ne.useRef(l),C=ne.useRef(d),P=ne.useRef(null),D=ne.useRef();D.current||(D.current=typeof crypto<"u"&&"randomUUID"in crypto?crypto.randomUUID():`viewer-${Math.random().toString(36).slice(2)}`);const W=ne.useRef(!1),Z=ne.useRef(!1),B=ne.useRef(null),X=ne.useRef(u),H=ne.useRef(e),L=ne.useRef(c),[k,Y]=ne.useState(null),$=ne.useRef(null),oe=ne.useRef(!1),Be=ne.useRef(null),[Qe,He]=ne.useState(!1),q=ne.useRef(!1),se=ne.useRef(null);ne.useEffect(()=>{C.current=d},[d]);const ie=ne.useCallback(ce=>{if(q.current===ce)return;q.current=ce,He(ce);const Me=f.current;Me&&(Me.enableZoom=ce)},[]),be=ne.useCallback(()=>{B.current!=null&&(window.clearTimeout(B.current),B.current=null)},[]),ke=ne.useCallback(()=>{const ce=g.current;ce&&(ce.dispose(),ce.forceContextLoss(),g.current=null)},[]),Ce=ne.useCallback(()=>{const ce=g.current,Me=X.current;if(!ce||!Me||Me.w<=0||Me.h<=0)return;const Fe=ce.domElement;if(Fe.width===Me.w&&Fe.height===Me.h)return;ce.setSize(Me.w,Me.h,!1);const Oe=m.current;Oe&&(Oe.aspect=Me.w/Me.h,Oe.updateProjectionMatrix())},[]),lt=ne.useCallback(()=>{var Oe;const ce=g.current;if(!ce||W.current)return;if(!oe.current){Za(D.current,lt);return}const Me=ce.getContext();let Fe=!1;if(!Me.isContextLost()){Ce();const I=M.current,Ze=m.current;I&&Ze&&ce.render(I,Ze);try{const De=ce.domElement.toDataURL("image/png");if(Lm(De)){Fe=!0;const R=new Image;R.onload=()=>{Y(De),$.current=De},R.src=De}}catch{}}if(!Fe&&$.current==null){Za(D.current,lt);return}(Oe=Be.current)==null||Oe.loseContext(),W.current=!0,Am(D.current),be()},[be]),Ye=ne.useCallback(()=>{be(),B.current=window.setTimeout(()=>{B.current=null,Z.current||lt()},wE)},[be,lt]),st=ne.useCallback(()=>{const ce=M.current;if(!ce||(x.current&&(ce.remove(x.current),x.current.geometry.dispose(),x.current.material.dispose(),x.current=null),y.current&&(ce.remove(y.current),y.current.geometry.dispose(),y.current.material.dispose(),y.current=null),!b.current))return;const Me=w.current,Fe=Me?Math.max(new U(...Me.max).sub(new U(...Me.min)).length()*.5,.001):1,Oe=new Lx(Fe*1.2);ce.add(Oe),x.current=Oe;const I=new Px(Fe*2,10);ce.add(I),y.current=I},[]),et=ne.useCallback(()=>{const ce=M.current;if(!ce)return;for(const Ze of S.current)ce.remove(Ze),Ze.geometry.dispose(),Ze.material.dispose();if(S.current=[],!_.current)return;const Me=w.current,Oe=(Me?Math.max(new U(...Me.max).sub(new U(...Me.min)).length()*.5,.001):1)*2,I=[{color:3900150,rotate:()=>{}},{color:2278750,rotate:Ze=>Ze.rotateX(-Math.PI/2)},{color:15680580,rotate:Ze=>Ze.rotateY(Math.PI/2)}];for(const Ze of I){const De=new Ln(new ro(Oe,Oe),new Wu({color:Ze.color,transparent:!0,opacity:.06,side:Rn,depthWrite:!1}));Ze.rotate(De),ce.add(De),S.current.push(De)}},[]),je=ne.useCallback(()=>{var ce;if(!W.current){wm(D.current);return}(ce=Be.current)==null||ce.restoreContext(),W.current=!1,Za(D.current,lt)},[lt]),it=ne.useCallback(()=>{var Oe;W.current&&je();const ce=g.current,Me=M.current,Fe=m.current;ce&&Me&&Fe&&(Ce(),ce.render(Me,Fe),(Oe=C.current)==null||Oe.call(C,ce.domElement)),wm(D.current),Ye()},[je,Ye,Ce]),wt=ne.useCallback(ce=>{w.current=ce,oe.current=!0;const Me=m.current,Fe=f.current;if(!Me||!Fe)return;const Oe=new U(...ce.min),I=new U(...ce.max),Ze=Oe.clone().add(I).multiplyScalar(.5),De=Math.max(I.clone().sub(Oe).length()*.5,.001),R=Me.fov*Math.PI/180,v=De/Math.sin(R/2)*1.15;Me.near=Math.max(v/1e3,1e-4),Me.far=v*10+De*10,Me.up.set(0,1,0),Me.position.copy(Ze).add(new U(1,.75,1).normalize().multiplyScalar(v)),Me.lookAt(Ze),Me.updateProjectionMatrix(),Fe.target.copy(Ze),Fe.update(),st(),et(),it()},[it,st,et]);return ne.useEffect(()=>{const ce=p.current;if(!ce)return;const Me=new Z1({canvas:ce,antialias:!0,alpha:!0});Me.setPixelRatio(Math.min(window.devicePixelRatio,2)),Me.setClearColor(H.current,L.current?1:0);const Fe=X.current;Fe.w>0&&Fe.h>0&&Me.setSize(Fe.w,Fe.h,!1),g.current=Me;const Oe=Me.getContext();Be.current=(Oe==null?void 0:Oe.getExtension("WEBGL_lose_context"))??null;const I=new rx;M.current=I;const Ze=new Dn(n,1,i,r);m.current=Ze;const De=new Q1(Ze,ce);De.enableDamping=!1,De.enableZoom=q.current,Im(De,A.current),f.current=De,se.current={position:Ze.position.toArray(),target:De.target.toArray(),zoom:Ze.zoom};const R=()=>{it(),P.current&&!T.current&&P.current.set({position:Ze.position.toArray(),target:De.target.toArray(),zoom:Ze.zoom})};De.addEventListener("change",R);const v=()=>{Z.current=!0,it()},O=()=>{Z.current=!1,Ye()};De.addEventListener("start",v),De.addEventListener("end",O);const G=()=>{if(w.current){wt(w.current);return}const J=se.current,le=m.current,Ee=f.current;J&&le&&Ee&&(le.position.fromArray(J.position),Ee.target.fromArray(J.target),le.zoom=J.zoom,le.updateProjectionMatrix(),Ee.update(),it())};ce.addEventListener("dblclick",G);const Q=J=>{const le=h.current;le&&ie(le.contains(J.target))},ae=J=>{const le=h.current;le&&(le.contains(J.target)||ie(!1))};document.addEventListener("pointerdown",Q,!0),document.addEventListener("wheel",ae,{capture:!0,passive:!0});const ue=J=>{J.preventDefault(),Pm("three-webgl-context-lost",{sourceId:D.current})},j=()=>{Pm("three-webgl-context-restored",{sourceId:D.current}),W.current=!1,it(),Y(null),$.current=null};return ce.addEventListener("webglcontextlost",ue,!1),ce.addEventListener("webglcontextrestored",j,!1),Za(D.current,lt),()=>{ce.removeEventListener("dblclick",G),document.removeEventListener("pointerdown",Q,!0),document.removeEventListener("wheel",ae,!0),ce.removeEventListener("webglcontextlost",ue,!1),ce.removeEventListener("webglcontextrestored",j,!1),De.removeEventListener("start",v),De.removeEventListener("end",O),De.removeEventListener("change",R),De.dispose(),be(),Am(D.current),ke(),Be.current=null,x.current&&(x.current.geometry.dispose(),x.current.material.dispose(),x.current=null),y.current&&(y.current.geometry.dispose(),y.current.material.dispose(),y.current=null);for(const J of S.current)J.geometry.dispose(),J.material.dispose();S.current=[],M.current=null,m.current=null,f.current=null}},[]),ne.useEffect(()=>{if(!s)return;const ce=m.current,Me=f.current;if(!ce||!Me)return;const Fe=mE(s.groupId,Oe=>{T.current=!0,ce.position.fromArray(Oe.position),Me.target.fromArray(Oe.target),ce.zoom=Oe.zoom,ce.updateProjectionMatrix(),Me.update(),T.current=!1});return P.current=Fe,Fe.seed(),()=>{P.current=null,Fe.dispose()}},[s==null?void 0:s.groupId]),ne.useEffect(()=>{b.current=o,st(),it()},[o]),ne.useEffect(()=>{_.current=a,et(),it()},[a]),ne.useEffect(()=>{A.current=l;const ce=f.current;ce&&Im(ce,l),it()},[l]),ne.useEffect(()=>{H.current=e,L.current=c;const ce=g.current;ce&&(ce.setClearColor(e,c?1:0),it())},[e,c]),ne.useEffect(()=>{X.current=u;const ce=m.current;ce&&u.w>0&&u.h>0&&(ce.aspect=u.w/u.h,ce.updateProjectionMatrix());const Me=g.current;!Me||u.w===0||u.h===0||(Me.setSize(u.w,u.h,!1),it())},[u.w,u.h]),{containerRef:h,canvasRef:p,requestRender:it,fitToBounds:wt,refs:{renderer:g,scene:M,camera:m,controls:f},cachedImageUrl:k,active:Qe}}function Ja({handle:t,className:e}){const[n,i]=ne.useState(null),r=Lm(t.cachedImageUrl)&&t.cachedImageUrl!==n;return Ae.jsxs("div",{ref:t.containerRef,className:e??"relative h-full w-full",children:[Ae.jsx("canvas",{ref:t.canvasRef,className:"block h-full w-full rounded",style:r?{opacity:0}:void 0}),r&&Ae.jsx("img",{src:t.cachedImageUrl,alt:"","aria-hidden":!0,onError:()=>i(t.cachedImageUrl),className:"pointer-events-none absolute inset-0 block h-full w-full rounded object-fill"}),t.active&&Ae.jsx("div",{"aria-hidden":!0,className:"pointer-events-none absolute inset-0 rounded border border-accent/50"})]})}function AE(t,e,n){return[t[0]+(e[0]-t[0])*n,t[1]+(e[1]-t[1])*n,t[2]+(e[2]-t[2])*n]}function RE(t){const e=new Uint8Array(768);for(let n=0;n<256;n++){const r=n/255*(t.length-1),s=Math.floor(r),o=Math.min(s+1,t.length-1),a=r-s,[l,c,d]=AE(t[s],t[o],a);e[n*3]=Math.round(l),e[n*3+1]=Math.round(c),e[n*3+2]=Math.round(d)}return e}const pf={turbo:[[48,18,59],[50,21,67],[51,24,74],[52,27,81],[53,30,88],[54,33,95],[55,36,102],[56,39,109],[57,42,115],[58,45,121],[59,47,128],[60,50,134],[61,53,139],[62,56,145],[63,59,151],[63,62,156],[64,64,162],[65,67,167],[65,70,172],[66,73,177],[66,75,181],[67,78,186],[68,81,191],[68,84,195],[68,86,199],[69,89,203],[69,92,207],[69,94,211],[70,97,214],[70,100,218],[70,102,221],[70,105,224],[70,107,227],[71,110,230],[71,113,233],[71,115,235],[71,118,238],[71,120,240],[71,123,242],[70,125,244],[70,128,246],[70,130,248],[70,133,250],[70,135,251],[69,138,252],[69,140,253],[68,143,254],[67,145,254],[66,148,255],[65,150,255],[64,153,255],[62,155,254],[61,158,254],[59,160,253],[58,163,252],[56,165,251],[55,168,250],[53,171,248],[51,173,247],[49,175,245],[47,178,244],[46,180,242],[44,183,240],[42,185,238],[40,188,235],[39,190,233],[37,192,231],[35,195,228],[34,197,226],[32,199,223],[31,201,221],[30,203,218],[28,205,216],[27,208,213],[26,210,210],[26,212,208],[25,213,205],[24,215,202],[24,217,200],[24,219,197],[24,221,194],[24,222,192],[24,224,189],[25,226,187],[25,227,185],[26,228,182],[28,230,180],[29,231,178],[31,233,175],[32,234,172],[34,235,170],[37,236,167],[39,238,164],[42,239,161],[44,240,158],[47,241,155],[50,242,152],[53,243,148],[56,244,145],[60,245,142],[63,246,138],[67,247,135],[70,248,132],[74,248,128],[78,249,125],[82,250,122],[85,250,118],[89,251,115],[93,252,111],[97,252,108],[101,253,105],[105,253,102],[109,254,98],[113,254,95],[117,254,92],[121,254,89],[125,255,86],[128,255,83],[132,255,81],[136,255,78],[139,255,75],[143,255,73],[146,255,71],[150,254,68],[153,254,66],[156,254,64],[159,253,63],[161,253,61],[164,252,60],[167,252,58],[169,251,57],[172,251,56],[175,250,55],[177,249,54],[180,248,54],[183,247,53],[185,246,53],[188,245,52],[190,244,52],[193,243,52],[195,241,52],[198,240,52],[200,239,52],[203,237,52],[205,236,52],[208,234,52],[210,233,53],[212,231,53],[215,229,53],[217,228,54],[219,226,54],[221,224,55],[223,223,55],[225,221,55],[227,219,56],[229,217,56],[231,215,57],[233,213,57],[235,211,57],[236,209,58],[238,207,58],[239,205,58],[241,203,58],[242,201,58],[244,199,58],[245,197,58],[246,195,58],[247,193,58],[248,190,57],[249,188,57],[250,186,57],[251,184,56],[251,182,55],[252,179,54],[252,177,54],[253,174,53],[253,172,52],[254,169,51],[254,167,50],[254,164,49],[254,161,48],[254,158,47],[254,155,45],[254,153,44],[254,150,43],[254,147,42],[254,144,41],[253,141,39],[253,138,38],[252,135,37],[252,132,35],[251,129,34],[251,126,33],[250,123,31],[249,120,30],[249,117,29],[248,114,28],[247,111,26],[246,108,25],[245,105,24],[244,102,23],[243,99,21],[242,96,20],[241,93,19],[240,91,18],[239,88,17],[237,85,16],[236,83,15],[235,80,14],[234,78,13],[232,75,12],[231,73,12],[229,71,11],[228,69,10],[226,67,10],[225,65,9],[223,63,8],[221,61,8],[220,59,7],[218,57,7],[216,55,6],[214,53,6],[212,51,5],[210,49,5],[208,47,5],[206,45,4],[204,43,4],[202,42,4],[200,40,3],[197,38,3],[195,37,3],[193,35,2],[190,33,2],[188,32,2],[185,30,2],[183,29,2],[180,27,1],[178,26,1],[175,24,1],[172,23,1],[169,22,1],[167,20,1],[164,19,1],[161,18,1],[158,16,1],[155,15,1],[152,14,1],[149,13,1],[146,11,1],[142,10,1],[139,9,2],[136,8,2],[133,7,2],[129,6,2],[126,5,2],[122,4,3]],plasma:[[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],magma:[[0,0,4],[1,0,5],[1,1,6],[1,1,8],[2,1,9],[2,2,11],[2,2,13],[3,3,15],[3,3,18],[4,4,20],[5,4,22],[6,5,24],[6,5,26],[7,6,28],[8,7,30],[9,7,32],[10,8,34],[11,9,36],[12,9,38],[13,10,41],[14,11,43],[16,11,45],[17,12,47],[18,13,49],[19,13,52],[20,14,54],[21,14,56],[22,15,59],[24,15,61],[25,16,63],[26,16,66],[28,16,68],[29,17,71],[30,17,73],[32,17,75],[33,17,78],[34,17,80],[36,18,83],[37,18,85],[39,18,88],[41,17,90],[42,17,92],[44,17,95],[45,17,97],[47,17,99],[49,17,101],[51,16,103],[52,16,105],[54,16,107],[56,16,108],[57,15,110],[59,15,112],[61,15,113],[63,15,114],[64,15,116],[66,15,117],[68,15,118],[69,16,119],[71,16,120],[73,16,120],[74,16,121],[76,17,122],[78,17,123],[79,18,123],[81,18,124],[82,19,124],[84,19,125],[86,20,125],[87,21,126],[89,21,126],[90,22,126],[92,22,127],[93,23,127],[95,24,127],[96,24,128],[98,25,128],[100,26,128],[101,26,128],[103,27,128],[104,28,129],[106,28,129],[107,29,129],[109,29,129],[110,30,129],[112,31,129],[114,31,129],[115,32,129],[117,33,129],[118,33,129],[120,34,129],[121,34,130],[123,35,130],[124,35,130],[126,36,130],[128,37,130],[129,37,129],[131,38,129],[132,38,129],[134,39,129],[136,39,129],[137,40,129],[139,41,129],[140,41,129],[142,42,129],[144,42,129],[145,43,129],[147,43,128],[148,44,128],[150,44,128],[152,45,128],[153,45,128],[155,46,127],[156,46,127],[158,47,127],[160,47,127],[161,48,126],[163,48,126],[165,49,126],[166,49,125],[168,50,125],[170,51,125],[171,51,124],[173,52,124],[174,52,123],[176,53,123],[178,53,123],[179,54,122],[181,54,122],[183,55,121],[184,55,121],[186,56,120],[188,57,120],[189,57,119],[191,58,119],[192,58,118],[194,59,117],[196,60,117],[197,60,116],[199,61,115],[200,62,115],[202,62,114],[204,63,113],[205,64,113],[207,64,112],[208,65,111],[210,66,111],[211,67,110],[213,68,109],[214,69,108],[216,69,108],[217,70,107],[219,71,106],[220,72,105],[222,73,104],[223,74,104],[224,76,103],[226,77,102],[227,78,101],[228,79,100],[229,80,100],[231,82,99],[232,83,98],[233,84,98],[234,86,97],[235,87,96],[236,88,96],[237,90,95],[238,91,94],[239,93,94],[240,95,94],[241,96,93],[242,98,93],[242,100,92],[243,101,92],[244,103,92],[244,105,92],[245,107,92],[246,108,92],[246,110,92],[247,112,92],[247,114,92],[248,116,92],[248,118,92],[249,120,93],[249,121,93],[249,123,93],[250,125,94],[250,127,94],[250,129,95],[251,131,95],[251,133,96],[251,135,97],[252,137,97],[252,138,98],[252,140,99],[252,142,100],[252,144,101],[253,146,102],[253,148,103],[253,150,104],[253,152,105],[253,154,106],[253,155,107],[254,157,108],[254,159,109],[254,161,110],[254,163,111],[254,165,113],[254,167,114],[254,169,115],[254,170,116],[254,172,118],[254,174,119],[254,176,120],[254,178,122],[254,180,123],[254,182,124],[254,183,126],[254,185,127],[254,187,129],[254,189,130],[254,191,132],[254,193,133],[254,194,135],[254,196,136],[254,198,138],[254,200,140],[254,202,141],[254,204,143],[254,205,144],[254,207,146],[254,209,148],[254,211,149],[254,213,151],[254,215,153],[254,216,154],[253,218,156],[253,220,158],[253,222,160],[253,224,161],[253,226,163],[253,227,165],[253,229,167],[253,231,169],[253,233,170],[253,235,172],[252,236,174],[252,238,176],[252,240,178],[252,242,180],[252,244,182],[252,246,184],[252,247,185],[252,249,187],[252,251,189],[252,253,191]],"red-green":[[215,25,28],[255,255,255],[26,150,65]],"red-blue":[[215,25,28],[255,255,255],[44,123,182]]},bE=Object.keys(pf),CE={plasma:"Plasma",magma:"Magma",turbo:"Turbo","red-green":"Red–Green","red-blue":"Red–Blue"};bE.map(t=>({id:t,label:CE[t]}));const Nm=new Map;function Um(t){const e=t;let n=Nm.get(e);if(!n){const i=pf[e]??pf.turbo;n=RE(i),Nm.set(e,n)}return n}function PE(t,e,n,i){let r=t,s=e,o=n;return o-s===0?.5:(r-s)/(o-s)}function LE(t){const e=t>0?t<1?t:1:0;return Math.round(e*255)}function DE(t,e,n,i){return Number.isFinite(t)?PE(t,e,n):0}const IE=["#0969da","#d29922","#3fb950","#f85149","#c678dd","#56d4dd"];function ja(t,e,n,i="turbo",r){const{stride:s=1,offset:o=0,out:a}=r??{},l=a??new Float32Array(e*3),c=Um(i),[d,h]=n;for(let u=0;u<e;u++){const p=LE(DE(t[u*s+o],d,h))*3;l[u*3]=c[p]/255,l[u*3+1]=c[p+1]/255,l[u*3+2]=c[p+2]/255}return l}function NE(t){const e=parseInt(t.replace("#",""),16);return[(e>>16&255)/255,(e>>8&255)/255,(e&255)/255]}const Fm=IE.map(NE);function UE(t,e,n){const{stride:i=1,offset:r=0,out:s}=n??{},o=s??new Float32Array(e*3);for(let a=0;a<e;a++){const l=Math.max(0,Math.round(t[a*i+r])),[c,d,h]=Fm[l%Fm.length];o[a*3]=c,o[a*3+1]=d,o[a*3+2]=h}return o}function Om(t,e,n,i,r){const s=new Float32Array(e*3);for(let o=0;o<e;o++)s[o*3]=t[o*n+i],s[o*3+1]=t[o*n+i+1],s[o*3+2]=t[o*n+i+2];return s}const Bm={xyz:3,xyzc:4,xyzrgb:6},FE={dark:856343,light:16185594};function OE(t,e){return t==="rgb"?e==="xyzrgb"?"rgb":e==="xyzc"?"category":"height":t==="category"?e==="xyzc"?"category":e==="xyzrgb"?"rgb":"height":t==="height"?"height":e==="xyzrgb"?"rgb":e==="xyzc"?"category":"height"}function BE(t,e,n){const i=Bm[e];if(i===3)return t.subarray(0,n*3);const r=new Float32Array(n*3);for(let s=0;s<n;s++)r[s*3]=t[s*i],r[s*3+1]=t[s*i+1],r[s*3+2]=t[s*i+2];return r}function km(t,e,n,i,r){const s=Bm[e],o=OE(r,e);return o==="rgb"?Om(t,n,s,3):o==="category"?UE(t,n,{stride:s,offset:3}):ja(t,n,[i.min[2],i.max[2]],"turbo",{stride:s,offset:2})}function kE({data:t,channels:e,nPoints:n,bounds:i,colorMode:r,pointSize:s,pointSizeMode:o="screen",background:a,className:l,sync:c=null,onFrame:d,showAxes:h=!1,showPlanes:u=!1,cameraMode:p="orbital",overrideColors:g=null}){const M=Qa({background:FE[a],sync:c,showAxes:h,showPlanes:u,cameraMode:p,onFrame:d}),{requestRender:m,fitToBounds:f,refs:x}=M,y=ne.useRef(null),S=ne.useRef(null),w=ne.useRef(null),T=ne.useMemo(()=>BE(t,e,n),[t,e,n]);return ne.useEffect(()=>{var D,W;const b=x.scene.current;if(!b)return;y.current&&(b.remove(y.current),(D=S.current)==null||D.dispose(),(W=w.current)==null||W.dispose());const _=new Xt;_.setAttribute("position",new bt(T,3));const A=g??km(t,e,n,i,r);_.setAttribute("color",new bt(A,3));const C=new qu({size:s,sizeAttenuation:o==="world",vertexColors:!0}),P=new px(_,C);b.add(P),S.current=_,w.current=C,y.current=P,f(i)},[T,t,e,n]),ne.useEffect(()=>{const b=S.current;if(!b)return;const _=g??km(t,e,n,i,r),A=b.getAttribute("color");A.copyArray(_),A.needsUpdate=!0,m()},[r,g]),ne.useEffect(()=>{const b=y.current,_=w.current;if(!b||!_)return;const A=o==="world";if(_.sizeAttenuation!==A){const C=new qu({size:s,sizeAttenuation:A,vertexColors:!0});b.material=C,_.dispose(),w.current=C}else _.size=s,_.needsUpdate=!0;m()},[s,o]),ne.useEffect(()=>()=>{var b,_;(b=S.current)==null||b.dispose(),(_=w.current)==null||_.dispose()},[]),Ae.jsx(Ja,{handle:M,className:l})}function $a({label:t,corner:e="bottom-left",isDraggable:n=!1,grip:i=n,onDragStart:r,attrs:s}){const o=e==="bottom-right"?"bottom-1 right-1":"bottom-1 left-1";return Ae.jsxs("span",{className:`absolute ${o} z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${n?" cairn-drag-grip":""}`,draggable:n,onDragStart:r,style:{cursor:n?"grab":void 0},...s,children:[i&&Ae.jsx("i",{className:"fa-solid fa-grip-vertical text-[8px] opacity-50","aria-hidden":"true"}),t]})}const zE="pointer-events-none absolute left-1 top-1 z-10 mono rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-subtle backdrop-blur-sm";function el({text:t}){return Ae.jsx("div",{className:zE,children:t})}var In={},zm={exports:{}},Vm={};/**
 * @license React
 * scheduler.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */(function(t){function e(L,k){var Y=L.length;L.push(k);e:for(;0<Y;){var $=Y-1>>>1,oe=L[$];if(0<r(oe,k))L[$]=k,L[Y]=oe,Y=$;else break e}}function n(L){return L.length===0?null:L[0]}function i(L){if(L.length===0)return null;var k=L[0],Y=L.pop();if(Y!==k){L[0]=Y;e:for(var $=0,oe=L.length,Be=oe>>>1;$<Be;){var Qe=2*($+1)-1,He=L[Qe],q=Qe+1,se=L[q];if(0>r(He,Y))q<oe&&0>r(se,He)?(L[$]=se,L[q]=Y,$=q):(L[$]=He,L[Qe]=Y,$=Qe);else if(q<oe&&0>r(se,Y))L[$]=se,L[q]=Y,$=q;else break e}}return k}function r(L,k){var Y=L.sortIndex-k.sortIndex;return Y!==0?Y:L.id-k.id}if(typeof performance=="object"&&typeof performance.now=="function"){var s=performance;t.unstable_now=function(){return s.now()}}else{var o=Date,a=o.now();t.unstable_now=function(){return o.now()-a}}var l=[],c=[],d=1,h=null,u=3,p=!1,g=!1,M=!1,m=typeof setTimeout=="function"?setTimeout:null,f=typeof clearTimeout=="function"?clearTimeout:null,x=typeof setImmediate<"u"?setImmediate:null;typeof navigator<"u"&&navigator.scheduling!==void 0&&navigator.scheduling.isInputPending!==void 0&&navigator.scheduling.isInputPending.bind(navigator.scheduling);function y(L){for(var k=n(c);k!==null;){if(k.callback===null)i(c);else if(k.startTime<=L)i(c),k.sortIndex=k.expirationTime,e(l,k);else break;k=n(c)}}function S(L){if(M=!1,y(L),!g)if(n(l)!==null)g=!0,X(w);else{var k=n(c);k!==null&&H(S,k.startTime-L)}}function w(L,k){g=!1,M&&(M=!1,f(_),_=-1),p=!0;var Y=u;try{for(y(k),h=n(l);h!==null&&(!(h.expirationTime>k)||L&&!P());){var $=h.callback;if(typeof $=="function"){h.callback=null,u=h.priorityLevel;var oe=$(h.expirationTime<=k);k=t.unstable_now(),typeof oe=="function"?h.callback=oe:h===n(l)&&i(l),y(k)}else i(l);h=n(l)}if(h!==null)var Be=!0;else{var Qe=n(c);Qe!==null&&H(S,Qe.startTime-k),Be=!1}return Be}finally{h=null,u=Y,p=!1}}var T=!1,b=null,_=-1,A=5,C=-1;function P(){return!(t.unstable_now()-C<A)}function D(){if(b!==null){var L=t.unstable_now();C=L;var k=!0;try{k=b(!0,L)}finally{k?W():(T=!1,b=null)}}else T=!1}var W;if(typeof x=="function")W=function(){x(D)};else if(typeof MessageChannel<"u"){var Z=new MessageChannel,B=Z.port2;Z.port1.onmessage=D,W=function(){B.postMessage(null)}}else W=function(){m(D,0)};function X(L){b=L,T||(T=!0,W())}function H(L,k){_=m(function(){L(t.unstable_now())},k)}t.unstable_IdlePriority=5,t.unstable_ImmediatePriority=1,t.unstable_LowPriority=4,t.unstable_NormalPriority=3,t.unstable_Profiling=null,t.unstable_UserBlockingPriority=2,t.unstable_cancelCallback=function(L){L.callback=null},t.unstable_continueExecution=function(){g||p||(g=!0,X(w))},t.unstable_forceFrameRate=function(L){0>L||125<L?console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"):A=0<L?Math.floor(1e3/L):5},t.unstable_getCurrentPriorityLevel=function(){return u},t.unstable_getFirstCallbackNode=function(){return n(l)},t.unstable_next=function(L){switch(u){case 1:case 2:case 3:var k=3;break;default:k=u}var Y=u;u=k;try{return L()}finally{u=Y}},t.unstable_pauseExecution=function(){},t.unstable_requestPaint=function(){},t.unstable_runWithPriority=function(L,k){switch(L){case 1:case 2:case 3:case 4:case 5:break;default:L=3}var Y=u;u=L;try{return k()}finally{u=Y}},t.unstable_scheduleCallback=function(L,k,Y){var $=t.unstable_now();switch(typeof Y=="object"&&Y!==null?(Y=Y.delay,Y=typeof Y=="number"&&0<Y?$+Y:$):Y=$,L){case 1:var oe=-1;break;case 2:oe=250;break;case 5:oe=1073741823;break;case 4:oe=1e4;break;default:oe=5e3}return oe=Y+oe,L={id:d++,callback:k,priorityLevel:L,startTime:Y,expirationTime:oe,sortIndex:-1},Y>$?(L.sortIndex=Y,e(c,L),n(l)===null&&L===n(c)&&(M?(f(_),_=-1):M=!0,H(S,Y-$))):(L.sortIndex=oe,e(l,L),g||p||(g=!0,X(w))),L},t.unstable_shouldYield=P,t.unstable_wrapCallback=function(L){var k=u;return function(){var Y=u;u=k;try{return L.apply(this,arguments)}finally{u=Y}}}})(Vm),zm.exports=Vm;var VE=zm.exports;/**
 * @license React
 * react-dom.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var HE=ne,yn=VE;function re(t){for(var e="https://reactjs.org/docs/error-decoder.html?invariant="+t,n=1;n<arguments.length;n++)e+="&args[]="+encodeURIComponent(arguments[n]);return"Minified React error #"+t+"; visit "+e+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}var Hm=new Set,lo={};function br(t,e){ps(t,e),ps(t+"Capture",e)}function ps(t,e){for(lo[t]=e,t=0;t<e.length;t++)Hm.add(e[t])}var Ai=!(typeof window>"u"||typeof window.document>"u"||typeof window.document.createElement>"u"),mf=Object.prototype.hasOwnProperty,GE=/^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/,Gm={},Wm={};function WE(t){return mf.call(Wm,t)?!0:mf.call(Gm,t)?!1:GE.test(t)?Wm[t]=!0:(Gm[t]=!0,!1)}function XE(t,e,n,i){if(n!==null&&n.type===0)return!1;switch(typeof e){case"function":case"symbol":return!0;case"boolean":return i?!1:n!==null?!n.acceptsBooleans:(t=t.toLowerCase().slice(0,5),t!=="data-"&&t!=="aria-");default:return!1}}function YE(t,e,n,i){if(e===null||typeof e>"u"||XE(t,e,n,i))return!0;if(i)return!1;if(n!==null)switch(n.type){case 3:return!e;case 4:return e===!1;case 5:return isNaN(e);case 6:return isNaN(e)||1>e}return!1}function ln(t,e,n,i,r,s,o){this.acceptsBooleans=e===2||e===3||e===4,this.attributeName=i,this.attributeNamespace=r,this.mustUseProperty=n,this.propertyName=t,this.type=e,this.sanitizeURL=s,this.removeEmptyString=o}var Yt={};"children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style".split(" ").forEach(function(t){Yt[t]=new ln(t,0,!1,t,null,!1,!1)}),[["acceptCharset","accept-charset"],["className","class"],["htmlFor","for"],["httpEquiv","http-equiv"]].forEach(function(t){var e=t[0];Yt[e]=new ln(e,1,!1,t[1],null,!1,!1)}),["contentEditable","draggable","spellCheck","value"].forEach(function(t){Yt[t]=new ln(t,2,!1,t.toLowerCase(),null,!1,!1)}),["autoReverse","externalResourcesRequired","focusable","preserveAlpha"].forEach(function(t){Yt[t]=new ln(t,2,!1,t,null,!1,!1)}),"allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope".split(" ").forEach(function(t){Yt[t]=new ln(t,3,!1,t.toLowerCase(),null,!1,!1)}),["checked","multiple","muted","selected"].forEach(function(t){Yt[t]=new ln(t,3,!0,t,null,!1,!1)}),["capture","download"].forEach(function(t){Yt[t]=new ln(t,4,!1,t,null,!1,!1)}),["cols","rows","size","span"].forEach(function(t){Yt[t]=new ln(t,6,!1,t,null,!1,!1)}),["rowSpan","start"].forEach(function(t){Yt[t]=new ln(t,5,!1,t.toLowerCase(),null,!1,!1)});var gf=/[\-:]([a-z])/g;function _f(t){return t[1].toUpperCase()}"accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height".split(" ").forEach(function(t){var e=t.replace(gf,_f);Yt[e]=new ln(e,1,!1,t,null,!1,!1)}),"xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type".split(" ").forEach(function(t){var e=t.replace(gf,_f);Yt[e]=new ln(e,1,!1,t,"http://www.w3.org/1999/xlink",!1,!1)}),["xml:base","xml:lang","xml:space"].forEach(function(t){var e=t.replace(gf,_f);Yt[e]=new ln(e,1,!1,t,"http://www.w3.org/XML/1998/namespace",!1,!1)}),["tabIndex","crossOrigin"].forEach(function(t){Yt[t]=new ln(t,1,!1,t.toLowerCase(),null,!1,!1)}),Yt.xlinkHref=new ln("xlinkHref",1,!1,"xlink:href","http://www.w3.org/1999/xlink",!0,!1),["src","href","action","formAction"].forEach(function(t){Yt[t]=new ln(t,1,!1,t.toLowerCase(),null,!0,!0)});function vf(t,e,n,i){var r=Yt.hasOwnProperty(e)?Yt[e]:null;(r!==null?r.type!==0:i||!(2<e.length)||e[0]!=="o"&&e[0]!=="O"||e[1]!=="n"&&e[1]!=="N")&&(YE(e,n,r,i)&&(n=null),i||r===null?WE(e)&&(n===null?t.removeAttribute(e):t.setAttribute(e,""+n)):r.mustUseProperty?t[r.propertyName]=n===null?r.type===3?!1:"":n:(e=r.attributeName,i=r.attributeNamespace,n===null?t.removeAttribute(e):(r=r.type,n=r===3||r===4&&n===!0?"":""+n,i?t.setAttributeNS(i,e,n):t.setAttribute(e,n))))}var Ri=HE.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,tl=Symbol.for("react.element"),ms=Symbol.for("react.portal"),gs=Symbol.for("react.fragment"),xf=Symbol.for("react.strict_mode"),Sf=Symbol.for("react.profiler"),Xm=Symbol.for("react.provider"),Ym=Symbol.for("react.context"),yf=Symbol.for("react.forward_ref"),Mf=Symbol.for("react.suspense"),Ef=Symbol.for("react.suspense_list"),Tf=Symbol.for("react.memo"),Zi=Symbol.for("react.lazy"),Km=Symbol.for("react.offscreen"),Zm=Symbol.iterator;function co(t){return t===null||typeof t!="object"?null:(t=Zm&&t[Zm]||t["@@iterator"],typeof t=="function"?t:null)}var yt=Object.assign,wf;function uo(t){if(wf===void 0)try{throw Error()}catch(n){var e=n.stack.trim().match(/\n( *(at )?)/);wf=e&&e[1]||""}return`
`+wf+t}var Af=!1;function Rf(t,e){if(!t||Af)return"";Af=!0;var n=Error.prepareStackTrace;Error.prepareStackTrace=void 0;try{if(e)if(e=function(){throw Error()},Object.defineProperty(e.prototype,"props",{set:function(){throw Error()}}),typeof Reflect=="object"&&Reflect.construct){try{Reflect.construct(e,[])}catch(c){var i=c}Reflect.construct(t,[],e)}else{try{e.call()}catch(c){i=c}t.call(e.prototype)}else{try{throw Error()}catch(c){i=c}t()}}catch(c){if(c&&i&&typeof c.stack=="string"){for(var r=c.stack.split(`
`),s=i.stack.split(`
`),o=r.length-1,a=s.length-1;1<=o&&0<=a&&r[o]!==s[a];)a--;for(;1<=o&&0<=a;o--,a--)if(r[o]!==s[a]){if(o!==1||a!==1)do if(o--,a--,0>a||r[o]!==s[a]){var l=`
`+r[o].replace(" at new "," at ");return t.displayName&&l.includes("<anonymous>")&&(l=l.replace("<anonymous>",t.displayName)),l}while(1<=o&&0<=a);break}}}finally{Af=!1,Error.prepareStackTrace=n}return(t=t?t.displayName||t.name:"")?uo(t):""}function KE(t){switch(t.tag){case 5:return uo(t.type);case 16:return uo("Lazy");case 13:return uo("Suspense");case 19:return uo("SuspenseList");case 0:case 2:case 15:return t=Rf(t.type,!1),t;case 11:return t=Rf(t.type.render,!1),t;case 1:return t=Rf(t.type,!0),t;default:return""}}function bf(t){if(t==null)return null;if(typeof t=="function")return t.displayName||t.name||null;if(typeof t=="string")return t;switch(t){case gs:return"Fragment";case ms:return"Portal";case Sf:return"Profiler";case xf:return"StrictMode";case Mf:return"Suspense";case Ef:return"SuspenseList"}if(typeof t=="object")switch(t.$$typeof){case Ym:return(t.displayName||"Context")+".Consumer";case Xm:return(t._context.displayName||"Context")+".Provider";case yf:var e=t.render;return t=t.displayName,t||(t=e.displayName||e.name||"",t=t!==""?"ForwardRef("+t+")":"ForwardRef"),t;case Tf:return e=t.displayName||null,e!==null?e:bf(t.type)||"Memo";case Zi:e=t._payload,t=t._init;try{return bf(t(e))}catch{}}return null}function ZE(t){var e=t.type;switch(t.tag){case 24:return"Cache";case 9:return(e.displayName||"Context")+".Consumer";case 10:return(e._context.displayName||"Context")+".Provider";case 18:return"DehydratedFragment";case 11:return t=e.render,t=t.displayName||t.name||"",e.displayName||(t!==""?"ForwardRef("+t+")":"ForwardRef");case 7:return"Fragment";case 5:return e;case 4:return"Portal";case 3:return"Root";case 6:return"Text";case 16:return bf(e);case 8:return e===xf?"StrictMode":"Mode";case 22:return"Offscreen";case 12:return"Profiler";case 21:return"Scope";case 13:return"Suspense";case 19:return"SuspenseList";case 25:return"TracingMarker";case 1:case 0:case 17:case 2:case 14:case 15:if(typeof e=="function")return e.displayName||e.name||null;if(typeof e=="string")return e}return null}function qi(t){switch(typeof t){case"boolean":case"number":case"string":case"undefined":return t;case"object":return t;default:return""}}function qm(t){var e=t.type;return(t=t.nodeName)&&t.toLowerCase()==="input"&&(e==="checkbox"||e==="radio")}function qE(t){var e=qm(t)?"checked":"value",n=Object.getOwnPropertyDescriptor(t.constructor.prototype,e),i=""+t[e];if(!t.hasOwnProperty(e)&&typeof n<"u"&&typeof n.get=="function"&&typeof n.set=="function"){var r=n.get,s=n.set;return Object.defineProperty(t,e,{configurable:!0,get:function(){return r.call(this)},set:function(o){i=""+o,s.call(this,o)}}),Object.defineProperty(t,e,{enumerable:n.enumerable}),{getValue:function(){return i},setValue:function(o){i=""+o},stopTracking:function(){t._valueTracker=null,delete t[e]}}}}function nl(t){t._valueTracker||(t._valueTracker=qE(t))}function Qm(t){if(!t)return!1;var e=t._valueTracker;if(!e)return!0;var n=e.getValue(),i="";return t&&(i=qm(t)?t.checked?"true":"false":t.value),t=i,t!==n?(e.setValue(t),!0):!1}function il(t){if(t=t||(typeof document<"u"?document:void 0),typeof t>"u")return null;try{return t.activeElement||t.body}catch{return t.body}}function Cf(t,e){var n=e.checked;return yt({},e,{defaultChecked:void 0,defaultValue:void 0,value:void 0,checked:n??t._wrapperState.initialChecked})}function Jm(t,e){var n=e.defaultValue==null?"":e.defaultValue,i=e.checked!=null?e.checked:e.defaultChecked;n=qi(e.value!=null?e.value:n),t._wrapperState={initialChecked:i,initialValue:n,controlled:e.type==="checkbox"||e.type==="radio"?e.checked!=null:e.value!=null}}function jm(t,e){e=e.checked,e!=null&&vf(t,"checked",e,!1)}function Pf(t,e){jm(t,e);var n=qi(e.value),i=e.type;if(n!=null)i==="number"?(n===0&&t.value===""||t.value!=n)&&(t.value=""+n):t.value!==""+n&&(t.value=""+n);else if(i==="submit"||i==="reset"){t.removeAttribute("value");return}e.hasOwnProperty("value")?Lf(t,e.type,n):e.hasOwnProperty("defaultValue")&&Lf(t,e.type,qi(e.defaultValue)),e.checked==null&&e.defaultChecked!=null&&(t.defaultChecked=!!e.defaultChecked)}function $m(t,e,n){if(e.hasOwnProperty("value")||e.hasOwnProperty("defaultValue")){var i=e.type;if(!(i!=="submit"&&i!=="reset"||e.value!==void 0&&e.value!==null))return;e=""+t._wrapperState.initialValue,n||e===t.value||(t.value=e),t.defaultValue=e}n=t.name,n!==""&&(t.name=""),t.defaultChecked=!!t._wrapperState.initialChecked,n!==""&&(t.name=n)}function Lf(t,e,n){(e!=="number"||il(t.ownerDocument)!==t)&&(n==null?t.defaultValue=""+t._wrapperState.initialValue:t.defaultValue!==""+n&&(t.defaultValue=""+n))}var fo=Array.isArray;function _s(t,e,n,i){if(t=t.options,e){e={};for(var r=0;r<n.length;r++)e["$"+n[r]]=!0;for(n=0;n<t.length;n++)r=e.hasOwnProperty("$"+t[n].value),t[n].selected!==r&&(t[n].selected=r),r&&i&&(t[n].defaultSelected=!0)}else{for(n=""+qi(n),e=null,r=0;r<t.length;r++){if(t[r].value===n){t[r].selected=!0,i&&(t[r].defaultSelected=!0);return}e!==null||t[r].disabled||(e=t[r])}e!==null&&(e.selected=!0)}}function Df(t,e){if(e.dangerouslySetInnerHTML!=null)throw Error(re(91));return yt({},e,{value:void 0,defaultValue:void 0,children:""+t._wrapperState.initialValue})}function eg(t,e){var n=e.value;if(n==null){if(n=e.children,e=e.defaultValue,n!=null){if(e!=null)throw Error(re(92));if(fo(n)){if(1<n.length)throw Error(re(93));n=n[0]}e=n}e==null&&(e=""),n=e}t._wrapperState={initialValue:qi(n)}}function tg(t,e){var n=qi(e.value),i=qi(e.defaultValue);n!=null&&(n=""+n,n!==t.value&&(t.value=n),e.defaultValue==null&&t.defaultValue!==n&&(t.defaultValue=n)),i!=null&&(t.defaultValue=""+i)}function ng(t){var e=t.textContent;e===t._wrapperState.initialValue&&e!==""&&e!==null&&(t.value=e)}function ig(t){switch(t){case"svg":return"http://www.w3.org/2000/svg";case"math":return"http://www.w3.org/1998/Math/MathML";default:return"http://www.w3.org/1999/xhtml"}}function If(t,e){return t==null||t==="http://www.w3.org/1999/xhtml"?ig(e):t==="http://www.w3.org/2000/svg"&&e==="foreignObject"?"http://www.w3.org/1999/xhtml":t}var rl,rg=function(t){return typeof MSApp<"u"&&MSApp.execUnsafeLocalFunction?function(e,n,i,r){MSApp.execUnsafeLocalFunction(function(){return t(e,n,i,r)})}:t}(function(t,e){if(t.namespaceURI!=="http://www.w3.org/2000/svg"||"innerHTML"in t)t.innerHTML=e;else{for(rl=rl||document.createElement("div"),rl.innerHTML="<svg>"+e.valueOf().toString()+"</svg>",e=rl.firstChild;t.firstChild;)t.removeChild(t.firstChild);for(;e.firstChild;)t.appendChild(e.firstChild)}});function ho(t,e){if(e){var n=t.firstChild;if(n&&n===t.lastChild&&n.nodeType===3){n.nodeValue=e;return}}t.textContent=e}var po={animationIterationCount:!0,aspectRatio:!0,borderImageOutset:!0,borderImageSlice:!0,borderImageWidth:!0,boxFlex:!0,boxFlexGroup:!0,boxOrdinalGroup:!0,columnCount:!0,columns:!0,flex:!0,flexGrow:!0,flexPositive:!0,flexShrink:!0,flexNegative:!0,flexOrder:!0,gridArea:!0,gridRow:!0,gridRowEnd:!0,gridRowSpan:!0,gridRowStart:!0,gridColumn:!0,gridColumnEnd:!0,gridColumnSpan:!0,gridColumnStart:!0,fontWeight:!0,lineClamp:!0,lineHeight:!0,opacity:!0,order:!0,orphans:!0,tabSize:!0,widows:!0,zIndex:!0,zoom:!0,fillOpacity:!0,floodOpacity:!0,stopOpacity:!0,strokeDasharray:!0,strokeDashoffset:!0,strokeMiterlimit:!0,strokeOpacity:!0,strokeWidth:!0},QE=["Webkit","ms","Moz","O"];Object.keys(po).forEach(function(t){QE.forEach(function(e){e=e+t.charAt(0).toUpperCase()+t.substring(1),po[e]=po[t]})});function sg(t,e,n){return e==null||typeof e=="boolean"||e===""?"":n||typeof e!="number"||e===0||po.hasOwnProperty(t)&&po[t]?(""+e).trim():e+"px"}function og(t,e){t=t.style;for(var n in e)if(e.hasOwnProperty(n)){var i=n.indexOf("--")===0,r=sg(n,e[n],i);n==="float"&&(n="cssFloat"),i?t.setProperty(n,r):t[n]=r}}var JE=yt({menuitem:!0},{area:!0,base:!0,br:!0,col:!0,embed:!0,hr:!0,img:!0,input:!0,keygen:!0,link:!0,meta:!0,param:!0,source:!0,track:!0,wbr:!0});function Nf(t,e){if(e){if(JE[t]&&(e.children!=null||e.dangerouslySetInnerHTML!=null))throw Error(re(137,t));if(e.dangerouslySetInnerHTML!=null){if(e.children!=null)throw Error(re(60));if(typeof e.dangerouslySetInnerHTML!="object"||!("__html"in e.dangerouslySetInnerHTML))throw Error(re(61))}if(e.style!=null&&typeof e.style!="object")throw Error(re(62))}}function Uf(t,e){if(t.indexOf("-")===-1)return typeof e.is=="string";switch(t){case"annotation-xml":case"color-profile":case"font-face":case"font-face-src":case"font-face-uri":case"font-face-format":case"font-face-name":case"missing-glyph":return!1;default:return!0}}var Ff=null;function Of(t){return t=t.target||t.srcElement||window,t.correspondingUseElement&&(t=t.correspondingUseElement),t.nodeType===3?t.parentNode:t}var Bf=null,vs=null,xs=null;function ag(t){if(t=Fo(t)){if(typeof Bf!="function")throw Error(re(280));var e=t.stateNode;e&&(e=Rl(e),Bf(t.stateNode,t.type,e))}}function lg(t){vs?xs?xs.push(t):xs=[t]:vs=t}function cg(){if(vs){var t=vs,e=xs;if(xs=vs=null,ag(t),e)for(t=0;t<e.length;t++)ag(e[t])}}function ug(t,e){return t(e)}function fg(){}var kf=!1;function dg(t,e,n){if(kf)return t(e,n);kf=!0;try{return ug(t,e,n)}finally{kf=!1,(vs!==null||xs!==null)&&(fg(),cg())}}function mo(t,e){var n=t.stateNode;if(n===null)return null;var i=Rl(n);if(i===null)return null;n=i[e];e:switch(e){case"onClick":case"onClickCapture":case"onDoubleClick":case"onDoubleClickCapture":case"onMouseDown":case"onMouseDownCapture":case"onMouseMove":case"onMouseMoveCapture":case"onMouseUp":case"onMouseUpCapture":case"onMouseEnter":(i=!i.disabled)||(t=t.type,i=!(t==="button"||t==="input"||t==="select"||t==="textarea")),t=!i;break e;default:t=!1}if(t)return null;if(n&&typeof n!="function")throw Error(re(231,e,typeof n));return n}var zf=!1;if(Ai)try{var go={};Object.defineProperty(go,"passive",{get:function(){zf=!0}}),window.addEventListener("test",go,go),window.removeEventListener("test",go,go)}catch{zf=!1}function jE(t,e,n,i,r,s,o,a,l){var c=Array.prototype.slice.call(arguments,3);try{e.apply(n,c)}catch(d){this.onError(d)}}var _o=!1,sl=null,ol=!1,Vf=null,$E={onError:function(t){_o=!0,sl=t}};function eT(t,e,n,i,r,s,o,a,l){_o=!1,sl=null,jE.apply($E,arguments)}function tT(t,e,n,i,r,s,o,a,l){if(eT.apply(this,arguments),_o){if(_o){var c=sl;_o=!1,sl=null}else throw Error(re(198));ol||(ol=!0,Vf=c)}}function Cr(t){var e=t,n=t;if(t.alternate)for(;e.return;)e=e.return;else{t=e;do e=t,e.flags&4098&&(n=e.return),t=e.return;while(t)}return e.tag===3?n:null}function hg(t){if(t.tag===13){var e=t.memoizedState;if(e===null&&(t=t.alternate,t!==null&&(e=t.memoizedState)),e!==null)return e.dehydrated}return null}function pg(t){if(Cr(t)!==t)throw Error(re(188))}function nT(t){var e=t.alternate;if(!e){if(e=Cr(t),e===null)throw Error(re(188));return e!==t?null:t}for(var n=t,i=e;;){var r=n.return;if(r===null)break;var s=r.alternate;if(s===null){if(i=r.return,i!==null){n=i;continue}break}if(r.child===s.child){for(s=r.child;s;){if(s===n)return pg(r),t;if(s===i)return pg(r),e;s=s.sibling}throw Error(re(188))}if(n.return!==i.return)n=r,i=s;else{for(var o=!1,a=r.child;a;){if(a===n){o=!0,n=r,i=s;break}if(a===i){o=!0,i=r,n=s;break}a=a.sibling}if(!o){for(a=s.child;a;){if(a===n){o=!0,n=s,i=r;break}if(a===i){o=!0,i=s,n=r;break}a=a.sibling}if(!o)throw Error(re(189))}}if(n.alternate!==i)throw Error(re(190))}if(n.tag!==3)throw Error(re(188));return n.stateNode.current===n?t:e}function mg(t){return t=nT(t),t!==null?gg(t):null}function gg(t){if(t.tag===5||t.tag===6)return t;for(t=t.child;t!==null;){var e=gg(t);if(e!==null)return e;t=t.sibling}return null}var _g=yn.unstable_scheduleCallback,vg=yn.unstable_cancelCallback,iT=yn.unstable_shouldYield,rT=yn.unstable_requestPaint,Ct=yn.unstable_now,sT=yn.unstable_getCurrentPriorityLevel,Hf=yn.unstable_ImmediatePriority,xg=yn.unstable_UserBlockingPriority,al=yn.unstable_NormalPriority,oT=yn.unstable_LowPriority,Sg=yn.unstable_IdlePriority,ll=null,ci=null;function aT(t){if(ci&&typeof ci.onCommitFiberRoot=="function")try{ci.onCommitFiberRoot(ll,t,void 0,(t.current.flags&128)===128)}catch{}}var Yn=Math.clz32?Math.clz32:uT,lT=Math.log,cT=Math.LN2;function uT(t){return t>>>=0,t===0?32:31-(lT(t)/cT|0)|0}var cl=64,ul=4194304;function vo(t){switch(t&-t){case 1:return 1;case 2:return 2;case 4:return 4;case 8:return 8;case 16:return 16;case 32:return 32;case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return t&4194240;case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:return t&130023424;case 134217728:return 134217728;case 268435456:return 268435456;case 536870912:return 536870912;case 1073741824:return 1073741824;default:return t}}function fl(t,e){var n=t.pendingLanes;if(n===0)return 0;var i=0,r=t.suspendedLanes,s=t.pingedLanes,o=n&268435455;if(o!==0){var a=o&~r;a!==0?i=vo(a):(s&=o,s!==0&&(i=vo(s)))}else o=n&~r,o!==0?i=vo(o):s!==0&&(i=vo(s));if(i===0)return 0;if(e!==0&&e!==i&&!(e&r)&&(r=i&-i,s=e&-e,r>=s||r===16&&(s&4194240)!==0))return e;if(i&4&&(i|=n&16),e=t.entangledLanes,e!==0)for(t=t.entanglements,e&=i;0<e;)n=31-Yn(e),r=1<<n,i|=t[n],e&=~r;return i}function fT(t,e){switch(t){case 1:case 2:case 4:return e+250;case 8:case 16:case 32:case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return e+5e3;case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:return-1;case 134217728:case 268435456:case 536870912:case 1073741824:return-1;default:return-1}}function dT(t,e){for(var n=t.suspendedLanes,i=t.pingedLanes,r=t.expirationTimes,s=t.pendingLanes;0<s;){var o=31-Yn(s),a=1<<o,l=r[o];l===-1?(!(a&n)||a&i)&&(r[o]=fT(a,e)):l<=e&&(t.expiredLanes|=a),s&=~a}}function Gf(t){return t=t.pendingLanes&-1073741825,t!==0?t:t&1073741824?1073741824:0}function yg(){var t=cl;return cl<<=1,!(cl&4194240)&&(cl=64),t}function Wf(t){for(var e=[],n=0;31>n;n++)e.push(t);return e}function xo(t,e,n){t.pendingLanes|=e,e!==536870912&&(t.suspendedLanes=0,t.pingedLanes=0),t=t.eventTimes,e=31-Yn(e),t[e]=n}function hT(t,e){var n=t.pendingLanes&~e;t.pendingLanes=e,t.suspendedLanes=0,t.pingedLanes=0,t.expiredLanes&=e,t.mutableReadLanes&=e,t.entangledLanes&=e,e=t.entanglements;var i=t.eventTimes;for(t=t.expirationTimes;0<n;){var r=31-Yn(n),s=1<<r;e[r]=0,i[r]=-1,t[r]=-1,n&=~s}}function Xf(t,e){var n=t.entangledLanes|=e;for(t=t.entanglements;n;){var i=31-Yn(n),r=1<<i;r&e|t[i]&e&&(t[i]|=e),n&=~r}}var at=0;function Mg(t){return t&=-t,1<t?4<t?t&268435455?16:536870912:4:1}var Eg,Yf,Tg,wg,Ag,Kf=!1,dl=[],Qi=null,Ji=null,ji=null,So=new Map,yo=new Map,$i=[],pT="mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset submit".split(" ");function Rg(t,e){switch(t){case"focusin":case"focusout":Qi=null;break;case"dragenter":case"dragleave":Ji=null;break;case"mouseover":case"mouseout":ji=null;break;case"pointerover":case"pointerout":So.delete(e.pointerId);break;case"gotpointercapture":case"lostpointercapture":yo.delete(e.pointerId)}}function Mo(t,e,n,i,r,s){return t===null||t.nativeEvent!==s?(t={blockedOn:e,domEventName:n,eventSystemFlags:i,nativeEvent:s,targetContainers:[r]},e!==null&&(e=Fo(e),e!==null&&Yf(e)),t):(t.eventSystemFlags|=i,e=t.targetContainers,r!==null&&e.indexOf(r)===-1&&e.push(r),t)}function mT(t,e,n,i,r){switch(e){case"focusin":return Qi=Mo(Qi,t,e,n,i,r),!0;case"dragenter":return Ji=Mo(Ji,t,e,n,i,r),!0;case"mouseover":return ji=Mo(ji,t,e,n,i,r),!0;case"pointerover":var s=r.pointerId;return So.set(s,Mo(So.get(s)||null,t,e,n,i,r)),!0;case"gotpointercapture":return s=r.pointerId,yo.set(s,Mo(yo.get(s)||null,t,e,n,i,r)),!0}return!1}function bg(t){var e=Pr(t.target);if(e!==null){var n=Cr(e);if(n!==null){if(e=n.tag,e===13){if(e=hg(n),e!==null){t.blockedOn=e,Ag(t.priority,function(){Tg(n)});return}}else if(e===3&&n.stateNode.current.memoizedState.isDehydrated){t.blockedOn=n.tag===3?n.stateNode.containerInfo:null;return}}}t.blockedOn=null}function hl(t){if(t.blockedOn!==null)return!1;for(var e=t.targetContainers;0<e.length;){var n=qf(t.domEventName,t.eventSystemFlags,e[0],t.nativeEvent);if(n===null){n=t.nativeEvent;var i=new n.constructor(n.type,n);Ff=i,n.target.dispatchEvent(i),Ff=null}else return e=Fo(n),e!==null&&Yf(e),t.blockedOn=n,!1;e.shift()}return!0}function Cg(t,e,n){hl(t)&&n.delete(e)}function gT(){Kf=!1,Qi!==null&&hl(Qi)&&(Qi=null),Ji!==null&&hl(Ji)&&(Ji=null),ji!==null&&hl(ji)&&(ji=null),So.forEach(Cg),yo.forEach(Cg)}function Eo(t,e){t.blockedOn===e&&(t.blockedOn=null,Kf||(Kf=!0,yn.unstable_scheduleCallback(yn.unstable_NormalPriority,gT)))}function To(t){function e(r){return Eo(r,t)}if(0<dl.length){Eo(dl[0],t);for(var n=1;n<dl.length;n++){var i=dl[n];i.blockedOn===t&&(i.blockedOn=null)}}for(Qi!==null&&Eo(Qi,t),Ji!==null&&Eo(Ji,t),ji!==null&&Eo(ji,t),So.forEach(e),yo.forEach(e),n=0;n<$i.length;n++)i=$i[n],i.blockedOn===t&&(i.blockedOn=null);for(;0<$i.length&&(n=$i[0],n.blockedOn===null);)bg(n),n.blockedOn===null&&$i.shift()}var Ss=Ri.ReactCurrentBatchConfig,pl=!0;function _T(t,e,n,i){var r=at,s=Ss.transition;Ss.transition=null;try{at=1,Zf(t,e,n,i)}finally{at=r,Ss.transition=s}}function vT(t,e,n,i){var r=at,s=Ss.transition;Ss.transition=null;try{at=4,Zf(t,e,n,i)}finally{at=r,Ss.transition=s}}function Zf(t,e,n,i){if(pl){var r=qf(t,e,n,i);if(r===null)dd(t,e,i,ml,n),Rg(t,i);else if(mT(r,t,e,n,i))i.stopPropagation();else if(Rg(t,i),e&4&&-1<pT.indexOf(t)){for(;r!==null;){var s=Fo(r);if(s!==null&&Eg(s),s=qf(t,e,n,i),s===null&&dd(t,e,i,ml,n),s===r)break;r=s}r!==null&&i.stopPropagation()}else dd(t,e,i,null,n)}}var ml=null;function qf(t,e,n,i){if(ml=null,t=Of(i),t=Pr(t),t!==null)if(e=Cr(t),e===null)t=null;else if(n=e.tag,n===13){if(t=hg(e),t!==null)return t;t=null}else if(n===3){if(e.stateNode.current.memoizedState.isDehydrated)return e.tag===3?e.stateNode.containerInfo:null;t=null}else e!==t&&(t=null);return ml=t,null}function Pg(t){switch(t){case"cancel":case"click":case"close":case"contextmenu":case"copy":case"cut":case"auxclick":case"dblclick":case"dragend":case"dragstart":case"drop":case"focusin":case"focusout":case"input":case"invalid":case"keydown":case"keypress":case"keyup":case"mousedown":case"mouseup":case"paste":case"pause":case"play":case"pointercancel":case"pointerdown":case"pointerup":case"ratechange":case"reset":case"resize":case"seeked":case"submit":case"touchcancel":case"touchend":case"touchstart":case"volumechange":case"change":case"selectionchange":case"textInput":case"compositionstart":case"compositionend":case"compositionupdate":case"beforeblur":case"afterblur":case"beforeinput":case"blur":case"fullscreenchange":case"focus":case"hashchange":case"popstate":case"select":case"selectstart":return 1;case"drag":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"mousemove":case"mouseout":case"mouseover":case"pointermove":case"pointerout":case"pointerover":case"scroll":case"toggle":case"touchmove":case"wheel":case"mouseenter":case"mouseleave":case"pointerenter":case"pointerleave":return 4;case"message":switch(sT()){case Hf:return 1;case xg:return 4;case al:case oT:return 16;case Sg:return 536870912;default:return 16}default:return 16}}var er=null,Qf=null,gl=null;function Lg(){if(gl)return gl;var t,e=Qf,n=e.length,i,r="value"in er?er.value:er.textContent,s=r.length;for(t=0;t<n&&e[t]===r[t];t++);var o=n-t;for(i=1;i<=o&&e[n-i]===r[s-i];i++);return gl=r.slice(t,1<i?1-i:void 0)}function _l(t){var e=t.keyCode;return"charCode"in t?(t=t.charCode,t===0&&e===13&&(t=13)):t=e,t===10&&(t=13),32<=t||t===13?t:0}function vl(){return!0}function Dg(){return!1}function Mn(t){function e(n,i,r,s,o){this._reactName=n,this._targetInst=r,this.type=i,this.nativeEvent=s,this.target=o,this.currentTarget=null;for(var a in t)t.hasOwnProperty(a)&&(n=t[a],this[a]=n?n(s):s[a]);return this.isDefaultPrevented=(s.defaultPrevented!=null?s.defaultPrevented:s.returnValue===!1)?vl:Dg,this.isPropagationStopped=Dg,this}return yt(e.prototype,{preventDefault:function(){this.defaultPrevented=!0;var n=this.nativeEvent;n&&(n.preventDefault?n.preventDefault():typeof n.returnValue!="unknown"&&(n.returnValue=!1),this.isDefaultPrevented=vl)},stopPropagation:function(){var n=this.nativeEvent;n&&(n.stopPropagation?n.stopPropagation():typeof n.cancelBubble!="unknown"&&(n.cancelBubble=!0),this.isPropagationStopped=vl)},persist:function(){},isPersistent:vl}),e}var ys={eventPhase:0,bubbles:0,cancelable:0,timeStamp:function(t){return t.timeStamp||Date.now()},defaultPrevented:0,isTrusted:0},Jf=Mn(ys),wo=yt({},ys,{view:0,detail:0}),xT=Mn(wo),jf,$f,Ao,xl=yt({},wo,{screenX:0,screenY:0,clientX:0,clientY:0,pageX:0,pageY:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,getModifierState:td,button:0,buttons:0,relatedTarget:function(t){return t.relatedTarget===void 0?t.fromElement===t.srcElement?t.toElement:t.fromElement:t.relatedTarget},movementX:function(t){return"movementX"in t?t.movementX:(t!==Ao&&(Ao&&t.type==="mousemove"?(jf=t.screenX-Ao.screenX,$f=t.screenY-Ao.screenY):$f=jf=0,Ao=t),jf)},movementY:function(t){return"movementY"in t?t.movementY:$f}}),Ig=Mn(xl),ST=yt({},xl,{dataTransfer:0}),yT=Mn(ST),MT=yt({},wo,{relatedTarget:0}),ed=Mn(MT),ET=yt({},ys,{animationName:0,elapsedTime:0,pseudoElement:0}),TT=Mn(ET),wT=yt({},ys,{clipboardData:function(t){return"clipboardData"in t?t.clipboardData:window.clipboardData}}),AT=Mn(wT),RT=yt({},ys,{data:0}),Ng=Mn(RT),bT={Esc:"Escape",Spacebar:" ",Left:"ArrowLeft",Up:"ArrowUp",Right:"ArrowRight",Down:"ArrowDown",Del:"Delete",Win:"OS",Menu:"ContextMenu",Apps:"ContextMenu",Scroll:"ScrollLock",MozPrintableKey:"Unidentified"},CT={8:"Backspace",9:"Tab",12:"Clear",13:"Enter",16:"Shift",17:"Control",18:"Alt",19:"Pause",20:"CapsLock",27:"Escape",32:" ",33:"PageUp",34:"PageDown",35:"End",36:"Home",37:"ArrowLeft",38:"ArrowUp",39:"ArrowRight",40:"ArrowDown",45:"Insert",46:"Delete",112:"F1",113:"F2",114:"F3",115:"F4",116:"F5",117:"F6",118:"F7",119:"F8",120:"F9",121:"F10",122:"F11",123:"F12",144:"NumLock",145:"ScrollLock",224:"Meta"},PT={Alt:"altKey",Control:"ctrlKey",Meta:"metaKey",Shift:"shiftKey"};function LT(t){var e=this.nativeEvent;return e.getModifierState?e.getModifierState(t):(t=PT[t])?!!e[t]:!1}function td(){return LT}var DT=yt({},wo,{key:function(t){if(t.key){var e=bT[t.key]||t.key;if(e!=="Unidentified")return e}return t.type==="keypress"?(t=_l(t),t===13?"Enter":String.fromCharCode(t)):t.type==="keydown"||t.type==="keyup"?CT[t.keyCode]||"Unidentified":""},code:0,location:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,repeat:0,locale:0,getModifierState:td,charCode:function(t){return t.type==="keypress"?_l(t):0},keyCode:function(t){return t.type==="keydown"||t.type==="keyup"?t.keyCode:0},which:function(t){return t.type==="keypress"?_l(t):t.type==="keydown"||t.type==="keyup"?t.keyCode:0}}),IT=Mn(DT),NT=yt({},xl,{pointerId:0,width:0,height:0,pressure:0,tangentialPressure:0,tiltX:0,tiltY:0,twist:0,pointerType:0,isPrimary:0}),Ug=Mn(NT),UT=yt({},wo,{touches:0,targetTouches:0,changedTouches:0,altKey:0,metaKey:0,ctrlKey:0,shiftKey:0,getModifierState:td}),FT=Mn(UT),OT=yt({},ys,{propertyName:0,elapsedTime:0,pseudoElement:0}),BT=Mn(OT),kT=yt({},xl,{deltaX:function(t){return"deltaX"in t?t.deltaX:"wheelDeltaX"in t?-t.wheelDeltaX:0},deltaY:function(t){return"deltaY"in t?t.deltaY:"wheelDeltaY"in t?-t.wheelDeltaY:"wheelDelta"in t?-t.wheelDelta:0},deltaZ:0,deltaMode:0}),zT=Mn(kT),VT=[9,13,27,32],nd=Ai&&"CompositionEvent"in window,Ro=null;Ai&&"documentMode"in document&&(Ro=document.documentMode);var HT=Ai&&"TextEvent"in window&&!Ro,Fg=Ai&&(!nd||Ro&&8<Ro&&11>=Ro),Og=" ",Bg=!1;function kg(t,e){switch(t){case"keyup":return VT.indexOf(e.keyCode)!==-1;case"keydown":return e.keyCode!==229;case"keypress":case"mousedown":case"focusout":return!0;default:return!1}}function zg(t){return t=t.detail,typeof t=="object"&&"data"in t?t.data:null}var Ms=!1;function GT(t,e){switch(t){case"compositionend":return zg(e);case"keypress":return e.which!==32?null:(Bg=!0,Og);case"textInput":return t=e.data,t===Og&&Bg?null:t;default:return null}}function WT(t,e){if(Ms)return t==="compositionend"||!nd&&kg(t,e)?(t=Lg(),gl=Qf=er=null,Ms=!1,t):null;switch(t){case"paste":return null;case"keypress":if(!(e.ctrlKey||e.altKey||e.metaKey)||e.ctrlKey&&e.altKey){if(e.char&&1<e.char.length)return e.char;if(e.which)return String.fromCharCode(e.which)}return null;case"compositionend":return Fg&&e.locale!=="ko"?null:e.data;default:return null}}var XT={color:!0,date:!0,datetime:!0,"datetime-local":!0,email:!0,month:!0,number:!0,password:!0,range:!0,search:!0,tel:!0,text:!0,time:!0,url:!0,week:!0};function Vg(t){var e=t&&t.nodeName&&t.nodeName.toLowerCase();return e==="input"?!!XT[t.type]:e==="textarea"}function Hg(t,e,n,i){lg(i),e=Tl(e,"onChange"),0<e.length&&(n=new Jf("onChange","change",null,n,i),t.push({event:n,listeners:e}))}var bo=null,Co=null;function YT(t){o0(t,0)}function Sl(t){var e=Rs(t);if(Qm(e))return t}function KT(t,e){if(t==="change")return e}var Gg=!1;if(Ai){var id;if(Ai){var rd="oninput"in document;if(!rd){var Wg=document.createElement("div");Wg.setAttribute("oninput","return;"),rd=typeof Wg.oninput=="function"}id=rd}else id=!1;Gg=id&&(!document.documentMode||9<document.documentMode)}function Xg(){bo&&(bo.detachEvent("onpropertychange",Yg),Co=bo=null)}function Yg(t){if(t.propertyName==="value"&&Sl(Co)){var e=[];Hg(e,Co,t,Of(t)),dg(YT,e)}}function ZT(t,e,n){t==="focusin"?(Xg(),bo=e,Co=n,bo.attachEvent("onpropertychange",Yg)):t==="focusout"&&Xg()}function qT(t){if(t==="selectionchange"||t==="keyup"||t==="keydown")return Sl(Co)}function QT(t,e){if(t==="click")return Sl(e)}function JT(t,e){if(t==="input"||t==="change")return Sl(e)}function jT(t,e){return t===e&&(t!==0||1/t===1/e)||t!==t&&e!==e}var Kn=typeof Object.is=="function"?Object.is:jT;function Po(t,e){if(Kn(t,e))return!0;if(typeof t!="object"||t===null||typeof e!="object"||e===null)return!1;var n=Object.keys(t),i=Object.keys(e);if(n.length!==i.length)return!1;for(i=0;i<n.length;i++){var r=n[i];if(!mf.call(e,r)||!Kn(t[r],e[r]))return!1}return!0}function Kg(t){for(;t&&t.firstChild;)t=t.firstChild;return t}function Zg(t,e){var n=Kg(t);t=0;for(var i;n;){if(n.nodeType===3){if(i=t+n.textContent.length,t<=e&&i>=e)return{node:n,offset:e-t};t=i}e:{for(;n;){if(n.nextSibling){n=n.nextSibling;break e}n=n.parentNode}n=void 0}n=Kg(n)}}function qg(t,e){return t&&e?t===e?!0:t&&t.nodeType===3?!1:e&&e.nodeType===3?qg(t,e.parentNode):"contains"in t?t.contains(e):t.compareDocumentPosition?!!(t.compareDocumentPosition(e)&16):!1:!1}function Qg(){for(var t=window,e=il();e instanceof t.HTMLIFrameElement;){try{var n=typeof e.contentWindow.location.href=="string"}catch{n=!1}if(n)t=e.contentWindow;else break;e=il(t.document)}return e}function sd(t){var e=t&&t.nodeName&&t.nodeName.toLowerCase();return e&&(e==="input"&&(t.type==="text"||t.type==="search"||t.type==="tel"||t.type==="url"||t.type==="password")||e==="textarea"||t.contentEditable==="true")}function $T(t){var e=Qg(),n=t.focusedElem,i=t.selectionRange;if(e!==n&&n&&n.ownerDocument&&qg(n.ownerDocument.documentElement,n)){if(i!==null&&sd(n)){if(e=i.start,t=i.end,t===void 0&&(t=e),"selectionStart"in n)n.selectionStart=e,n.selectionEnd=Math.min(t,n.value.length);else if(t=(e=n.ownerDocument||document)&&e.defaultView||window,t.getSelection){t=t.getSelection();var r=n.textContent.length,s=Math.min(i.start,r);i=i.end===void 0?s:Math.min(i.end,r),!t.extend&&s>i&&(r=i,i=s,s=r),r=Zg(n,s);var o=Zg(n,i);r&&o&&(t.rangeCount!==1||t.anchorNode!==r.node||t.anchorOffset!==r.offset||t.focusNode!==o.node||t.focusOffset!==o.offset)&&(e=e.createRange(),e.setStart(r.node,r.offset),t.removeAllRanges(),s>i?(t.addRange(e),t.extend(o.node,o.offset)):(e.setEnd(o.node,o.offset),t.addRange(e)))}}for(e=[],t=n;t=t.parentNode;)t.nodeType===1&&e.push({element:t,left:t.scrollLeft,top:t.scrollTop});for(typeof n.focus=="function"&&n.focus(),n=0;n<e.length;n++)t=e[n],t.element.scrollLeft=t.left,t.element.scrollTop=t.top}}var ew=Ai&&"documentMode"in document&&11>=document.documentMode,Es=null,od=null,Lo=null,ad=!1;function Jg(t,e,n){var i=n.window===n?n.document:n.nodeType===9?n:n.ownerDocument;ad||Es==null||Es!==il(i)||(i=Es,"selectionStart"in i&&sd(i)?i={start:i.selectionStart,end:i.selectionEnd}:(i=(i.ownerDocument&&i.ownerDocument.defaultView||window).getSelection(),i={anchorNode:i.anchorNode,anchorOffset:i.anchorOffset,focusNode:i.focusNode,focusOffset:i.focusOffset}),Lo&&Po(Lo,i)||(Lo=i,i=Tl(od,"onSelect"),0<i.length&&(e=new Jf("onSelect","select",null,e,n),t.push({event:e,listeners:i}),e.target=Es)))}function yl(t,e){var n={};return n[t.toLowerCase()]=e.toLowerCase(),n["Webkit"+t]="webkit"+e,n["Moz"+t]="moz"+e,n}var Ts={animationend:yl("Animation","AnimationEnd"),animationiteration:yl("Animation","AnimationIteration"),animationstart:yl("Animation","AnimationStart"),transitionend:yl("Transition","TransitionEnd")},ld={},jg={};Ai&&(jg=document.createElement("div").style,"AnimationEvent"in window||(delete Ts.animationend.animation,delete Ts.animationiteration.animation,delete Ts.animationstart.animation),"TransitionEvent"in window||delete Ts.transitionend.transition);function Ml(t){if(ld[t])return ld[t];if(!Ts[t])return t;var e=Ts[t],n;for(n in e)if(e.hasOwnProperty(n)&&n in jg)return ld[t]=e[n];return t}var $g=Ml("animationend"),e0=Ml("animationiteration"),t0=Ml("animationstart"),n0=Ml("transitionend"),i0=new Map,r0="abort auxClick cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");function tr(t,e){i0.set(t,e),br(e,[t])}for(var cd=0;cd<r0.length;cd++){var ud=r0[cd],tw=ud.toLowerCase(),nw=ud[0].toUpperCase()+ud.slice(1);tr(tw,"on"+nw)}tr($g,"onAnimationEnd"),tr(e0,"onAnimationIteration"),tr(t0,"onAnimationStart"),tr("dblclick","onDoubleClick"),tr("focusin","onFocus"),tr("focusout","onBlur"),tr(n0,"onTransitionEnd"),ps("onMouseEnter",["mouseout","mouseover"]),ps("onMouseLeave",["mouseout","mouseover"]),ps("onPointerEnter",["pointerout","pointerover"]),ps("onPointerLeave",["pointerout","pointerover"]),br("onChange","change click focusin focusout input keydown keyup selectionchange".split(" ")),br("onSelect","focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" ")),br("onBeforeInput",["compositionend","keypress","textInput","paste"]),br("onCompositionEnd","compositionend focusout keydown keypress keyup mousedown".split(" ")),br("onCompositionStart","compositionstart focusout keydown keypress keyup mousedown".split(" ")),br("onCompositionUpdate","compositionupdate focusout keydown keypress keyup mousedown".split(" "));var Do="abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "),iw=new Set("cancel close invalid load scroll toggle".split(" ").concat(Do));function s0(t,e,n){var i=t.type||"unknown-event";t.currentTarget=n,tT(i,e,void 0,t),t.currentTarget=null}function o0(t,e){e=(e&4)!==0;for(var n=0;n<t.length;n++){var i=t[n],r=i.event;i=i.listeners;e:{var s=void 0;if(e)for(var o=i.length-1;0<=o;o--){var a=i[o],l=a.instance,c=a.currentTarget;if(a=a.listener,l!==s&&r.isPropagationStopped())break e;s0(r,a,c),s=l}else for(o=0;o<i.length;o++){if(a=i[o],l=a.instance,c=a.currentTarget,a=a.listener,l!==s&&r.isPropagationStopped())break e;s0(r,a,c),s=l}}}if(ol)throw t=Vf,ol=!1,Vf=null,t}function gt(t,e){var n=e[vd];n===void 0&&(n=e[vd]=new Set);var i=t+"__bubble";n.has(i)||(a0(e,t,2,!1),n.add(i))}function fd(t,e,n){var i=0;e&&(i|=4),a0(n,t,i,e)}var El="_reactListening"+Math.random().toString(36).slice(2);function Io(t){if(!t[El]){t[El]=!0,Hm.forEach(function(n){n!=="selectionchange"&&(iw.has(n)||fd(n,!1,t),fd(n,!0,t))});var e=t.nodeType===9?t:t.ownerDocument;e===null||e[El]||(e[El]=!0,fd("selectionchange",!1,e))}}function a0(t,e,n,i){switch(Pg(e)){case 1:var r=_T;break;case 4:r=vT;break;default:r=Zf}n=r.bind(null,e,n,t),r=void 0,!zf||e!=="touchstart"&&e!=="touchmove"&&e!=="wheel"||(r=!0),i?r!==void 0?t.addEventListener(e,n,{capture:!0,passive:r}):t.addEventListener(e,n,!0):r!==void 0?t.addEventListener(e,n,{passive:r}):t.addEventListener(e,n,!1)}function dd(t,e,n,i,r){var s=i;if(!(e&1)&&!(e&2)&&i!==null)e:for(;;){if(i===null)return;var o=i.tag;if(o===3||o===4){var a=i.stateNode.containerInfo;if(a===r||a.nodeType===8&&a.parentNode===r)break;if(o===4)for(o=i.return;o!==null;){var l=o.tag;if((l===3||l===4)&&(l=o.stateNode.containerInfo,l===r||l.nodeType===8&&l.parentNode===r))return;o=o.return}for(;a!==null;){if(o=Pr(a),o===null)return;if(l=o.tag,l===5||l===6){i=s=o;continue e}a=a.parentNode}}i=i.return}dg(function(){var c=s,d=Of(n),h=[];e:{var u=i0.get(t);if(u!==void 0){var p=Jf,g=t;switch(t){case"keypress":if(_l(n)===0)break e;case"keydown":case"keyup":p=IT;break;case"focusin":g="focus",p=ed;break;case"focusout":g="blur",p=ed;break;case"beforeblur":case"afterblur":p=ed;break;case"click":if(n.button===2)break e;case"auxclick":case"dblclick":case"mousedown":case"mousemove":case"mouseup":case"mouseout":case"mouseover":case"contextmenu":p=Ig;break;case"drag":case"dragend":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"dragstart":case"drop":p=yT;break;case"touchcancel":case"touchend":case"touchmove":case"touchstart":p=FT;break;case $g:case e0:case t0:p=TT;break;case n0:p=BT;break;case"scroll":p=xT;break;case"wheel":p=zT;break;case"copy":case"cut":case"paste":p=AT;break;case"gotpointercapture":case"lostpointercapture":case"pointercancel":case"pointerdown":case"pointermove":case"pointerout":case"pointerover":case"pointerup":p=Ug}var M=(e&4)!==0,m=!M&&t==="scroll",f=M?u!==null?u+"Capture":null:u;M=[];for(var x=c,y;x!==null;){y=x;var S=y.stateNode;if(y.tag===5&&S!==null&&(y=S,f!==null&&(S=mo(x,f),S!=null&&M.push(No(x,S,y)))),m)break;x=x.return}0<M.length&&(u=new p(u,g,null,n,d),h.push({event:u,listeners:M}))}}if(!(e&7)){e:{if(u=t==="mouseover"||t==="pointerover",p=t==="mouseout"||t==="pointerout",u&&n!==Ff&&(g=n.relatedTarget||n.fromElement)&&(Pr(g)||g[bi]))break e;if((p||u)&&(u=d.window===d?d:(u=d.ownerDocument)?u.defaultView||u.parentWindow:window,p?(g=n.relatedTarget||n.toElement,p=c,g=g?Pr(g):null,g!==null&&(m=Cr(g),g!==m||g.tag!==5&&g.tag!==6)&&(g=null)):(p=null,g=c),p!==g)){if(M=Ig,S="onMouseLeave",f="onMouseEnter",x="mouse",(t==="pointerout"||t==="pointerover")&&(M=Ug,S="onPointerLeave",f="onPointerEnter",x="pointer"),m=p==null?u:Rs(p),y=g==null?u:Rs(g),u=new M(S,x+"leave",p,n,d),u.target=m,u.relatedTarget=y,S=null,Pr(d)===c&&(M=new M(f,x+"enter",g,n,d),M.target=y,M.relatedTarget=m,S=M),m=S,p&&g)t:{for(M=p,f=g,x=0,y=M;y;y=ws(y))x++;for(y=0,S=f;S;S=ws(S))y++;for(;0<x-y;)M=ws(M),x--;for(;0<y-x;)f=ws(f),y--;for(;x--;){if(M===f||f!==null&&M===f.alternate)break t;M=ws(M),f=ws(f)}M=null}else M=null;p!==null&&l0(h,u,p,M,!1),g!==null&&m!==null&&l0(h,m,g,M,!0)}}e:{if(u=c?Rs(c):window,p=u.nodeName&&u.nodeName.toLowerCase(),p==="select"||p==="input"&&u.type==="file")var w=KT;else if(Vg(u))if(Gg)w=JT;else{w=qT;var T=ZT}else(p=u.nodeName)&&p.toLowerCase()==="input"&&(u.type==="checkbox"||u.type==="radio")&&(w=QT);if(w&&(w=w(t,c))){Hg(h,w,n,d);break e}T&&T(t,u,c),t==="focusout"&&(T=u._wrapperState)&&T.controlled&&u.type==="number"&&Lf(u,"number",u.value)}switch(T=c?Rs(c):window,t){case"focusin":(Vg(T)||T.contentEditable==="true")&&(Es=T,od=c,Lo=null);break;case"focusout":Lo=od=Es=null;break;case"mousedown":ad=!0;break;case"contextmenu":case"mouseup":case"dragend":ad=!1,Jg(h,n,d);break;case"selectionchange":if(ew)break;case"keydown":case"keyup":Jg(h,n,d)}var b;if(nd)e:{switch(t){case"compositionstart":var _="onCompositionStart";break e;case"compositionend":_="onCompositionEnd";break e;case"compositionupdate":_="onCompositionUpdate";break e}_=void 0}else Ms?kg(t,n)&&(_="onCompositionEnd"):t==="keydown"&&n.keyCode===229&&(_="onCompositionStart");_&&(Fg&&n.locale!=="ko"&&(Ms||_!=="onCompositionStart"?_==="onCompositionEnd"&&Ms&&(b=Lg()):(er=d,Qf="value"in er?er.value:er.textContent,Ms=!0)),T=Tl(c,_),0<T.length&&(_=new Ng(_,t,null,n,d),h.push({event:_,listeners:T}),b?_.data=b:(b=zg(n),b!==null&&(_.data=b)))),(b=HT?GT(t,n):WT(t,n))&&(c=Tl(c,"onBeforeInput"),0<c.length&&(d=new Ng("onBeforeInput","beforeinput",null,n,d),h.push({event:d,listeners:c}),d.data=b))}o0(h,e)})}function No(t,e,n){return{instance:t,listener:e,currentTarget:n}}function Tl(t,e){for(var n=e+"Capture",i=[];t!==null;){var r=t,s=r.stateNode;r.tag===5&&s!==null&&(r=s,s=mo(t,n),s!=null&&i.unshift(No(t,s,r)),s=mo(t,e),s!=null&&i.push(No(t,s,r))),t=t.return}return i}function ws(t){if(t===null)return null;do t=t.return;while(t&&t.tag!==5);return t||null}function l0(t,e,n,i,r){for(var s=e._reactName,o=[];n!==null&&n!==i;){var a=n,l=a.alternate,c=a.stateNode;if(l!==null&&l===i)break;a.tag===5&&c!==null&&(a=c,r?(l=mo(n,s),l!=null&&o.unshift(No(n,l,a))):r||(l=mo(n,s),l!=null&&o.push(No(n,l,a)))),n=n.return}o.length!==0&&t.push({event:e,listeners:o})}var rw=/\r\n?/g,sw=/\u0000|\uFFFD/g;function c0(t){return(typeof t=="string"?t:""+t).replace(rw,`
`).replace(sw,"")}function wl(t,e,n){if(e=c0(e),c0(t)!==e&&n)throw Error(re(425))}function Al(){}var hd=null,pd=null;function md(t,e){return t==="textarea"||t==="noscript"||typeof e.children=="string"||typeof e.children=="number"||typeof e.dangerouslySetInnerHTML=="object"&&e.dangerouslySetInnerHTML!==null&&e.dangerouslySetInnerHTML.__html!=null}var gd=typeof setTimeout=="function"?setTimeout:void 0,ow=typeof clearTimeout=="function"?clearTimeout:void 0,u0=typeof Promise=="function"?Promise:void 0,aw=typeof queueMicrotask=="function"?queueMicrotask:typeof u0<"u"?function(t){return u0.resolve(null).then(t).catch(lw)}:gd;function lw(t){setTimeout(function(){throw t})}function _d(t,e){var n=e,i=0;do{var r=n.nextSibling;if(t.removeChild(n),r&&r.nodeType===8)if(n=r.data,n==="/$"){if(i===0){t.removeChild(r),To(e);return}i--}else n!=="$"&&n!=="$?"&&n!=="$!"||i++;n=r}while(n);To(e)}function nr(t){for(;t!=null;t=t.nextSibling){var e=t.nodeType;if(e===1||e===3)break;if(e===8){if(e=t.data,e==="$"||e==="$!"||e==="$?")break;if(e==="/$")return null}}return t}function f0(t){t=t.previousSibling;for(var e=0;t;){if(t.nodeType===8){var n=t.data;if(n==="$"||n==="$!"||n==="$?"){if(e===0)return t;e--}else n==="/$"&&e++}t=t.previousSibling}return null}var As=Math.random().toString(36).slice(2),ui="__reactFiber$"+As,Uo="__reactProps$"+As,bi="__reactContainer$"+As,vd="__reactEvents$"+As,cw="__reactListeners$"+As,uw="__reactHandles$"+As;function Pr(t){var e=t[ui];if(e)return e;for(var n=t.parentNode;n;){if(e=n[bi]||n[ui]){if(n=e.alternate,e.child!==null||n!==null&&n.child!==null)for(t=f0(t);t!==null;){if(n=t[ui])return n;t=f0(t)}return e}t=n,n=t.parentNode}return null}function Fo(t){return t=t[ui]||t[bi],!t||t.tag!==5&&t.tag!==6&&t.tag!==13&&t.tag!==3?null:t}function Rs(t){if(t.tag===5||t.tag===6)return t.stateNode;throw Error(re(33))}function Rl(t){return t[Uo]||null}var xd=[],bs=-1;function ir(t){return{current:t}}function _t(t){0>bs||(t.current=xd[bs],xd[bs]=null,bs--)}function ht(t,e){bs++,xd[bs]=t.current,t.current=e}var rr={},jt=ir(rr),pn=ir(!1),Lr=rr;function Cs(t,e){var n=t.type.contextTypes;if(!n)return rr;var i=t.stateNode;if(i&&i.__reactInternalMemoizedUnmaskedChildContext===e)return i.__reactInternalMemoizedMaskedChildContext;var r={},s;for(s in n)r[s]=e[s];return i&&(t=t.stateNode,t.__reactInternalMemoizedUnmaskedChildContext=e,t.__reactInternalMemoizedMaskedChildContext=r),r}function mn(t){return t=t.childContextTypes,t!=null}function bl(){_t(pn),_t(jt)}function d0(t,e,n){if(jt.current!==rr)throw Error(re(168));ht(jt,e),ht(pn,n)}function h0(t,e,n){var i=t.stateNode;if(e=e.childContextTypes,typeof i.getChildContext!="function")return n;i=i.getChildContext();for(var r in i)if(!(r in e))throw Error(re(108,ZE(t)||"Unknown",r));return yt({},n,i)}function Cl(t){return t=(t=t.stateNode)&&t.__reactInternalMemoizedMergedChildContext||rr,Lr=jt.current,ht(jt,t),ht(pn,pn.current),!0}function p0(t,e,n){var i=t.stateNode;if(!i)throw Error(re(169));n?(t=h0(t,e,Lr),i.__reactInternalMemoizedMergedChildContext=t,_t(pn),_t(jt),ht(jt,t)):_t(pn),ht(pn,n)}var Ci=null,Pl=!1,Sd=!1;function m0(t){Ci===null?Ci=[t]:Ci.push(t)}function fw(t){Pl=!0,m0(t)}function sr(){if(!Sd&&Ci!==null){Sd=!0;var t=0,e=at;try{var n=Ci;for(at=1;t<n.length;t++){var i=n[t];do i=i(!0);while(i!==null)}Ci=null,Pl=!1}catch(r){throw Ci!==null&&(Ci=Ci.slice(t+1)),_g(Hf,sr),r}finally{at=e,Sd=!1}}return null}var Ps=[],Ls=0,Ll=null,Dl=0,Nn=[],Un=0,Dr=null,Pi=1,Li="";function Ir(t,e){Ps[Ls++]=Dl,Ps[Ls++]=Ll,Ll=t,Dl=e}function g0(t,e,n){Nn[Un++]=Pi,Nn[Un++]=Li,Nn[Un++]=Dr,Dr=t;var i=Pi;t=Li;var r=32-Yn(i)-1;i&=~(1<<r),n+=1;var s=32-Yn(e)+r;if(30<s){var o=r-r%5;s=(i&(1<<o)-1).toString(32),i>>=o,r-=o,Pi=1<<32-Yn(e)+r|n<<r|i,Li=s+t}else Pi=1<<s|n<<r|i,Li=t}function yd(t){t.return!==null&&(Ir(t,1),g0(t,1,0))}function Md(t){for(;t===Ll;)Ll=Ps[--Ls],Ps[Ls]=null,Dl=Ps[--Ls],Ps[Ls]=null;for(;t===Dr;)Dr=Nn[--Un],Nn[Un]=null,Li=Nn[--Un],Nn[Un]=null,Pi=Nn[--Un],Nn[Un]=null}var En=null,Tn=null,xt=!1,Zn=null;function _0(t,e){var n=kn(5,null,null,0);n.elementType="DELETED",n.stateNode=e,n.return=t,e=t.deletions,e===null?(t.deletions=[n],t.flags|=16):e.push(n)}function v0(t,e){switch(t.tag){case 5:var n=t.type;return e=e.nodeType!==1||n.toLowerCase()!==e.nodeName.toLowerCase()?null:e,e!==null?(t.stateNode=e,En=t,Tn=nr(e.firstChild),!0):!1;case 6:return e=t.pendingProps===""||e.nodeType!==3?null:e,e!==null?(t.stateNode=e,En=t,Tn=null,!0):!1;case 13:return e=e.nodeType!==8?null:e,e!==null?(n=Dr!==null?{id:Pi,overflow:Li}:null,t.memoizedState={dehydrated:e,treeContext:n,retryLane:1073741824},n=kn(18,null,null,0),n.stateNode=e,n.return=t,t.child=n,En=t,Tn=null,!0):!1;default:return!1}}function Ed(t){return(t.mode&1)!==0&&(t.flags&128)===0}function Td(t){if(xt){var e=Tn;if(e){var n=e;if(!v0(t,e)){if(Ed(t))throw Error(re(418));e=nr(n.nextSibling);var i=En;e&&v0(t,e)?_0(i,n):(t.flags=t.flags&-4097|2,xt=!1,En=t)}}else{if(Ed(t))throw Error(re(418));t.flags=t.flags&-4097|2,xt=!1,En=t}}}function x0(t){for(t=t.return;t!==null&&t.tag!==5&&t.tag!==3&&t.tag!==13;)t=t.return;En=t}function Il(t){if(t!==En)return!1;if(!xt)return x0(t),xt=!0,!1;var e;if((e=t.tag!==3)&&!(e=t.tag!==5)&&(e=t.type,e=e!=="head"&&e!=="body"&&!md(t.type,t.memoizedProps)),e&&(e=Tn)){if(Ed(t))throw S0(),Error(re(418));for(;e;)_0(t,e),e=nr(e.nextSibling)}if(x0(t),t.tag===13){if(t=t.memoizedState,t=t!==null?t.dehydrated:null,!t)throw Error(re(317));e:{for(t=t.nextSibling,e=0;t;){if(t.nodeType===8){var n=t.data;if(n==="/$"){if(e===0){Tn=nr(t.nextSibling);break e}e--}else n!=="$"&&n!=="$!"&&n!=="$?"||e++}t=t.nextSibling}Tn=null}}else Tn=En?nr(t.stateNode.nextSibling):null;return!0}function S0(){for(var t=Tn;t;)t=nr(t.nextSibling)}function Ds(){Tn=En=null,xt=!1}function wd(t){Zn===null?Zn=[t]:Zn.push(t)}var dw=Ri.ReactCurrentBatchConfig;function Oo(t,e,n){if(t=n.ref,t!==null&&typeof t!="function"&&typeof t!="object"){if(n._owner){if(n=n._owner,n){if(n.tag!==1)throw Error(re(309));var i=n.stateNode}if(!i)throw Error(re(147,t));var r=i,s=""+t;return e!==null&&e.ref!==null&&typeof e.ref=="function"&&e.ref._stringRef===s?e.ref:(e=function(o){var a=r.refs;o===null?delete a[s]:a[s]=o},e._stringRef=s,e)}if(typeof t!="string")throw Error(re(284));if(!n._owner)throw Error(re(290,t))}return t}function Nl(t,e){throw t=Object.prototype.toString.call(e),Error(re(31,t==="[object Object]"?"object with keys {"+Object.keys(e).join(", ")+"}":t))}function y0(t){var e=t._init;return e(t._payload)}function M0(t){function e(f,x){if(t){var y=f.deletions;y===null?(f.deletions=[x],f.flags|=16):y.push(x)}}function n(f,x){if(!t)return null;for(;x!==null;)e(f,x),x=x.sibling;return null}function i(f,x){for(f=new Map;x!==null;)x.key!==null?f.set(x.key,x):f.set(x.index,x),x=x.sibling;return f}function r(f,x){return f=hr(f,x),f.index=0,f.sibling=null,f}function s(f,x,y){return f.index=y,t?(y=f.alternate,y!==null?(y=y.index,y<x?(f.flags|=2,x):y):(f.flags|=2,x)):(f.flags|=1048576,x)}function o(f){return t&&f.alternate===null&&(f.flags|=2),f}function a(f,x,y,S){return x===null||x.tag!==6?(x=gh(y,f.mode,S),x.return=f,x):(x=r(x,y),x.return=f,x)}function l(f,x,y,S){var w=y.type;return w===gs?d(f,x,y.props.children,S,y.key):x!==null&&(x.elementType===w||typeof w=="object"&&w!==null&&w.$$typeof===Zi&&y0(w)===x.type)?(S=r(x,y.props),S.ref=Oo(f,x,y),S.return=f,S):(S=rc(y.type,y.key,y.props,null,f.mode,S),S.ref=Oo(f,x,y),S.return=f,S)}function c(f,x,y,S){return x===null||x.tag!==4||x.stateNode.containerInfo!==y.containerInfo||x.stateNode.implementation!==y.implementation?(x=_h(y,f.mode,S),x.return=f,x):(x=r(x,y.children||[]),x.return=f,x)}function d(f,x,y,S,w){return x===null||x.tag!==7?(x=Vr(y,f.mode,S,w),x.return=f,x):(x=r(x,y),x.return=f,x)}function h(f,x,y){if(typeof x=="string"&&x!==""||typeof x=="number")return x=gh(""+x,f.mode,y),x.return=f,x;if(typeof x=="object"&&x!==null){switch(x.$$typeof){case tl:return y=rc(x.type,x.key,x.props,null,f.mode,y),y.ref=Oo(f,null,x),y.return=f,y;case ms:return x=_h(x,f.mode,y),x.return=f,x;case Zi:var S=x._init;return h(f,S(x._payload),y)}if(fo(x)||co(x))return x=Vr(x,f.mode,y,null),x.return=f,x;Nl(f,x)}return null}function u(f,x,y,S){var w=x!==null?x.key:null;if(typeof y=="string"&&y!==""||typeof y=="number")return w!==null?null:a(f,x,""+y,S);if(typeof y=="object"&&y!==null){switch(y.$$typeof){case tl:return y.key===w?l(f,x,y,S):null;case ms:return y.key===w?c(f,x,y,S):null;case Zi:return w=y._init,u(f,x,w(y._payload),S)}if(fo(y)||co(y))return w!==null?null:d(f,x,y,S,null);Nl(f,y)}return null}function p(f,x,y,S,w){if(typeof S=="string"&&S!==""||typeof S=="number")return f=f.get(y)||null,a(x,f,""+S,w);if(typeof S=="object"&&S!==null){switch(S.$$typeof){case tl:return f=f.get(S.key===null?y:S.key)||null,l(x,f,S,w);case ms:return f=f.get(S.key===null?y:S.key)||null,c(x,f,S,w);case Zi:var T=S._init;return p(f,x,y,T(S._payload),w)}if(fo(S)||co(S))return f=f.get(y)||null,d(x,f,S,w,null);Nl(x,S)}return null}function g(f,x,y,S){for(var w=null,T=null,b=x,_=x=0,A=null;b!==null&&_<y.length;_++){b.index>_?(A=b,b=null):A=b.sibling;var C=u(f,b,y[_],S);if(C===null){b===null&&(b=A);break}t&&b&&C.alternate===null&&e(f,b),x=s(C,x,_),T===null?w=C:T.sibling=C,T=C,b=A}if(_===y.length)return n(f,b),xt&&Ir(f,_),w;if(b===null){for(;_<y.length;_++)b=h(f,y[_],S),b!==null&&(x=s(b,x,_),T===null?w=b:T.sibling=b,T=b);return xt&&Ir(f,_),w}for(b=i(f,b);_<y.length;_++)A=p(b,f,_,y[_],S),A!==null&&(t&&A.alternate!==null&&b.delete(A.key===null?_:A.key),x=s(A,x,_),T===null?w=A:T.sibling=A,T=A);return t&&b.forEach(function(P){return e(f,P)}),xt&&Ir(f,_),w}function M(f,x,y,S){var w=co(y);if(typeof w!="function")throw Error(re(150));if(y=w.call(y),y==null)throw Error(re(151));for(var T=w=null,b=x,_=x=0,A=null,C=y.next();b!==null&&!C.done;_++,C=y.next()){b.index>_?(A=b,b=null):A=b.sibling;var P=u(f,b,C.value,S);if(P===null){b===null&&(b=A);break}t&&b&&P.alternate===null&&e(f,b),x=s(P,x,_),T===null?w=P:T.sibling=P,T=P,b=A}if(C.done)return n(f,b),xt&&Ir(f,_),w;if(b===null){for(;!C.done;_++,C=y.next())C=h(f,C.value,S),C!==null&&(x=s(C,x,_),T===null?w=C:T.sibling=C,T=C);return xt&&Ir(f,_),w}for(b=i(f,b);!C.done;_++,C=y.next())C=p(b,f,_,C.value,S),C!==null&&(t&&C.alternate!==null&&b.delete(C.key===null?_:C.key),x=s(C,x,_),T===null?w=C:T.sibling=C,T=C);return t&&b.forEach(function(D){return e(f,D)}),xt&&Ir(f,_),w}function m(f,x,y,S){if(typeof y=="object"&&y!==null&&y.type===gs&&y.key===null&&(y=y.props.children),typeof y=="object"&&y!==null){switch(y.$$typeof){case tl:e:{for(var w=y.key,T=x;T!==null;){if(T.key===w){if(w=y.type,w===gs){if(T.tag===7){n(f,T.sibling),x=r(T,y.props.children),x.return=f,f=x;break e}}else if(T.elementType===w||typeof w=="object"&&w!==null&&w.$$typeof===Zi&&y0(w)===T.type){n(f,T.sibling),x=r(T,y.props),x.ref=Oo(f,T,y),x.return=f,f=x;break e}n(f,T);break}else e(f,T);T=T.sibling}y.type===gs?(x=Vr(y.props.children,f.mode,S,y.key),x.return=f,f=x):(S=rc(y.type,y.key,y.props,null,f.mode,S),S.ref=Oo(f,x,y),S.return=f,f=S)}return o(f);case ms:e:{for(T=y.key;x!==null;){if(x.key===T)if(x.tag===4&&x.stateNode.containerInfo===y.containerInfo&&x.stateNode.implementation===y.implementation){n(f,x.sibling),x=r(x,y.children||[]),x.return=f,f=x;break e}else{n(f,x);break}else e(f,x);x=x.sibling}x=_h(y,f.mode,S),x.return=f,f=x}return o(f);case Zi:return T=y._init,m(f,x,T(y._payload),S)}if(fo(y))return g(f,x,y,S);if(co(y))return M(f,x,y,S);Nl(f,y)}return typeof y=="string"&&y!==""||typeof y=="number"?(y=""+y,x!==null&&x.tag===6?(n(f,x.sibling),x=r(x,y),x.return=f,f=x):(n(f,x),x=gh(y,f.mode,S),x.return=f,f=x),o(f)):n(f,x)}return m}var Is=M0(!0),E0=M0(!1),Ul=ir(null),Fl=null,Ns=null,Ad=null;function Rd(){Ad=Ns=Fl=null}function bd(t){var e=Ul.current;_t(Ul),t._currentValue=e}function Cd(t,e,n){for(;t!==null;){var i=t.alternate;if((t.childLanes&e)!==e?(t.childLanes|=e,i!==null&&(i.childLanes|=e)):i!==null&&(i.childLanes&e)!==e&&(i.childLanes|=e),t===n)break;t=t.return}}function Us(t,e){Fl=t,Ad=Ns=null,t=t.dependencies,t!==null&&t.firstContext!==null&&(t.lanes&e&&(gn=!0),t.firstContext=null)}function Fn(t){var e=t._currentValue;if(Ad!==t)if(t={context:t,memoizedValue:e,next:null},Ns===null){if(Fl===null)throw Error(re(308));Ns=t,Fl.dependencies={lanes:0,firstContext:t}}else Ns=Ns.next=t;return e}var Nr=null;function Pd(t){Nr===null?Nr=[t]:Nr.push(t)}function T0(t,e,n,i){var r=e.interleaved;return r===null?(n.next=n,Pd(e)):(n.next=r.next,r.next=n),e.interleaved=n,Di(t,i)}function Di(t,e){t.lanes|=e;var n=t.alternate;for(n!==null&&(n.lanes|=e),n=t,t=t.return;t!==null;)t.childLanes|=e,n=t.alternate,n!==null&&(n.childLanes|=e),n=t,t=t.return;return n.tag===3?n.stateNode:null}var or=!1;function Ld(t){t.updateQueue={baseState:t.memoizedState,firstBaseUpdate:null,lastBaseUpdate:null,shared:{pending:null,interleaved:null,lanes:0},effects:null}}function w0(t,e){t=t.updateQueue,e.updateQueue===t&&(e.updateQueue={baseState:t.baseState,firstBaseUpdate:t.firstBaseUpdate,lastBaseUpdate:t.lastBaseUpdate,shared:t.shared,effects:t.effects})}function Ii(t,e){return{eventTime:t,lane:e,tag:0,payload:null,callback:null,next:null}}function ar(t,e,n){var i=t.updateQueue;if(i===null)return null;if(i=i.shared,nt&2){var r=i.pending;return r===null?e.next=e:(e.next=r.next,r.next=e),i.pending=e,Di(t,n)}return r=i.interleaved,r===null?(e.next=e,Pd(i)):(e.next=r.next,r.next=e),i.interleaved=e,Di(t,n)}function Ol(t,e,n){if(e=e.updateQueue,e!==null&&(e=e.shared,(n&4194240)!==0)){var i=e.lanes;i&=t.pendingLanes,n|=i,e.lanes=n,Xf(t,n)}}function A0(t,e){var n=t.updateQueue,i=t.alternate;if(i!==null&&(i=i.updateQueue,n===i)){var r=null,s=null;if(n=n.firstBaseUpdate,n!==null){do{var o={eventTime:n.eventTime,lane:n.lane,tag:n.tag,payload:n.payload,callback:n.callback,next:null};s===null?r=s=o:s=s.next=o,n=n.next}while(n!==null);s===null?r=s=e:s=s.next=e}else r=s=e;n={baseState:i.baseState,firstBaseUpdate:r,lastBaseUpdate:s,shared:i.shared,effects:i.effects},t.updateQueue=n;return}t=n.lastBaseUpdate,t===null?n.firstBaseUpdate=e:t.next=e,n.lastBaseUpdate=e}function Bl(t,e,n,i){var r=t.updateQueue;or=!1;var s=r.firstBaseUpdate,o=r.lastBaseUpdate,a=r.shared.pending;if(a!==null){r.shared.pending=null;var l=a,c=l.next;l.next=null,o===null?s=c:o.next=c,o=l;var d=t.alternate;d!==null&&(d=d.updateQueue,a=d.lastBaseUpdate,a!==o&&(a===null?d.firstBaseUpdate=c:a.next=c,d.lastBaseUpdate=l))}if(s!==null){var h=r.baseState;o=0,d=c=l=null,a=s;do{var u=a.lane,p=a.eventTime;if((i&u)===u){d!==null&&(d=d.next={eventTime:p,lane:0,tag:a.tag,payload:a.payload,callback:a.callback,next:null});e:{var g=t,M=a;switch(u=e,p=n,M.tag){case 1:if(g=M.payload,typeof g=="function"){h=g.call(p,h,u);break e}h=g;break e;case 3:g.flags=g.flags&-65537|128;case 0:if(g=M.payload,u=typeof g=="function"?g.call(p,h,u):g,u==null)break e;h=yt({},h,u);break e;case 2:or=!0}}a.callback!==null&&a.lane!==0&&(t.flags|=64,u=r.effects,u===null?r.effects=[a]:u.push(a))}else p={eventTime:p,lane:u,tag:a.tag,payload:a.payload,callback:a.callback,next:null},d===null?(c=d=p,l=h):d=d.next=p,o|=u;if(a=a.next,a===null){if(a=r.shared.pending,a===null)break;u=a,a=u.next,u.next=null,r.lastBaseUpdate=u,r.shared.pending=null}}while(!0);if(d===null&&(l=h),r.baseState=l,r.firstBaseUpdate=c,r.lastBaseUpdate=d,e=r.shared.interleaved,e!==null){r=e;do o|=r.lane,r=r.next;while(r!==e)}else s===null&&(r.shared.lanes=0);Or|=o,t.lanes=o,t.memoizedState=h}}function R0(t,e,n){if(t=e.effects,e.effects=null,t!==null)for(e=0;e<t.length;e++){var i=t[e],r=i.callback;if(r!==null){if(i.callback=null,i=n,typeof r!="function")throw Error(re(191,r));r.call(i)}}}var Bo={},fi=ir(Bo),ko=ir(Bo),zo=ir(Bo);function Ur(t){if(t===Bo)throw Error(re(174));return t}function Dd(t,e){switch(ht(zo,e),ht(ko,t),ht(fi,Bo),t=e.nodeType,t){case 9:case 11:e=(e=e.documentElement)?e.namespaceURI:If(null,"");break;default:t=t===8?e.parentNode:e,e=t.namespaceURI||null,t=t.tagName,e=If(e,t)}_t(fi),ht(fi,e)}function Fs(){_t(fi),_t(ko),_t(zo)}function b0(t){Ur(zo.current);var e=Ur(fi.current),n=If(e,t.type);e!==n&&(ht(ko,t),ht(fi,n))}function Id(t){ko.current===t&&(_t(fi),_t(ko))}var Mt=ir(0);function kl(t){for(var e=t;e!==null;){if(e.tag===13){var n=e.memoizedState;if(n!==null&&(n=n.dehydrated,n===null||n.data==="$?"||n.data==="$!"))return e}else if(e.tag===19&&e.memoizedProps.revealOrder!==void 0){if(e.flags&128)return e}else if(e.child!==null){e.child.return=e,e=e.child;continue}if(e===t)break;for(;e.sibling===null;){if(e.return===null||e.return===t)return null;e=e.return}e.sibling.return=e.return,e=e.sibling}return null}var Nd=[];function Ud(){for(var t=0;t<Nd.length;t++)Nd[t]._workInProgressVersionPrimary=null;Nd.length=0}var zl=Ri.ReactCurrentDispatcher,Fd=Ri.ReactCurrentBatchConfig,Fr=0,Et=null,kt=null,Ht=null,Vl=!1,Vo=!1,Ho=0,hw=0;function $t(){throw Error(re(321))}function Od(t,e){if(e===null)return!1;for(var n=0;n<e.length&&n<t.length;n++)if(!Kn(t[n],e[n]))return!1;return!0}function Bd(t,e,n,i,r,s){if(Fr=s,Et=e,e.memoizedState=null,e.updateQueue=null,e.lanes=0,zl.current=t===null||t.memoizedState===null?_w:vw,t=n(i,r),Vo){s=0;do{if(Vo=!1,Ho=0,25<=s)throw Error(re(301));s+=1,Ht=kt=null,e.updateQueue=null,zl.current=xw,t=n(i,r)}while(Vo)}if(zl.current=Wl,e=kt!==null&&kt.next!==null,Fr=0,Ht=kt=Et=null,Vl=!1,e)throw Error(re(300));return t}function kd(){var t=Ho!==0;return Ho=0,t}function di(){var t={memoizedState:null,baseState:null,baseQueue:null,queue:null,next:null};return Ht===null?Et.memoizedState=Ht=t:Ht=Ht.next=t,Ht}function On(){if(kt===null){var t=Et.alternate;t=t!==null?t.memoizedState:null}else t=kt.next;var e=Ht===null?Et.memoizedState:Ht.next;if(e!==null)Ht=e,kt=t;else{if(t===null)throw Error(re(310));kt=t,t={memoizedState:kt.memoizedState,baseState:kt.baseState,baseQueue:kt.baseQueue,queue:kt.queue,next:null},Ht===null?Et.memoizedState=Ht=t:Ht=Ht.next=t}return Ht}function Go(t,e){return typeof e=="function"?e(t):e}function zd(t){var e=On(),n=e.queue;if(n===null)throw Error(re(311));n.lastRenderedReducer=t;var i=kt,r=i.baseQueue,s=n.pending;if(s!==null){if(r!==null){var o=r.next;r.next=s.next,s.next=o}i.baseQueue=r=s,n.pending=null}if(r!==null){s=r.next,i=i.baseState;var a=o=null,l=null,c=s;do{var d=c.lane;if((Fr&d)===d)l!==null&&(l=l.next={lane:0,action:c.action,hasEagerState:c.hasEagerState,eagerState:c.eagerState,next:null}),i=c.hasEagerState?c.eagerState:t(i,c.action);else{var h={lane:d,action:c.action,hasEagerState:c.hasEagerState,eagerState:c.eagerState,next:null};l===null?(a=l=h,o=i):l=l.next=h,Et.lanes|=d,Or|=d}c=c.next}while(c!==null&&c!==s);l===null?o=i:l.next=a,Kn(i,e.memoizedState)||(gn=!0),e.memoizedState=i,e.baseState=o,e.baseQueue=l,n.lastRenderedState=i}if(t=n.interleaved,t!==null){r=t;do s=r.lane,Et.lanes|=s,Or|=s,r=r.next;while(r!==t)}else r===null&&(n.lanes=0);return[e.memoizedState,n.dispatch]}function Vd(t){var e=On(),n=e.queue;if(n===null)throw Error(re(311));n.lastRenderedReducer=t;var i=n.dispatch,r=n.pending,s=e.memoizedState;if(r!==null){n.pending=null;var o=r=r.next;do s=t(s,o.action),o=o.next;while(o!==r);Kn(s,e.memoizedState)||(gn=!0),e.memoizedState=s,e.baseQueue===null&&(e.baseState=s),n.lastRenderedState=s}return[s,i]}function C0(){}function P0(t,e){var n=Et,i=On(),r=e(),s=!Kn(i.memoizedState,r);if(s&&(i.memoizedState=r,gn=!0),i=i.queue,Hd(I0.bind(null,n,i,t),[t]),i.getSnapshot!==e||s||Ht!==null&&Ht.memoizedState.tag&1){if(n.flags|=2048,Wo(9,D0.bind(null,n,i,r,e),void 0,null),Gt===null)throw Error(re(349));Fr&30||L0(n,e,r)}return r}function L0(t,e,n){t.flags|=16384,t={getSnapshot:e,value:n},e=Et.updateQueue,e===null?(e={lastEffect:null,stores:null},Et.updateQueue=e,e.stores=[t]):(n=e.stores,n===null?e.stores=[t]:n.push(t))}function D0(t,e,n,i){e.value=n,e.getSnapshot=i,N0(e)&&U0(t)}function I0(t,e,n){return n(function(){N0(e)&&U0(t)})}function N0(t){var e=t.getSnapshot;t=t.value;try{var n=e();return!Kn(t,n)}catch{return!0}}function U0(t){var e=Di(t,1);e!==null&&jn(e,t,1,-1)}function F0(t){var e=di();return typeof t=="function"&&(t=t()),e.memoizedState=e.baseState=t,t={pending:null,interleaved:null,lanes:0,dispatch:null,lastRenderedReducer:Go,lastRenderedState:t},e.queue=t,t=t.dispatch=gw.bind(null,Et,t),[e.memoizedState,t]}function Wo(t,e,n,i){return t={tag:t,create:e,destroy:n,deps:i,next:null},e=Et.updateQueue,e===null?(e={lastEffect:null,stores:null},Et.updateQueue=e,e.lastEffect=t.next=t):(n=e.lastEffect,n===null?e.lastEffect=t.next=t:(i=n.next,n.next=t,t.next=i,e.lastEffect=t)),t}function O0(){return On().memoizedState}function Hl(t,e,n,i){var r=di();Et.flags|=t,r.memoizedState=Wo(1|e,n,void 0,i===void 0?null:i)}function Gl(t,e,n,i){var r=On();i=i===void 0?null:i;var s=void 0;if(kt!==null){var o=kt.memoizedState;if(s=o.destroy,i!==null&&Od(i,o.deps)){r.memoizedState=Wo(e,n,s,i);return}}Et.flags|=t,r.memoizedState=Wo(1|e,n,s,i)}function B0(t,e){return Hl(8390656,8,t,e)}function Hd(t,e){return Gl(2048,8,t,e)}function k0(t,e){return Gl(4,2,t,e)}function z0(t,e){return Gl(4,4,t,e)}function V0(t,e){if(typeof e=="function")return t=t(),e(t),function(){e(null)};if(e!=null)return t=t(),e.current=t,function(){e.current=null}}function H0(t,e,n){return n=n!=null?n.concat([t]):null,Gl(4,4,V0.bind(null,e,t),n)}function Gd(){}function G0(t,e){var n=On();e=e===void 0?null:e;var i=n.memoizedState;return i!==null&&e!==null&&Od(e,i[1])?i[0]:(n.memoizedState=[t,e],t)}function W0(t,e){var n=On();e=e===void 0?null:e;var i=n.memoizedState;return i!==null&&e!==null&&Od(e,i[1])?i[0]:(t=t(),n.memoizedState=[t,e],t)}function X0(t,e,n){return Fr&21?(Kn(n,e)||(n=yg(),Et.lanes|=n,Or|=n,t.baseState=!0),e):(t.baseState&&(t.baseState=!1,gn=!0),t.memoizedState=n)}function pw(t,e){var n=at;at=n!==0&&4>n?n:4,t(!0);var i=Fd.transition;Fd.transition={};try{t(!1),e()}finally{at=n,Fd.transition=i}}function Y0(){return On().memoizedState}function mw(t,e,n){var i=fr(t);if(n={lane:i,action:n,hasEagerState:!1,eagerState:null,next:null},K0(t))Z0(e,n);else if(n=T0(t,e,n,i),n!==null){var r=un();jn(n,t,i,r),q0(n,e,i)}}function gw(t,e,n){var i=fr(t),r={lane:i,action:n,hasEagerState:!1,eagerState:null,next:null};if(K0(t))Z0(e,r);else{var s=t.alternate;if(t.lanes===0&&(s===null||s.lanes===0)&&(s=e.lastRenderedReducer,s!==null))try{var o=e.lastRenderedState,a=s(o,n);if(r.hasEagerState=!0,r.eagerState=a,Kn(a,o)){var l=e.interleaved;l===null?(r.next=r,Pd(e)):(r.next=l.next,l.next=r),e.interleaved=r;return}}catch{}finally{}n=T0(t,e,r,i),n!==null&&(r=un(),jn(n,t,i,r),q0(n,e,i))}}function K0(t){var e=t.alternate;return t===Et||e!==null&&e===Et}function Z0(t,e){Vo=Vl=!0;var n=t.pending;n===null?e.next=e:(e.next=n.next,n.next=e),t.pending=e}function q0(t,e,n){if(n&4194240){var i=e.lanes;i&=t.pendingLanes,n|=i,e.lanes=n,Xf(t,n)}}var Wl={readContext:Fn,useCallback:$t,useContext:$t,useEffect:$t,useImperativeHandle:$t,useInsertionEffect:$t,useLayoutEffect:$t,useMemo:$t,useReducer:$t,useRef:$t,useState:$t,useDebugValue:$t,useDeferredValue:$t,useTransition:$t,useMutableSource:$t,useSyncExternalStore:$t,useId:$t,unstable_isNewReconciler:!1},_w={readContext:Fn,useCallback:function(t,e){return di().memoizedState=[t,e===void 0?null:e],t},useContext:Fn,useEffect:B0,useImperativeHandle:function(t,e,n){return n=n!=null?n.concat([t]):null,Hl(4194308,4,V0.bind(null,e,t),n)},useLayoutEffect:function(t,e){return Hl(4194308,4,t,e)},useInsertionEffect:function(t,e){return Hl(4,2,t,e)},useMemo:function(t,e){var n=di();return e=e===void 0?null:e,t=t(),n.memoizedState=[t,e],t},useReducer:function(t,e,n){var i=di();return e=n!==void 0?n(e):e,i.memoizedState=i.baseState=e,t={pending:null,interleaved:null,lanes:0,dispatch:null,lastRenderedReducer:t,lastRenderedState:e},i.queue=t,t=t.dispatch=mw.bind(null,Et,t),[i.memoizedState,t]},useRef:function(t){var e=di();return t={current:t},e.memoizedState=t},useState:F0,useDebugValue:Gd,useDeferredValue:function(t){return di().memoizedState=t},useTransition:function(){var t=F0(!1),e=t[0];return t=pw.bind(null,t[1]),di().memoizedState=t,[e,t]},useMutableSource:function(){},useSyncExternalStore:function(t,e,n){var i=Et,r=di();if(xt){if(n===void 0)throw Error(re(407));n=n()}else{if(n=e(),Gt===null)throw Error(re(349));Fr&30||L0(i,e,n)}r.memoizedState=n;var s={value:n,getSnapshot:e};return r.queue=s,B0(I0.bind(null,i,s,t),[t]),i.flags|=2048,Wo(9,D0.bind(null,i,s,n,e),void 0,null),n},useId:function(){var t=di(),e=Gt.identifierPrefix;if(xt){var n=Li,i=Pi;n=(i&~(1<<32-Yn(i)-1)).toString(32)+n,e=":"+e+"R"+n,n=Ho++,0<n&&(e+="H"+n.toString(32)),e+=":"}else n=hw++,e=":"+e+"r"+n.toString(32)+":";return t.memoizedState=e},unstable_isNewReconciler:!1},vw={readContext:Fn,useCallback:G0,useContext:Fn,useEffect:Hd,useImperativeHandle:H0,useInsertionEffect:k0,useLayoutEffect:z0,useMemo:W0,useReducer:zd,useRef:O0,useState:function(){return zd(Go)},useDebugValue:Gd,useDeferredValue:function(t){var e=On();return X0(e,kt.memoizedState,t)},useTransition:function(){var t=zd(Go)[0],e=On().memoizedState;return[t,e]},useMutableSource:C0,useSyncExternalStore:P0,useId:Y0,unstable_isNewReconciler:!1},xw={readContext:Fn,useCallback:G0,useContext:Fn,useEffect:Hd,useImperativeHandle:H0,useInsertionEffect:k0,useLayoutEffect:z0,useMemo:W0,useReducer:Vd,useRef:O0,useState:function(){return Vd(Go)},useDebugValue:Gd,useDeferredValue:function(t){var e=On();return kt===null?e.memoizedState=t:X0(e,kt.memoizedState,t)},useTransition:function(){var t=Vd(Go)[0],e=On().memoizedState;return[t,e]},useMutableSource:C0,useSyncExternalStore:P0,useId:Y0,unstable_isNewReconciler:!1};function qn(t,e){if(t&&t.defaultProps){e=yt({},e),t=t.defaultProps;for(var n in t)e[n]===void 0&&(e[n]=t[n]);return e}return e}function Wd(t,e,n,i){e=t.memoizedState,n=n(i,e),n=n==null?e:yt({},e,n),t.memoizedState=n,t.lanes===0&&(t.updateQueue.baseState=n)}var Xl={isMounted:function(t){return(t=t._reactInternals)?Cr(t)===t:!1},enqueueSetState:function(t,e,n){t=t._reactInternals;var i=un(),r=fr(t),s=Ii(i,r);s.payload=e,n!=null&&(s.callback=n),e=ar(t,s,r),e!==null&&(jn(e,t,r,i),Ol(e,t,r))},enqueueReplaceState:function(t,e,n){t=t._reactInternals;var i=un(),r=fr(t),s=Ii(i,r);s.tag=1,s.payload=e,n!=null&&(s.callback=n),e=ar(t,s,r),e!==null&&(jn(e,t,r,i),Ol(e,t,r))},enqueueForceUpdate:function(t,e){t=t._reactInternals;var n=un(),i=fr(t),r=Ii(n,i);r.tag=2,e!=null&&(r.callback=e),e=ar(t,r,i),e!==null&&(jn(e,t,i,n),Ol(e,t,i))}};function Q0(t,e,n,i,r,s,o){return t=t.stateNode,typeof t.shouldComponentUpdate=="function"?t.shouldComponentUpdate(i,s,o):e.prototype&&e.prototype.isPureReactComponent?!Po(n,i)||!Po(r,s):!0}function J0(t,e,n){var i=!1,r=rr,s=e.contextType;return typeof s=="object"&&s!==null?s=Fn(s):(r=mn(e)?Lr:jt.current,i=e.contextTypes,s=(i=i!=null)?Cs(t,r):rr),e=new e(n,s),t.memoizedState=e.state!==null&&e.state!==void 0?e.state:null,e.updater=Xl,t.stateNode=e,e._reactInternals=t,i&&(t=t.stateNode,t.__reactInternalMemoizedUnmaskedChildContext=r,t.__reactInternalMemoizedMaskedChildContext=s),e}function j0(t,e,n,i){t=e.state,typeof e.componentWillReceiveProps=="function"&&e.componentWillReceiveProps(n,i),typeof e.UNSAFE_componentWillReceiveProps=="function"&&e.UNSAFE_componentWillReceiveProps(n,i),e.state!==t&&Xl.enqueueReplaceState(e,e.state,null)}function Xd(t,e,n,i){var r=t.stateNode;r.props=n,r.state=t.memoizedState,r.refs={},Ld(t);var s=e.contextType;typeof s=="object"&&s!==null?r.context=Fn(s):(s=mn(e)?Lr:jt.current,r.context=Cs(t,s)),r.state=t.memoizedState,s=e.getDerivedStateFromProps,typeof s=="function"&&(Wd(t,e,s,n),r.state=t.memoizedState),typeof e.getDerivedStateFromProps=="function"||typeof r.getSnapshotBeforeUpdate=="function"||typeof r.UNSAFE_componentWillMount!="function"&&typeof r.componentWillMount!="function"||(e=r.state,typeof r.componentWillMount=="function"&&r.componentWillMount(),typeof r.UNSAFE_componentWillMount=="function"&&r.UNSAFE_componentWillMount(),e!==r.state&&Xl.enqueueReplaceState(r,r.state,null),Bl(t,n,r,i),r.state=t.memoizedState),typeof r.componentDidMount=="function"&&(t.flags|=4194308)}function Os(t,e){try{var n="",i=e;do n+=KE(i),i=i.return;while(i);var r=n}catch(s){r=`
Error generating stack: `+s.message+`
`+s.stack}return{value:t,source:e,stack:r,digest:null}}function Yd(t,e,n){return{value:t,source:null,stack:n??null,digest:e??null}}function Kd(t,e){try{console.error(e.value)}catch(n){setTimeout(function(){throw n})}}var Sw=typeof WeakMap=="function"?WeakMap:Map;function $0(t,e,n){n=Ii(-1,n),n.tag=3,n.payload={element:null};var i=e.value;return n.callback=function(){jl||(jl=!0,lh=i),Kd(t,e)},n}function e_(t,e,n){n=Ii(-1,n),n.tag=3;var i=t.type.getDerivedStateFromError;if(typeof i=="function"){var r=e.value;n.payload=function(){return i(r)},n.callback=function(){Kd(t,e)}}var s=t.stateNode;return s!==null&&typeof s.componentDidCatch=="function"&&(n.callback=function(){Kd(t,e),typeof i!="function"&&(cr===null?cr=new Set([this]):cr.add(this));var o=e.stack;this.componentDidCatch(e.value,{componentStack:o!==null?o:""})}),n}function t_(t,e,n){var i=t.pingCache;if(i===null){i=t.pingCache=new Sw;var r=new Set;i.set(e,r)}else r=i.get(e),r===void 0&&(r=new Set,i.set(e,r));r.has(n)||(r.add(n),t=Nw.bind(null,t,e,n),e.then(t,t))}function n_(t){do{var e;if((e=t.tag===13)&&(e=t.memoizedState,e=e!==null?e.dehydrated!==null:!0),e)return t;t=t.return}while(t!==null);return null}function i_(t,e,n,i,r){return t.mode&1?(t.flags|=65536,t.lanes=r,t):(t===e?t.flags|=65536:(t.flags|=128,n.flags|=131072,n.flags&=-52805,n.tag===1&&(n.alternate===null?n.tag=17:(e=Ii(-1,1),e.tag=2,ar(n,e,1))),n.lanes|=1),t)}var yw=Ri.ReactCurrentOwner,gn=!1;function cn(t,e,n,i){e.child=t===null?E0(e,null,n,i):Is(e,t.child,n,i)}function r_(t,e,n,i,r){n=n.render;var s=e.ref;return Us(e,r),i=Bd(t,e,n,i,s,r),n=kd(),t!==null&&!gn?(e.updateQueue=t.updateQueue,e.flags&=-2053,t.lanes&=~r,Ni(t,e,r)):(xt&&n&&yd(e),e.flags|=1,cn(t,e,i,r),e.child)}function s_(t,e,n,i,r){if(t===null){var s=n.type;return typeof s=="function"&&!mh(s)&&s.defaultProps===void 0&&n.compare===null&&n.defaultProps===void 0?(e.tag=15,e.type=s,o_(t,e,s,i,r)):(t=rc(n.type,null,i,e,e.mode,r),t.ref=e.ref,t.return=e,e.child=t)}if(s=t.child,!(t.lanes&r)){var o=s.memoizedProps;if(n=n.compare,n=n!==null?n:Po,n(o,i)&&t.ref===e.ref)return Ni(t,e,r)}return e.flags|=1,t=hr(s,i),t.ref=e.ref,t.return=e,e.child=t}function o_(t,e,n,i,r){if(t!==null){var s=t.memoizedProps;if(Po(s,i)&&t.ref===e.ref)if(gn=!1,e.pendingProps=i=s,(t.lanes&r)!==0)t.flags&131072&&(gn=!0);else return e.lanes=t.lanes,Ni(t,e,r)}return Zd(t,e,n,i,r)}function a_(t,e,n){var i=e.pendingProps,r=i.children,s=t!==null?t.memoizedState:null;if(i.mode==="hidden")if(!(e.mode&1))e.memoizedState={baseLanes:0,cachePool:null,transitions:null},ht(ks,wn),wn|=n;else{if(!(n&1073741824))return t=s!==null?s.baseLanes|n:n,e.lanes=e.childLanes=1073741824,e.memoizedState={baseLanes:t,cachePool:null,transitions:null},e.updateQueue=null,ht(ks,wn),wn|=t,null;e.memoizedState={baseLanes:0,cachePool:null,transitions:null},i=s!==null?s.baseLanes:n,ht(ks,wn),wn|=i}else s!==null?(i=s.baseLanes|n,e.memoizedState=null):i=n,ht(ks,wn),wn|=i;return cn(t,e,r,n),e.child}function l_(t,e){var n=e.ref;(t===null&&n!==null||t!==null&&t.ref!==n)&&(e.flags|=512,e.flags|=2097152)}function Zd(t,e,n,i,r){var s=mn(n)?Lr:jt.current;return s=Cs(e,s),Us(e,r),n=Bd(t,e,n,i,s,r),i=kd(),t!==null&&!gn?(e.updateQueue=t.updateQueue,e.flags&=-2053,t.lanes&=~r,Ni(t,e,r)):(xt&&i&&yd(e),e.flags|=1,cn(t,e,n,r),e.child)}function c_(t,e,n,i,r){if(mn(n)){var s=!0;Cl(e)}else s=!1;if(Us(e,r),e.stateNode===null)Kl(t,e),J0(e,n,i),Xd(e,n,i,r),i=!0;else if(t===null){var o=e.stateNode,a=e.memoizedProps;o.props=a;var l=o.context,c=n.contextType;typeof c=="object"&&c!==null?c=Fn(c):(c=mn(n)?Lr:jt.current,c=Cs(e,c));var d=n.getDerivedStateFromProps,h=typeof d=="function"||typeof o.getSnapshotBeforeUpdate=="function";h||typeof o.UNSAFE_componentWillReceiveProps!="function"&&typeof o.componentWillReceiveProps!="function"||(a!==i||l!==c)&&j0(e,o,i,c),or=!1;var u=e.memoizedState;o.state=u,Bl(e,i,o,r),l=e.memoizedState,a!==i||u!==l||pn.current||or?(typeof d=="function"&&(Wd(e,n,d,i),l=e.memoizedState),(a=or||Q0(e,n,a,i,u,l,c))?(h||typeof o.UNSAFE_componentWillMount!="function"&&typeof o.componentWillMount!="function"||(typeof o.componentWillMount=="function"&&o.componentWillMount(),typeof o.UNSAFE_componentWillMount=="function"&&o.UNSAFE_componentWillMount()),typeof o.componentDidMount=="function"&&(e.flags|=4194308)):(typeof o.componentDidMount=="function"&&(e.flags|=4194308),e.memoizedProps=i,e.memoizedState=l),o.props=i,o.state=l,o.context=c,i=a):(typeof o.componentDidMount=="function"&&(e.flags|=4194308),i=!1)}else{o=e.stateNode,w0(t,e),a=e.memoizedProps,c=e.type===e.elementType?a:qn(e.type,a),o.props=c,h=e.pendingProps,u=o.context,l=n.contextType,typeof l=="object"&&l!==null?l=Fn(l):(l=mn(n)?Lr:jt.current,l=Cs(e,l));var p=n.getDerivedStateFromProps;(d=typeof p=="function"||typeof o.getSnapshotBeforeUpdate=="function")||typeof o.UNSAFE_componentWillReceiveProps!="function"&&typeof o.componentWillReceiveProps!="function"||(a!==h||u!==l)&&j0(e,o,i,l),or=!1,u=e.memoizedState,o.state=u,Bl(e,i,o,r);var g=e.memoizedState;a!==h||u!==g||pn.current||or?(typeof p=="function"&&(Wd(e,n,p,i),g=e.memoizedState),(c=or||Q0(e,n,c,i,u,g,l)||!1)?(d||typeof o.UNSAFE_componentWillUpdate!="function"&&typeof o.componentWillUpdate!="function"||(typeof o.componentWillUpdate=="function"&&o.componentWillUpdate(i,g,l),typeof o.UNSAFE_componentWillUpdate=="function"&&o.UNSAFE_componentWillUpdate(i,g,l)),typeof o.componentDidUpdate=="function"&&(e.flags|=4),typeof o.getSnapshotBeforeUpdate=="function"&&(e.flags|=1024)):(typeof o.componentDidUpdate!="function"||a===t.memoizedProps&&u===t.memoizedState||(e.flags|=4),typeof o.getSnapshotBeforeUpdate!="function"||a===t.memoizedProps&&u===t.memoizedState||(e.flags|=1024),e.memoizedProps=i,e.memoizedState=g),o.props=i,o.state=g,o.context=l,i=c):(typeof o.componentDidUpdate!="function"||a===t.memoizedProps&&u===t.memoizedState||(e.flags|=4),typeof o.getSnapshotBeforeUpdate!="function"||a===t.memoizedProps&&u===t.memoizedState||(e.flags|=1024),i=!1)}return qd(t,e,n,i,s,r)}function qd(t,e,n,i,r,s){l_(t,e);var o=(e.flags&128)!==0;if(!i&&!o)return r&&p0(e,n,!1),Ni(t,e,s);i=e.stateNode,yw.current=e;var a=o&&typeof n.getDerivedStateFromError!="function"?null:i.render();return e.flags|=1,t!==null&&o?(e.child=Is(e,t.child,null,s),e.child=Is(e,null,a,s)):cn(t,e,a,s),e.memoizedState=i.state,r&&p0(e,n,!0),e.child}function u_(t){var e=t.stateNode;e.pendingContext?d0(t,e.pendingContext,e.pendingContext!==e.context):e.context&&d0(t,e.context,!1),Dd(t,e.containerInfo)}function f_(t,e,n,i,r){return Ds(),wd(r),e.flags|=256,cn(t,e,n,i),e.child}var Qd={dehydrated:null,treeContext:null,retryLane:0};function Jd(t){return{baseLanes:t,cachePool:null,transitions:null}}function d_(t,e,n){var i=e.pendingProps,r=Mt.current,s=!1,o=(e.flags&128)!==0,a;if((a=o)||(a=t!==null&&t.memoizedState===null?!1:(r&2)!==0),a?(s=!0,e.flags&=-129):(t===null||t.memoizedState!==null)&&(r|=1),ht(Mt,r&1),t===null)return Td(e),t=e.memoizedState,t!==null&&(t=t.dehydrated,t!==null)?(e.mode&1?t.data==="$!"?e.lanes=8:e.lanes=1073741824:e.lanes=1,null):(o=i.children,t=i.fallback,s?(i=e.mode,s=e.child,o={mode:"hidden",children:o},!(i&1)&&s!==null?(s.childLanes=0,s.pendingProps=o):s=sc(o,i,0,null),t=Vr(t,i,n,null),s.return=e,t.return=e,s.sibling=t,e.child=s,e.child.memoizedState=Jd(n),e.memoizedState=Qd,t):jd(e,o));if(r=t.memoizedState,r!==null&&(a=r.dehydrated,a!==null))return Mw(t,e,o,i,a,r,n);if(s){s=i.fallback,o=e.mode,r=t.child,a=r.sibling;var l={mode:"hidden",children:i.children};return!(o&1)&&e.child!==r?(i=e.child,i.childLanes=0,i.pendingProps=l,e.deletions=null):(i=hr(r,l),i.subtreeFlags=r.subtreeFlags&14680064),a!==null?s=hr(a,s):(s=Vr(s,o,n,null),s.flags|=2),s.return=e,i.return=e,i.sibling=s,e.child=i,i=s,s=e.child,o=t.child.memoizedState,o=o===null?Jd(n):{baseLanes:o.baseLanes|n,cachePool:null,transitions:o.transitions},s.memoizedState=o,s.childLanes=t.childLanes&~n,e.memoizedState=Qd,i}return s=t.child,t=s.sibling,i=hr(s,{mode:"visible",children:i.children}),!(e.mode&1)&&(i.lanes=n),i.return=e,i.sibling=null,t!==null&&(n=e.deletions,n===null?(e.deletions=[t],e.flags|=16):n.push(t)),e.child=i,e.memoizedState=null,i}function jd(t,e){return e=sc({mode:"visible",children:e},t.mode,0,null),e.return=t,t.child=e}function Yl(t,e,n,i){return i!==null&&wd(i),Is(e,t.child,null,n),t=jd(e,e.pendingProps.children),t.flags|=2,e.memoizedState=null,t}function Mw(t,e,n,i,r,s,o){if(n)return e.flags&256?(e.flags&=-257,i=Yd(Error(re(422))),Yl(t,e,o,i)):e.memoizedState!==null?(e.child=t.child,e.flags|=128,null):(s=i.fallback,r=e.mode,i=sc({mode:"visible",children:i.children},r,0,null),s=Vr(s,r,o,null),s.flags|=2,i.return=e,s.return=e,i.sibling=s,e.child=i,e.mode&1&&Is(e,t.child,null,o),e.child.memoizedState=Jd(o),e.memoizedState=Qd,s);if(!(e.mode&1))return Yl(t,e,o,null);if(r.data==="$!"){if(i=r.nextSibling&&r.nextSibling.dataset,i)var a=i.dgst;return i=a,s=Error(re(419)),i=Yd(s,i,void 0),Yl(t,e,o,i)}if(a=(o&t.childLanes)!==0,gn||a){if(i=Gt,i!==null){switch(o&-o){case 4:r=2;break;case 16:r=8;break;case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:r=32;break;case 536870912:r=268435456;break;default:r=0}r=r&(i.suspendedLanes|o)?0:r,r!==0&&r!==s.retryLane&&(s.retryLane=r,Di(t,r),jn(i,t,r,-1))}return ph(),i=Yd(Error(re(421))),Yl(t,e,o,i)}return r.data==="$?"?(e.flags|=128,e.child=t.child,e=Uw.bind(null,t),r._reactRetry=e,null):(t=s.treeContext,Tn=nr(r.nextSibling),En=e,xt=!0,Zn=null,t!==null&&(Nn[Un++]=Pi,Nn[Un++]=Li,Nn[Un++]=Dr,Pi=t.id,Li=t.overflow,Dr=e),e=jd(e,i.children),e.flags|=4096,e)}function h_(t,e,n){t.lanes|=e;var i=t.alternate;i!==null&&(i.lanes|=e),Cd(t.return,e,n)}function $d(t,e,n,i,r){var s=t.memoizedState;s===null?t.memoizedState={isBackwards:e,rendering:null,renderingStartTime:0,last:i,tail:n,tailMode:r}:(s.isBackwards=e,s.rendering=null,s.renderingStartTime=0,s.last=i,s.tail=n,s.tailMode=r)}function p_(t,e,n){var i=e.pendingProps,r=i.revealOrder,s=i.tail;if(cn(t,e,i.children,n),i=Mt.current,i&2)i=i&1|2,e.flags|=128;else{if(t!==null&&t.flags&128)e:for(t=e.child;t!==null;){if(t.tag===13)t.memoizedState!==null&&h_(t,n,e);else if(t.tag===19)h_(t,n,e);else if(t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break e;for(;t.sibling===null;){if(t.return===null||t.return===e)break e;t=t.return}t.sibling.return=t.return,t=t.sibling}i&=1}if(ht(Mt,i),!(e.mode&1))e.memoizedState=null;else switch(r){case"forwards":for(n=e.child,r=null;n!==null;)t=n.alternate,t!==null&&kl(t)===null&&(r=n),n=n.sibling;n=r,n===null?(r=e.child,e.child=null):(r=n.sibling,n.sibling=null),$d(e,!1,r,n,s);break;case"backwards":for(n=null,r=e.child,e.child=null;r!==null;){if(t=r.alternate,t!==null&&kl(t)===null){e.child=r;break}t=r.sibling,r.sibling=n,n=r,r=t}$d(e,!0,n,null,s);break;case"together":$d(e,!1,null,null,void 0);break;default:e.memoizedState=null}return e.child}function Kl(t,e){!(e.mode&1)&&t!==null&&(t.alternate=null,e.alternate=null,e.flags|=2)}function Ni(t,e,n){if(t!==null&&(e.dependencies=t.dependencies),Or|=e.lanes,!(n&e.childLanes))return null;if(t!==null&&e.child!==t.child)throw Error(re(153));if(e.child!==null){for(t=e.child,n=hr(t,t.pendingProps),e.child=n,n.return=e;t.sibling!==null;)t=t.sibling,n=n.sibling=hr(t,t.pendingProps),n.return=e;n.sibling=null}return e.child}function Ew(t,e,n){switch(e.tag){case 3:u_(e),Ds();break;case 5:b0(e);break;case 1:mn(e.type)&&Cl(e);break;case 4:Dd(e,e.stateNode.containerInfo);break;case 10:var i=e.type._context,r=e.memoizedProps.value;ht(Ul,i._currentValue),i._currentValue=r;break;case 13:if(i=e.memoizedState,i!==null)return i.dehydrated!==null?(ht(Mt,Mt.current&1),e.flags|=128,null):n&e.child.childLanes?d_(t,e,n):(ht(Mt,Mt.current&1),t=Ni(t,e,n),t!==null?t.sibling:null);ht(Mt,Mt.current&1);break;case 19:if(i=(n&e.childLanes)!==0,t.flags&128){if(i)return p_(t,e,n);e.flags|=128}if(r=e.memoizedState,r!==null&&(r.rendering=null,r.tail=null,r.lastEffect=null),ht(Mt,Mt.current),i)break;return null;case 22:case 23:return e.lanes=0,a_(t,e,n)}return Ni(t,e,n)}var m_,eh,g_,__;m_=function(t,e){for(var n=e.child;n!==null;){if(n.tag===5||n.tag===6)t.appendChild(n.stateNode);else if(n.tag!==4&&n.child!==null){n.child.return=n,n=n.child;continue}if(n===e)break;for(;n.sibling===null;){if(n.return===null||n.return===e)return;n=n.return}n.sibling.return=n.return,n=n.sibling}},eh=function(){},g_=function(t,e,n,i){var r=t.memoizedProps;if(r!==i){t=e.stateNode,Ur(fi.current);var s=null;switch(n){case"input":r=Cf(t,r),i=Cf(t,i),s=[];break;case"select":r=yt({},r,{value:void 0}),i=yt({},i,{value:void 0}),s=[];break;case"textarea":r=Df(t,r),i=Df(t,i),s=[];break;default:typeof r.onClick!="function"&&typeof i.onClick=="function"&&(t.onclick=Al)}Nf(n,i);var o;n=null;for(c in r)if(!i.hasOwnProperty(c)&&r.hasOwnProperty(c)&&r[c]!=null)if(c==="style"){var a=r[c];for(o in a)a.hasOwnProperty(o)&&(n||(n={}),n[o]="")}else c!=="dangerouslySetInnerHTML"&&c!=="children"&&c!=="suppressContentEditableWarning"&&c!=="suppressHydrationWarning"&&c!=="autoFocus"&&(lo.hasOwnProperty(c)?s||(s=[]):(s=s||[]).push(c,null));for(c in i){var l=i[c];if(a=r!=null?r[c]:void 0,i.hasOwnProperty(c)&&l!==a&&(l!=null||a!=null))if(c==="style")if(a){for(o in a)!a.hasOwnProperty(o)||l&&l.hasOwnProperty(o)||(n||(n={}),n[o]="");for(o in l)l.hasOwnProperty(o)&&a[o]!==l[o]&&(n||(n={}),n[o]=l[o])}else n||(s||(s=[]),s.push(c,n)),n=l;else c==="dangerouslySetInnerHTML"?(l=l?l.__html:void 0,a=a?a.__html:void 0,l!=null&&a!==l&&(s=s||[]).push(c,l)):c==="children"?typeof l!="string"&&typeof l!="number"||(s=s||[]).push(c,""+l):c!=="suppressContentEditableWarning"&&c!=="suppressHydrationWarning"&&(lo.hasOwnProperty(c)?(l!=null&&c==="onScroll"&&gt("scroll",t),s||a===l||(s=[])):(s=s||[]).push(c,l))}n&&(s=s||[]).push("style",n);var c=s;(e.updateQueue=c)&&(e.flags|=4)}},__=function(t,e,n,i){n!==i&&(e.flags|=4)};function Xo(t,e){if(!xt)switch(t.tailMode){case"hidden":e=t.tail;for(var n=null;e!==null;)e.alternate!==null&&(n=e),e=e.sibling;n===null?t.tail=null:n.sibling=null;break;case"collapsed":n=t.tail;for(var i=null;n!==null;)n.alternate!==null&&(i=n),n=n.sibling;i===null?e||t.tail===null?t.tail=null:t.tail.sibling=null:i.sibling=null}}function en(t){var e=t.alternate!==null&&t.alternate.child===t.child,n=0,i=0;if(e)for(var r=t.child;r!==null;)n|=r.lanes|r.childLanes,i|=r.subtreeFlags&14680064,i|=r.flags&14680064,r.return=t,r=r.sibling;else for(r=t.child;r!==null;)n|=r.lanes|r.childLanes,i|=r.subtreeFlags,i|=r.flags,r.return=t,r=r.sibling;return t.subtreeFlags|=i,t.childLanes=n,e}function Tw(t,e,n){var i=e.pendingProps;switch(Md(e),e.tag){case 2:case 16:case 15:case 0:case 11:case 7:case 8:case 12:case 9:case 14:return en(e),null;case 1:return mn(e.type)&&bl(),en(e),null;case 3:return i=e.stateNode,Fs(),_t(pn),_t(jt),Ud(),i.pendingContext&&(i.context=i.pendingContext,i.pendingContext=null),(t===null||t.child===null)&&(Il(e)?e.flags|=4:t===null||t.memoizedState.isDehydrated&&!(e.flags&256)||(e.flags|=1024,Zn!==null&&(fh(Zn),Zn=null))),eh(t,e),en(e),null;case 5:Id(e);var r=Ur(zo.current);if(n=e.type,t!==null&&e.stateNode!=null)g_(t,e,n,i,r),t.ref!==e.ref&&(e.flags|=512,e.flags|=2097152);else{if(!i){if(e.stateNode===null)throw Error(re(166));return en(e),null}if(t=Ur(fi.current),Il(e)){i=e.stateNode,n=e.type;var s=e.memoizedProps;switch(i[ui]=e,i[Uo]=s,t=(e.mode&1)!==0,n){case"dialog":gt("cancel",i),gt("close",i);break;case"iframe":case"object":case"embed":gt("load",i);break;case"video":case"audio":for(r=0;r<Do.length;r++)gt(Do[r],i);break;case"source":gt("error",i);break;case"img":case"image":case"link":gt("error",i),gt("load",i);break;case"details":gt("toggle",i);break;case"input":Jm(i,s),gt("invalid",i);break;case"select":i._wrapperState={wasMultiple:!!s.multiple},gt("invalid",i);break;case"textarea":eg(i,s),gt("invalid",i)}Nf(n,s),r=null;for(var o in s)if(s.hasOwnProperty(o)){var a=s[o];o==="children"?typeof a=="string"?i.textContent!==a&&(s.suppressHydrationWarning!==!0&&wl(i.textContent,a,t),r=["children",a]):typeof a=="number"&&i.textContent!==""+a&&(s.suppressHydrationWarning!==!0&&wl(i.textContent,a,t),r=["children",""+a]):lo.hasOwnProperty(o)&&a!=null&&o==="onScroll"&&gt("scroll",i)}switch(n){case"input":nl(i),$m(i,s,!0);break;case"textarea":nl(i),ng(i);break;case"select":case"option":break;default:typeof s.onClick=="function"&&(i.onclick=Al)}i=r,e.updateQueue=i,i!==null&&(e.flags|=4)}else{o=r.nodeType===9?r:r.ownerDocument,t==="http://www.w3.org/1999/xhtml"&&(t=ig(n)),t==="http://www.w3.org/1999/xhtml"?n==="script"?(t=o.createElement("div"),t.innerHTML="<script><\/script>",t=t.removeChild(t.firstChild)):typeof i.is=="string"?t=o.createElement(n,{is:i.is}):(t=o.createElement(n),n==="select"&&(o=t,i.multiple?o.multiple=!0:i.size&&(o.size=i.size))):t=o.createElementNS(t,n),t[ui]=e,t[Uo]=i,m_(t,e,!1,!1),e.stateNode=t;e:{switch(o=Uf(n,i),n){case"dialog":gt("cancel",t),gt("close",t),r=i;break;case"iframe":case"object":case"embed":gt("load",t),r=i;break;case"video":case"audio":for(r=0;r<Do.length;r++)gt(Do[r],t);r=i;break;case"source":gt("error",t),r=i;break;case"img":case"image":case"link":gt("error",t),gt("load",t),r=i;break;case"details":gt("toggle",t),r=i;break;case"input":Jm(t,i),r=Cf(t,i),gt("invalid",t);break;case"option":r=i;break;case"select":t._wrapperState={wasMultiple:!!i.multiple},r=yt({},i,{value:void 0}),gt("invalid",t);break;case"textarea":eg(t,i),r=Df(t,i),gt("invalid",t);break;default:r=i}Nf(n,r),a=r;for(s in a)if(a.hasOwnProperty(s)){var l=a[s];s==="style"?og(t,l):s==="dangerouslySetInnerHTML"?(l=l?l.__html:void 0,l!=null&&rg(t,l)):s==="children"?typeof l=="string"?(n!=="textarea"||l!=="")&&ho(t,l):typeof l=="number"&&ho(t,""+l):s!=="suppressContentEditableWarning"&&s!=="suppressHydrationWarning"&&s!=="autoFocus"&&(lo.hasOwnProperty(s)?l!=null&&s==="onScroll"&&gt("scroll",t):l!=null&&vf(t,s,l,o))}switch(n){case"input":nl(t),$m(t,i,!1);break;case"textarea":nl(t),ng(t);break;case"option":i.value!=null&&t.setAttribute("value",""+qi(i.value));break;case"select":t.multiple=!!i.multiple,s=i.value,s!=null?_s(t,!!i.multiple,s,!1):i.defaultValue!=null&&_s(t,!!i.multiple,i.defaultValue,!0);break;default:typeof r.onClick=="function"&&(t.onclick=Al)}switch(n){case"button":case"input":case"select":case"textarea":i=!!i.autoFocus;break e;case"img":i=!0;break e;default:i=!1}}i&&(e.flags|=4)}e.ref!==null&&(e.flags|=512,e.flags|=2097152)}return en(e),null;case 6:if(t&&e.stateNode!=null)__(t,e,t.memoizedProps,i);else{if(typeof i!="string"&&e.stateNode===null)throw Error(re(166));if(n=Ur(zo.current),Ur(fi.current),Il(e)){if(i=e.stateNode,n=e.memoizedProps,i[ui]=e,(s=i.nodeValue!==n)&&(t=En,t!==null))switch(t.tag){case 3:wl(i.nodeValue,n,(t.mode&1)!==0);break;case 5:t.memoizedProps.suppressHydrationWarning!==!0&&wl(i.nodeValue,n,(t.mode&1)!==0)}s&&(e.flags|=4)}else i=(n.nodeType===9?n:n.ownerDocument).createTextNode(i),i[ui]=e,e.stateNode=i}return en(e),null;case 13:if(_t(Mt),i=e.memoizedState,t===null||t.memoizedState!==null&&t.memoizedState.dehydrated!==null){if(xt&&Tn!==null&&e.mode&1&&!(e.flags&128))S0(),Ds(),e.flags|=98560,s=!1;else if(s=Il(e),i!==null&&i.dehydrated!==null){if(t===null){if(!s)throw Error(re(318));if(s=e.memoizedState,s=s!==null?s.dehydrated:null,!s)throw Error(re(317));s[ui]=e}else Ds(),!(e.flags&128)&&(e.memoizedState=null),e.flags|=4;en(e),s=!1}else Zn!==null&&(fh(Zn),Zn=null),s=!0;if(!s)return e.flags&65536?e:null}return e.flags&128?(e.lanes=n,e):(i=i!==null,i!==(t!==null&&t.memoizedState!==null)&&i&&(e.child.flags|=8192,e.mode&1&&(t===null||Mt.current&1?zt===0&&(zt=3):ph())),e.updateQueue!==null&&(e.flags|=4),en(e),null);case 4:return Fs(),eh(t,e),t===null&&Io(e.stateNode.containerInfo),en(e),null;case 10:return bd(e.type._context),en(e),null;case 17:return mn(e.type)&&bl(),en(e),null;case 19:if(_t(Mt),s=e.memoizedState,s===null)return en(e),null;if(i=(e.flags&128)!==0,o=s.rendering,o===null)if(i)Xo(s,!1);else{if(zt!==0||t!==null&&t.flags&128)for(t=e.child;t!==null;){if(o=kl(t),o!==null){for(e.flags|=128,Xo(s,!1),i=o.updateQueue,i!==null&&(e.updateQueue=i,e.flags|=4),e.subtreeFlags=0,i=n,n=e.child;n!==null;)s=n,t=i,s.flags&=14680066,o=s.alternate,o===null?(s.childLanes=0,s.lanes=t,s.child=null,s.subtreeFlags=0,s.memoizedProps=null,s.memoizedState=null,s.updateQueue=null,s.dependencies=null,s.stateNode=null):(s.childLanes=o.childLanes,s.lanes=o.lanes,s.child=o.child,s.subtreeFlags=0,s.deletions=null,s.memoizedProps=o.memoizedProps,s.memoizedState=o.memoizedState,s.updateQueue=o.updateQueue,s.type=o.type,t=o.dependencies,s.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext}),n=n.sibling;return ht(Mt,Mt.current&1|2),e.child}t=t.sibling}s.tail!==null&&Ct()>zs&&(e.flags|=128,i=!0,Xo(s,!1),e.lanes=4194304)}else{if(!i)if(t=kl(o),t!==null){if(e.flags|=128,i=!0,n=t.updateQueue,n!==null&&(e.updateQueue=n,e.flags|=4),Xo(s,!0),s.tail===null&&s.tailMode==="hidden"&&!o.alternate&&!xt)return en(e),null}else 2*Ct()-s.renderingStartTime>zs&&n!==1073741824&&(e.flags|=128,i=!0,Xo(s,!1),e.lanes=4194304);s.isBackwards?(o.sibling=e.child,e.child=o):(n=s.last,n!==null?n.sibling=o:e.child=o,s.last=o)}return s.tail!==null?(e=s.tail,s.rendering=e,s.tail=e.sibling,s.renderingStartTime=Ct(),e.sibling=null,n=Mt.current,ht(Mt,i?n&1|2:n&1),e):(en(e),null);case 22:case 23:return hh(),i=e.memoizedState!==null,t!==null&&t.memoizedState!==null!==i&&(e.flags|=8192),i&&e.mode&1?wn&1073741824&&(en(e),e.subtreeFlags&6&&(e.flags|=8192)):en(e),null;case 24:return null;case 25:return null}throw Error(re(156,e.tag))}function ww(t,e){switch(Md(e),e.tag){case 1:return mn(e.type)&&bl(),t=e.flags,t&65536?(e.flags=t&-65537|128,e):null;case 3:return Fs(),_t(pn),_t(jt),Ud(),t=e.flags,t&65536&&!(t&128)?(e.flags=t&-65537|128,e):null;case 5:return Id(e),null;case 13:if(_t(Mt),t=e.memoizedState,t!==null&&t.dehydrated!==null){if(e.alternate===null)throw Error(re(340));Ds()}return t=e.flags,t&65536?(e.flags=t&-65537|128,e):null;case 19:return _t(Mt),null;case 4:return Fs(),null;case 10:return bd(e.type._context),null;case 22:case 23:return hh(),null;case 24:return null;default:return null}}var Zl=!1,tn=!1,Aw=typeof WeakSet=="function"?WeakSet:Set,Se=null;function Bs(t,e){var n=t.ref;if(n!==null)if(typeof n=="function")try{n(null)}catch(i){Tt(t,e,i)}else n.current=null}function th(t,e,n){try{n()}catch(i){Tt(t,e,i)}}var v_=!1;function Rw(t,e){if(hd=pl,t=Qg(),sd(t)){if("selectionStart"in t)var n={start:t.selectionStart,end:t.selectionEnd};else e:{n=(n=t.ownerDocument)&&n.defaultView||window;var i=n.getSelection&&n.getSelection();if(i&&i.rangeCount!==0){n=i.anchorNode;var r=i.anchorOffset,s=i.focusNode;i=i.focusOffset;try{n.nodeType,s.nodeType}catch{n=null;break e}var o=0,a=-1,l=-1,c=0,d=0,h=t,u=null;t:for(;;){for(var p;h!==n||r!==0&&h.nodeType!==3||(a=o+r),h!==s||i!==0&&h.nodeType!==3||(l=o+i),h.nodeType===3&&(o+=h.nodeValue.length),(p=h.firstChild)!==null;)u=h,h=p;for(;;){if(h===t)break t;if(u===n&&++c===r&&(a=o),u===s&&++d===i&&(l=o),(p=h.nextSibling)!==null)break;h=u,u=h.parentNode}h=p}n=a===-1||l===-1?null:{start:a,end:l}}else n=null}n=n||{start:0,end:0}}else n=null;for(pd={focusedElem:t,selectionRange:n},pl=!1,Se=e;Se!==null;)if(e=Se,t=e.child,(e.subtreeFlags&1028)!==0&&t!==null)t.return=e,Se=t;else for(;Se!==null;){e=Se;try{var g=e.alternate;if(e.flags&1024)switch(e.tag){case 0:case 11:case 15:break;case 1:if(g!==null){var M=g.memoizedProps,m=g.memoizedState,f=e.stateNode,x=f.getSnapshotBeforeUpdate(e.elementType===e.type?M:qn(e.type,M),m);f.__reactInternalSnapshotBeforeUpdate=x}break;case 3:var y=e.stateNode.containerInfo;y.nodeType===1?y.textContent="":y.nodeType===9&&y.documentElement&&y.removeChild(y.documentElement);break;case 5:case 6:case 4:case 17:break;default:throw Error(re(163))}}catch(S){Tt(e,e.return,S)}if(t=e.sibling,t!==null){t.return=e.return,Se=t;break}Se=e.return}return g=v_,v_=!1,g}function Yo(t,e,n){var i=e.updateQueue;if(i=i!==null?i.lastEffect:null,i!==null){var r=i=i.next;do{if((r.tag&t)===t){var s=r.destroy;r.destroy=void 0,s!==void 0&&th(e,n,s)}r=r.next}while(r!==i)}}function ql(t,e){if(e=e.updateQueue,e=e!==null?e.lastEffect:null,e!==null){var n=e=e.next;do{if((n.tag&t)===t){var i=n.create;n.destroy=i()}n=n.next}while(n!==e)}}function nh(t){var e=t.ref;if(e!==null){var n=t.stateNode;switch(t.tag){case 5:t=n;break;default:t=n}typeof e=="function"?e(t):e.current=t}}function x_(t){var e=t.alternate;e!==null&&(t.alternate=null,x_(e)),t.child=null,t.deletions=null,t.sibling=null,t.tag===5&&(e=t.stateNode,e!==null&&(delete e[ui],delete e[Uo],delete e[vd],delete e[cw],delete e[uw])),t.stateNode=null,t.return=null,t.dependencies=null,t.memoizedProps=null,t.memoizedState=null,t.pendingProps=null,t.stateNode=null,t.updateQueue=null}function S_(t){return t.tag===5||t.tag===3||t.tag===4}function y_(t){e:for(;;){for(;t.sibling===null;){if(t.return===null||S_(t.return))return null;t=t.return}for(t.sibling.return=t.return,t=t.sibling;t.tag!==5&&t.tag!==6&&t.tag!==18;){if(t.flags&2||t.child===null||t.tag===4)continue e;t.child.return=t,t=t.child}if(!(t.flags&2))return t.stateNode}}function ih(t,e,n){var i=t.tag;if(i===5||i===6)t=t.stateNode,e?n.nodeType===8?n.parentNode.insertBefore(t,e):n.insertBefore(t,e):(n.nodeType===8?(e=n.parentNode,e.insertBefore(t,n)):(e=n,e.appendChild(t)),n=n._reactRootContainer,n!=null||e.onclick!==null||(e.onclick=Al));else if(i!==4&&(t=t.child,t!==null))for(ih(t,e,n),t=t.sibling;t!==null;)ih(t,e,n),t=t.sibling}function rh(t,e,n){var i=t.tag;if(i===5||i===6)t=t.stateNode,e?n.insertBefore(t,e):n.appendChild(t);else if(i!==4&&(t=t.child,t!==null))for(rh(t,e,n),t=t.sibling;t!==null;)rh(t,e,n),t=t.sibling}var Kt=null,Qn=!1;function lr(t,e,n){for(n=n.child;n!==null;)M_(t,e,n),n=n.sibling}function M_(t,e,n){if(ci&&typeof ci.onCommitFiberUnmount=="function")try{ci.onCommitFiberUnmount(ll,n)}catch{}switch(n.tag){case 5:tn||Bs(n,e);case 6:var i=Kt,r=Qn;Kt=null,lr(t,e,n),Kt=i,Qn=r,Kt!==null&&(Qn?(t=Kt,n=n.stateNode,t.nodeType===8?t.parentNode.removeChild(n):t.removeChild(n)):Kt.removeChild(n.stateNode));break;case 18:Kt!==null&&(Qn?(t=Kt,n=n.stateNode,t.nodeType===8?_d(t.parentNode,n):t.nodeType===1&&_d(t,n),To(t)):_d(Kt,n.stateNode));break;case 4:i=Kt,r=Qn,Kt=n.stateNode.containerInfo,Qn=!0,lr(t,e,n),Kt=i,Qn=r;break;case 0:case 11:case 14:case 15:if(!tn&&(i=n.updateQueue,i!==null&&(i=i.lastEffect,i!==null))){r=i=i.next;do{var s=r,o=s.destroy;s=s.tag,o!==void 0&&(s&2||s&4)&&th(n,e,o),r=r.next}while(r!==i)}lr(t,e,n);break;case 1:if(!tn&&(Bs(n,e),i=n.stateNode,typeof i.componentWillUnmount=="function"))try{i.props=n.memoizedProps,i.state=n.memoizedState,i.componentWillUnmount()}catch(a){Tt(n,e,a)}lr(t,e,n);break;case 21:lr(t,e,n);break;case 22:n.mode&1?(tn=(i=tn)||n.memoizedState!==null,lr(t,e,n),tn=i):lr(t,e,n);break;default:lr(t,e,n)}}function E_(t){var e=t.updateQueue;if(e!==null){t.updateQueue=null;var n=t.stateNode;n===null&&(n=t.stateNode=new Aw),e.forEach(function(i){var r=Fw.bind(null,t,i);n.has(i)||(n.add(i),i.then(r,r))})}}function Jn(t,e){var n=e.deletions;if(n!==null)for(var i=0;i<n.length;i++){var r=n[i];try{var s=t,o=e,a=o;e:for(;a!==null;){switch(a.tag){case 5:Kt=a.stateNode,Qn=!1;break e;case 3:Kt=a.stateNode.containerInfo,Qn=!0;break e;case 4:Kt=a.stateNode.containerInfo,Qn=!0;break e}a=a.return}if(Kt===null)throw Error(re(160));M_(s,o,r),Kt=null,Qn=!1;var l=r.alternate;l!==null&&(l.return=null),r.return=null}catch(c){Tt(r,e,c)}}if(e.subtreeFlags&12854)for(e=e.child;e!==null;)T_(e,t),e=e.sibling}function T_(t,e){var n=t.alternate,i=t.flags;switch(t.tag){case 0:case 11:case 14:case 15:if(Jn(e,t),hi(t),i&4){try{Yo(3,t,t.return),ql(3,t)}catch(M){Tt(t,t.return,M)}try{Yo(5,t,t.return)}catch(M){Tt(t,t.return,M)}}break;case 1:Jn(e,t),hi(t),i&512&&n!==null&&Bs(n,n.return);break;case 5:if(Jn(e,t),hi(t),i&512&&n!==null&&Bs(n,n.return),t.flags&32){var r=t.stateNode;try{ho(r,"")}catch(M){Tt(t,t.return,M)}}if(i&4&&(r=t.stateNode,r!=null)){var s=t.memoizedProps,o=n!==null?n.memoizedProps:s,a=t.type,l=t.updateQueue;if(t.updateQueue=null,l!==null)try{a==="input"&&s.type==="radio"&&s.name!=null&&jm(r,s),Uf(a,o);var c=Uf(a,s);for(o=0;o<l.length;o+=2){var d=l[o],h=l[o+1];d==="style"?og(r,h):d==="dangerouslySetInnerHTML"?rg(r,h):d==="children"?ho(r,h):vf(r,d,h,c)}switch(a){case"input":Pf(r,s);break;case"textarea":tg(r,s);break;case"select":var u=r._wrapperState.wasMultiple;r._wrapperState.wasMultiple=!!s.multiple;var p=s.value;p!=null?_s(r,!!s.multiple,p,!1):u!==!!s.multiple&&(s.defaultValue!=null?_s(r,!!s.multiple,s.defaultValue,!0):_s(r,!!s.multiple,s.multiple?[]:"",!1))}r[Uo]=s}catch(M){Tt(t,t.return,M)}}break;case 6:if(Jn(e,t),hi(t),i&4){if(t.stateNode===null)throw Error(re(162));r=t.stateNode,s=t.memoizedProps;try{r.nodeValue=s}catch(M){Tt(t,t.return,M)}}break;case 3:if(Jn(e,t),hi(t),i&4&&n!==null&&n.memoizedState.isDehydrated)try{To(e.containerInfo)}catch(M){Tt(t,t.return,M)}break;case 4:Jn(e,t),hi(t);break;case 13:Jn(e,t),hi(t),r=t.child,r.flags&8192&&(s=r.memoizedState!==null,r.stateNode.isHidden=s,!s||r.alternate!==null&&r.alternate.memoizedState!==null||(ah=Ct())),i&4&&E_(t);break;case 22:if(d=n!==null&&n.memoizedState!==null,t.mode&1?(tn=(c=tn)||d,Jn(e,t),tn=c):Jn(e,t),hi(t),i&8192){if(c=t.memoizedState!==null,(t.stateNode.isHidden=c)&&!d&&t.mode&1)for(Se=t,d=t.child;d!==null;){for(h=Se=d;Se!==null;){switch(u=Se,p=u.child,u.tag){case 0:case 11:case 14:case 15:Yo(4,u,u.return);break;case 1:Bs(u,u.return);var g=u.stateNode;if(typeof g.componentWillUnmount=="function"){i=u,n=u.return;try{e=i,g.props=e.memoizedProps,g.state=e.memoizedState,g.componentWillUnmount()}catch(M){Tt(i,n,M)}}break;case 5:Bs(u,u.return);break;case 22:if(u.memoizedState!==null){R_(h);continue}}p!==null?(p.return=u,Se=p):R_(h)}d=d.sibling}e:for(d=null,h=t;;){if(h.tag===5){if(d===null){d=h;try{r=h.stateNode,c?(s=r.style,typeof s.setProperty=="function"?s.setProperty("display","none","important"):s.display="none"):(a=h.stateNode,l=h.memoizedProps.style,o=l!=null&&l.hasOwnProperty("display")?l.display:null,a.style.display=sg("display",o))}catch(M){Tt(t,t.return,M)}}}else if(h.tag===6){if(d===null)try{h.stateNode.nodeValue=c?"":h.memoizedProps}catch(M){Tt(t,t.return,M)}}else if((h.tag!==22&&h.tag!==23||h.memoizedState===null||h===t)&&h.child!==null){h.child.return=h,h=h.child;continue}if(h===t)break e;for(;h.sibling===null;){if(h.return===null||h.return===t)break e;d===h&&(d=null),h=h.return}d===h&&(d=null),h.sibling.return=h.return,h=h.sibling}}break;case 19:Jn(e,t),hi(t),i&4&&E_(t);break;case 21:break;default:Jn(e,t),hi(t)}}function hi(t){var e=t.flags;if(e&2){try{e:{for(var n=t.return;n!==null;){if(S_(n)){var i=n;break e}n=n.return}throw Error(re(160))}switch(i.tag){case 5:var r=i.stateNode;i.flags&32&&(ho(r,""),i.flags&=-33);var s=y_(t);rh(t,s,r);break;case 3:case 4:var o=i.stateNode.containerInfo,a=y_(t);ih(t,a,o);break;default:throw Error(re(161))}}catch(l){Tt(t,t.return,l)}t.flags&=-3}e&4096&&(t.flags&=-4097)}function bw(t,e,n){Se=t,w_(t)}function w_(t,e,n){for(var i=(t.mode&1)!==0;Se!==null;){var r=Se,s=r.child;if(r.tag===22&&i){var o=r.memoizedState!==null||Zl;if(!o){var a=r.alternate,l=a!==null&&a.memoizedState!==null||tn;a=Zl;var c=tn;if(Zl=o,(tn=l)&&!c)for(Se=r;Se!==null;)o=Se,l=o.child,o.tag===22&&o.memoizedState!==null?b_(r):l!==null?(l.return=o,Se=l):b_(r);for(;s!==null;)Se=s,w_(s),s=s.sibling;Se=r,Zl=a,tn=c}A_(t)}else r.subtreeFlags&8772&&s!==null?(s.return=r,Se=s):A_(t)}}function A_(t){for(;Se!==null;){var e=Se;if(e.flags&8772){var n=e.alternate;try{if(e.flags&8772)switch(e.tag){case 0:case 11:case 15:tn||ql(5,e);break;case 1:var i=e.stateNode;if(e.flags&4&&!tn)if(n===null)i.componentDidMount();else{var r=e.elementType===e.type?n.memoizedProps:qn(e.type,n.memoizedProps);i.componentDidUpdate(r,n.memoizedState,i.__reactInternalSnapshotBeforeUpdate)}var s=e.updateQueue;s!==null&&R0(e,s,i);break;case 3:var o=e.updateQueue;if(o!==null){if(n=null,e.child!==null)switch(e.child.tag){case 5:n=e.child.stateNode;break;case 1:n=e.child.stateNode}R0(e,o,n)}break;case 5:var a=e.stateNode;if(n===null&&e.flags&4){n=a;var l=e.memoizedProps;switch(e.type){case"button":case"input":case"select":case"textarea":l.autoFocus&&n.focus();break;case"img":l.src&&(n.src=l.src)}}break;case 6:break;case 4:break;case 12:break;case 13:if(e.memoizedState===null){var c=e.alternate;if(c!==null){var d=c.memoizedState;if(d!==null){var h=d.dehydrated;h!==null&&To(h)}}}break;case 19:case 17:case 21:case 22:case 23:case 25:break;default:throw Error(re(163))}tn||e.flags&512&&nh(e)}catch(u){Tt(e,e.return,u)}}if(e===t){Se=null;break}if(n=e.sibling,n!==null){n.return=e.return,Se=n;break}Se=e.return}}function R_(t){for(;Se!==null;){var e=Se;if(e===t){Se=null;break}var n=e.sibling;if(n!==null){n.return=e.return,Se=n;break}Se=e.return}}function b_(t){for(;Se!==null;){var e=Se;try{switch(e.tag){case 0:case 11:case 15:var n=e.return;try{ql(4,e)}catch(l){Tt(e,n,l)}break;case 1:var i=e.stateNode;if(typeof i.componentDidMount=="function"){var r=e.return;try{i.componentDidMount()}catch(l){Tt(e,r,l)}}var s=e.return;try{nh(e)}catch(l){Tt(e,s,l)}break;case 5:var o=e.return;try{nh(e)}catch(l){Tt(e,o,l)}}}catch(l){Tt(e,e.return,l)}if(e===t){Se=null;break}var a=e.sibling;if(a!==null){a.return=e.return,Se=a;break}Se=e.return}}var Cw=Math.ceil,Ql=Ri.ReactCurrentDispatcher,sh=Ri.ReactCurrentOwner,Bn=Ri.ReactCurrentBatchConfig,nt=0,Gt=null,Nt=null,Zt=0,wn=0,ks=ir(0),zt=0,Ko=null,Or=0,Jl=0,oh=0,Zo=null,_n=null,ah=0,zs=1/0,Ui=null,jl=!1,lh=null,cr=null,$l=!1,ur=null,ec=0,qo=0,ch=null,tc=-1,nc=0;function un(){return nt&6?Ct():tc!==-1?tc:tc=Ct()}function fr(t){return t.mode&1?nt&2&&Zt!==0?Zt&-Zt:dw.transition!==null?(nc===0&&(nc=yg()),nc):(t=at,t!==0||(t=window.event,t=t===void 0?16:Pg(t.type)),t):1}function jn(t,e,n,i){if(50<qo)throw qo=0,ch=null,Error(re(185));xo(t,n,i),(!(nt&2)||t!==Gt)&&(t===Gt&&(!(nt&2)&&(Jl|=n),zt===4&&dr(t,Zt)),vn(t,i),n===1&&nt===0&&!(e.mode&1)&&(zs=Ct()+500,Pl&&sr()))}function vn(t,e){var n=t.callbackNode;dT(t,e);var i=fl(t,t===Gt?Zt:0);if(i===0)n!==null&&vg(n),t.callbackNode=null,t.callbackPriority=0;else if(e=i&-i,t.callbackPriority!==e){if(n!=null&&vg(n),e===1)t.tag===0?fw(P_.bind(null,t)):m0(P_.bind(null,t)),aw(function(){!(nt&6)&&sr()}),n=null;else{switch(Mg(i)){case 1:n=Hf;break;case 4:n=xg;break;case 16:n=al;break;case 536870912:n=Sg;break;default:n=al}n=B_(n,C_.bind(null,t))}t.callbackPriority=e,t.callbackNode=n}}function C_(t,e){if(tc=-1,nc=0,nt&6)throw Error(re(327));var n=t.callbackNode;if(Vs()&&t.callbackNode!==n)return null;var i=fl(t,t===Gt?Zt:0);if(i===0)return null;if(i&30||i&t.expiredLanes||e)e=ic(t,i);else{e=i;var r=nt;nt|=2;var s=D_();(Gt!==t||Zt!==e)&&(Ui=null,zs=Ct()+500,kr(t,e));do try{Dw();break}catch(a){L_(t,a)}while(!0);Rd(),Ql.current=s,nt=r,Nt!==null?e=0:(Gt=null,Zt=0,e=zt)}if(e!==0){if(e===2&&(r=Gf(t),r!==0&&(i=r,e=uh(t,r))),e===1)throw n=Ko,kr(t,0),dr(t,i),vn(t,Ct()),n;if(e===6)dr(t,i);else{if(r=t.current.alternate,!(i&30)&&!Pw(r)&&(e=ic(t,i),e===2&&(s=Gf(t),s!==0&&(i=s,e=uh(t,s))),e===1))throw n=Ko,kr(t,0),dr(t,i),vn(t,Ct()),n;switch(t.finishedWork=r,t.finishedLanes=i,e){case 0:case 1:throw Error(re(345));case 2:zr(t,_n,Ui);break;case 3:if(dr(t,i),(i&130023424)===i&&(e=ah+500-Ct(),10<e)){if(fl(t,0)!==0)break;if(r=t.suspendedLanes,(r&i)!==i){un(),t.pingedLanes|=t.suspendedLanes&r;break}t.timeoutHandle=gd(zr.bind(null,t,_n,Ui),e);break}zr(t,_n,Ui);break;case 4:if(dr(t,i),(i&4194240)===i)break;for(e=t.eventTimes,r=-1;0<i;){var o=31-Yn(i);s=1<<o,o=e[o],o>r&&(r=o),i&=~s}if(i=r,i=Ct()-i,i=(120>i?120:480>i?480:1080>i?1080:1920>i?1920:3e3>i?3e3:4320>i?4320:1960*Cw(i/1960))-i,10<i){t.timeoutHandle=gd(zr.bind(null,t,_n,Ui),i);break}zr(t,_n,Ui);break;case 5:zr(t,_n,Ui);break;default:throw Error(re(329))}}}return vn(t,Ct()),t.callbackNode===n?C_.bind(null,t):null}function uh(t,e){var n=Zo;return t.current.memoizedState.isDehydrated&&(kr(t,e).flags|=256),t=ic(t,e),t!==2&&(e=_n,_n=n,e!==null&&fh(e)),t}function fh(t){_n===null?_n=t:_n.push.apply(_n,t)}function Pw(t){for(var e=t;;){if(e.flags&16384){var n=e.updateQueue;if(n!==null&&(n=n.stores,n!==null))for(var i=0;i<n.length;i++){var r=n[i],s=r.getSnapshot;r=r.value;try{if(!Kn(s(),r))return!1}catch{return!1}}}if(n=e.child,e.subtreeFlags&16384&&n!==null)n.return=e,e=n;else{if(e===t)break;for(;e.sibling===null;){if(e.return===null||e.return===t)return!0;e=e.return}e.sibling.return=e.return,e=e.sibling}}return!0}function dr(t,e){for(e&=~oh,e&=~Jl,t.suspendedLanes|=e,t.pingedLanes&=~e,t=t.expirationTimes;0<e;){var n=31-Yn(e),i=1<<n;t[n]=-1,e&=~i}}function P_(t){if(nt&6)throw Error(re(327));Vs();var e=fl(t,0);if(!(e&1))return vn(t,Ct()),null;var n=ic(t,e);if(t.tag!==0&&n===2){var i=Gf(t);i!==0&&(e=i,n=uh(t,i))}if(n===1)throw n=Ko,kr(t,0),dr(t,e),vn(t,Ct()),n;if(n===6)throw Error(re(345));return t.finishedWork=t.current.alternate,t.finishedLanes=e,zr(t,_n,Ui),vn(t,Ct()),null}function dh(t,e){var n=nt;nt|=1;try{return t(e)}finally{nt=n,nt===0&&(zs=Ct()+500,Pl&&sr())}}function Br(t){ur!==null&&ur.tag===0&&!(nt&6)&&Vs();var e=nt;nt|=1;var n=Bn.transition,i=at;try{if(Bn.transition=null,at=1,t)return t()}finally{at=i,Bn.transition=n,nt=e,!(nt&6)&&sr()}}function hh(){wn=ks.current,_t(ks)}function kr(t,e){t.finishedWork=null,t.finishedLanes=0;var n=t.timeoutHandle;if(n!==-1&&(t.timeoutHandle=-1,ow(n)),Nt!==null)for(n=Nt.return;n!==null;){var i=n;switch(Md(i),i.tag){case 1:i=i.type.childContextTypes,i!=null&&bl();break;case 3:Fs(),_t(pn),_t(jt),Ud();break;case 5:Id(i);break;case 4:Fs();break;case 13:_t(Mt);break;case 19:_t(Mt);break;case 10:bd(i.type._context);break;case 22:case 23:hh()}n=n.return}if(Gt=t,Nt=t=hr(t.current,null),Zt=wn=e,zt=0,Ko=null,oh=Jl=Or=0,_n=Zo=null,Nr!==null){for(e=0;e<Nr.length;e++)if(n=Nr[e],i=n.interleaved,i!==null){n.interleaved=null;var r=i.next,s=n.pending;if(s!==null){var o=s.next;s.next=r,i.next=o}n.pending=i}Nr=null}return t}function L_(t,e){do{var n=Nt;try{if(Rd(),zl.current=Wl,Vl){for(var i=Et.memoizedState;i!==null;){var r=i.queue;r!==null&&(r.pending=null),i=i.next}Vl=!1}if(Fr=0,Ht=kt=Et=null,Vo=!1,Ho=0,sh.current=null,n===null||n.return===null){zt=1,Ko=e,Nt=null;break}e:{var s=t,o=n.return,a=n,l=e;if(e=Zt,a.flags|=32768,l!==null&&typeof l=="object"&&typeof l.then=="function"){var c=l,d=a,h=d.tag;if(!(d.mode&1)&&(h===0||h===11||h===15)){var u=d.alternate;u?(d.updateQueue=u.updateQueue,d.memoizedState=u.memoizedState,d.lanes=u.lanes):(d.updateQueue=null,d.memoizedState=null)}var p=n_(o);if(p!==null){p.flags&=-257,i_(p,o,a,s,e),p.mode&1&&t_(s,c,e),e=p,l=c;var g=e.updateQueue;if(g===null){var M=new Set;M.add(l),e.updateQueue=M}else g.add(l);break e}else{if(!(e&1)){t_(s,c,e),ph();break e}l=Error(re(426))}}else if(xt&&a.mode&1){var m=n_(o);if(m!==null){!(m.flags&65536)&&(m.flags|=256),i_(m,o,a,s,e),wd(Os(l,a));break e}}s=l=Os(l,a),zt!==4&&(zt=2),Zo===null?Zo=[s]:Zo.push(s),s=o;do{switch(s.tag){case 3:s.flags|=65536,e&=-e,s.lanes|=e;var f=$0(s,l,e);A0(s,f);break e;case 1:a=l;var x=s.type,y=s.stateNode;if(!(s.flags&128)&&(typeof x.getDerivedStateFromError=="function"||y!==null&&typeof y.componentDidCatch=="function"&&(cr===null||!cr.has(y)))){s.flags|=65536,e&=-e,s.lanes|=e;var S=e_(s,a,e);A0(s,S);break e}}s=s.return}while(s!==null)}N_(n)}catch(w){e=w,Nt===n&&n!==null&&(Nt=n=n.return);continue}break}while(!0)}function D_(){var t=Ql.current;return Ql.current=Wl,t===null?Wl:t}function ph(){(zt===0||zt===3||zt===2)&&(zt=4),Gt===null||!(Or&268435455)&&!(Jl&268435455)||dr(Gt,Zt)}function ic(t,e){var n=nt;nt|=2;var i=D_();(Gt!==t||Zt!==e)&&(Ui=null,kr(t,e));do try{Lw();break}catch(r){L_(t,r)}while(!0);if(Rd(),nt=n,Ql.current=i,Nt!==null)throw Error(re(261));return Gt=null,Zt=0,zt}function Lw(){for(;Nt!==null;)I_(Nt)}function Dw(){for(;Nt!==null&&!iT();)I_(Nt)}function I_(t){var e=O_(t.alternate,t,wn);t.memoizedProps=t.pendingProps,e===null?N_(t):Nt=e,sh.current=null}function N_(t){var e=t;do{var n=e.alternate;if(t=e.return,e.flags&32768){if(n=ww(n,e),n!==null){n.flags&=32767,Nt=n;return}if(t!==null)t.flags|=32768,t.subtreeFlags=0,t.deletions=null;else{zt=6,Nt=null;return}}else if(n=Tw(n,e,wn),n!==null){Nt=n;return}if(e=e.sibling,e!==null){Nt=e;return}Nt=e=t}while(e!==null);zt===0&&(zt=5)}function zr(t,e,n){var i=at,r=Bn.transition;try{Bn.transition=null,at=1,Iw(t,e,n,i)}finally{Bn.transition=r,at=i}return null}function Iw(t,e,n,i){do Vs();while(ur!==null);if(nt&6)throw Error(re(327));n=t.finishedWork;var r=t.finishedLanes;if(n===null)return null;if(t.finishedWork=null,t.finishedLanes=0,n===t.current)throw Error(re(177));t.callbackNode=null,t.callbackPriority=0;var s=n.lanes|n.childLanes;if(hT(t,s),t===Gt&&(Nt=Gt=null,Zt=0),!(n.subtreeFlags&2064)&&!(n.flags&2064)||$l||($l=!0,B_(al,function(){return Vs(),null})),s=(n.flags&15990)!==0,n.subtreeFlags&15990||s){s=Bn.transition,Bn.transition=null;var o=at;at=1;var a=nt;nt|=4,sh.current=null,Rw(t,n),T_(n,t),$T(pd),pl=!!hd,pd=hd=null,t.current=n,bw(n),rT(),nt=a,at=o,Bn.transition=s}else t.current=n;if($l&&($l=!1,ur=t,ec=r),s=t.pendingLanes,s===0&&(cr=null),aT(n.stateNode),vn(t,Ct()),e!==null)for(i=t.onRecoverableError,n=0;n<e.length;n++)r=e[n],i(r.value,{componentStack:r.stack,digest:r.digest});if(jl)throw jl=!1,t=lh,lh=null,t;return ec&1&&t.tag!==0&&Vs(),s=t.pendingLanes,s&1?t===ch?qo++:(qo=0,ch=t):qo=0,sr(),null}function Vs(){if(ur!==null){var t=Mg(ec),e=Bn.transition,n=at;try{if(Bn.transition=null,at=16>t?16:t,ur===null)var i=!1;else{if(t=ur,ur=null,ec=0,nt&6)throw Error(re(331));var r=nt;for(nt|=4,Se=t.current;Se!==null;){var s=Se,o=s.child;if(Se.flags&16){var a=s.deletions;if(a!==null){for(var l=0;l<a.length;l++){var c=a[l];for(Se=c;Se!==null;){var d=Se;switch(d.tag){case 0:case 11:case 15:Yo(8,d,s)}var h=d.child;if(h!==null)h.return=d,Se=h;else for(;Se!==null;){d=Se;var u=d.sibling,p=d.return;if(x_(d),d===c){Se=null;break}if(u!==null){u.return=p,Se=u;break}Se=p}}}var g=s.alternate;if(g!==null){var M=g.child;if(M!==null){g.child=null;do{var m=M.sibling;M.sibling=null,M=m}while(M!==null)}}Se=s}}if(s.subtreeFlags&2064&&o!==null)o.return=s,Se=o;else e:for(;Se!==null;){if(s=Se,s.flags&2048)switch(s.tag){case 0:case 11:case 15:Yo(9,s,s.return)}var f=s.sibling;if(f!==null){f.return=s.return,Se=f;break e}Se=s.return}}var x=t.current;for(Se=x;Se!==null;){o=Se;var y=o.child;if(o.subtreeFlags&2064&&y!==null)y.return=o,Se=y;else e:for(o=x;Se!==null;){if(a=Se,a.flags&2048)try{switch(a.tag){case 0:case 11:case 15:ql(9,a)}}catch(w){Tt(a,a.return,w)}if(a===o){Se=null;break e}var S=a.sibling;if(S!==null){S.return=a.return,Se=S;break e}Se=a.return}}if(nt=r,sr(),ci&&typeof ci.onPostCommitFiberRoot=="function")try{ci.onPostCommitFiberRoot(ll,t)}catch{}i=!0}return i}finally{at=n,Bn.transition=e}}return!1}function U_(t,e,n){e=Os(n,e),e=$0(t,e,1),t=ar(t,e,1),e=un(),t!==null&&(xo(t,1,e),vn(t,e))}function Tt(t,e,n){if(t.tag===3)U_(t,t,n);else for(;e!==null;){if(e.tag===3){U_(e,t,n);break}else if(e.tag===1){var i=e.stateNode;if(typeof e.type.getDerivedStateFromError=="function"||typeof i.componentDidCatch=="function"&&(cr===null||!cr.has(i))){t=Os(n,t),t=e_(e,t,1),e=ar(e,t,1),t=un(),e!==null&&(xo(e,1,t),vn(e,t));break}}e=e.return}}function Nw(t,e,n){var i=t.pingCache;i!==null&&i.delete(e),e=un(),t.pingedLanes|=t.suspendedLanes&n,Gt===t&&(Zt&n)===n&&(zt===4||zt===3&&(Zt&130023424)===Zt&&500>Ct()-ah?kr(t,0):oh|=n),vn(t,e)}function F_(t,e){e===0&&(t.mode&1?(e=ul,ul<<=1,!(ul&130023424)&&(ul=4194304)):e=1);var n=un();t=Di(t,e),t!==null&&(xo(t,e,n),vn(t,n))}function Uw(t){var e=t.memoizedState,n=0;e!==null&&(n=e.retryLane),F_(t,n)}function Fw(t,e){var n=0;switch(t.tag){case 13:var i=t.stateNode,r=t.memoizedState;r!==null&&(n=r.retryLane);break;case 19:i=t.stateNode;break;default:throw Error(re(314))}i!==null&&i.delete(e),F_(t,n)}var O_;O_=function(t,e,n){if(t!==null)if(t.memoizedProps!==e.pendingProps||pn.current)gn=!0;else{if(!(t.lanes&n)&&!(e.flags&128))return gn=!1,Ew(t,e,n);gn=!!(t.flags&131072)}else gn=!1,xt&&e.flags&1048576&&g0(e,Dl,e.index);switch(e.lanes=0,e.tag){case 2:var i=e.type;Kl(t,e),t=e.pendingProps;var r=Cs(e,jt.current);Us(e,n),r=Bd(null,e,i,t,r,n);var s=kd();return e.flags|=1,typeof r=="object"&&r!==null&&typeof r.render=="function"&&r.$$typeof===void 0?(e.tag=1,e.memoizedState=null,e.updateQueue=null,mn(i)?(s=!0,Cl(e)):s=!1,e.memoizedState=r.state!==null&&r.state!==void 0?r.state:null,Ld(e),r.updater=Xl,e.stateNode=r,r._reactInternals=e,Xd(e,i,t,n),e=qd(null,e,i,!0,s,n)):(e.tag=0,xt&&s&&yd(e),cn(null,e,r,n),e=e.child),e;case 16:i=e.elementType;e:{switch(Kl(t,e),t=e.pendingProps,r=i._init,i=r(i._payload),e.type=i,r=e.tag=Bw(i),t=qn(i,t),r){case 0:e=Zd(null,e,i,t,n);break e;case 1:e=c_(null,e,i,t,n);break e;case 11:e=r_(null,e,i,t,n);break e;case 14:e=s_(null,e,i,qn(i.type,t),n);break e}throw Error(re(306,i,""))}return e;case 0:return i=e.type,r=e.pendingProps,r=e.elementType===i?r:qn(i,r),Zd(t,e,i,r,n);case 1:return i=e.type,r=e.pendingProps,r=e.elementType===i?r:qn(i,r),c_(t,e,i,r,n);case 3:e:{if(u_(e),t===null)throw Error(re(387));i=e.pendingProps,s=e.memoizedState,r=s.element,w0(t,e),Bl(e,i,null,n);var o=e.memoizedState;if(i=o.element,s.isDehydrated)if(s={element:i,isDehydrated:!1,cache:o.cache,pendingSuspenseBoundaries:o.pendingSuspenseBoundaries,transitions:o.transitions},e.updateQueue.baseState=s,e.memoizedState=s,e.flags&256){r=Os(Error(re(423)),e),e=f_(t,e,i,n,r);break e}else if(i!==r){r=Os(Error(re(424)),e),e=f_(t,e,i,n,r);break e}else for(Tn=nr(e.stateNode.containerInfo.firstChild),En=e,xt=!0,Zn=null,n=E0(e,null,i,n),e.child=n;n;)n.flags=n.flags&-3|4096,n=n.sibling;else{if(Ds(),i===r){e=Ni(t,e,n);break e}cn(t,e,i,n)}e=e.child}return e;case 5:return b0(e),t===null&&Td(e),i=e.type,r=e.pendingProps,s=t!==null?t.memoizedProps:null,o=r.children,md(i,r)?o=null:s!==null&&md(i,s)&&(e.flags|=32),l_(t,e),cn(t,e,o,n),e.child;case 6:return t===null&&Td(e),null;case 13:return d_(t,e,n);case 4:return Dd(e,e.stateNode.containerInfo),i=e.pendingProps,t===null?e.child=Is(e,null,i,n):cn(t,e,i,n),e.child;case 11:return i=e.type,r=e.pendingProps,r=e.elementType===i?r:qn(i,r),r_(t,e,i,r,n);case 7:return cn(t,e,e.pendingProps,n),e.child;case 8:return cn(t,e,e.pendingProps.children,n),e.child;case 12:return cn(t,e,e.pendingProps.children,n),e.child;case 10:e:{if(i=e.type._context,r=e.pendingProps,s=e.memoizedProps,o=r.value,ht(Ul,i._currentValue),i._currentValue=o,s!==null)if(Kn(s.value,o)){if(s.children===r.children&&!pn.current){e=Ni(t,e,n);break e}}else for(s=e.child,s!==null&&(s.return=e);s!==null;){var a=s.dependencies;if(a!==null){o=s.child;for(var l=a.firstContext;l!==null;){if(l.context===i){if(s.tag===1){l=Ii(-1,n&-n),l.tag=2;var c=s.updateQueue;if(c!==null){c=c.shared;var d=c.pending;d===null?l.next=l:(l.next=d.next,d.next=l),c.pending=l}}s.lanes|=n,l=s.alternate,l!==null&&(l.lanes|=n),Cd(s.return,n,e),a.lanes|=n;break}l=l.next}}else if(s.tag===10)o=s.type===e.type?null:s.child;else if(s.tag===18){if(o=s.return,o===null)throw Error(re(341));o.lanes|=n,a=o.alternate,a!==null&&(a.lanes|=n),Cd(o,n,e),o=s.sibling}else o=s.child;if(o!==null)o.return=s;else for(o=s;o!==null;){if(o===e){o=null;break}if(s=o.sibling,s!==null){s.return=o.return,o=s;break}o=o.return}s=o}cn(t,e,r.children,n),e=e.child}return e;case 9:return r=e.type,i=e.pendingProps.children,Us(e,n),r=Fn(r),i=i(r),e.flags|=1,cn(t,e,i,n),e.child;case 14:return i=e.type,r=qn(i,e.pendingProps),r=qn(i.type,r),s_(t,e,i,r,n);case 15:return o_(t,e,e.type,e.pendingProps,n);case 17:return i=e.type,r=e.pendingProps,r=e.elementType===i?r:qn(i,r),Kl(t,e),e.tag=1,mn(i)?(t=!0,Cl(e)):t=!1,Us(e,n),J0(e,i,r),Xd(e,i,r,n),qd(null,e,i,!0,t,n);case 19:return p_(t,e,n);case 22:return a_(t,e,n)}throw Error(re(156,e.tag))};function B_(t,e){return _g(t,e)}function Ow(t,e,n,i){this.tag=t,this.key=n,this.sibling=this.child=this.return=this.stateNode=this.type=this.elementType=null,this.index=0,this.ref=null,this.pendingProps=e,this.dependencies=this.memoizedState=this.updateQueue=this.memoizedProps=null,this.mode=i,this.subtreeFlags=this.flags=0,this.deletions=null,this.childLanes=this.lanes=0,this.alternate=null}function kn(t,e,n,i){return new Ow(t,e,n,i)}function mh(t){return t=t.prototype,!(!t||!t.isReactComponent)}function Bw(t){if(typeof t=="function")return mh(t)?1:0;if(t!=null){if(t=t.$$typeof,t===yf)return 11;if(t===Tf)return 14}return 2}function hr(t,e){var n=t.alternate;return n===null?(n=kn(t.tag,e,t.key,t.mode),n.elementType=t.elementType,n.type=t.type,n.stateNode=t.stateNode,n.alternate=t,t.alternate=n):(n.pendingProps=e,n.type=t.type,n.flags=0,n.subtreeFlags=0,n.deletions=null),n.flags=t.flags&14680064,n.childLanes=t.childLanes,n.lanes=t.lanes,n.child=t.child,n.memoizedProps=t.memoizedProps,n.memoizedState=t.memoizedState,n.updateQueue=t.updateQueue,e=t.dependencies,n.dependencies=e===null?null:{lanes:e.lanes,firstContext:e.firstContext},n.sibling=t.sibling,n.index=t.index,n.ref=t.ref,n}function rc(t,e,n,i,r,s){var o=2;if(i=t,typeof t=="function")mh(t)&&(o=1);else if(typeof t=="string")o=5;else e:switch(t){case gs:return Vr(n.children,r,s,e);case xf:o=8,r|=8;break;case Sf:return t=kn(12,n,e,r|2),t.elementType=Sf,t.lanes=s,t;case Mf:return t=kn(13,n,e,r),t.elementType=Mf,t.lanes=s,t;case Ef:return t=kn(19,n,e,r),t.elementType=Ef,t.lanes=s,t;case Km:return sc(n,r,s,e);default:if(typeof t=="object"&&t!==null)switch(t.$$typeof){case Xm:o=10;break e;case Ym:o=9;break e;case yf:o=11;break e;case Tf:o=14;break e;case Zi:o=16,i=null;break e}throw Error(re(130,t==null?t:typeof t,""))}return e=kn(o,n,e,r),e.elementType=t,e.type=i,e.lanes=s,e}function Vr(t,e,n,i){return t=kn(7,t,i,e),t.lanes=n,t}function sc(t,e,n,i){return t=kn(22,t,i,e),t.elementType=Km,t.lanes=n,t.stateNode={isHidden:!1},t}function gh(t,e,n){return t=kn(6,t,null,e),t.lanes=n,t}function _h(t,e,n){return e=kn(4,t.children!==null?t.children:[],t.key,e),e.lanes=n,e.stateNode={containerInfo:t.containerInfo,pendingChildren:null,implementation:t.implementation},e}function kw(t,e,n,i,r){this.tag=e,this.containerInfo=t,this.finishedWork=this.pingCache=this.current=this.pendingChildren=null,this.timeoutHandle=-1,this.callbackNode=this.pendingContext=this.context=null,this.callbackPriority=0,this.eventTimes=Wf(0),this.expirationTimes=Wf(-1),this.entangledLanes=this.finishedLanes=this.mutableReadLanes=this.expiredLanes=this.pingedLanes=this.suspendedLanes=this.pendingLanes=0,this.entanglements=Wf(0),this.identifierPrefix=i,this.onRecoverableError=r,this.mutableSourceEagerHydrationData=null}function vh(t,e,n,i,r,s,o,a,l){return t=new kw(t,e,n,a,l),e===1?(e=1,s===!0&&(e|=8)):e=0,s=kn(3,null,null,e),t.current=s,s.stateNode=t,s.memoizedState={element:i,isDehydrated:n,cache:null,transitions:null,pendingSuspenseBoundaries:null},Ld(s),t}function zw(t,e,n){var i=3<arguments.length&&arguments[3]!==void 0?arguments[3]:null;return{$$typeof:ms,key:i==null?null:""+i,children:t,containerInfo:e,implementation:n}}function k_(t){if(!t)return rr;t=t._reactInternals;e:{if(Cr(t)!==t||t.tag!==1)throw Error(re(170));var e=t;do{switch(e.tag){case 3:e=e.stateNode.context;break e;case 1:if(mn(e.type)){e=e.stateNode.__reactInternalMemoizedMergedChildContext;break e}}e=e.return}while(e!==null);throw Error(re(171))}if(t.tag===1){var n=t.type;if(mn(n))return h0(t,n,e)}return e}function z_(t,e,n,i,r,s,o,a,l){return t=vh(n,i,!0,t,r,s,o,a,l),t.context=k_(null),n=t.current,i=un(),r=fr(n),s=Ii(i,r),s.callback=e??null,ar(n,s,r),t.current.lanes=r,xo(t,r,i),vn(t,i),t}function oc(t,e,n,i){var r=e.current,s=un(),o=fr(r);return n=k_(n),e.context===null?e.context=n:e.pendingContext=n,e=Ii(s,o),e.payload={element:t},i=i===void 0?null:i,i!==null&&(e.callback=i),t=ar(r,e,o),t!==null&&(jn(t,r,o,s),Ol(t,r,o)),o}function ac(t){if(t=t.current,!t.child)return null;switch(t.child.tag){case 5:return t.child.stateNode;default:return t.child.stateNode}}function V_(t,e){if(t=t.memoizedState,t!==null&&t.dehydrated!==null){var n=t.retryLane;t.retryLane=n!==0&&n<e?n:e}}function xh(t,e){V_(t,e),(t=t.alternate)&&V_(t,e)}function Vw(){return null}var H_=typeof reportError=="function"?reportError:function(t){console.error(t)};function Sh(t){this._internalRoot=t}lc.prototype.render=Sh.prototype.render=function(t){var e=this._internalRoot;if(e===null)throw Error(re(409));oc(t,e,null,null)},lc.prototype.unmount=Sh.prototype.unmount=function(){var t=this._internalRoot;if(t!==null){this._internalRoot=null;var e=t.containerInfo;Br(function(){oc(null,t,null,null)}),e[bi]=null}};function lc(t){this._internalRoot=t}lc.prototype.unstable_scheduleHydration=function(t){if(t){var e=wg();t={blockedOn:null,target:t,priority:e};for(var n=0;n<$i.length&&e!==0&&e<$i[n].priority;n++);$i.splice(n,0,t),n===0&&bg(t)}};function yh(t){return!(!t||t.nodeType!==1&&t.nodeType!==9&&t.nodeType!==11)}function cc(t){return!(!t||t.nodeType!==1&&t.nodeType!==9&&t.nodeType!==11&&(t.nodeType!==8||t.nodeValue!==" react-mount-point-unstable "))}function G_(){}function Hw(t,e,n,i,r){if(r){if(typeof i=="function"){var s=i;i=function(){var c=ac(o);s.call(c)}}var o=z_(e,i,t,0,null,!1,!1,"",G_);return t._reactRootContainer=o,t[bi]=o.current,Io(t.nodeType===8?t.parentNode:t),Br(),o}for(;r=t.lastChild;)t.removeChild(r);if(typeof i=="function"){var a=i;i=function(){var c=ac(l);a.call(c)}}var l=vh(t,0,!1,null,null,!1,!1,"",G_);return t._reactRootContainer=l,t[bi]=l.current,Io(t.nodeType===8?t.parentNode:t),Br(function(){oc(e,l,n,i)}),l}function uc(t,e,n,i,r){var s=n._reactRootContainer;if(s){var o=s;if(typeof r=="function"){var a=r;r=function(){var l=ac(o);a.call(l)}}oc(e,o,t,r)}else o=Hw(n,e,t,r,i);return ac(o)}Eg=function(t){switch(t.tag){case 3:var e=t.stateNode;if(e.current.memoizedState.isDehydrated){var n=vo(e.pendingLanes);n!==0&&(Xf(e,n|1),vn(e,Ct()),!(nt&6)&&(zs=Ct()+500,sr()))}break;case 13:Br(function(){var i=Di(t,1);if(i!==null){var r=un();jn(i,t,1,r)}}),xh(t,1)}},Yf=function(t){if(t.tag===13){var e=Di(t,134217728);if(e!==null){var n=un();jn(e,t,134217728,n)}xh(t,134217728)}},Tg=function(t){if(t.tag===13){var e=fr(t),n=Di(t,e);if(n!==null){var i=un();jn(n,t,e,i)}xh(t,e)}},wg=function(){return at},Ag=function(t,e){var n=at;try{return at=t,e()}finally{at=n}},Bf=function(t,e,n){switch(e){case"input":if(Pf(t,n),e=n.name,n.type==="radio"&&e!=null){for(n=t;n.parentNode;)n=n.parentNode;for(n=n.querySelectorAll("input[name="+JSON.stringify(""+e)+'][type="radio"]'),e=0;e<n.length;e++){var i=n[e];if(i!==t&&i.form===t.form){var r=Rl(i);if(!r)throw Error(re(90));Qm(i),Pf(i,r)}}}break;case"textarea":tg(t,n);break;case"select":e=n.value,e!=null&&_s(t,!!n.multiple,e,!1)}},ug=dh,fg=Br;var Gw={usingClientEntryPoint:!1,Events:[Fo,Rs,Rl,lg,cg,dh]},Qo={findFiberByHostInstance:Pr,bundleType:0,version:"18.3.1",rendererPackageName:"react-dom"},Ww={bundleType:Qo.bundleType,version:Qo.version,rendererPackageName:Qo.rendererPackageName,rendererConfig:Qo.rendererConfig,overrideHookState:null,overrideHookStateDeletePath:null,overrideHookStateRenamePath:null,overrideProps:null,overridePropsDeletePath:null,overridePropsRenamePath:null,setErrorHandler:null,setSuspenseHandler:null,scheduleUpdate:null,currentDispatcherRef:Ri.ReactCurrentDispatcher,findHostInstanceByFiber:function(t){return t=mg(t),t===null?null:t.stateNode},findFiberByHostInstance:Qo.findFiberByHostInstance||Vw,findHostInstancesForRefresh:null,scheduleRefresh:null,scheduleRoot:null,setRefreshHandler:null,getCurrentFiber:null,reconcilerVersion:"18.3.1-next-f1338f8080-20240426"};if(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__<"u"){var fc=__REACT_DEVTOOLS_GLOBAL_HOOK__;if(!fc.isDisabled&&fc.supportsFiber)try{ll=fc.inject(Ww),ci=fc}catch{}}In.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED=Gw,In.createPortal=function(t,e){var n=2<arguments.length&&arguments[2]!==void 0?arguments[2]:null;if(!yh(e))throw Error(re(200));return zw(t,e,null,n)},In.createRoot=function(t,e){if(!yh(t))throw Error(re(299));var n=!1,i="",r=H_;return e!=null&&(e.unstable_strictMode===!0&&(n=!0),e.identifierPrefix!==void 0&&(i=e.identifierPrefix),e.onRecoverableError!==void 0&&(r=e.onRecoverableError)),e=vh(t,1,!1,null,null,n,!1,i,r),t[bi]=e.current,Io(t.nodeType===8?t.parentNode:t),new Sh(e)},In.findDOMNode=function(t){if(t==null)return null;if(t.nodeType===1)return t;var e=t._reactInternals;if(e===void 0)throw typeof t.render=="function"?Error(re(188)):(t=Object.keys(t).join(","),Error(re(268,t)));return t=mg(e),t=t===null?null:t.stateNode,t},In.flushSync=function(t){return Br(t)},In.hydrate=function(t,e,n){if(!cc(e))throw Error(re(200));return uc(null,t,e,!0,n)},In.hydrateRoot=function(t,e,n){if(!yh(t))throw Error(re(405));var i=n!=null&&n.hydratedSources||null,r=!1,s="",o=H_;if(n!=null&&(n.unstable_strictMode===!0&&(r=!0),n.identifierPrefix!==void 0&&(s=n.identifierPrefix),n.onRecoverableError!==void 0&&(o=n.onRecoverableError)),e=z_(e,null,t,1,n??null,r,!1,s,o),t[bi]=e.current,Io(t),i)for(t=0;t<i.length;t++)n=i[t],r=n._getVersion,r=r(n._source),e.mutableSourceEagerHydrationData==null?e.mutableSourceEagerHydrationData=[n,r]:e.mutableSourceEagerHydrationData.push(n,r);return new lc(e)},In.render=function(t,e,n){if(!cc(e))throw Error(re(200));return uc(null,t,e,!1,n)},In.unmountComponentAtNode=function(t){if(!cc(t))throw Error(re(40));return t._reactRootContainer?(Br(function(){uc(null,null,t,!1,function(){t._reactRootContainer=null,t[bi]=null})}),!0):!1},In.unstable_batchedUpdates=dh,In.unstable_renderSubtreeIntoContainer=function(t,e,n,i){if(!cc(n))throw Error(re(200));if(t==null||t._reactInternals===void 0)throw Error(re(38));return uc(t,e,n,!1,i)},In.version="18.3.1-next-f1338f8080-20240426";function W_(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>"u"||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!="function"))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(W_)}catch(t){console.error(t)}}W_();const Mh="flex h-full w-full items-center justify-center",Xw={empty:`${Mh} text-sm text-fg-muted`,loading:`${Mh} text-sm text-fg-muted motion-safe:animate-pulse`,error:`${Mh} rounded bg-bg p-4 text-center text-sm text-fg-muted`};function dc({variant:t,children:e}){return Ae.jsx("div",{className:Xw[t],children:e})}function Yw({item:t,view:e,sync:n,label:i,isDraggable:r,onDragStart:s,onFrame:o}){if(!t)return Ae.jsx(dc,{variant:"empty",children:"no point cloud logged yet"});const{arrays:a,meta:l}=t;return Ae.jsxs("div",{className:"relative flex h-full w-full overflow-hidden rounded bg-bg",children:[Ae.jsx("div",{className:"min-w-0 flex-1",children:Ae.jsx(kE,{data:a.data,channels:l.channels,nPoints:l.n_points,bounds:l.bounds,colorMode:e.colorMode,pointSize:e.pointSize,pointSizeMode:e.pointSizeMode,background:e.background,showAxes:e.showAxes,showPlanes:e.showPlanes,cameraMode:e.cameraMode,sync:n,onFrame:o})}),Ae.jsx(el,{text:`${l.n_points.toLocaleString()} points · ${l.channels}`}),Ae.jsx($a,{label:i,isDraggable:r,onDragStart:s})]})}const Kw={dark:856343,light:16185594},X_=7252223,Zw=0;function Y_(t,e,n,i=!1){return t==="face-colors"&&!i?e?"vertex-colors":n?"values":"solid":t==="vertex-colors"&&!e?n?"values":"solid":t==="values"&&!n?e?"vertex-colors":"solid":t}function qw(t,e,n,i){const s=(n>0?i.length/n:3)===4?4:3,o=new Float32Array(n*9),a=new Float32Array(n*3*s);for(let l=0;l<n;l++){const c=i[l*s],d=i[l*s+1],h=i[l*s+2],u=s===4?i[l*s+3]:1;for(let p=0;p<3;p++){const g=e[l*3+p],M=(l*3+p)*3;o[M]=t[g*3],o[M+1]=t[g*3+1],o[M+2]=t[g*3+2];const m=(l*3+p)*s;a[m]=c,a[m+1]=d,a[m+2]=h,s===4&&(a[m+3]=u)}}return{outPositions:o,outColors:a,channels:s}}function Qw(t){let e=1/0,n=-1/0;for(let i=0;i<t.length;i++){const r=t[i];r<e&&(e=r),r>n&&(n=r)}return!Number.isFinite(e)||!Number.isFinite(n)?[0,1]:[e,n]}function K_(t,e,n,i,r){if(t==="vertex-colors"&&r)return Om(r,e,3,0);if(t==="values"&&n){const s=i??Qw(n);return ja(n,e,s,"turbo")}return null}function Jw({positions:t,faces:e,nVertices:n,nFaces:i,values:r=null,valueRange:s=null,colors:o=null,faceColors:a=null,normals:l=null,bounds:c,colorMode:d,shading:h,wireframe:u,doubleSided:p,background:g,className:M,sync:m=null,onFrame:f,showAxes:x=!1,showPlanes:y=!1,cameraMode:S="orbital"}){const w=Qa({background:Kw[g],sync:m,showAxes:x,showPlanes:y,cameraMode:S,onFrame:f}),{requestRender:T,fitToBounds:b,refs:_}=w,A=ne.useRef(null),C=ne.useRef(null),P=ne.useRef(null),D=ne.useRef(null),W=ne.useRef(null),Z=ne.useRef(null),B=ne.useRef([]),X=ne.useMemo(()=>Y_(d,!!o,!!r,!!a),[d,o,r,a]),H=X==="face-colors"&&!!a;return ne.useEffect(()=>{const L=_.scene.current;if(!L)return;const k=new Tx(16777215,3817290,1.1),Y=new Rx(16777215,1.1);return Y.position.set(1,1.6,1.2),L.add(k,Y),B.current=[k,Y],T(),()=>{L.remove(k,Y)}},[]),ne.useEffect(()=>{var He,q,se,ie;const L=_.scene.current;if(!L)return;A.current&&(L.remove(A.current),(He=C.current)==null||He.dispose(),(q=P.current)==null||q.dispose()),D.current&&(L.remove(D.current),(se=W.current)==null||se.dispose(),(ie=Z.current)==null||ie.dispose());const k=new yx({color:X_,roughness:.85,metalness:0,flatShading:h==="flat",side:p?Rn:$n,polygonOffset:!0,polygonOffsetFactor:1,polygonOffsetUnits:1}),Y=new Xt;if(H&&a){const{outPositions:be,outColors:ke,channels:Ce}=qw(t,e,i,a);Y.setAttribute("position",new bt(be,3)),Y.computeVertexNormals(),Y.setAttribute("color",new bt(ke,Ce)),k.vertexColors=!0,Ce===4&&(k.transparent=!0)}else{Y.setAttribute("position",new bt(t,3)),Y.setIndex(new bt(e,1)),l&&l.length===n*3?Y.setAttribute("normal",new bt(l,3)):Y.computeVertexNormals();const be=K_(X,n,r,s,o);be&&(Y.setAttribute("color",new bt(be,3)),k.vertexColors=!0)}const $=new Ln(Y,k);L.add($),C.current=Y,P.current=k,A.current=$;const oe=new gx(Y),Be=new no({color:Zw,transparent:!0,opacity:.35}),Qe=new Na(oe,Be);Qe.visible=u,L.add(Qe),W.current=oe,Z.current=Be,D.current=Qe,b(c)},[t,e,n,i,l,H,a]),ne.useEffect(()=>{const L=C.current,k=P.current;if(!L||!k||H)return;const Y=K_(X,n,r,s,o);if(Y){let $=L.getAttribute("color");!$||$.count!==n?($=new bt(Y,3),L.setAttribute("color",$)):($.copyArray(Y),$.needsUpdate=!0),k.vertexColors=!0}else k.vertexColors=!1,k.color.setHex(X_);k.needsUpdate=!0,T()},[X,r,s,o,n,H]),ne.useEffect(()=>{const L=P.current;L&&(L.flatShading=h==="flat",L.needsUpdate=!0,T())},[h]),ne.useEffect(()=>{const L=P.current;L&&(L.side=p?Rn:$n,L.needsUpdate=!0,T())},[p]),ne.useEffect(()=>{const L=D.current;L&&(L.visible=u,T())},[u]),ne.useEffect(()=>()=>{var L,k,Y,$;(L=C.current)==null||L.dispose(),(k=P.current)==null||k.dispose(),(Y=W.current)==null||Y.dispose(),($=Z.current)==null||$.dispose()},[]),Ae.jsx(Ja,{handle:w,className:M})}function jw(t){return t?Object.keys(t):[]}function $w(t){let e=1/0,n=-1/0;for(let i=0;i<t.length;i++){const r=t[i];r<e&&(e=r),r>n&&(n=r)}return!Number.isFinite(e)||!Number.isFinite(n)?[0,1]:[e,n]}function Z_(t,e,n){const i=jw(t);if(i.length===0)return{name:null,values:null,range:null};const r=e&&i.includes(e)?e:i[0],s=t[r],o=n==null?void 0:n.find(l=>l.name===r),a=o?[o.min,o.max]:$w(s);return{name:r,values:s,range:a}}function eA({item:t,view:e,sync:n,label:i,isDraggable:r,onDragStart:s,onFrame:o,colorRange:a}){if(!t)return Ae.jsx(dc,{variant:"empty",children:"no mesh logged yet"});const{arrays:l,meta:c}=t,d=Z_(l.properties,e.property,c.properties??null),u=Y_(e.colorMode,!!l.colors,!!d.values,!!l.faceColors)==="values"?a??d.range:d.range;return Ae.jsxs("div",{className:"relative flex h-full w-full flex-col overflow-hidden rounded bg-bg",children:[Ae.jsx("div",{className:"flex flex-1 min-h-0 overflow-hidden",children:Ae.jsx("div",{className:"min-w-0 flex-1",children:Ae.jsx(Jw,{positions:l.positions,faces:l.faces,nVertices:c.n_vertices,nFaces:c.n_faces,values:d.values,valueRange:u,colors:l.colors,faceColors:l.faceColors,normals:l.normals,bounds:c.bounds,colorMode:e.colorMode,shading:e.shading,wireframe:e.wireframe,doubleSided:e.doubleSided,background:e.background,showAxes:e.showAxes,showPlanes:e.showPlanes,cameraMode:e.cameraMode,sync:n,onFrame:o})})}),Ae.jsx(el,{text:`${c.n_vertices.toLocaleString()} verts · ${c.n_faces.toLocaleString()} faces${d.name?` · ${d.name}`:""}`}),Ae.jsx($a,{label:i,isDraggable:r,onDragStart:s})]})}function tA({title:t,body:e,className:n}){return Ae.jsx("div",{className:n??"relative h-full w-full",children:Ae.jsxs("div",{className:"flex h-full w-full flex-col items-center justify-center gap-1 rounded bg-bg-hover p-4 text-center",children:[Ae.jsx("div",{className:"text-sm font-semibold text-fg",children:t}),Ae.jsx("div",{className:"text-xs text-fg-muted",children:e})]})})}const nA={dark:856343,light:16185594},q_=256;let Jo=null;function iA(){if(Jo!==null)return Jo;try{const e=document.createElement("canvas").getContext("webgl2");if(e){const n=e.getExtension("WEBGL_lose_context");n==null||n.loseContext()}Jo=!!e}catch{Jo=!1}return Jo}function rA(t,e,n){const i=n-e||1,r=new Uint8Array(t.length);for(let s=0;s<t.length;s++){const o=(t[s]-e)/i;r[s]=Math.max(0,Math.min(255,Math.round(o*255)))}return r}function Q_(t){const e=Um(t),n=new Uint8Array(256*4);for(let r=0;r<256;r++)n[r*4]=e[r*3],n[r*4+1]=e[r*3+1],n[r*4+2]=e[r*3+2],n[r*4+3]=255;const i=new yp(n,256,1,bn,sn);return i.minFilter=Dt,i.magFilter=Dt,i.wrapS=fn,i.wrapT=fn,i.needsUpdate=!0,i}const sA=`precision highp float;

in vec3 position;

uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 cameraPosition;

out vec3 vOrigin;
out vec3 vDirection;

void main() {
  // Camera position transformed into this mesh's local (object) space.
  vOrigin = ( inverse( modelMatrix ) * vec4( cameraPosition, 1.0 ) ).xyz;
  vDirection = position - vOrigin;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`,oA=`precision highp float;
precision highp sampler3D;

in vec3 vOrigin;
in vec3 vDirection;
out vec4 outColor;

uniform sampler3D uData;
uniform sampler2D uLUT;
uniform int uMode;          // 0 = MIP, 1 = ISO
uniform float uSteps;       // <= ${q_}.0
uniform float uIsovalue;    // normalized [0,1]
uniform vec3 uClipMin;      // normalized [0,1], texture-space (x=W,y=H,z=D)
uniform vec3 uClipMax;
uniform vec3 uTexelSize;    // (1/W, 1/H, 1/D), for the gradient step

const int MAX_STEPS = ${q_};
const vec3 BOX_MIN = vec3( -0.5 );
const vec3 BOX_MAX = vec3( 0.5 );

// Ray/box intersection (slab method) against the local unit box.
vec2 hitBox( vec3 orig, vec3 dir ) {
  vec3 invDir = 1.0 / dir;
  vec3 t0s = ( BOX_MIN - orig ) * invDir;
  vec3 t1s = ( BOX_MAX - orig ) * invDir;
  vec3 tsmaller = min( t0s, t1s );
  vec3 tbigger  = max( t0s, t1s );
  float t0 = max( tsmaller.x, max( tsmaller.y, tsmaller.z ) );
  float t1 = min( tbigger.x, min( tbigger.y, tbigger.z ) );
  return vec2( t0, t1 );
}

// Local-space position [-0.5,0.5]^3 -> texture coordinate [0,1]^3.
vec3 toTexCoord( vec3 localPos ) { return localPos + 0.5; }

bool inClip( vec3 uv ) {
  return all( greaterThanEqual( uv, uClipMin ) ) && all( lessThanEqual( uv, uClipMax ) );
}

// Density at a texture coordinate, zero outside the clip box (slicing).
float sampleDensity( vec3 uv ) {
  if ( !inClip( uv ) ) return 0.0;
  return texture( uData, uv ).r;
}

vec3 computeGradient( vec3 uv ) {
  float dx = sampleDensity( uv + vec3( uTexelSize.x, 0.0, 0.0 ) ) - sampleDensity( uv - vec3( uTexelSize.x, 0.0, 0.0 ) );
  float dy = sampleDensity( uv + vec3( 0.0, uTexelSize.y, 0.0 ) ) - sampleDensity( uv - vec3( 0.0, uTexelSize.y, 0.0 ) );
  float dz = sampleDensity( uv + vec3( 0.0, 0.0, uTexelSize.z ) ) - sampleDensity( uv - vec3( 0.0, 0.0, uTexelSize.z ) );
  return vec3( dx, dy, dz );
}

void main() {
  vec3 rayDir = normalize( vDirection );
  vec2 bounds = hitBox( vOrigin, rayDir );
  if ( bounds.x > bounds.y ) discard; // ray misses the box entirely

  float t0 = max( bounds.x, 0.0 ); // camera may be inside the box
  float t1 = bounds.y;
  if ( t1 <= t0 ) discard;

  float steps = clamp( uSteps, 1.0, float( MAX_STEPS ) );
  float dt = ( t1 - t0 ) / steps;

  if ( uMode == 0 ) {
    // ---- MIP: maximum-intensity projection ----
    float maxDensity = 0.0;
    float t = t0;
    for ( int i = 0; i < MAX_STEPS; i++ ) {
      if ( float( i ) >= steps ) break;
      vec3 uv = toTexCoord( vOrigin + rayDir * t );
      maxDensity = max( maxDensity, sampleDensity( uv ) );
      t += dt;
    }
    if ( maxDensity <= 0.001 ) discard; // ray hit nothing (or was clipped away)
    outColor = vec4( texture( uLUT, vec2( maxDensity, 0.5 ) ).rgb, 1.0 );
  } else {
    // ---- ISO: first-hit isosurface, gradient-shaded ----
    float prevD = sampleDensity( toTexCoord( vOrigin + rayDir * t0 ) );
    float t = t0 + dt;
    bool hit = false;
    vec3 hitUv = vec3( 0.0 );
    for ( int i = 1; i < MAX_STEPS; i++ ) {
      if ( float( i ) >= steps ) break;
      vec3 uv = toTexCoord( vOrigin + rayDir * t );
      float d = sampleDensity( uv );
      if ( prevD < uIsovalue && d >= uIsovalue ) {
        // Sub-step refinement: linearly interpolate the crossing point
        // between the previous and current samples.
        float denom = max( d - prevD, 1e-6 );
        float frac = ( uIsovalue - prevD ) / denom;
        hitUv = toTexCoord( vOrigin + rayDir * ( t - dt + dt * frac ) );
        hit = true;
        break;
      }
      prevD = d;
      t += dt;
    }
    if ( !hit ) discard;
    vec3 grad = computeGradient( hitUv );
    // Outward normal = -gradient (see function docstring above).
    vec3 normal = length( grad ) > 1e-6 ? -normalize( grad ) : vec3( 0.0, 0.0, 1.0 );
    vec3 lightDir = normalize( vec3( 0.4, 0.6, 0.7 ) );
    float diffuse = max( dot( normal, lightDir ), 0.0 );
    float shade = 0.35 + 0.65 * diffuse; // ambient floor + lambert term
    vec3 base = texture( uLUT, vec2( uIsovalue, 0.5 ) ).rgb;
    outColor = vec4( base * shade, 1.0 );
  }
}
`;function aA(t,e,n){const[i,r,s]=t,o=s*e[2],a=r*e[1],l=i*e[0],c=n[2],d=n[1],h=n[0];return{scale:[o,a,l],position:[c+o/2,d+a/2,h+l/2],bounds:{min:[c,d,h],max:[c+o,d+a,h+l]}}}function lA({data:t,shape:e,spacing:n,origin:i,vmin:r,vmax:s,mode:o,isovalue:a,colormap:l,steps:c,clip:d,background:h,className:u,sync:p=null,onFrame:g,showAxes:M=!1,showPlanes:m=!1,cameraMode:f="orbital"}){const x=Qa({background:nA[h],sync:p,showAxes:M,showPlanes:m,cameraMode:f,onFrame:g}),{requestRender:y,fitToBounds:S,refs:w}=x,T=ne.useRef(null),b=ne.useRef(null),_=ne.useRef(null),A=ne.useRef(null),C=ne.useRef(null);return ne.useEffect(()=>{var He,q,se,ie;const P=w.scene.current;if(!P)return;T.current&&(P.remove(T.current),(He=b.current)==null||He.dispose(),(q=_.current)==null||q.dispose(),(se=A.current)==null||se.dispose(),(ie=C.current)==null||ie.dispose());const[D,W,Z]=e,B=rA(t,r,s),X=new sp(B,Z,W,D);X.format=Oc,X.type=sn,X.minFilter=Dt,X.magFilter=Dt,X.wrapR=fn,X.wrapS=fn,X.wrapT=fn,X.needsUpdate=!0;const H=Q_(l),L={uData:{value:X},uLUT:{value:H},uMode:{value:o==="mip"?0:1},uSteps:{value:c},uIsovalue:{value:a},uClipMin:{value:new U(...d.min)},uClipMax:{value:new U(...d.max)},uTexelSize:{value:new U(1/Z,1/W,1/D)}},k=new Ip({glslVersion:Su,vertexShader:sA,fragmentShader:oA,uniforms:L,side:rn,transparent:!1}),Y=new ls(1,1,1),$=new Ln(Y,k),{scale:oe,position:Be,bounds:Qe}=aA(e,n,i);$.scale.set(...oe),$.position.set(...Be),P.add($),T.current=$,b.current=Y,_.current=k,A.current=X,C.current=H,S(Qe)},[t,e,n,i,r,s]),ne.useEffect(()=>{var W;const P=_.current;if(!P)return;(W=C.current)==null||W.dispose();const D=Q_(l);C.current=D,P.uniforms.uLUT.value=D,y()},[l]),ne.useEffect(()=>{const P=_.current;if(!P)return;const D=P.uniforms;D.uMode.value=o==="mip"?0:1,D.uSteps.value=c,D.uIsovalue.value=a,D.uClipMin.value.set(...d.min),D.uClipMax.value.set(...d.max),y()},[o,a,c,d]),ne.useEffect(()=>()=>{var P,D,W,Z;(P=b.current)==null||P.dispose(),(D=_.current)==null||D.dispose(),(W=A.current)==null||W.dispose(),(Z=C.current)==null||Z.dispose()},[]),Ae.jsx(Ja,{handle:x,className:u})}function cA(t){return iA()?Ae.jsx(lA,{...t}):Ae.jsx(tA,{className:t.className,title:"WebGL2 unavailable",body:"Volume rendering needs WebGL2 (raymarched 3D textures), which this browser or GPU doesn't support."})}function uA({item:t,view:e,sync:n,label:i,isDraggable:r,onDragStart:s,onFrame:o,colorRange:a}){if(!t)return Ae.jsx(dc,{variant:"empty",children:"no volume logged yet"});const{arrays:l,meta:c}=t,[d,h]=a??[c.vmin,c.vmax];return Ae.jsxs("div",{className:"relative flex h-full w-full flex-col overflow-hidden rounded bg-bg",children:[Ae.jsx("div",{className:"flex flex-1 min-h-0 overflow-hidden",children:Ae.jsx("div",{className:"min-w-0 flex-1 overflow-hidden rounded bg-bg",children:Ae.jsx(cA,{data:l.data,shape:c.shape,spacing:c.spacing,origin:c.origin,vmin:d,vmax:h,mode:e.mode,isovalue:e.isovalue,colormap:e.colormap,steps:e.steps,clip:{min:e.clipMin,max:e.clipMax},background:e.background,showAxes:e.showAxes,showPlanes:e.showPlanes,cameraMode:e.cameraMode,sync:n,onFrame:o})})}),Ae.jsx(el,{text:`${c.shape.join("×")} · vmin ${c.vmin.toFixed(3)} · vmax ${c.vmax.toFixed(3)}`}),Ae.jsx($a,{label:i,isDraggable:r,onDragStart:s})]})}const fA={dark:856343,light:16185594},Eh=[.36,.66,.96],J_=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];function j_(t,e){return t==="value"&&!e?"depth":t}function dA(t,e,n,i,r,s){if(s==="value"&&n)return ja(n,t,r??[0,1],"turbo");if(s==="depth")return ja(e,t,[0,Math.max(i,1e-6)],"turbo");const o=new Float32Array(t*3);for(let a=0;a<t;a++)o[a*3]=Eh[0],o[a*3+1]=Eh[1],o[a*3+2]=Eh[2];return o}function hA(t,e,n,i,r){const[s,o]=i,a=[];for(let l=0;l<t;l++){const c=e[l]??0;if(!(c<s||c>o)){if(r&&n){const d=n[l]??0;if(d<r[0]||d>r[1])continue}a.push(l)}}return a}function pA(t,e,n,i){const r=J_.length*2,s=new Float32Array(n.length*r*3),o=new Float32Array(n.length*r*3),a=new Float32Array(8*3);let l=0,c=0;for(const d of n){const h=t[d*3],u=t[d*3+1],p=t[d*3+2],g=e[d*3],M=e[d*3+1],m=e[d*3+2];a[0]=h,a[1]=u,a[2]=p,a[3]=g,a[4]=u,a[5]=p,a[6]=g,a[7]=M,a[8]=p,a[9]=h,a[10]=M,a[11]=p,a[12]=h,a[13]=u,a[14]=m,a[15]=g,a[16]=u,a[17]=m,a[18]=g,a[19]=M,a[20]=m,a[21]=h,a[22]=M,a[23]=m;const f=i[d*3],x=i[d*3+1],y=i[d*3+2];for(const[S,w]of J_)s[l++]=a[S*3],s[l++]=a[S*3+1],s[l++]=a[S*3+2],s[l++]=a[w*3],s[l++]=a[w*3+1],s[l++]=a[w*3+2],o[c++]=f,o[c++]=x,o[c++]=y,o[c++]=f,o[c++]=x,o[c++]=y}return{positions:s,colors:o}}function mA({mins:t,maxs:e,depth:n,values:i,nBoxes:r,bounds:s,maxDepth:o,valueRange:a,colorMode:l,depthRange:c,valueThreshold:d,background:h,className:u,sync:p=null,onVisibleCount:g,onFrame:M,showAxes:m=!1,showPlanes:f=!1,cameraMode:x="orbital",overrideColors:y=null}){const S=Qa({background:fA[h],sync:p,showAxes:m,showPlanes:f,cameraMode:x,onFrame:M}),{requestRender:w,fitToBounds:T,refs:b}=S,_=ne.useRef(null),A=ne.useRef(null),C=ne.useRef(null),P=j_(l,!!i);return ne.useEffect(()=>{var Y,$;const D=b.scene.current;if(!D)return;const W=hA(r,n,i,c,d??null),Z=y??dA(r,n,i,o,a,P),{positions:B,colors:X}=pA(t,e,W,Z);_.current&&(D.remove(_.current),(Y=A.current)==null||Y.dispose(),($=C.current)==null||$.dispose());const H=new Xt;H.setAttribute("position",new bt(B,3)),H.setAttribute("color",new bt(X,3));const L=new no({vertexColors:!0}),k=new Na(H,L);D.add(k),A.current=H,C.current=L,_.current=k,w(),g==null||g(W.length,r)},[t,e,n,i,r,c[0],c[1],d==null?void 0:d[0],d==null?void 0:d[1],P,o,a==null?void 0:a[0],a==null?void 0:a[1],y]),ne.useEffect(()=>{T(s)},[t,e,r]),ne.useEffect(()=>()=>{var D,W;(D=A.current)==null||D.dispose(),(W=C.current)==null||W.dispose()},[]),Ae.jsx(Ja,{handle:S,className:u})}function hc(t,e,n){return Math.min(Math.max(t,e),n)}function gA({item:t,view:e,sync:n,label:i,isDraggable:r,onDragStart:s,onFrame:o,colorRange:a}){const[l,c]=ne.useState(null);if(!t)return Ae.jsx(dc,{variant:"empty",children:"no boxes logged yet"});const{arrays:d,meta:h}=t,u=Z_(d.properties,e.property,h.properties??null),p=!!u.values&&!!u.range,g=h.max_depth,M=hc(e.depthMin??0,0,g),m=hc(e.depthMax??g,M,g),f=p&&e.valueFilterEnabled&&u.range?[hc(e.valueMin??u.range[0],u.range[0],u.range[1]),hc(e.valueMax??u.range[1],u.range[0],u.range[1])]:null,x=j_(e.colorMode,p),y=x==="value"?a??u.range:u.range,S=x==="depth"&&a?a[1]:g;return Ae.jsxs("div",{className:"relative flex h-full w-full flex-col overflow-hidden rounded bg-bg",children:[Ae.jsx("div",{className:"flex flex-1 min-h-0 overflow-hidden",children:Ae.jsx("div",{className:"min-w-0 flex-1",children:Ae.jsx(mA,{mins:d.mins,maxs:d.maxs,depth:d.depth,values:u.values,nBoxes:h.n_boxes,bounds:h.bounds,maxDepth:S,valueRange:y,colorMode:e.colorMode,depthRange:[M,m],valueThreshold:f,background:e.background,showAxes:e.showAxes,showPlanes:e.showPlanes,cameraMode:e.cameraMode,sync:n,onVisibleCount:w=>c(w),onFrame:o})})}),Ae.jsx(el,{text:`${(l??h.n_boxes).toLocaleString()} of ${h.n_boxes.toLocaleString()} boxes · ${h.kind}`}),Ae.jsx($a,{label:i,isDraggable:r,onDragStart:s})]})}const _A=ne.createContext(!1),vA=400;function pc({height:t,children:e}){const n=ne.useContext(_A);return Ae.jsxs("div",{className:"cairn-plot-chartbox",style:{height:t??(n?"100%":vA),width:"100%"},children:[Ae.jsx("style",{children:".cairn-plot-chartbox > * { height: 100%; width: 100%; }"}),e]})}const xA={pointSize:2.5,pointSizeMode:"screen",colorMode:"auto",background:"dark",property:null,showAxes:!1,showPlanes:!1,cameraMode:"orbital"};function SA(t){const{height:e,item:n,...i}=t,r={...xA,...typeof i.pointSize=="number"?{pointSize:i.pointSize}:{},...i.pointSizeMode?{pointSizeMode:i.pointSizeMode}:{},...i.colorMode?{colorMode:i.colorMode}:{},...i.background?{background:i.background}:{},...i.property!==void 0?{property:i.property}:{},...i.showAxes!==void 0?{showAxes:i.showAxes}:{},...i.showPlanes!==void 0?{showPlanes:i.showPlanes}:{},...i.cameraMode?{cameraMode:i.cameraMode}:{}};return Ae.jsx(pc,{height:e,children:Ae.jsx(Yw,{item:n??null,view:r,sync:null,label:i.label??""})})}const yA={colorMode:"solid",shading:"smooth",wireframe:!1,doubleSided:!0,background:"dark",property:null,showAxes:!1,showPlanes:!1,cameraMode:"orbital"};function MA(t){const{height:e,item:n,...i}=t,r={...yA,...i.colorMode?{colorMode:i.colorMode}:{},...i.shading?{shading:i.shading}:{},...i.wireframe!==void 0?{wireframe:i.wireframe}:{},...i.doubleSided!==void 0?{doubleSided:i.doubleSided}:{},...i.background?{background:i.background}:{},...i.property!==void 0?{property:i.property}:{},...i.showAxes!==void 0?{showAxes:i.showAxes}:{},...i.showPlanes!==void 0?{showPlanes:i.showPlanes}:{},...i.cameraMode?{cameraMode:i.cameraMode}:{}};return Ae.jsx(pc,{height:e,children:Ae.jsx(eA,{item:n??null,view:r,sync:null,label:i.label??""})})}const EA={mode:"mip",isovalue:.5,colormap:"turbo",steps:128,clipMin:[0,0,0],clipMax:[1,1,1],background:"dark",showAxes:!1,showPlanes:!1,cameraMode:"orbital"};function TA(t){const{height:e,item:n,...i}=t,r={...EA,...i.mode?{mode:i.mode}:{},...typeof i.isovalue=="number"?{isovalue:i.isovalue}:{},...i.colormap?{colormap:i.colormap}:{},...i.steps?{steps:i.steps}:{},...i.clipMin?{clipMin:i.clipMin}:{},...i.clipMax?{clipMax:i.clipMax}:{},...i.background?{background:i.background}:{},...i.showAxes!==void 0?{showAxes:i.showAxes}:{},...i.showPlanes!==void 0?{showPlanes:i.showPlanes}:{},...i.cameraMode?{cameraMode:i.cameraMode}:{}};return Ae.jsx(pc,{height:e,children:Ae.jsx(uA,{item:n??null,view:r,sync:null,label:i.label??""})})}const wA={colorMode:"depth",background:"dark",property:null,showAxes:!1,showPlanes:!1,cameraMode:"orbital"};function AA(t){const{height:e,item:n,...i}=t,r={...wA,...i.colorMode?{colorMode:i.colorMode}:{},...i.background?{background:i.background}:{},...i.property!==void 0?{property:i.property}:{},...i.showAxes!==void 0?{showAxes:i.showAxes}:{},...i.showPlanes!==void 0?{showPlanes:i.showPlanes}:{},...i.cameraMode?{cameraMode:i.cameraMode}:{},...typeof i.depthMin=="number"?{depthMin:i.depthMin}:{},...typeof i.depthMax=="number"?{depthMax:i.depthMax}:{}};return Ae.jsx(pc,{height:e,children:Ae.jsx(gA,{item:n??null,view:r,sync:null,label:i.label??""})})}function RA({presentation:t}){return Ae.jsx(SA,{...t})}function bA({presentation:t}){return Ae.jsx(MA,{...t})}function CA({presentation:t}){return Ae.jsx(TA,{...t})}function PA({presentation:t}){return Ae.jsx(AA,{...t})}function mc(t,e){return{id:`${t}-three`,family:t,technology:"three",supports:()=>({supported:!0,priority:1}),canReuse:()=>!0,component({input:n}){return ne.createElement(e,{presentation:n.presentation,settings:n.settings,commands:n.commands})}}}function LA(){return{pointcloud:mc("pointcloud",RA),mesh:mc("mesh",bA),volume:mc("volume",CA),boxes3d:mc("boxes3d",PA)}}if(!window.__cairnPlotThreeLoaded)if(typeof window.__cairnPlotRegisterBackends=="function"){const t=LA();window.__cairnPlotRegisterBackends("pointcloud",[t.pointcloud]),window.__cairnPlotRegisterBackends("mesh",[t.mesh]),window.__cairnPlotRegisterBackends("volume",[t.volume]),window.__cairnPlotRegisterBackends("boxes3d",[t.boxes3d]),window.__cairnPlotThreeLoaded=!0}else console.error("cairn-plot three addon: core bundle not installed (window.__cairnPlotRegisterBackends missing) — 3D plots will not render.")})(__cairnPlotReact,__cairnPlotJsxRuntime);
