/**
 * STARTRACE-5 R4: two-body sourced Earth/Moon perturbation comparison.
 * Inputs MUST pass strict Horizons-table declarations and coverage checks.
 * No external data bundled. This is user-supplied, unauthenticated source text.
 */
import {AU_KM,CANDIDATES,jdFor,cometParabolic} from './startrace-sky.js';
import {DEFAULT_FLYBY,MU_SUN,GM_EARTH_KM3_S2,GM_MOON_KM3_S2,SECONDS_DAY,evaluateFlyby} from './startrace-flyby.js';
import {pairHorizons,interpolateVectors,SOURCE_STATUS} from './startrace-horizons.js';
export const R4_MODEL='startrace-5-r4-two-perturbers-v1';
const mu=gm=>gm*SECONDS_DAY**2/AU_KM**3;
export const MU_EARTH=mu(GM_EARTH_KM3_S2);
export const MU_MOON=mu(GM_MOON_KM3_S2);
const subtract=(a,b)=>a.map((x,i)=>x-b[i]);
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const scale=(v,s)=>v.map(x=>x*s);
const norm=v=>Math.hypot(...v);
const between=(v,name,min,max)=>{
 if(!Number.isFinite(v)||typeof v!=='number'||v<min||v>max)throw new RangeError(name+' out of bounds');return v;
};
function initial(jd,orbit){
 const dt=.001;
 const p=cometParabolic(jd,orbit);
 return [...p,...scale(subtract(cometParabolic(jd+dt,orbit),cometParabolic(jd-dt,orbit)),1/(2*dt))];
}
function differential(body,r,mass,collisionKm){
 const displacement=subtract(body,r);
 const d=norm(displacement),b=norm(body);
 if(d*AU_KM<collisionKm)throw new RangeError('Candidate enters excluded close-proximity zone for a point-mass model');
 if(b<.5)throw new RangeError('Planet position is invalid for Sun-relative frame');
 return add(scale(displacement,mass/d**3),scale(body,-mass/b**3));
}
function acceleration(r,jd,source,massFactor){
 const rs=norm(r);
 if(rs<.001)throw new RangeError('Candidate too close to Sun for this model');
 let value=scale(r,-MU_SUN/rs**3);
 if(massFactor===0)return value;
 const e=interpolateVectors(source.earth,jd).p;
 const m=interpolateVectors(source.moon,jd).p;
 value=add(value,scale(add(differential(e,r,MU_EARTH,10000),differential(m,r,MU_MOON,3000)),massFactor));
 return value;
}
function integrateStep(state,time,step,source,massFactor){
 const derivative=(x,t)=>[...x.slice(3),...acceleration(x.slice(0,3),t,source,massFactor)];
 const k1=derivative(state,time);
 const k2=derivative(add(state,scale(k1,step/2)),time+step/2);
 const k3=derivative(add(state,scale(k2,step/2)),time+step/2);
 const k4=derivative(add(state,scale(k3,step)),time+step);
 return state.map((x,i)=>x+step*(k1[i]+2*k2[i]+2*k3[i]+k4[i])/6);
}
function propagate(source,epoch,targets,seed,stepHours,massFactor){
 let state=seed.slice(),time=epoch,steps=0;
 const states=[];
 for(const jd of targets){
  while(jd-time>1e-8){
    const dt=Math.min(stepHours/24,jd-time);
    if(dt<1e-8)break;
    state=integrateStep(state,time,dt,source,massFactor);
    time+=dt;steps++;
    if(steps>40000)throw new RangeError('Integrator budget exceeded');
  }
  time=jd;
  states.push(state.slice());
 }
 return {states,steps};
}
function angle(a,b){
 const cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 return Math.atan2(norm(cross),a.reduce((s,x,i)=>s+x*b[i],0))*180/Math.PI;
}
export function compareImportedEphemerides(earth,moon,options={}){
 const p={...DEFAULT_FLYBY,...options};
 between(p.day,'candidate day',3,13);
 between(p.leadDays,'lead days',.5,7);
 between(p.massMultiplier,'mass factor',0,2);
 between(p.stepHours,'step hours',.05,1.5);
 const c=CANDIDATES.find(x=>x.day===p.day);
 if(!c)throw new RangeError('Not a published candidate');
 const prior=evaluateFlyby(p);
 const epoch=prior.anchorJdTT;
 const targets=prior.samples.map(x=>x.jdTT);
 const source=pairHorizons(earth,moon,{startJD:epoch,endJD:targets.at(-1)});
 const seed=initial(epoch,c);
 const imported=propagate(source,epoch,targets,seed,p.stepHours,p.massMultiplier);
 const half=propagate(source,epoch,targets,seed,p.stepHours/2,p.massMultiplier);
 let maxImportedVsApproxKm=0,maxStepDifferenceKm=0,maxEarthProxyDifferenceKm=0,maxMoonSeparationKm=0;
 const samples=prior.samples.map((r,i)=>{
  const e=interpolateVectors(earth,r.jdTT).p;
  const m=interpolateVectors(moon,r.jdTT).p;
  const importedPos=imported.states[i].slice(0,3);
  const approximatePos=r.perturbedPos;
  const importedGeo=subtract(importedPos,e);
  const approximateGeo=subtract(approximatePos,r.embPos);
  const shiftKm=norm(subtract(importedPos,approximatePos))*AU_KM;
  const angleDeg=angle(importedGeo,approximateGeo);
  const earthApproxErrorKm=norm(subtract(e,r.embPos))*AU_KM;
  const moonRangeKm=norm(subtract(e,m))*AU_KM;
  const integrationErrorKm=norm(subtract(importedPos,half.states[i].slice(0,3)))*AU_KM;
  maxImportedVsApproxKm=Math.max(maxImportedVsApproxKm,shiftKm);
  maxStepDifferenceKm=Math.max(maxStepDifferenceKm,integrationErrorKm);
  maxEarthProxyDifferenceKm=Math.max(maxEarthProxyDifferenceKm,earthApproxErrorKm);
  maxMoonSeparationKm=Math.max(maxMoonSeparationKm,moonRangeKm);
  return {
   hour:r.hour,jdTT:r.jdTT,importedPos,approximatePos,
   importedGeocentric:importedGeo,approximateProxyGeocentric:approximateGeo,
   earthPos:e,moonPos:m,shiftKm,angleDeg,earthApproxErrorKm,
   moonRangeKm,integrationErrorKm
  };
 });
 const chosen=samples.reduce((best,s)=>Math.abs(s.hour-p.hour)<Math.abs(best.hour-p.hour)?s:best,samples[0]);
 return {
  schema:'gmed-startrace-5:ephemeris-comparison:v4',
  verdict:'CONDITIONAL_IMPORTED_VECTOR_EXPERIMENT',
  modelVersion:R4_MODEL,
  inputs:p,
  sourceStatus:SOURCE_STATUS,
  sourceMetadata:{
   earth:{body:earth.body,count:earth.count,startJD:earth.startJD,endJD:earth.endJD,header:earth.sourceHeader},
   moon:{body:moon.body,count:moon.count,startJD:moon.startJD,endJD:moon.endJD,header:moon.sourceHeader}
  },
  metrics:{
   maxImportedVsApproxKm,maxStepDifferenceKm,maxEarthProxyDifferenceKm,maxMoonSeparationKm,
   integrationSteps:{imported:imported.steps,half:half.steps},
   selected:chosen
  },
  samples,
  limitations:[
   'Uploaded Horizons-looking text has not been cryptographically authenticated against JPL; a forged text header could pass validation.',
   'The parser checks declared body IDs, frame, units, TDB and coverage; this does not prove DE441 was actually used.',
   'Cubic Hermite interpolation of provided vector tables is an approximation, especially if spaced too far apart for close encounters.',
   'The Sun and uploaded Earth/Moon paths are prescribed; comet initial state is still a speculative Sun-only fitted parabola.',
   'Only solar, Earth and Moon gravitational terms are considered; no n-body refit, other planets, relativity or non-gravitational comet forces.',
   'An arbitrary comet initial anchor changes the computed divergence and does not constrain the historical comet orbit.',
   'Step-size agreement assesses this integrator only; ephemeris accuracy and measured event identification remain unverified.',
   'R3 comparison uses an approximate barycenter point mass; the R4 comparison separates Earth and Moon positions.',
   'Angular deviation here is between model sightlines, not a recovered ancient observational offset.'
  ],
  historicalCometOrbitConfirmed:false,
  jplSourceCryptographicallyVerified:false,
  precisionReconstructionValidated:false,
  independentVerification:false
 };
}
export function r4Receipt(result,{earthDigest,moonDigest}={}){
 if(!result||result.schema!=='gmed-startrace-5:ephemeris-comparison:v4')
   throw new TypeError('R4 comparison result required');
 const {samples,...rest}=result;
 return {
  ...rest,
  samples:samples.map(({hour,jdTT,shiftKm,angleDeg,earthApproxErrorKm,moonRangeKm,integrationErrorKm})=>({
   hour,jdTT,shiftKm,angleDeg,earthApproxErrorKm,moonRangeKm,integrationErrorKm
  })),
  inputTextSha256:{
   earth:typeof earthDigest==='string'&&/^[a-f0-9]{64}$/.test(earthDigest)?earthDigest:null,
   moon:typeof moonDigest==='string'&&/^[a-f0-9]{64}$/.test(moonDigest)?moonDigest:null
  },
  generatedAt:new Date().toISOString(),
  sources:[
   {name:'JPL Horizons API documentation',url:'https://ssd-api.jpl.nasa.gov/doc/horizons.html'},
   {name:'Matney JBAA hypothetical candidate elements, pp 395–397',url:'https://britastro.org/wp-content/uploads/2025/12/387-407_Matney_JBAA_2025-1.pdf'}
  ]
 };
}
