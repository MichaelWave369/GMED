import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rk4FixedStep,dopri54Step,adaptiveTimeline,fixedTimeline} from '../src/startrace-integrators.js';
import {R7_SCHEMA,restrictedCometDerivative,solarKeplerBenchmark,
 stressTestGravity,r7Receipt} from '../src/startrace-r7.js';
import {parseHorizons} from '../src/startrace-horizons.js';
const approx=(a,b,tol)=>assert.ok(Math.abs(a-b)<tol,String(a)+' != '+String(b)+' tolerance '+tol);
const load=(name,body)=>parseHorizons(readFileSync(
 new URL('../data/horizons-5bce/'+name,import.meta.url),'utf8'),body);
const earth=()=>load('earth-399-extract.txt','earth');
const moon=()=>load('moon-301-extract.txt','moon');
test('fixed RK4 and adaptive DOPRI54 independently solve exponential growth',()=>{
 const f=(_t,y)=>y;
 const fixed=fixedTimeline(f,0,[1],[1,2],.01);
 const adaptive=adaptiveTimeline(f,0,[1],[1,2],{rtol:1e-11,atol:1e-13,maxStepDays:.1});
 approx(fixed.states[1][0],Math.exp(2),5e-9);
 approx(adaptive.states[1][0],Math.exp(2),1e-9);
 assert.ok(adaptive.stats.accepted>1);
});
test('adaptive solver follows analytic harmonic oscillator cycle',()=>{
 const f=(_t,[x,v])=>[v,-x];
 const result=adaptiveTimeline(f,0,[1,0],[Math.PI/2,Math.PI,2*Math.PI],
  {rtol:1e-11,atol:1e-12,maxStepDays:.15});
 approx(result.states[0][0],0,2e-9);
 approx(result.states[0][1],-1,2e-9);
 approx(result.states.at(-1)[0],1,2e-9);
});
test('embedded error rejection responds to tight tolerance and large steps',()=>{
 const f=(_t,y)=>[y[0]**2];
 const step=dopri54Step(f,0,[1],.4,{rtol:1e-12,atol:1e-14});
 assert.ok(step.errorNorm>1);
 const r=adaptiveTimeline(f,0,[1],[.6],{rtol:1e-11,atol:1e-13,initialStepDays:.4,maxStepDays:.4});
 assert.ok(r.stats.rejected>=1);assert.ok(r.stats.accepted>1);
});
test('reject invalid derivatives, ordering, step budget and tolerance',()=>{
 assert.throws(()=>rk4FixedStep(()=>[NaN],0,[1],.01),/Derivative/);
 assert.throws(()=>adaptiveTimeline(()=>[1],0,[0],[1,.5]),/increase/);
 assert.throws(()=>adaptiveTimeline(()=>[1],0,[0],[1],{maxAttempts:1,maxStepDays:.1}),/BUDGET/);
 assert.throws(()=>dopri54Step(()=>[1],0,[0],.1,{atol:[1e-9,1e-9]}),/length/);
});
test('solar-only parabolic check: finite error, stable angular momentum',()=>{
 const r=solarKeplerBenchmark({day:8,leadDays:2});
 assert.ok(Number.isFinite(r.maxAnalyticPositionErrorKm));
 assert.ok(Number.isFinite(r.maxAngularMomentumDrift));
 assert.ok(r.maxAngularMomentumDrift<1e-7);
 assert.ok(r.maxRK4DifferenceKm<10);
});
test('source-derived Earth and Moon inputs support numerical stress comparison',()=>{
 const result=stressTestGravity(earth(),moon());
 assert.equal(result.schema,R7_SCHEMA);
 assert.equal(result.verdict,'NUMERICAL_METHOD_CROSSCHECK_ONLY');
 assert.equal(result.samples.length,29);
 assert.ok(result.consistency.adaptiveSteps.accepted>0);
 assert.ok(result.consistency.minSampledEarthDistanceKm>15000);
 assert.ok(result.consistency.minSampledMoonDistanceKm>7000);
 assert.ok(Number.isFinite(result.consistency.maxRK4VsAdaptiveKm));
 assert.ok(Number.isFinite(result.consistency.maxLegacyVsAdaptiveKm));
 assert.equal(result.historicalCometOrbitConfirmed,false);
 assert.equal(result.independentPhysicalValidation,false);
});
test('both fixed-step settings agree with solar-only adaptive solution to a reasonable numerical tolerance',()=>{
 const e=earth(),m=moon();
 const a=stressTestGravity(e,m,{stepHours:1,massMultiplier:0});
 const b=stressTestGravity(e,m,{stepHours:.25,massMultiplier:0});
 assert.ok(a.consistency.maxRK4VsAdaptiveKm<10,'1-hour disagreement (km): '+a.consistency.maxRK4VsAdaptiveKm);
 assert.ok(b.consistency.maxRK4VsAdaptiveKm<10,'15-minute disagreement (km): '+b.consistency.maxRK4VsAdaptiveKm);
});
test('unsupported scenarios and collision-zone conditions fail closed',()=>{
 const e=earth(),m=moon();
 assert.throws(()=>stressTestGravity(e,m,{day:3}),/only covers/);
 assert.throws(()=>stressTestGravity(e,m,{leadDays:4}));
 assert.throws(()=>stressTestGravity(e,m,{rtol:1e-3}));
 const r=e.points[10],s=[...r.p,0,0,0],f=restrictedCometDerivative(e,m);
 assert.throws(()=>f(r.jd,s),/EARTH_CLOSE_APPROACH_EXCLUSION/);
});
test('receipt preserves source digests without historical certification',()=>{
 const receipt=r7Receipt(stressTestGravity(earth(),moon(),{massMultiplier:0}),
  {earthSha256:'a'.repeat(64),moonSha256:'b'.repeat(64)});
 assert.equal(receipt.normalizedSourceSha256.earth,'a'.repeat(64));
 assert.equal(receipt.normalizedSourceSha256.moon,'b'.repeat(64));
 assert.equal(receipt.exactClosestApproachDetermined,false);
 assert.equal(receipt.sourceCryptographicAuthenticity,false);
 assert.ok(receipt.scientificLimitations.length>=7);
});
