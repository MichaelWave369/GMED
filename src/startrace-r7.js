/**
 * STARTRACE-5 R7: solver stress-test for a HYPOTHETICAL 5 BCE comet orbit.
 * Uses the same R4 restricted Sun/Earth/Moon force assumptions and stored
 * provider-declared Horizons DE441-derived Earth/Moon states.
 *
 * Independent INTEGRATION METHODS, NOT independent orbital observations.
 * No comet observations, fitted orbit, full gravitational model, or NASA
 * source signatures are present.
 */
import {AU_KM,CANDIDATES,jdFor,cometParabolic} from './startrace-sky.js';
import {MU_SUN,DEFAULT_FLYBY,SECONDS_DAY} from './startrace-flyby.js';
import {MU_EARTH,MU_MOON,compareImportedEphemerides} from './startrace-precision.js';
import {pairHorizons,interpolateVectors} from './startrace-horizons.js';
import {adaptiveTimeline,fixedTimeline} from './startrace-integrators.js';

export const R7_SCHEMA='gmed-startrace-5:gravity-solver-stress:v7';
const norm=v=>Math.hypot(...v),diff=(a,b)=>a.map((x,i)=>x-b[i]);
const limit=(x,name,lo,hi)=>{
 if(typeof x!=='number'||!Number.isFinite(x)||x<lo||x>hi)
  throw new RangeError(name+' must be in ['+lo+', '+hi+']');
 return x;
};
const solarEnergy=s=>.5*(s[3]**2+s[4]**2+s[5]**2)-MU_SUN/norm(s.slice(0,3));
const angularMomentum=s=>{
 const [x,y,z,vx,vy,vz]=s;
 return Math.hypot(y*vz-z*vy,z*vx-x*vz,x*vy-y*vx);
};
export const R7_DEFAULTS=Object.freeze({
  day:8, leadDays:2, massMultiplier:1, deltaTSeconds:10572,
  stepHours:.5, rtol:1e-10, maxAdaptiveStepMinutes:30
});
function initialState(jd,candidate){
 const h=.001;
 const p=cometParabolic(jd,candidate);
 const before=cometParabolic(jd-h,candidate),after=cometParabolic(jd+h,candidate);
 return [...p,...diff(after,before).map(x=>x/(2*h))];
}
export function restrictedCometDerivative(earth,moon,{
  massMultiplier=1,sunOnly=false,tracker=null
}={}){
 limit(massMultiplier,'massMultiplier',0,2);
 return (jd,s)=>{
  if(!Array.isArray(s)||s.length!==6||!s.every(Number.isFinite))
    throw new TypeError('Nonfinite six-dimensional comet state');
  const r=s.slice(0,3),radius=norm(r);
  if(radius<.001)throw new Error('SUN_CLOSE_APPROACH_EXCLUSION');
  const acceleration=r.map(x=>-MU_SUN*x/radius**3);
  if(!sunOnly&&massMultiplier!==0){
   for(const [name,data,mu,cutoffKm] of [
     ['EARTH',earth,MU_EARTH,15000],
     ['MOON',moon,MU_MOON,7000]
   ]){
    const body=interpolateVectors(data,jd).p;
    const sep=diff(body,r),distance=norm(sep),central=norm(body);
    if(tracker)tracker[name]=Math.min(tracker[name],distance*AU_KM);
    if(distance*AU_KM<=cutoffKm)
      throw new Error(name+'_CLOSE_APPROACH_EXCLUSION');
    if(central<.5)throw new Error('INVALID_HELIOCENTRIC_BODY_POSITION');
    for(let i=0;i<3;i++)
      acceleration[i]+=massMultiplier*mu*(sep[i]/distance**3-body[i]/central**3);
   }
  }
  return [...s.slice(3),...acceleration];
 };
}
export function solarKeplerBenchmark({day=8,leadDays=2,rtol=1e-11}={}){
 limit(day,'candidate day',3,13);limit(leadDays,'leadDays',.5,3);
 const c=CANDIDATES.find(x=>x.day===day);
 const initial=jdFor(day,12)-leadDays+10572/SECONDS_DAY;
 const y0=initialState(initial,c);
 const targets=Array.from({length:33},(_,k)=>initial+(k+1)/48);
 const f=restrictedCometDerivative(null,null,{sunOnly:true});
 const reference=adaptiveTimeline(f,initial,y0,targets,{
   rtol,atol:[1e-13,1e-13,1e-13,1e-13,1e-13,1e-13],
   maxStepDays:1/24
 });
 const fixed=fixedTimeline(f,initial,y0,targets,1/96);
 let maxAnalyticPositionErrorKm=0,maxRelativeEnergyDrift=0,maxAngularMomentumDrift=0;
 const e0=solarEnergy(y0),h0=angularMomentum(y0);
 reference.states.forEach((s,i)=>{
   const expected=cometParabolic(targets[i],c);
   maxAnalyticPositionErrorKm=Math.max(maxAnalyticPositionErrorKm,
     norm(diff(expected,s.slice(0,3)))*AU_KM);
   maxRelativeEnergyDrift=Math.max(maxRelativeEnergyDrift,Math.abs(solarEnergy(s)-e0)/Math.max(1e-12,Math.abs(e0)));
   maxAngularMomentumDrift=Math.max(maxAngularMomentumDrift,Math.abs(angularMomentum(s)-h0)/h0);
 });
 const maxRK4DifferenceKm=Math.max(...fixed.states.map((s,i)=>
   norm(diff(s.slice(0,3),reference.states[i].slice(0,3)))*AU_KM));
 return {maxAnalyticPositionErrorKm,maxRelativeEnergyDrift,maxAngularMomentumDrift,maxRK4DifferenceKm,
   source:'analytic parabolic Sun-only candidate; no Earth/Moon gravity',
   algorithmComparison:'RK4 fixed vs DOPRI54 adaptive'};
}
export function stressTestGravity(earth,moon,options={}){
 const opts={...R7_DEFAULTS,...options};
 limit(opts.day,'day',3,13);
 if(opts.day!==8)throw new RangeError('R7 committed dataset only covers featured June 8 scenario');
 limit(opts.leadDays,'leadDays',.5,2);
 limit(opts.massMultiplier,'massMultiplier',0,2);
 limit(opts.deltaTSeconds,'deltaTSeconds',10000,11000);
 limit(opts.stepHours,'stepHours',.1,1);
 limit(opts.rtol,'rtol',1e-12,1e-7);
 limit(opts.maxAdaptiveStepMinutes,'maxAdaptiveStepMinutes',2,60);
 const scenario={...DEFAULT_FLYBY,day:opts.day,leadDays:opts.leadDays,
   massMultiplier:opts.massMultiplier,deltaTSeconds:opts.deltaTSeconds,
   stepHours:opts.stepHours};
 // Use the existing R4 numerical algorithm without altering it.
 const legacy=compareImportedEphemerides(earth,moon,scenario);
 const start=legacy.samples[0].jdTT;
 const end=legacy.samples.at(-1).jdTT;
 const anchor=legacy.samples[0].jdTT-(4-12)/24-opts.leadDays;
 // R4's time anchor is candidate local noon UT minus lead days, +ΔT.
 const exactAnchor=jdFor(opts.day,12)-opts.leadDays+opts.deltaTSeconds/SECONDS_DAY;
 if(Math.abs(anchor-exactAnchor)>1e-8)throw new Error('ANCHOR_EPOCH_DISAGREEMENT');
 const source=pairHorizons(earth,moon,{startJD:exactAnchor,endJD:end});
 const candidate=CANDIDATES.find(x=>x.day===opts.day);
 const seed=initialState(exactAnchor,candidate);
 const targets=legacy.samples.map(s=>s.jdTT);
 const tracker={EARTH:Infinity,MOON:Infinity};
 const force=restrictedCometDerivative(source.earth,source.moon,{
   massMultiplier:opts.massMultiplier,tracker
 });
 const adaptive=adaptiveTimeline(force,exactAnchor,seed,targets,{
   rtol:opts.rtol,atol:[1e-12,1e-12,1e-12,3e-12,3e-12,3e-12],
   initialStepDays:1/96,maxStepDays:opts.maxAdaptiveStepMinutes/1440,
   minStepDays:1e-7,maxAttempts:25000
 });
 // Independent RK4 implementation in this module, in addition to R4's
 // own legacy code. A quarter-step comparison probes order convergence.
 const fixed=fixedTimeline(force,exactAnchor,seed,targets,opts.stepHours/24);
 const refined=fixedTimeline(force,exactAnchor,seed,targets,opts.stepHours/96);
 const rows=targets.map((jd,i)=>{
   const rk4=fixed.states[i],high=adaptive.states[i],r4=legacy.samples[i].importedPos;
   const referencePosition=high.slice(0,3);
   const refVsRK4Km=norm(diff(rk4.slice(0,3),referencePosition))*AU_KM;
   const refVsLegacyKm=norm(diff(r4,referencePosition))*AU_KM;
   const rk4RefinementKm=norm(diff(rk4.slice(0,3),refined.states[i].slice(0,3)))*AU_KM;
   const earthAt=interpolateVectors(earth,jd).p;
   const moonAt=interpolateVectors(moon,jd).p;
   const earthDistanceKm=norm(diff(referencePosition,earthAt))*AU_KM;
   const moonDistanceKm=norm(diff(referencePosition,moonAt))*AU_KM;
   return {jdTT:jd,hour:legacy.samples[i].hour,refVsRK4Km,refVsLegacyKm,
     rk4RefinementKm,earthDistanceKm,moonDistanceKm};
 });
 const max=(key)=>Math.max(...rows.map(x=>x[key]));
 const min=(key)=>Math.min(...rows.map(x=>x[key]));
 const consistency={
  maxRK4VsAdaptiveKm:max('refVsRK4Km'),
  maxLegacyVsAdaptiveKm:max('refVsLegacyKm'),
  maxRK4RefinementKm:max('rk4RefinementKm'),
  minSampledEarthDistanceKm:min('earthDistanceKm'),
  minSampledMoonDistanceKm:min('moonDistanceKm'),
  minStageEarthDistanceKm:tracker.EARTH,
  minStageMoonDistanceKm:tracker.MOON,
  adaptiveSteps:adaptive.stats,
  fixedSteps:fixed.stats.steps,
  refinedSteps:refined.stats.steps
 };
 const result={
  schema:R7_SCHEMA,verdict:'NUMERICAL_METHOD_CROSSCHECK_ONLY',
  scenario:opts,candidate,anchorJdTT:exactAnchor,
  dataSource:'NASA/JPL Horizons-derived normalized, not authenticated DE441-reported Earth/Moon vectors',
  comparisonMethods:['Existing R4 RK4 solver','Separate fixed-step RK4','Adaptive Dormand–Prince 5(4)'],
  consistency,
  solarBenchmark:solarKeplerBenchmark({day:8,leadDays:opts.leadDays}),
  samples:rows,
  scientificLimitations:[
    'Both numerical methods solve the same simplified restricted Sun+Earth+Moon equations; agreement does not validate physics against independent observations.',
    'Comet initial orbital elements are hypothetical; they are not a fitted historical orbit.',
    'Sun, Earth and Moon are prescribed from source-derived normalized Horizons text; source authenticity and deep-time ephemeris uncertainty are unverified.',
    'Time conversion assumes TT approximately equals TDB at this sensitivity; historical ΔT is assumed, not inferred.',
    'Other planets, comet outgassing and relativistic terms are omitted.',
    'Earth and Moon proximity exclusion thresholds are computational guardrails, NOT collision detection.',
    'Minimum sampled approach and minimum derivative-stage distance do not mathematically guarantee continuous-time closest approach.',
    'An adaptive local error estimate is not a bound on global orbit error, and no external reference solver output was used.',
    'All values reflect the chosen arbitrary initial anchor; no historical comet visibility/identity is certified.'
  ],
  historicalCometOrbitConfirmed:false,
  independentPhysicalValidation:false,
  sourceCryptographicAuthenticity:false,
  exactClosestApproachDetermined:false
 };
 if(!Object.values(consistency).filter(x=>typeof x==='number').every(Number.isFinite))
  throw new Error('NUMERICAL_DIAGNOSTIC_NONFINITE');
 return result;
}
export function r7Receipt(result,{earthSha256=null,moonSha256=null}={}){
 if(result?.schema!==R7_SCHEMA)throw new TypeError('R7 stress result required');
 const valid=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x)?x:null;
 return {...result,generatedAt:new Date().toISOString(),
   normalizedSourceSha256:{earth:valid(earthSha256),moon:valid(moonSha256)}};
}
