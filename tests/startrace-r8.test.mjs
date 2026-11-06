import test from 'node:test';
import assert from 'node:assert/strict';
import {verifySciPyReport} from '../src/startrace-r8-verify.js';
const fake=()=>{
 const input={
  schema:'gmed-startrace-5:r8-cross-language-input:v1',
  historicalCometOrbitConfirmed:false,sourceAuthenticityVerified:false,
  physicalModelIndependentlyValidated:false,
  epochJD:1719754,outputJD:[1719755,1719755.1],
  localSolarHours:[4,6],earthCutoffKm:15000,moonCutoffKm:7000,
  sourceNormalizedSha256:{earth:'a'.repeat(64),moon:'b'.repeat(64)}
 };
 const result={
  schema:'gmed-startrace-5:r8-external-numerical-result:v1',
  verdict:'CROSS_LANGUAGE_NUMERICAL_AGREEMENT_ONLY',
  referenceMethod:'SciPy solve_ivp DOP853 (8th-order adaptive Runge-Kutta)',
  scipyVersion:'1.18.1',
  historicalCometOrbitConfirmed:false,independentPhysicalValidation:false,
  sourceCryptographicAuthenticity:false,exactClosestApproachDetermined:false,
  anchorJD:input.epochJD,outputJD:input.outputJD,
  sourceNormalizedSha256:{...input.sourceNormalizedSha256},
  statistics:{maxPositionDifferenceKm:.001,rmsPositionDifferenceKm:.0008,
   maxVelocityDifferenceKmS:.000001,rmsVelocityDifferenceKmS:.0000008,
   scipyFunctionEvaluations:100,minDerivativeStageEarthDistanceKm:400000,
   minDerivativeStageMoonDistanceKm:300000,sampleCount:2},
  samples:[
   {jd:1719755,hour:4,positionDifferenceKm:.001,velocityDifferenceKmS:.000001},
   {jd:1719755.1,hour:6,positionDifferenceKm:.0005,velocityDifferenceKmS:.0000005}
  ],
  model:'Same hypothetical restricted equations',
  scientificLimitations:['Same force model','Not measured','Not authenticated','No orbit fit']
 };
 return {input,result};
};
test('qualified external report becomes conservative publishable cross-language receipt',()=>{
 const {input,result}=fake();
 const v=verifySciPyReport(input,result);
 assert.equal(v.verificationGate.passed,true);
 assert.equal(v.verdict,'CROSS_LANGUAGE_NUMERICAL_AGREEMENT_ONLY');
 assert.equal(v.historicalCometOrbitConfirmed,false);
 assert.equal(v.independentPhysicalValidation,false);
});
test('modified or missing source digest fails closed',()=>{
 const {input,result}=fake();
 result.sourceNormalizedSha256.earth='c'.repeat(64);
 assert.throws(()=>verifySciPyReport(input,result),/HASH/);
});
test('rejects fabricated solver identity or scientific certification',()=>{
 const {input,result}=fake();result.referenceMethod='Fake solver';
 assert.throws(()=>verifySciPyReport(input,result),/DOP853/);
 const r=fake();r.result.historicalCometOrbitConfirmed=true;
 assert.throws(()=>verifySciPyReport(r.input,r.result),/CERTIFICATION/);
});
test('rejects mismatched epochs, missing samples, nonfinite and negative errors',()=>{
 let r=fake();r.result.outputJD[1]+=1;
 assert.throws(()=>verifySciPyReport(r.input,r.result),/EPOCHS/);
 r=fake();r.result.samples.pop();
 assert.throws(()=>verifySciPyReport(r.input,r.result),/ROWS/);
 r=fake();r.result.statistics.maxPositionDifferenceKm=Infinity;
 assert.throws(()=>verifySciPyReport(r.input,r.result),/NONFINITE/);
 r=fake();r.result.samples[0].positionDifferenceKm=-1;
 assert.throws(()=>verifySciPyReport(r.input,r.result),/INVALID/);
});
test('excessive solver mismatch and unsafe proximity do not pass the gate',()=>{
 let r=fake();r.result.statistics.maxPositionDifferenceKm=6;
 assert.throws(()=>verifySciPyReport(r.input,r.result),/POSITION_SOLVER/);
 r=fake();r.result.statistics.minDerivativeStageMoonDistanceKm=6500;
 assert.throws(()=>verifySciPyReport(r.input,r.result),/CLOSE_APPROACH/);
});
