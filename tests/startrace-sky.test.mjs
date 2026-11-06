import test from 'node:test';
import assert from 'node:assert/strict';
import {
 AU_KM,NOON_UT_JD,DEFAULT_DELTA_T,CANDIDATES,earthApprox,cometParabolic,gmst,jdFor,skyAt,skyPaths,skyReceipt
} from '../src/startrace-sky.js';
const near=(a,b,e)=>assert.ok(Math.abs(a-b)<e,String(a)+' differs from '+String(b));
const magnitude=v=>Math.hypot(...v);
test('papers eleven candidate elements are loaded',()=>{
 assert.deepEqual(CANDIDATES.map(x=>x.day),[3,4,5,6,7,8,9,10,11,12,13]);
 assert.equal(CANDIDATES[5].q,.0407);assert.equal(CANDIDATES[5].omega,346.25);
 assert.equal(CANDIDATES[5].perihelionJd,1719785.565);
});
test('paper noon UT converts to ephemeris time by ADDING delta T',()=>{
 const p=skyAt({day:8,hour:12});
 near(p.jdUT,NOON_UT_JD,1e-10);
 near(p.jdTT-p.jdUT,DEFAULT_DELTA_T/86400,1e-10);
 near(jdFor(9,12)-jdFor(8,12),1,1e-10);
});
test('NASA Earth barycenter stays at roughly one AU',()=>{
 for(const jd of [1719720,1719756,1720020,2451545]){
  assert.ok(magnitude(earthApprox(jd))>.98&&magnitude(earthApprox(jd))<1.02);
 }
});
test('parabolic candidate reaches perihelion at its stated q',()=>{
 for(const c of CANDIDATES) near(magnitude(cometParabolic(c.perihelionJd,c)),c.q,1e-10);
});
test('June 8 close approach is near lunar-distance order',()=>{
 const p=skyAt({hour:8});
 assert.ok(p.comet.geocentricDistanceAu>.0018&&p.comet.geocentricDistanceAu<.0045,String(p.comet.geocentricDistanceAu));
});
test('sky solar noon Sun is south (regression guard for reversing ΔT)',()=>{
 const p=skyAt({hour:12});
 assert.ok(p.sun.azDeg>150&&p.sun.azDeg<210,String(p.sun.azDeg));
 assert.ok(p.sun.altDeg>70,String(p.sun.altDeg));
});
test('comet arrives near zenith around 10 local time in central published scenario',()=>{
 const p=skyAt({hour:10});
 assert.ok(p.comet.altDeg>75,String(p.comet.altDeg));
});
test('bounded azimuth, altitude, and ΔT sensitivity',()=>{
 const a=skyAt({hour:10}),b=skyAt({hour:10,deltaTSeconds:11000});
 for(const x of [a,b]){assert.ok(x.comet.azDeg>=0&&x.comet.azDeg<360);assert.ok(x.comet.altDeg>=-90&&x.comet.altDeg<=90);}
 assert.notEqual(a.comet.geocentricDistanceAu,b.comet.geocentricDistanceAu);
});
test('all eleven candidate sky trails are finite',()=>{
 const p=skyPaths({start:5,end:14,step:1});
 assert.equal(p.length,11);assert.equal(p[5].samples.length,10);
 assert.ok(p.flatMap(x=>x.samples).every(x=>Number.isFinite(x.altDeg)));
});
test('bounds reject bad dates and unregistered orbits',()=>{
 assert.throws(()=>skyAt({day:1}));assert.throws(()=>skyAt({hour:-1}));
 assert.throws(()=>skyAt({deltaTSeconds:0}));
 assert.throws(()=>cometParabolic(1719756,{q:.1}));
 assert.throws(()=>skyPaths({step:0}));assert.throws(()=>jdFor(8,25));
});
test('receipt never certifies identification or precise reconstruction',()=>{
 const r=skyReceipt({day:8,hour:10});
 assert.equal(r.schema,'gmed-startrace-5:sky-scenario:v2');
 assert.equal(r.historicalIdentificationConfirmed,false);
 assert.equal(r.skyPathReproduced,false);
 assert.equal(r.independentVerification,false);
 assert.equal(r.alternativeScenarioCount,11);
 assert.ok(r.limitations.length>=6);
});
