const $=id=>document.getElementById(id);
const fmt=(v,d=3)=>Number(v).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
let report=null,mode='position';
function draw(){
 const el=$('plot'),w=Math.max(230,el.getBoundingClientRect().width),h=Math.max(160,el.getBoundingClientRect().height);
 const scale=Math.min(window.devicePixelRatio||1,2);el.width=Math.round(w*scale);el.height=Math.round(h*scale);
 const ctx=el.getContext('2d');ctx.setTransform(scale,0,0,scale,0,0);ctx.fillStyle='#0a1c2b';ctx.fillRect(0,0,w,h);
 if(!report){ctx.fillStyle='#abc4c9';ctx.font='13px system-ui';ctx.textAlign='center';ctx.fillText('Verified build report not loaded.',w/2,h/2);return;}
 const series=mode==='position'?'positionDifferenceKm':'velocityDifferenceKmS',points=report.samples;
 const max=Math.max(1e-6,...points.map(p=>p[series]*1000))*1.16;
 const left=65,right=23,top=31,bottom=45,x=i=>left+i/(points.length-1)*(w-left-right);
 const y=v=>h-bottom-v/max*(h-top-bottom);ctx.font='10px system-ui';
 for(let k=0;k<=4;k++){const n=max*k/4,py=y(n);ctx.beginPath();ctx.moveTo(left,py);ctx.lineTo(w-right,py);ctx.strokeStyle='#294958';ctx.stroke();ctx.textAlign='right';ctx.fillStyle='#acc5cb';ctx.fillText(fmt(n,n<1?4:2),left-9,py+3);}
 ctx.textAlign='center';for(let i=0;i<points.length;i+=4)ctx.fillText(points[i].hour+':00',x(i),h-13);
 ctx.strokeStyle=mode==='position'?'#9bebcb':'#79b7ff';ctx.lineWidth=2.6;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(x(i),y(p[series]*1000)):ctx.moveTo(x(i),y(p[series]*1000)));ctx.stroke();
 ctx.textAlign='left';ctx.fillStyle='#b4d1d6';ctx.fillText(mode==='position'?'Position discrepancy (m)':'Velocity discrepancy (m/s)',left,17);
}
function setMode(v){mode=v;$('positionMode').setAttribute('aria-pressed',String(v==='position'));$('velocityMode').setAttribute('aria-pressed',String(v==='velocity'));draw();}
$('positionMode').addEventListener('click',()=>setMode('position'));
$('velocityMode').addEventListener('click',()=>setMode('velocity'));
function validate(r){
 if(r?.schema!=='gmed-startrace-5:public-cross-language-report:v8'||
  r.verdict!=='CROSS_LANGUAGE_NUMERICAL_AGREEMENT_ONLY'||
  r.verificationGate?.passed!==true||
  r.historicalCometOrbitConfirmed!==false||
  r.independentPhysicalValidation!==false||
  r.sourceCryptographicAuthenticity!==false||
  r.exactClosestApproachDetermined!==false||
  !Array.isArray(r.samples)||r.samples.length!==29||
  !r.samples.every(x=>Number.isFinite(x.positionDifferenceKm)&&x.positionDifferenceKm>=0&&Number.isFinite(x.velocityDifferenceKmS)&&x.velocityDifferenceKmS>=0)){
   throw new Error('Published output violates the R8 scientific report contract');
 }
}
async function load(){
 $('reload').disabled=true;$('export').disabled=true;$('error').hidden=true;$('status').textContent='Loading CI-verified reference data…';
 try{
  const res=await fetch('./data/solver-r8-report.json',{cache:'no-cache'});
  if(!res.ok)throw new Error('No validated report on Pages (HTTP '+res.status+')');
  const value=await res.json();validate(value);report=value;
  $('maxPosition').textContent=fmt(value.statistics.maxPositionDifferenceKm*1000,3)+' m';
  $('rmsPosition').textContent=fmt(value.statistics.rmsPositionDifferenceKm*1000,3)+' m';
  $('maxVelocity').textContent=fmt(value.statistics.maxVelocityDifferenceKmS*1000,6)+' m/s';
  $('evaluations').textContent=String(value.statistics.scipyFunctionEvaluations);
  $('count').textContent=String(value.statistics.sampleCount);
  $('status').textContent='Cross-language check passed. Historical orbit remains unverified.';
  $('export').disabled=false;draw();
 }catch(e){report=null;$('status').textContent='No accepted report available';$('error').hidden=false;$('error').textContent='REPORT REFUSED: '+(e instanceof Error?e.message:String(e));draw();}
 finally{$('reload').disabled=false;}
}
$('reload').addEventListener('click',load);
$('export').addEventListener('click',()=>{if(!report)return;const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='STARTRACE-R8-SciPy-audit.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);});
window.addEventListener('resize',draw);draw();load();
