import {AU_KM} from './src/startrace-sky.js';
import {DEFAULT_FLYBY,evaluateFlyby,flybyReceipt} from './src/startrace-flyby.js';
const $=id=>document.getElementById(id);
const inputIds=['day','leadDays','massMultiplier','stepHours','deltaTSeconds','hour'];
const state={...DEFAULT_FLYBY};
let data=null,playing=false,priorFrame=0;
const length=v=>Math.hypot(...v);
const fmt=(x,d=1)=>Number(x).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
function canvas(id){
 const el=$(id),bounds=el.getBoundingClientRect(),w=Math.max(160,bounds.width),h=Math.max(160,bounds.height);
 const ratio=Math.min(window.devicePixelRatio||1,2);
 if(el.width!==Math.round(w*ratio)||el.height!==Math.round(h*ratio)){
  el.width=Math.round(w*ratio);el.height=Math.round(h*ratio);
 }
 const ctx=el.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);
 ctx.clearRect(0,0,w,h);ctx.fillStyle='#091b2a';ctx.fillRect(0,0,w,h);
 return {ctx,w,h};
}
function drawLine(ctx,pts,color,width=2,dash=[]){
 if(pts.length<2)return;
 ctx.save();ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);
 pts.slice(1).forEach(pt=>ctx.lineTo(pt[0],pt[1]));
 ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.stroke();ctx.restore();
}
function dot(ctx,x,y,color,r=5){
 ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
}
function label(ctx,value,x,y,align='left'){
 ctx.fillStyle='#9dbcc6';ctx.font='10px ui-sans-serif,system-ui';ctx.textAlign=align;ctx.fillText(value,x,y);
}
function selected(){
 return data.samples.reduce((best,row)=>Math.abs(row.hour-state.hour)<Math.abs(best.hour-state.hour)?row:best,data.samples[0]);
}
function drawPath(s){
 const {ctx,w,h}=canvas('pathCanvas'),cx=w/2,cy=h/2;
 const range=Math.max(450000,...data.samples.flatMap(row=>[length(row.freeGeocentric),length(row.perturbedGeocentric)].map(v=>v*AU_KM)));
 const scale=Math.min(w,h)*.42/range;
 const projection=v=>[cx+v[0]*AU_KM*scale,cy-v[1]*AU_KM*scale];
 for(let k=1;k<=4;k++){
  ctx.beginPath();ctx.arc(cx,cy,range*k/4*scale,0,2*Math.PI);
  ctx.strokeStyle='#244152';ctx.lineWidth=.75;ctx.stroke();
 }
 ctx.beginPath();ctx.arc(cx,cy,384400*scale,0,2*Math.PI);
 ctx.strokeStyle='#9f83be';ctx.setLineDash([5,5]);ctx.stroke();ctx.setLineDash([]);
 drawLine(ctx,data.samples.map(p=>projection(p.freeGeocentric)),'#74b6ff',2.3);
 drawLine(ctx,data.samples.map(p=>projection(p.perturbedGeocentric)),'#9be9cb',2.5);
 const a=projection(s.freeGeocentric),b=projection(s.perturbedGeocentric);
 drawLine(ctx,[a,b],'#ffbd7b',1.2,[3,4]);
 dot(ctx,a[0],a[1],'#75b9ff');dot(ctx,b[0],b[1],'#9cf5cb',6);
 dot(ctx,cx,cy,'#efc184');
 label(ctx,'EARTH-MOON BARYCENTER',cx+10,cy-14);
 label(ctx,'J2000 ecliptic XY projection, not a full 3D distance',14,23);
 label(ctx,'Plot radius '+fmt(range/1e6,2)+' million km',14,h-13);
}
function drawAngle(s){
 const {ctx,w,h}=canvas('angleCanvas'),left=58,right=24,top=29,bottom=46;
 const max=Math.max(.001,data.metrics.maxAngularShiftDeg*1.12);
 const X=t=>left+(t-4)/14*(w-left-right);
 const Y=a=>h-bottom-a/max*(h-top-bottom);
 for(let k=0;k<=4;k++){
  const a=k*max/4,y=Y(a);
  drawLine(ctx,[[left,y],[w-right,y]],'#2c4859',.8,[2,5]);
  label(ctx,fmt(a,3)+'°',left-9,y+4,'right');
 }
 for(let hour=4;hour<=18;hour+=2)label(ctx,hour+':00',X(hour),h-16,'center');
 drawLine(ctx,data.samples.map(p=>[X(p.hour),Y(p.angularShiftDeg)]),'#94e8c7',2.8);
 const x=X(s.hour),y=Y(s.angularShiftDeg);
 drawLine(ctx,[[x,top],[x,h-bottom]],'#ffbd7b',1,[4,4]);dot(ctx,x,y,'#ffbd7b');
 label(ctx,'Modeled angular difference / degrees',left,18);
}
function paint(){
 if(!data)return;
 const s=selected(),m=data.metrics;
 $('hourValue').textContent=String(Math.floor(state.hour)).padStart(2,'0')+':'+String(Math.round((state.hour%1)*60)).padStart(2,'0');
 $('leadValue').textContent=fmt(state.leadDays,1)+' days before';
 $('massValue').textContent=fmt(state.massMultiplier,1)+' ×';
 $('deltaValue').textContent=fmt(state.deltaTSeconds,0)+' s';
 $('shift').textContent=fmt(s.shiftKm,1)+' km';
 $('angle').textContent=fmt(s.angularShiftDeg,3)+'°';
 $('maxshift').textContent=fmt(m.maxShiftKm,1)+' km';
 $('convergence').textContent=fmt(m.maxIntegrationDifferenceKm,3)+' km';
 $('baseline').textContent=fmt(m.maxReferenceErrorKm,3)+' km';
 $('range').textContent=fmt(m.sampledMinimumBaselineRangeKm/1000,1)+' × 1,000 km';
 drawPath(s);drawAngle(s);
}
function recompute(){
 $('error').hidden=true;
 try{data=evaluateFlyby(state);paint();}
 catch(e){data=null;$('error').hidden=false;$('error').textContent=e instanceof Error?e.message:String(e);}
}
for(const id of inputIds){
 $(id).addEventListener(['day','stepHours'].includes(id)?'change':'input',()=>{
  state[id]=Number($(id).value);
  if(id==='hour')paint();else recompute();
 });
}
$('play').addEventListener('click',()=>{
 playing=!playing;$('play').textContent=playing?'Ⅱ PAUSE':'▶ PLAY ENCOUNTER';
 if(playing){priorFrame=0;requestAnimationFrame(frame);}
});
function frame(time){
 if(!playing||!data)return;
 if(!priorFrame)priorFrame=time;
 if(time-priorFrame>150){
  state.hour=state.hour>=18?4:state.hour+.5;
  $('hour').value=String(state.hour);priorFrame=time;paint();
 }
 requestAnimationFrame(frame);
}
$('reset').addEventListener('click',()=>{
 Object.assign(state,DEFAULT_FLYBY);
 inputIds.forEach(id=>$(id).value=String(state[id]));
 playing=false;$('play').textContent='▶ PLAY ENCOUNTER';recompute();
});
$('export').addEventListener('click',()=>{
 if(!data)return;
 try{
  const receipt=JSON.stringify(flybyReceipt(state),null,2)+'\n';
  const url=URL.createObjectURL(new Blob([receipt],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='STARTRACE-5-R3-gravity-receipt.json';
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(e){$('error').textContent=String(e);$('error').hidden=false;}
});
window.addEventListener('resize',paint);
recompute();
