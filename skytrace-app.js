import {AU_KM,NOON_UT_JD,DEFAULT_DELTA_T,CANDIDATES,skyAt,skyPaths,skyReceipt,earthApprox,cometParabolic} from './src/startrace-sky.js';
const $=id=>document.getElementById(id);
const orbitCanvas=$('orbitCanvas'),skyCanvas=$('skyCanvas');
const view={day:8,hour:10,deltaTSeconds:DEFAULT_DELTA_T,alternatives:true,yaw:-.7,pitch:.67,playing:false};
let paths=[],lastPlay=0,drag=null;
const radians=x=>x*Math.PI/180;
const fmt=(x,decimal=1)=>Number(x).toLocaleString('en-US',{minimumFractionDigits:decimal,maximumFractionDigits:decimal});
const drawPt=(ctx,x,y,r,color,glow=0)=>{
 ctx.save();ctx.fillStyle=color;if(glow){ctx.shadowColor=color;ctx.shadowBlur=glow;}
 ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.restore();
};
function sizeCanvas(canvas){
 const rect=canvas.getBoundingClientRect();
 const ratio=Math.min(window.devicePixelRatio||1,2);
 const w=Math.max(100,Math.round(rect.width)),h=Math.max(100,Math.round(rect.height));
 const pxW=Math.round(w*ratio),pxH=Math.round(h*ratio);
 if(canvas.width!==pxW||canvas.height!==pxH){canvas.width=pxW;canvas.height=pxH;}
 const ctx=canvas.getContext('2d');
 ctx.setTransform(ratio,0,0,ratio,0,0);
 return {ctx,w,h};
}
function line(ctx,points,color,width=1,dash=[]){
 if(points.length<2)return;
 ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);
 ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
 for(const [x,y] of points.slice(1))ctx.lineTo(x,y);
 ctx.stroke();ctx.restore();
}
function text(ctx,s,x,y,color='#90b4c4',font='11px ui-sans-serif, system-ui',align='left'){
 ctx.fillStyle=color;ctx.font=font;ctx.textAlign=align;ctx.fillText(s,x,y);
}
function orbitView(){
 const {ctx,w,h}=sizeCanvas(orbitCanvas);
 ctx.clearRect(0,0,w,h);
 const p=skyAt(view),scale=Math.min(w,h)*.21;
 const orient=v=>{
   const cy=Math.cos(view.yaw),sy=Math.sin(view.yaw),cp=Math.cos(view.pitch),sp=Math.sin(view.pitch);
   const x=v[0]*cy-v[1]*sy,y=v[0]*sy+v[1]*cy;
   const depth=y*sp+v[2]*cp;
   const y2=y*cp-v[2]*sp;
   const perspective=4.8/(4.8-depth);
   return [w/2+x*scale*perspective,h/2-y2*scale*perspective,depth];
 };
 const jdTT=p.jdTT;
 ctx.fillStyle='#091824';ctx.fillRect(0,0,w,h);
 // Soft mathematical reference grid, not the actual stellar background.
 for(let r=.5;r<=2.5;r+=.5){
   const ring=Array.from({length:101},(_,i)=>orient([r*Math.cos(2*Math.PI*i/100),r*Math.sin(2*Math.PI*i/100),0]));
   line(ctx,ring,'#223c4d',.8,r===1?[]:[3,6]);
 }
 for(let a=0;a<12;a++){
  const t=a*Math.PI/6;
  line(ctx,[orient([0,0,0]),orient([2.5*Math.cos(t),2.5*Math.sin(t),0])],'#223648',.8);
 }
 text(ctx,'J2000 ECLIPTIC / AU',16,23,'#87b5c2','bold 10px ui-sans-serif, system-ui');
 const origin=orient([0,0,0]);drawPt(ctx,origin[0],origin[1],7,'#f6b966',15);
 const earthTrack=[];
 for(let k=0;k<=120;k++)earthTrack.push(orient(earthApprox(jdTT-183+k*366/120)));
 line(ctx,earthTrack,'#4d94c8',1.6);
 const cometTrack=(c)=>Array.from({length:110},(_,k)=>orient(cometParabolic(NOON_UT_JD-70+k*(155/109)+view.deltaTSeconds/86400,c)));
 if(view.alternatives){
   for(const c of CANDIDATES.filter(x=>x.day!==view.day))line(ctx,cometTrack(c),'#536e83a0',.9);
 }
 const sel=CANDIDATES.find(c=>c.day===view.day);
 line(ctx,cometTrack(sel),'#8af2ca',2.5);
 const earth=orient(p.vectors.earth),comet=orient(p.vectors.comet);
 line(ctx,[earth,comet],'#edce8399',1.2,[4,5]);
 drawPt(ctx,earth[0],earth[1],5,'#67b6ff',12);
 drawPt(ctx,comet[0],comet[1],6,'#86f3ca',18);
 text(ctx,'SUN',origin[0]+12,origin[1]-13,'#e7c395','bold 11px ui-sans-serif, system-ui');
 text(ctx,'EARTH',earth[0]+10,earth[1]-10,'#92c9f9','bold 11px ui-sans-serif, system-ui');
 text(ctx,'COMET / '+view.day,comet[0]+10,comet[1]-10,'#a2f4d2','bold 11px ui-sans-serif, system-ui');
 text(ctx,'Drag canvas to orbit camera',15,h-17,'#86a6b6');
}
function skyProj(o,cx,cy,R){
 const r=(90-o.altDeg)/90*R;
 const a=radians(o.azDeg);
 return [cx+Math.sin(a)*r,cy-Math.cos(a)*r];
}
function skyView(){
 const {ctx,w,h}=sizeCanvas(skyCanvas);
 const p=skyAt(view);
 ctx.fillStyle='#0b1a28';ctx.fillRect(0,0,w,h);
 const R=Math.min(w*.40,h*.41),cx=w/2,cy=h/2+2;
 ctx.save();
 ctx.beginPath();ctx.arc(cx,cy,R,0,2*Math.PI);ctx.clip();
 const lit=p.sun.altDeg>0;
 const gradient=ctx.createRadialGradient(cx,cy,0,cx,cy,R*1.3);
 gradient.addColorStop(0,lit?'#254358':'#15263b');
 gradient.addColorStop(1,lit?'#132e43':'#0d2030');
 ctx.fillStyle=gradient;ctx.fillRect(cx-R,cy-R,2*R,2*R);
 for(const a of [30,60]){
   ctx.beginPath();ctx.arc(cx,cy,(90-a)/90*R,0,2*Math.PI);
   ctx.strokeStyle='#365367';ctx.lineWidth=1;ctx.stroke();
 }
 for(let a=0;a<360;a+=30){
  const az=radians(a);
  line(ctx,[[cx,cy],[cx+Math.sin(az)*R,cy-Math.cos(az)*R]],'#284657',.6);
 }
 const road=skyProj({altDeg:0,azDeg:206},cx,cy,R);
 line(ctx,[[cx,cy],road],'#6b84fa',1.7,[5,5]);
 const drawPath=(samples,color,stroke=2,dash=[])=>{
   let segment=[];
   for(const s of samples){
    if(s.altDeg>=0){segment.push(skyProj(s,cx,cy,R));}
    else if(segment.length){line(ctx,segment,color,stroke,dash);segment=[];}
   }
   line(ctx,segment,color,stroke,dash);
 };
 if(view.alternatives)for(const path of paths.filter(path=>path.day!==view.day))drawPath(path.samples,'#5b7395a0',1.3);
 const central=paths.find(x=>x.day===view.day);
 if(central)drawPath(central.samples,'#79e9bf',2.8);
 const sunSamples=Array.from({length:71},(_,i)=>skyAt({...view,hour:4+i*.2}).sun);
 drawPath(sunSamples,'#f1b96e',1.8);
 const comet=skyProj(p.comet,cx,cy,R),sun=skyProj(p.sun,cx,cy,R);
 if(p.comet.altDeg>=0)drawPt(ctx,comet[0],comet[1],5,'#a3ffdc',17);
 if(p.sun.altDeg>=0)drawPt(ctx,sun[0],sun[1],5,'#ffd18d',12);
 ctx.restore();
 ctx.beginPath();ctx.arc(cx,cy,R,0,2*Math.PI);ctx.strokeStyle='#7196a6';ctx.lineWidth=1.6;ctx.stroke();
 for(const [label,az] of [['N',0],['E',90],['S',180],['W',270]]){
  const pxy=skyProj({altDeg:-10,azDeg:az},cx,cy,R);
  text(ctx,label,pxy[0],pxy[1]+4,'#c1d6dc','bold 12px ui-sans-serif, system-ui','center');
 }
 text(ctx,'ZENITH',cx+5,cy-7,'#a9c4c7','bold 10px ui-sans-serif, system-ui');
 text(ctx,'30°',cx+7,cy+R*2/3-5,'#8aabb9');
 text(ctx,'60°',cx+7,cy+R/3-5,'#8aabb9');
 text(ctx,'ROAD TO BETHLEHEM / 206°',15,h-16,'#9aabfb','bold 10px ui-sans-serif, system-ui');
}
function rebuildPaths(){paths=skyPaths({start:4,end:18,step:.25,deltaTSeconds:view.deltaTSeconds});}
function render(){
 const p=skyAt(view);
 $('hourValue').textContent=String(Math.floor(view.hour)).padStart(2,'0')+':'+String(Math.round((view.hour%1)*60)).padStart(2,'0');
 $('deltaValue').textContent=Math.round(view.deltaTSeconds).toLocaleString('en-US')+' s';
 $('altitude').textContent=fmt(p.comet.altDeg,1)+'°';
 $('azimuth').textContent=fmt(p.comet.azDeg,1)+'°';
 $('distance').textContent=fmt(p.comet.geocentricDistanceAu,4)+' AU';
 $('sunalt').textContent=fmt(p.sun.altDeg,1)+'°';
 orbitView();skyView();
}
function updateHour(){view.hour=Number($('hour').value);render();}
$('day').addEventListener('change',()=>{
 view.day=Number($('day').value);render();
});
$('hour').addEventListener('input',updateHour);
$('deltaT').addEventListener('input',()=>{
 view.deltaTSeconds=Number($('deltaT').value);rebuildPaths();render();
});
$('alternatives').addEventListener('change',()=>{
 view.alternatives=$('alternatives').checked;render();
});
$('reset').addEventListener('click',()=>{
 view.day=8;view.hour=10;view.deltaTSeconds=DEFAULT_DELTA_T;view.alternatives=true;
 view.yaw=-.7;view.pitch=.67;view.playing=false;$('play').textContent='▶ PLAY SKY';
 $('day').value='8';$('hour').value='10';$('deltaT').value=String(DEFAULT_DELTA_T);
 $('alternatives').checked=true;rebuildPaths();render();
});
$('play').addEventListener('click',()=>{
 view.playing=!view.playing;
 $('play').textContent=view.playing?'Ⅱ PAUSE SKY':'▶ PLAY SKY';
 lastPlay=0;
 if(view.playing)requestAnimationFrame(tick);
});
function tick(time){
 if(!view.playing)return;
 if(!lastPlay)lastPlay=time;
 if(time-lastPlay>=80){
  view.hour+=Math.min((time-lastPlay)*.001,1);
  if(view.hour>=18)view.hour=4;
  $('hour').value=String(view.hour);lastPlay=time;render();
 }
 requestAnimationFrame(tick);
}
orbitCanvas.addEventListener('pointerdown',e=>{
 drag={x:e.clientX,y:e.clientY,yaw:view.yaw,pitch:view.pitch};
 orbitCanvas.setPointerCapture(e.pointerId);
});
orbitCanvas.addEventListener('pointermove',e=>{
 if(!drag)return;
 view.yaw=drag.yaw+(e.clientX-drag.x)*.009;
 view.pitch=Math.max(-1.2,Math.min(1.2,drag.pitch+(e.clientY-drag.y)*.008));
 render();
});
const stopDrag=()=>{drag=null;};
orbitCanvas.addEventListener('pointerup',stopDrag);
orbitCanvas.addEventListener('pointercancel',stopDrag);
$('export').addEventListener('click',()=>{
 const receipt=skyReceipt({day:view.day,hour:view.hour,deltaTSeconds:view.deltaTSeconds,alternatives:view.alternatives});
 const blob=new Blob([JSON.stringify(receipt,null,2)+'\n'],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='STARTRACE-5-sky-r2-candidate.json';
 document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
});
window.addEventListener('resize',render);
rebuildPaths();render();
