import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AU_KM, PAPER_BENCHMARK, DEFAULT_SCENARIO, EVIDENCE_LEDGER,
  requiredTransverseSpeed, angularRateDegPerHour, parallaxArcseconds,
  keplerPeriodOrbit, brightnessRatioForMagnitudeDecrease,
  evaluateScenario, researchReceipt
} from '../src/startrace.js';

const near=(actual,expected,tol=1e-7)=>assert.ok(Math.abs(actual-expected)<=tol,
  'expected '+actual+' within '+tol+' of '+expected);

test('AU constant and published benchmark are pinned',()=>{
  assert.equal(AU_KM,149_597_870.7);
  assert.equal(PAPER_BENCHMARK.closestApproachAu,0.0026);
  assert.equal(PAPER_BENCHMARK.perihelionAu,0.0407);
  assert.equal(PAPER_BENCHMARK.deltaTSeconds,10572);
});
test('at 389,000 km a 13-degree hourly rate needs about 24.5 km/s',()=>{
  const speed=requiredTransverseSpeed(389000,13);
  assert.ok(speed>24.4&&speed<24.6);
});
test('forward angular rate inverses required transverse velocity',()=>{
  for(const distance of [100000,389000,1000000]){
    const v=requiredTransverseSpeed(distance,13);
    near(angularRateDegPerHour(distance,v),13,1e-11);
  }
});
test('parallax at 10 km baseline near lunar distance is about 5 arcseconds',()=>{
  const angle=parallaxArcseconds(389000,10);
  assert.ok(angle>5&&angle<5.5);
  assert.equal(parallaxArcseconds(389000,0),0);
});
test('Kepler orbit for 13,200 years is extremely elliptical with 1,117 AU aphelion',()=>{
  const o=keplerPeriodOrbit(13200,0.0407);
  assert.ok(o.semimajorAxisAu>558&&o.semimajorAxisAu<559);
  assert.ok(o.eccentricity>0.9999&&o.eccentricity<1);
  assert.ok(o.aphelionAu>1116&&o.aphelionAu<1118);
});
test('five magnitude brightening yields 100x factor',()=>near(brightnessRatioForMagnitudeDecrease(5),100,1e-10));
test('distance scaling is linear for required transverse speed',()=>{
  near(requiredTransverseSpeed(800000,13),2*requiredTransverseSpeed(400000,13),1e-12);
});
test('default evaluation is deterministic and units are preserved',()=>{
  const a=evaluateScenario(), b=evaluateScenario({...DEFAULT_SCENARIO});
  assert.deepEqual(a,b);
  near(a.calculated.distanceKm,0.0026*AU_KM);
  assert.equal(a.boundaries.length,6);
});
test('rate residual is exactly zero at matching benchmark',()=>{
  const required=requiredTransverseSpeed(0.0026*AU_KM,13);
  near(evaluateScenario({transverseSpeedKmS:required}).calculated.residualRateDegHour,0,1e-12);
});
test('no negative or nonfinite physically meaningful inputs accepted',()=>{
  for(const bad of [0,-1,NaN,Infinity,'389000',null]){
    assert.throws(()=>angularRateDegPerHour(bad,20));
  }
  assert.throws(()=>evaluateScenario({transverseSpeedKmS:-1}));
  assert.throws(()=>evaluateScenario({baselineKm:-1}));
  assert.throws(()=>evaluateScenario({periodYears:0}));
  assert.throws(()=>evaluateScenario({magnitudeDecrease:NaN}));
  assert.throws(()=>keplerPeriodOrbit(1,1));
});
test('sources distinguish original observations from unverified assertions',()=>{
  assert.equal(EVIDENCE_LEDGER.length,5);
  assert.equal(EVIDENCE_LEDGER.find(x=>x.id==='meier-comet').status,'unverified-attribution');
  assert.equal(EVIDENCE_LEDGER.find(x=>x.id==='identification').status,'unconfirmed');
});
test('receipt does not claim a recreated sky, or verified history',()=>{
  const receipt=researchReceipt(DEFAULT_SCENARIO,{generatedAt:'2026-11-06T00:00:00.000Z'});
  assert.equal(receipt.schema,'gmed-startrace-5:research-receipt:v1');
  assert.equal(receipt.verdict,'ILLUSTRATIVE_PHYSICS_ONLY');
  assert.equal(receipt.skyPathReproduced,false);
  assert.equal(receipt.historicalIdentificationConfirmed,false);
  assert.equal(receipt.independentVerification,false);
  assert.equal(receipt.evidence.length,5);
  assert.equal(receipt.generatedAt,'2026-11-06T00:00:00.000Z');
});
test('receipt rejects bad timestamps and non-object inputs',()=>{
  assert.throws(()=>researchReceipt(DEFAULT_SCENARIO,{generatedAt:'not-a-date'}));
  assert.throws(()=>evaluateScenario(null));
});
