import test from 'node:test';
import assert from 'node:assert/strict';
import {horizonsQueryUrl,parseHorizons,interpolateVectors,pairHorizons,SOURCE_STATUS} from '../src/startrace-horizons.js';
// Explicitly synthetic Horizons-shaped fixtures: NOT NASA data.
const header=(id,name,opts={})=>['Target body name: '+name+' ('+id+') {source: DE441}',
 'Center body name: Sun (10) {source: DE441}',
 'Center-site name: BODY CENTER',
 'Start time: B.C. 0005-Jun-06 00:00:00.0000 '+(opts.time||'TDB'),
 'Reference frame : '+(opts.frame||'Ecliptic of J2000.0'),
 'Output units : '+(opts.units||'AU-D'),
 'Output type : GEOMETRIC cartesian states',
 '$$SOE'].join('\n');
function fixture(id,name,{start=1719752.0,step=.125,count=24,shift=0,...opts}={}){
 const rows=Array.from({length:count},(_,i)=>{
  const t=i*step;
  return [start+t,'B.C. 0005-Jun-06 00:00:00.0000',
    1+t*.01,shift+t*.02,0,.01,.02,0,''].join(',');
 });
 return header(id,name,opts)+'\n'+rows.join('\n')+'\n$$EOE\n';
}
const e=()=>parseHorizons(fixture(399,'Earth'),'earth');
const m=()=>parseHorizons(fixture(301,'Moon',{shift:.00257}),'moon');
test('official query params select distinct geocentric bodies and heliocentric TDB vectors',()=>{
 for(const [body,id] of [['earth','399'],['moon','301']]){
  const url=new URL(horizonsQueryUrl(body));
  const params=url.searchParams;
  assert.equal(params.get('COMMAND'),"'"+id+"'");
  assert.equal(params.get('CENTER'),"'500@10'");
  assert.equal(params.get('REF_PLANE'),"'ECLIPTIC'");
  assert.equal(params.get('OUT_UNITS'),"'AU-D'");
  assert.equal(params.get('TIME_TYPE'),"'TDB'");
  assert.equal(params.get('VEC_CORR'),"'NONE'");
  assert.equal(params.get('CSV_FORMAT'),"'YES'");
 }
});
test('parser preserves timestamps and both velocity components',()=>{
 const data=e();
 assert.equal(data.body,'earth');assert.equal(data.count,24);
 assert.equal(data.sourceStatus,SOURCE_STATUS);
 assert.equal(data.sourceHeader.model,'DE441');
 assert.deepEqual(data.points[0].p,[1,0,0]);
 assert.deepEqual(data.points[0].v,[.01,.02,0]);
});
test('parser rejects frame, units, timescale, target and missing geometry metadata',()=>{
 for(const raw of [
  fixture(301,'Moon'),fixture(399,'Earth',{frame:'ICRF'}),
  fixture(399,'Earth',{units:'KM-S'}),
  fixture(399,'Earth',{time:'UT'}),
  fixture(399,'Earth').replace('Output type : GEOMETRIC','Output type : ASTROMETRIC'),
  fixture(399,'Earth').replace('Center body name: Sun (10)','Center body name: Earth (399)'),
  fixture(399,'Earth').replace('$$SOE',''),
 ])assert.throws(()=>parseHorizons(raw,'earth'));
});
test('parser rejects suspicious timestamps, sparsity, duplication and incompatible data',()=>{
 assert.throws(()=>parseHorizons(fixture(399,'Earth',{step:.3}),'earth'));
 assert.throws(()=>parseHorizons(fixture(399,'Earth',{count:1}),'earth'));
 assert.throws(()=>parseHorizons(fixture(399,'Earth',{start:2451545}),'earth'));
 assert.throws(()=>parseHorizons(fixture(399,'Earth').replace('1719752.125','1719752.000'),'earth'));
});
test('Hermite interpolation preserves endpoints and linear analytic state',()=>{
 const data=e(),jd=1719752+.0625;
 const mid=interpolateVectors(data,jd);
 assert.ok(Math.abs(mid.p[0]-(1+.0625*.01))<1e-10);
 assert.ok(Math.abs(mid.p[1]-(.0625*.02))<1e-10);
 assert.ok(Math.abs(mid.v[0]-.01)<1e-10);
 assert.throws(()=>interpolateVectors(data,1719740));
});
test('Earth and Moon are both required and interval must be covered',()=>{
 const pair=pairHorizons(e(),m(),{startJD:1719752.2,endJD:1719754.2});
 assert.equal(pair.sourceStatus,SOURCE_STATUS);
 assert.throws(()=>pairHorizons(e(),m(),{startJD:1719751,endJD:1719754}));
 assert.throws(()=>pairHorizons(m(),e(),{startJD:1719752.2,endJD:1719754.2}));
});
test('cannot claim a full orbit without two original imported sources',()=>{
 assert.throws(()=>pairHorizons(e(),null,{startJD:1719752.2,endJD:1719754.2}));
 assert.throws(()=>horizonsQueryUrl('jupiter'));
});
