/**
 * STARTRACE-5 R4: fail-closed parser for externally acquired JPL Horizons
 * vector TABLE text, plus Hermite interpolation of Earth and Moon separately.
 *
 * This module validates DECLARED headers, not server authenticity, data integrity,
 * DE441 model identity, or historical accuracy. No network access.
 */
import {AU_KM,jdFor} from './startrace-sky.js';
export const R4_SCHEMA='gmed-startrace-5:horizons-vectors:v1';
export const HORIZONS_DOCUMENTATION='https://ssd-api.jpl.nasa.gov/doc/horizons.html';
export const SOURCE_STATUS='UNAUTHENTICATED_SOURCE_DECLARATION';
const TARGETS={earth:399,moon:301};
const number=/^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[EeDd][+-]?\d+)?$/;
const toNumber=(raw)=>{
 const s=raw.trim();
 if(!number.test(s))throw new Error('Malformed Horizons numeric field');
 const v=Number(s.replace(/[Dd]/g,'E'));
 if(!Number.isFinite(v))throw new Error('Non-finite Horizons number');
 return v;
};
const invariant=(condition,message)=>{if(!condition)throw new Error(message);};
const vecNorm=v=>Math.hypot(...v);
const sub=(a,b)=>a.map((x,k)=>x-b[k]);

export function horizonsQueryUrl(body,{day=8,leadDays=2,deltaTSeconds=10572}={}){
 invariant(Object.hasOwn(TARGETS,body),'Unsupported Horizons target');
 invariant(Number.isInteger(day)&&day>=3&&day<=13,'Candidate day outside published range');
 invariant(Number.isFinite(leadDays)&&leadDays>=.5&&leadDays<=7,'Lead days out of bounds');
 invariant(Number.isFinite(deltaTSeconds)&&deltaTSeconds>=8000&&deltaTSeconds<=14000,'Delta T out of bounds');
 // Extended by 12 hours around the entire integration range.
 const start=jdFor(day,12)-leadDays+deltaTSeconds/86400-.5;
 const stop=jdFor(day,18)+deltaTSeconds/86400+.5;
 const q=new URLSearchParams({
  format:'text', COMMAND:"'"+TARGETS[body]+"'", OBJ_DATA:"'NO'",
  MAKE_EPHEM:"'YES'", EPHEM_TYPE:"'VECTORS'",
  CENTER:"'500@10'", START_TIME:"'JD "+start.toFixed(6)+"'",
  STOP_TIME:"'JD "+stop.toFixed(6)+"'", STEP_SIZE:"'3 h'",
  TIME_TYPE:"'TDB'", REF_PLANE:"'ECLIPTIC'", REF_SYSTEM:"'ICRF'",
  OUT_UNITS:"'AU-D'", VEC_CORR:"'NONE'",
  VEC_TABLE:"'2'", VEC_LABELS:"'NO'", CSV_FORMAT:"'YES'",
  CAL_FORMAT:"'BOTH'"
 });
 return 'https://ssd.jpl.nasa.gov/api/horizons.api?'+q.toString();
}

