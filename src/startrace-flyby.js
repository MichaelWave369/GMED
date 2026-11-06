/**
 * STARTRACE-5 R3 — numerical sensitivity of an unverified comet candidate
 * to Earth–Moon-system gravity.
 *
 * Important: this is NOT a precision reconstruction of an ancient orbit.
 * Sun fixed at heliocentric origin, JPL APPROXIMATE Earth-Moon barycenter
 * driven as a prescribed point-mass perturbing body, test-particle comet,
 * fourth-order Runge–Kutta in J2000 ecliptic cartesian coordinates.
 */
import {
  AU_KM,CANDIDATES,DEFAULT_DELTA_T,jdFor,
  earthApprox,cometParabolic
} from './startrace-sky.js';

export const R3_VERSION='startrace-5-r3-restricted-flyby-v1';
export const GM_SUN_KM3_S2=132712440041.279419;
export const GM_EARTH_KM3_S2=398600.435507;
export const GM_MOON_KM3_S2=4902.800118;
export const SECONDS_DAY=86400;
const convertGM=mu=>mu*SECONDS_DAY**2/AU_KM**3;
export const MU_SUN=convertGM(GM_SUN_KM3_S2);
export const MU_EMB=convertGM(GM_EARTH_KM3_S2+GM_MOON_KM3_S2);
const ZERO=[0,0,0];
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const diff=(a,b)=>a.map((x,i)=>x-b[i]);
const mul=(a,k)=>a.map(x=>x*k);
const norm=a=>Math.hypot(a[0],a[1],a[2]);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const clamp=(x,l,h)=>Math.max(l,Math.min(h,x));
function limit(value,name,min,max){
  if(!Number.isFinite(value)||typeof value!=='number'||value<min||value>max)
    throw new RangeError(name+' must be a finite number from '+min+' to '+max);
  return value;
}
export const DEFAULT_FLYBY=Object.freeze({
  day:8, hour:10, deltaTSeconds:DEFAULT_DELTA_T,
  leadDays:2, massMultiplier:1, stepHours:.5,
  startHour:4,endHour:18,sampleStepHours:.5
});
function validate(options){
  const p={...DEFAULT_FLYBY,...options};
  if(!CANDIDATES.some(x=>x.day===p.day))throw new RangeError('Choose a published day, June 3–13');
  limit(p.hour,'hour',0,24);
  limit(p.deltaTSeconds,'ΔT seconds',8000,14000);
  limit(p.leadDays,'lead days',.5,7);
  limit(p.massMultiplier,'mass multiplier',0,2);
  limit(p.stepHours,'integrator step hours',.05,3);
  limit(p.startHour,'start local hour',0,24);
  limit(p.endHour,'end local hour',0,24);
  limit(p.sampleStepHours,'sample step hours',.25,2);
  if(p.endHour<=p.startHour)throw new RangeError('End hour must be after start hour');
  if(p.hour<p.startHour||p.hour>p.endHour)throw new RangeError('Selected hour outside samples');
  const total=(p.endHour-p.startHour)/p.sampleStepHours;
  if(total>200)throw new RangeError('Sampling exceeds 200 intervals');
  return p;
}
function initialState(jd,candidate){
  // Finite-difference derivative, in AU/day. This is a source-derived
  // approximation to a parabolic velocity, not a measurement.
  const dt=1e-3;
  const pos=cometParabolic(jd,candidate);
  const vel=mul(diff(cometParabolic(jd+dt,candidate),cometParabolic(jd-dt,candidate)),1/(2*dt));
  return [...pos,...vel];
}
function acceleration(position,jdTT,multiplier){
  const r=norm(position);
  if(r<.001)throw new RangeError('Trajectory exceeds model minimum heliocentric distance');
  let acceleration=mul(position,-MU_SUN/(r*r*r));
  if(multiplier===0)return acceleration;
  const emb=earthApprox(jdTT);
  const cometMinusEmb=diff(position,emb);
  const sep=norm(cometMinusEmb);
  // Exclude close-encounter collision-scale solutions for this simplified
  // barycenter-as-point-mass model.
  if(sep<.00007)throw new RangeError('Earth-Moon point-mass model enters excluded collision zone');
  const re=norm(emb);
  // Differential third-body acceleration, including the indirect acceleration
  // of the heliocentric frame origin caused by the Earth-Moon system.
  const direct=mul(cometMinusEmb,-multiplier*MU_EMB/(sep**3));
  const indirect=mul(emb,-multiplier*MU_EMB/(re**3));
  acceleration=add(acceleration,add(direct,indirect));
  return acceleration;
}
function derivative(state,jd,massMultiplier){
  const position=state.slice(0,3),velocity=state.slice(3,6);
  return [...velocity,...acceleration(position,jd,massMultiplier)];
}
export function rk4Step(state,jd,stepDays,massMultiplier){
  if(!Array.isArray(state)||state.length!==6||!state.every(Number.isFinite))
    throw new TypeError('State must be six finite Cartesian coordinates');
  limit(jd,'Julian ephemeris date',1000000,3000000);
  limit(stepDays,'step days',1e-8,.15);
  limit(massMultiplier,'mass multiplier',0,2);
  const k1=derivative(state,jd,massMultiplier);
  const k2=derivative(add(state,mul(k1,stepDays/2)),jd+stepDays/2,massMultiplier);
  const k3=derivative(add(state,mul(k2,stepDays/2)),jd+stepDays/2,massMultiplier);
  const k4=derivative(add(state,mul(k3,stepDays)),jd+stepDays,massMultiplier);
  const next=state.map((x,i)=>x+stepDays*(k1[i]+2*k2[i]+2*k3[i]+k4[i])/6);
  if(!next.every(Number.isFinite))throw new RangeError('Numerical integration produced a nonfinite value');
  return next;
}
function stateTimeline(candidate,jdStart,sampleJds,stepHours,massMultiplier){
  const states=[];
  let current=initialState(jdStart,candidate),time=jdStart,steps=0;
  for(const target of sampleJds){
    if(target<time-1e-9)throw new RangeError('Integration targets must be ascending and after anchor');
    while(target-time>1e-9){
      const step=Math.min(stepHours/24,target-time);
      if(step<=1e-8)break;
      current=rk4Step(current,time,step,massMultiplier);
      time+=step;
      steps++;
      if(steps>30000)throw new RangeError('Integration step budget exceeded');
    }
    time=target;
    states.push(current.slice());
  }
  return {states,steps};
}
function separationDegrees(a,b){
  const la=norm(a),lb=norm(b);
  if(la<=0||lb<=0)throw new RangeError('Cannot compare zero-length direction');
  return Math.acos(clamp(dot(a,b)/(la*lb),-1,1))*180/Math.PI;
}
export function evaluateFlyby(options={}){
  const p=validate(options);
  const candidate=CANDIDATES.find(x=>x.day===p.day);
  // EPOCH DEFINITION: the chosen candidate's local-noon UT minus lead days,
  // converted to TT with the selected ΔT. Initial state is fixed at this
  // arbitrary anchor for BOTH integrations, so results are anchor-sensitive.
  const jdAnchor=jdFor(p.day,12)-p.leadDays+p.deltaTSeconds/SECONDS_DAY;
  const intervals=Math.floor((p.endHour-p.startHour)/p.sampleStepHours);
  const hours=Array.from({length:intervals+1},(_,i)=>p.startHour+i*p.sampleStepHours);
  if(hours.at(-1)<p.endHour-1e-8)hours.push(p.endHour);
  const targets=hours.map(hour=>jdFor(p.day,hour)+p.deltaTSeconds/SECONDS_DAY);
  const free=stateTimeline(candidate,jdAnchor,targets,p.stepHours,0);
  const influenced=stateTimeline(candidate,jdAnchor,targets,p.stepHours,p.massMultiplier);
  // Step-doubling convergence check for this APPROXIMATE model, not truth.
  const refined=stateTimeline(candidate,jdAnchor,targets,p.stepHours/2,p.massMultiplier);
  let maxReferenceErrorKm=0,maxIntegrationDifferenceKm=0,maxAngularShiftDeg=0;
  let minBaselineRangeKm=Infinity,minPerturbedRangeKm=Infinity,maxShiftKm=0;
  const samples=hours.map((hour,i)=>{
    const jdTT=targets[i],emb=earthApprox(jdTT);
    const freeState=free.states[i],affectedState=influenced.states[i],refinedState=refined.states[i];
    const freePos=freeState.slice(0,3),perturbedPos=affectedState.slice(0,3);
    const originalPos=cometParabolic(jdTT,candidate);
    const baselineGeo=diff(freePos,emb),affectedGeo=diff(perturbedPos,emb);
    const baselineDistanceKm=norm(baselineGeo)*AU_KM;
    const perturbedDistanceKm=norm(affectedGeo)*AU_KM;
    const angularShiftDeg=separationDegrees(baselineGeo,affectedGeo);
    const shiftKm=norm(diff(perturbedPos,freePos))*AU_KM;
    const integrationDifferenceKm=norm(diff(perturbedPos,refinedState.slice(0,3)))*AU_KM;
    const referenceErrorKm=norm(diff(freePos,originalPos))*AU_KM;
    maxReferenceErrorKm=Math.max(maxReferenceErrorKm,referenceErrorKm);
    maxIntegrationDifferenceKm=Math.max(maxIntegrationDifferenceKm,integrationDifferenceKm);
    minBaselineRangeKm=Math.min(minBaselineRangeKm,baselineDistanceKm);
    minPerturbedRangeKm=Math.min(minPerturbedRangeKm,perturbedDistanceKm);
    maxAngularShiftDeg=Math.max(maxAngularShiftDeg,angularShiftDeg);
    maxShiftKm=Math.max(maxShiftKm,shiftKm);
    return {
      hour,jdTT,
      freePos,perturbedPos,embPos:emb,
      freeGeocentric:baselineGeo,perturbedGeocentric:affectedGeo,
      baselineDistanceKm,perturbedDistanceKm,angularShiftDeg,shiftKm,
      referenceErrorKm,integrationDifferenceKm
    };
  });
  const selected=samples.reduce((best,next)=>Math.abs(next.hour-p.hour)<Math.abs(best.hour-p.hour)?next:best,samples[0]);
  return {
    schema:'gmed-startrace-5:flyby-experiment:v3',
    version:R3_VERSION,
    verdict:'ILLUSTRATIVE_GRAVITY_SENSITIVITY',
    inputs:p,
    candidate,anchorJdTT:jdAnchor,
    metrics:{maxReferenceErrorKm,maxIntegrationDifferenceKm,maxAngularShiftDeg,maxShiftKm,
      sampledMinimumBaselineRangeKm:minBaselineRangeKm,
      sampledMinimumPerturbedRangeKm:minPerturbedRangeKm,
      integrationSteps:{free:free.steps,affected:influenced.steps,refined:refined.steps}},
    selected,
    samples,
    limitations:[
      'Hypothetical candidate orbital elements are not measurements of the 5 BCE comet.',
      'The integration starts at an arbitrary user-selected anchor, with unperturbed parabolic initial velocity: shifting that anchor changes the result.',
      'One prescribed JPL approximate Earth-Moon barycenter represents both Earth and Moon as a single point mass; individual lunar gravitational effects are not modeled.',
      'Earth-Moon system perturbation is included with the heliocentric-frame indirect term; other planets and relativity are ignored.',
      'The fourth-order RK4 integrator compares step sizes, but numerical convergence is not physical accuracy or validation against JPL Horizons.',
      'Geocentric distance here is to the Earth-Moon barycenter proxy, not the true Earth center.',
      'Samples report a sampled minimum, not the exact moment or impact parameter of closest approach.',
      'Apparent angular shift is between two modeled lines of sight, not directly a verified topocentric altitude/azimuth discrepancy.',
      'Earth/sun photometry, daytime visibility, historical identification and full uncertainty ensembles are not established.'
    ],
    historicalIdentificationConfirmed:false,highPrecisionEphemerisValidated:false,
    independentVerification:false
  };
}
export function flybyReceipt(options={}){
  const experiment=evaluateFlyby(options);
  const {samples,selected,...rest}=experiment;
  return {
    ...rest,
    selected,
    trajectorySamples:samples.map(({hour,jdTT,freeGeocentric,perturbedGeocentric,
      baselineDistanceKm,perturbedDistanceKm,angularShiftDeg,shiftKm,referenceErrorKm,integrationDifferenceKm})=>({
        hour,jdTT,freeGeocentric,perturbedGeocentric,
        baselineDistanceKm,perturbedDistanceKm,angularShiftDeg,shiftKm,referenceErrorKm,integrationDifferenceKm
      })),
    generatedAt:new Date().toISOString(),
    sources:[
      {label:'JPL Astrodynamic Parameters',url:'https://ssd.jpl.nasa.gov/astro_par.html'},
      {label:'JPL Approximate Positions of the Planets',url:'https://ssd.jpl.nasa.gov/planets/approx_pos.html'},
      {label:'Matney (2025) JBAA 135(6), pp. 395–397',url:'https://britastro.org/wp-content/uploads/2025/12/387-407_Matney_JBAA_2025-1.pdf'}
    ]
  };
}
