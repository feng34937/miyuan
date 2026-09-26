import * as THREE from 'three';
export function addOriginalScenery(parent: THREE.Object3D) {
 const mats=new Map<string,THREE.MeshStandardMaterial>();
 const material=(c: string)=>{if(!mats.has(c))mats.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.8,metalness:.2}));return mats.get(c)!;};
 const part=(geo: THREE.BufferGeometry,c: string,x: number,y: number,z: number)=>{const m=new THREE.Mesh(geo,material(c));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
 const box=(w: number,h: number,d: number,c: string,x: number,y: number,z: number)=>part(new THREE.BoxGeometry(w,h,d),c,x,y,z);
 const pipe=(r: number,h: number,c: string,x: number,y: number,z: number)=>part(new THREE.CylinderGeometry(r,r,h,10),c,x,y,z);
 // Anti-aircraft gun emplacements guard the four corners of the beachhead.
 for(const [x,z] of [[-31,-23],[34,-25],[-35,29],[34,29]]) {
  pipe(1.5,.5,'#5d6248',x,.25,z);
  box(1.7,.2,1.7,'#454a36',x,.6,z);
  pipe(.45,1.3,'#454a36',x,1.15,z);
  const barrel=pipe(.11,3.8,'#3c4030',x+.9,2.4,z);barrel.rotation.z=1.05;
  const shield=box(1.1,.9,.08,'#5d6248',x+.4,1.6,z);shield.rotation.z=.2;
  for(const side of [-1,1]){
   box(.7,.34,.5,'#a8946f',x+side*1.7,.17,z+1.3);
   box(.7,.34,.5,'#93805f',x+side*1.7,.17,z-1.3);
   box(.5,.34,.7,'#a8946f',x+side*2.1,.17,z);
   box(.7,.34,.5,'#93805f',x+side*1.7,.5,z+1.3);
  }
  box(.9,.5,.6,'#6a5438',x-1.2,.25,z+.9);
 }
 // A line of steel hedgehogs blocks the northern approach.
 for(let i=0;i<9;i++){
  const x=-20+i*5,z=-38;
  const b1=box(.15,1.8,.15,'#4b5445',x,.7,z);b1.rotation.z=.55;
  const b2=box(.15,1.8,.15,'#5a5142',x,.7,z);b2.rotation.x=.55;
  const b3=box(.15,1.8,.15,'#8a5638',x,.7,z);b3.rotation.set(.5,.8,-.5);
 }
}