export function parseHorizons(raw,expectedBody){
 invariant(Object.hasOwn(TARGETS,expectedBody),'Expected target must be earth or moon');
 invariant(typeof raw==='string'&&raw.length>=100&&raw.length<=1_000_000,'Horizons text must be 100 bytes to 1 MiB');
 const target=TARGETS[expectedBody];
 const match=raw.match(/^\s*Target body name\s*:\s*([^\r\n]+)$/mi);
 invariant(match&&new RegExp('\\('+target+'\\)').test(match[1]),'Target ID does not match expected '+expectedBody);
 invariant(/^\s*Center body name\s*:\s*Sun\s*\(10\)/mi.test(raw),'Expected Sun-centered (10) vectors');
 invariant(/^\s*Reference frame\s*:\s*Ecliptic of J2000\.0\b/mi.test(raw),'Requires J2000 ecliptic frame');
 invariant(/^\s*Output units\s*:\s*AU-D\b/mi.test(raw),'Requires AU and days, not km or seconds');
 // Check TDB declaration in the ephemeris header; UT here is a severe error.
 const preamble=raw.split('$$SOE')[0];
 invariant(/^\s*Start time\s*:\s*[^\r\n]*\bTDB\b/mi.test(preamble),
  'Requires TDB ephemeris dates, not UT or TT');
 invariant(/^\s*Output type\s*:\s*GEOMETRIC\b/mi.test(preamble),
  'Requires uncorrected geometric vectors; light-time solutions are unsupported');
 const markS=raw.indexOf('$$SOE'),markE=raw.indexOf('$$EOE');
 invariant(markS>=0&&markE>markS&&raw.indexOf('$$SOE',markS+5)<0,'Exactly one Horizons data section required');
 invariant(raw.indexOf('$$EOE',markE+5)<0,'Exactly one Horizons end marker required');
 const rows=raw.slice(markS+5,markE).trim().split(/\r?\n/).filter(s=>s.trim());
 invariant(rows.length>=2&&rows.length<=3000,'Require 2 to 3000 vector rows');
 const points=rows.map((line,index)=>{
   const cols=line.split(',').map(s=>s.trim());
   invariant(cols.length>=8&&cols.length<=11,
     'Expected CSV with JD, calendar string, xyz and velocity, row '+(index+1));
   const jd=toNumber(cols[0]);
   invariant(jd>1719700&&jd<1719900,'JD outside limited 5 BCE research window');
   invariant(/(?:B\.C\.|BC|A\.D\.)/i.test(cols[1]),
     'Missing Horizons calendar date field');
   const p=cols.slice(2,5).map(toNumber),v=cols.slice(5,8).map(toNumber);
   invariant(vecNorm(p)>.7&&vecNorm(p)<1.3,
     'Sun-relative Earth/Moon heliocentric distance outside defensible range');
   invariant(vecNorm(v)>.005&&vecNorm(v)<.05,
     'Sun-relative Earth/Moon speed outside defensible range');
   return Object.freeze({jd,p:Object.freeze(p),v:Object.freeze(v)});
 });
 let maxGapDays=0;
 for(let i=1;i<points.length;i++){
   const gap=points[i].jd-points[i-1].jd;
   invariant(gap>1e-7,'Vector times must increase strictly');
   invariant(gap<=.26,'Vector sampling gap exceeds 6.24 hours');
   maxGapDays=Math.max(maxGapDays,gap);
 }
 return Object.freeze({
   schema:R4_SCHEMA,body:expectedBody,target,sourceStatus:SOURCE_STATUS,
   frame:'J2000 heliocentric ecliptic',units:'AU-D',timescale:'TDB',
   count:points.length,startJD:points[0].jd,endJD:points.at(-1).jd,
   maxGapDays,points:Object.freeze(points),
   sourceHeader:Object.freeze({
     targetName:match[1].trim(),
     model:raw.match(/\bDE(?:4[34]\d)\b/i)?.[0]||'NOT DISCLOSED'
   })
 });
}

export function interpolateVectors(dataset,jd){
 invariant(dataset&&dataset.schema===R4_SCHEMA,'Invalid Horizons dataset');
 invariant(typeof jd==='number'&&Number.isFinite(jd),'JD must be finite');
 const pts=dataset.points;
 invariant(jd>=pts[0].jd-1e-9&&jd<=pts.at(-1).jd+1e-9,
   'Requested JD is outside Horizons ephemeris coverage');
 if(jd<=pts[0].jd)return {p:[...pts[0].p],v:[...pts[0].v]};
 if(jd>=pts.at(-1).jd)return {p:[...pts.at(-1).p],v:[...pts.at(-1).v]};
 let lo=0,hi=pts.length-1;
 while(hi-lo>1){
   const mid=(hi+lo)>>1;
   if(pts[mid].jd<=jd)lo=mid;else hi=mid;
 }
 const a=pts[lo],b=pts[hi],h=b.jd-a.jd,t=(jd-a.jd)/h;
 const t2=t*t,t3=t2*t;
 const h00=2*t3-3*t2+1,h10=t3-2*t2+t,h01=-2*t3+3*t2,h11=t3-t2;
 const dh00=(6*t2-6*t)/h,dh10=3*t2-4*t+1,dh01=(-6*t2+6*t)/h,dh11=3*t2-2*t;
 return {
   p:a.p.map((x,k)=>h00*x+h10*h*a.v[k]+h01*b.p[k]+h11*h*b.v[k]),
   v:a.v.map((x,k)=>dh00*a.p[k]+dh10*x+dh01*b.p[k]+dh11*b.v[k])
 };
}
export function pairHorizons(earth,moon,{startJD,endJD}={}){
 invariant(earth?.schema===R4_SCHEMA&&earth.body==='earth','Valid Earth (399) source required');
 invariant(moon?.schema===R4_SCHEMA&&moon.body==='moon','Valid Moon (301) source required');
 invariant(earth.units===moon.units&&earth.frame===moon.frame&&earth.timescale===moon.timescale,
   'Inconsistent vector frame, units or time scale');
 invariant(Number.isFinite(startJD)&&Number.isFinite(endJD)&&endJD>startJD,
   'Integration interval must be finite and increasing');
 for(const [name,d] of [['Earth',earth],['Moon',moon]]){
   invariant(startJD>=d.startJD+1e-7&&endJD<=d.endJD-1e-7,
     name+' data do not cover the entire requested period with a margin');
 }
 const span=Math.max(startJD,earth.startJD,moon.startJD);
 const days=[span,(startJD+endJD)/2,Math.min(endJD,earth.endJD,moon.endJD)];
 for(const jd of days){
  const e=interpolateVectors(earth,jd).p,m=interpolateVectors(moon,jd).p;
  const km=vecNorm(sub(e,m))*AU_KM;
  invariant(km>150000&&km<600000,'Earth–Moon separation outside conservative physical range');
 }
 return Object.freeze({earth,moon,startJD,endJD,sourceStatus:SOURCE_STATUS});
}
