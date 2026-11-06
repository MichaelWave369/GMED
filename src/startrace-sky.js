/**
 * STARTRACE-5 / R2 candidate-orbit visualization, NOT a confirmed ancient ephemeris.
 * Candidate elements: Matney 2025 pp 395-397, J2000 ecliptic frame.
 * Earth: JPL long-range (3000 BC–3000 AD) Earth-Moon barycenter.
 * The paper's noon JD is a UT reference; ephemeris JD = JD_UT + ΔT/86400.
 */
export const MODEL_VERSION='startrace-r2-candidate-2026-11';
export const AU_KM=149597870.7;
export const NOON_UT_JD=1719755.898;
export const DEFAULT_DELTA_T=10572;
export const BETHLEHEM=Object.freeze({latDeg:31.7043,lonDeg:35.2077,name:'Bethlehem'});
const deg=Math.PI/180;
const rad=x=>x*deg;
const wrap=x=>(x%360+360)%360;
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const length=v=>Math.hypot(...v);
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const check=(v,name,lo,hi)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)throw new RangeError(name+' invalid');return v;};
const candidate=(day,q,omega,node,inc,perihelionJd)=>Object.freeze({day,q,omega,node,inc,perihelionJd});
export const CANDIDATES=Object.freeze([
candidate(3,.0201,154.18,287.25,1.34,1719779.753),
candidate(4,.0218,86.21,355.48,.23,1719780.822),
candidate(5,.0238,355.00,86.88,1.03,1719781.903),
candidate(6,.0264,348.56,93.33,1.82,1719783.006),
candidate(7,.0360,351.09,88.59,1.02,1719784.385),
candidate(8,.0407,346.25,93.01,1.39,1719785.565),
candidate(9,.0456,343.11,95.74,1.71,1719786.754),
candidate(10,.0637,353.17,82.07,.60,1719788.442),
candidate(11,.0752,356.77,76.85,.47,1719789.866),
candidate(12,.0872,359.82,72.27,.40,1719791.298),
candidate(13,.0997,2.15,68.46,.36,1719792.739)
]);
export const PRIMARY_SOURCES=Object.freeze([
{title:'Matney 2025, JBAA 135(6), pp 395-397, Tables 1 and 2',url:'https://britastro.org/wp-content/uploads/2025/12/387-407_Matney_JBAA_2025-1.pdf'},
{title:'NASA JPL approximate planetary position elements 3000 BC–3000 AD',url:'https://ssd.jpl.nasa.gov/planets/approx_pos.html'}
]);
const earthBase=[1.00000018,.01673163,-.00054346,100.46691572,102.93005885,-5.11260389];
const earthRate=[-.00000003,-.00003661,-.01337178,35999.37306329,.31795260,-.24123856];
const gaussianK=.01720209895;
function orbitXYZ(x,y,incl,node,omega){
 const co=Math.cos(rad(omega)),so=Math.sin(rad(omega)),cO=Math.cos(rad(node)),sO=Math.sin(rad(node));
 const ci=Math.cos(rad(incl)),si=Math.sin(rad(incl));
 return [x*(co*cO-so*sO*ci)+y*(-so*cO-co*sO*ci),
 x*(co*sO+so*cO*ci)+y*(-so*sO+co*cO*ci),
 x*so*si+y*co*si];
}
export function earthApprox(jdTT){
 check(jdTT,'ephemeris JD',1000000,3000000);
 const T=(jdTT-2451545)/36525;
 const [a,e,i,L,peri,node]=earthBase.map((v,k)=>v+earthRate[k]*T);
 const M=rad(wrap(L-peri+180)-180);
 let E=M;
 for(let k=0;k<24;k++){const step=(M-E+e*Math.sin(E))/(1-e*Math.cos(E));E+=step;if(Math.abs(step)<1e-13)break;}
 return orbitXYZ(a*(Math.cos(E)-e),a*Math.sqrt(1-e*e)*Math.sin(E),i,node,peri-node);
}
export function cometParabolic(jdTT,orbit=CANDIDATES[5]){
 check(jdTT,'ephemeris JD',1000000,3000000);
 if(!CANDIDATES.includes(orbit))throw new RangeError('Not a published candidate');
 const {q,omega,node,inc,perihelionJd}=orbit;
 const factor=Math.sqrt(2*q*q*q)/gaussianK;
 const D=2*Math.sinh(Math.asinh(1.5*(jdTT-perihelionJd)/factor)/3);
 const radius=q*(1+D*D),nu=2*Math.atan(D);
 return orbitXYZ(radius*Math.cos(nu),radius*Math.sin(nu),inc,node,omega);
}
function equatorialJ2000(v){
 const e=rad(23.4392911);
 return [v[0],Math.cos(e)*v[1]-Math.sin(e)*v[2],Math.sin(e)*v[1]+Math.cos(e)*v[2]];
}
function precessToDate(v,jdTT){
 const T=(jdTT-2451545)/36525;
 const zeta=rad((2306.2181*T+.30188*T*T+.017998*T**3)/3600);
 const z=rad((2306.2181*T+1.09468*T*T+.018203*T**3)/3600);
 const theta=rad((2004.3109*T-.42665*T*T-.041833*T**3)/3600);
 const radius=length(v),a=Math.atan2(v[1],v[0]),d=Math.atan2(v[2],Math.hypot(v[0],v[1]));
 const A=Math.cos(d)*Math.sin(a+zeta);
 const B=Math.cos(theta)*Math.cos(d)*Math.cos(a+zeta)-Math.sin(theta)*Math.sin(d);
 const C=Math.sin(theta)*Math.cos(d)*Math.cos(a+zeta)+Math.cos(theta)*Math.sin(d);
 const ra=Math.atan2(A,B)+z,dec=Math.asin(Math.max(-1,Math.min(1,C)));
 return [radius*Math.cos(dec)*Math.cos(ra),radius*Math.cos(dec)*Math.sin(ra),radius*Math.sin(dec)];
}
export function gmst(jdUT){
 check(jdUT,'UT JD',1000000,3000000);
 const T=(jdUT-2451545)/36525;
 return wrap(280.46061837+360.98564736629*(jdUT-2451545)+.000387933*T*T-T**3/38710000);
}
function observerOffset(jdUT,observer){
 const lat=rad(observer.latDeg),lst=rad(wrap(gmst(jdUT)+observer.lonDeg));
 const f=1/298.257223563, e2=2*f-f*f;
 const N=6378.137/Math.sqrt(1-e2*Math.sin(lat)**2);
 return [N*Math.cos(lat)*Math.cos(lst)/AU_KM,N*Math.cos(lat)*Math.sin(lst)/AU_KM,N*(1-e2)*Math.sin(lat)/AU_KM];
}
function horizon(eq,jdUT,observer){
 const lat=rad(observer.latDeg),lst=rad(wrap(gmst(jdUT)+observer.lonDeg));
 const east=[-Math.sin(lst),Math.cos(lst),0];
 const north=[-Math.sin(lat)*Math.cos(lst),-Math.sin(lat)*Math.sin(lst),Math.cos(lat)];
 const up=[Math.cos(lat)*Math.cos(lst),Math.cos(lat)*Math.sin(lst),Math.sin(lat)];
 const e=dot(eq,east),n=dot(eq,north),u=dot(eq,up);
 return {altDeg:Math.atan2(u,Math.hypot(e,n))/deg,azDeg:wrap(Math.atan2(e,n)/deg),distanceAu:length(eq)};
}
export function jdFor(day,hour){
 if(!CANDIDATES.some(c=>c.day===day))throw new RangeError('Use candidate day 3–13');
 check(hour,'local solar hour',0,24);
 return NOON_UT_JD+(day-8)+(hour-12)/24;
}
export function skyAt({day=8,hour=10,deltaTSeconds=DEFAULT_DELTA_T,observer=BETHLEHEM}={}){
 check(deltaTSeconds,'ΔT seconds',8000,14000);
 check(observer.latDeg,'latitude',-90,90);check(observer.lonDeg,'longitude',-180,180);
 const orbit=CANDIDATES.find(c=>c.day===day);
 if(!orbit)throw new RangeError('Unknown candidate day');
 const jdUT=jdFor(day,hour);
 // UT is for Earth rotation, TT/ET is for solar system body positions.
 const jdTT=jdUT+deltaTSeconds/86400;
 const earth=earthApprox(jdTT),comet=cometParabolic(jdTT,orbit);
 const offset=observerOffset(jdUT,observer);
 const eqComet=precessToDate(equatorialJ2000(sub(comet,earth)),jdTT);
 const eqSun=precessToDate(equatorialJ2000(earth.map(v=>-v)),jdTT);
 return {
  day,hour,jdUT,jdTT,deltaTSeconds,observer,
  comet:{...horizon(sub(eqComet,offset),jdUT,observer),geocentricDistanceAu:length(sub(comet,earth))},
  sun:horizon(sub(eqSun,offset),jdUT,observer),
  vectors:{earth,comet},
  model:'JPL approximate Earth-Moon barycenter and Matney parabolic candidate; topocentric apparent geometry with approximate historical precession'
 };
}
export function skyPaths({start=4,end=18,step=.25,deltaTSeconds=DEFAULT_DELTA_T}={}){
 check(start,'start',0,24);check(end,'end',0,24);check(step,'step',.05,2);
 if(end<=start)throw new RangeError('Invalid interval');
 return CANDIDATES.map(c=>({day:c.day,samples:Array.from({length:Math.floor((end-start)/step)+1},(_,k)=>skyAt({day:c.day,hour:Math.min(end,start+k*step),deltaTSeconds}).comet)}));
}
export function skyReceipt({day=8,hour=10,deltaTSeconds=DEFAULT_DELTA_T,alternatives=true}={}){
 const value=skyAt({day,hour,deltaTSeconds});
 return {
  schema:'gmed-startrace-5:sky-scenario:v2',verdict:'UNVERIFIED_CANDIDATE_RECONSTRUCTION',
  modelVersion:MODEL_VERSION,createdAt:new Date().toISOString(),
  candidate:CANDIDATES.find(c=>c.day===day),calculation:value,
  alternativeScenarioCount:CANDIDATES.length,alternativesDisplayed:Boolean(alternatives),
  sources:PRIMARY_SOURCES,
  limitations:[
   'Candidate orbital elements are proposed reconstructions, not measured positions of a 5 BCE comet.',
   'Approximate Earth-Moon barycenter is not a precise Earth geocenter (Moon barycenter correction excluded).',
   'Parabolic solar two-body motion ignores close-approach Earth gravity and any other perturbations.',
   'Ancient precession, rotation model, ΔT and atmospheric refraction are approximate.',
   'Alternative published curves are not random samples, posterior draws or confidence intervals.',
   'Apparent geometric position does not show actual comet brightness or daytime visual visibility.',
   'Independent Figure 6 numerical reproduction has not been established.'
  ],
  historicalIdentificationConfirmed:false,skyPathReproduced:false,independentVerification:false
 };
}
