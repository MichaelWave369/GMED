import test from 'node:test';
import assert from 'node:assert/strict';
import {AU_KM,CANDIDATES,jdFor,cometParabolic} from '../src/startrace-sky.js';
import {GM_SUN_KM3_S2,GM_EARTH_KM3_S2,GM_MOON_KM3_S2,MU_SUN,MU_EMB,
  DEFAULT_FLYBY,rk4Step,evaluateFlyby,flybyReceipt} from '../src/startrace-flyby.js';
const near=(value,expected,tol)=>assert.ok(Math.abs(value-expected)<=tol,
  String(value)+' should be within '+String(tol)+' of '+String(expected));
test('physical constants and unit conversion agree with standard Sun and Earth ratios',()=>{
  near(MU_EMB/MU_SUN,(GM_EARTH_KM3_S2+GM_MOON_KM3_S2)/GM_SUN_KM3_S2,1e-15);
  assert.ok(MU_SUN>.000295&&MU_SUN<.000296);
  assert.ok(MU_EMB>8e-10&&MU_EMB<1e-9);
});
test('RK4 accepts finite six-dimensional state and refuses invalid or oversized steps',()=>{
  const state=[1,0,0,0,.017,0],jd=2451545;
  assert.ok(rk4Step(state,jd,.01,0).every(Number.isFinite));
  assert.throws(()=>rk4Step([1,2],jd,.01,0));
  assert.throws(()=>rk4Step(state,jd,.2,0));
  assert.throws(()=>rk4Step(state,jd,.01,-1));
});
test('R3 Sun-only numerical baseline tracks independently implemented R2 parabola',()=>{
  const r=evaluateFlyby({day:8,leadDays:2,massMultiplier:0,stepHours:.5});
  assert.ok(r.metrics.maxReferenceErrorKm<10,'parabolic drift in km: '+r.metrics.maxReferenceErrorKm);
  assert.ok(r.samples.every(x=>x.shiftKm<1e-9));
  assert.equal(r.metrics.maxAngularShiftDeg,0);
});
test('nonzero gravity creates a different numerical trajectory',()=>{
  const r=evaluateFlyby({day:8,leadDays:2,massMultiplier:1,stepHours:.5});
  assert.ok(r.metrics.maxShiftKm>1,'maximum gravity shift km: '+r.metrics.maxShiftKm);
  assert.ok(r.metrics.maxAngularShiftDeg>.001);
  assert.ok(r.metrics.sampledMinimumBaselineRangeKm>20000);
  assert.ok(r.metrics.sampledMinimumPerturbedRangeKm>20000);
});
test('RK4 step-doubling convergence is much smaller than modeled gravity deviation',()=>{
  const r=evaluateFlyby({day:8,leadDays:2,massMultiplier:1,stepHours:.5});
  assert.ok(r.metrics.maxIntegrationDifferenceKm<r.metrics.maxShiftKm*.02,
    'numerical error '+r.metrics.maxIntegrationDifferenceKm+' vs modeled shift '+r.metrics.maxShiftKm);
});
test('earlier integration anchor changes gravity shift, explicit parameter sensitivity',()=>{
  const r1=evaluateFlyby({leadDays:1,massMultiplier:1});
  const r3=evaluateFlyby({leadDays:3,massMultiplier:1});
  assert.ok(Math.abs(r1.metrics.maxShiftKm-r3.metrics.maxShiftKm)>1);
});
test('zero gravity factor has zero force deviation; double gravitational multiplier increases sensitivity',()=>{
  const a=evaluateFlyby({massMultiplier:0,leadDays:2});
  const b=evaluateFlyby({massMultiplier:2,leadDays:2});
  assert.equal(a.metrics.maxShiftKm,0);
  assert.ok(b.metrics.maxShiftKm>1);
});
test('sampled times remain ordered and end-point nominal selection is closest',()=>{
 const r=evaluateFlyby({day:8,hour:10,leadDays:2,stepHours:1});
 assert.ok(r.samples.length>=29);
 assert.ok(r.samples.every((s,i)=>i===0||s.jdTT>r.samples[i-1].jdTT));
 assert.equal(r.selected.hour,10);
});
test('other candidate dates produce finite results without a historical verification claim',()=>{
 for(const day of [3,8,13]){
   const r=evaluateFlyby({day,massMultiplier:.5,leadDays:1,stepHours:.5});
   assert.ok(Number.isFinite(r.metrics.maxShiftKm));
   assert.equal(r.historicalIdentificationConfirmed,false);
   assert.equal(r.highPrecisionEphemerisValidated,false);
 }
});
test('strict bounds for time, physics, sampling, and unsupported scenarios',()=>{
 for(const options of [{day:2},{hour:30},{leadDays:0},{leadDays:100},
  {stepHours:0},{massMultiplier:-1},{massMultiplier:3},
  {sampleStepHours:0},{startHour:19,endHour:18},
  {deltaTSeconds:Infinity},{day:8,hour:3,startHour:4}]){
   assert.throws(()=>evaluateFlyby(options));
 }
});
test('receipt is scientific experiment, not validated astronomy or a probability forecast',()=>{
 const r=flybyReceipt({day:8,massMultiplier:1});
 assert.equal(r.verdict,'ILLUSTRATIVE_GRAVITY_SENSITIVITY');
 assert.equal(r.schema,'gmed-startrace-5:flyby-experiment:v3');
 assert.equal(r.historicalIdentificationConfirmed,false);
 assert.equal(r.highPrecisionEphemerisValidated,false);
 assert.equal(r.independentVerification,false);
 assert.ok(r.trajectorySamples.length>=29);
 assert.equal('samples' in r,false);
 assert.ok(r.limitations.some(s=>s.includes('step sizes')));
});
