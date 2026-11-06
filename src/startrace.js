/**
 * STARTRACE-5: transparent calculations, NOT an astronomical ephemeris.
 * All inputs and output units are explicit. No claim of historical identification.
 * MIT, Phi369 Labs.
 */
export const AU_KM = 149_597_870.7;
export const PAPER_BENCHMARK = Object.freeze({
  paper: 'Matney (2025), JBAA 135(6), pp. 387–406, DOI 10.64150/193njt',
  perihelionAu: 0.0407,
  approximateEccentricity: 1,
  closestApproachAu: 0.0026,
  deltaTSeconds: 10572,
  referenceAngularRateDegPerHour: 13,
  // A rounded motion benchmark from the discussion; not an exact
  // local sky stationarity condition, which depends on geometry.
});

export const EVIDENCE_LEDGER = Object.freeze([
  Object.freeze({
    id:'han-record',
    category:'historical-record',
    status:'reported-observation',
    statement:'A Chinese astronomical chronicle reports a comet-like object in the Ch’ien Niu region during 5 BCE, visible for more than 70 days.',
    limitation:'The identification, date translation, and sky-region boundaries require source criticism. No precise positional ephemeris was recorded.',
    source:'Matney 2025, pp. 392–393, summarising Han Shu astronomical annals',
    url:'https://britastro.org/wp-content/uploads/2025/12/387-407_Matney_JBAA_2025-1.pdf'
  }),
  Object.freeze({
    id:'matney-orbit',
    category:'scientific-model',
    status:'published-hypothesis',
    statement:'Matney constructs a family of candidate comet orbits compatible with sparse Chinese descriptions; one selected solution approaches Earth in June 5 BCE.',
    limitation:'A candidate solution is not a measured orbit, and model selection is not independent historical confirmation.',
    source:'Matney 2025, pp. 394–397',
    url:'https://doi.org/10.64150/193njt'
  }),
  Object.freeze({
    id:'matthew-narrative',
    category:'literary-source',
    status:'recorded-text',
    statement:'Matthew 2 narrates a star associated with the Magi and Bethlehem.',
    limitation:'A text attests that the story was told; it is not independent astronomical measurement.',
    source:'Gospel of Matthew, chapter 2',
    url:'https://www.biblegateway.com/passage/?search=Matthew%202&version=NRSVUE'
  }),
  Object.freeze({
    id:'meier-comet',
    category:'extraordinary-claim',
    status:'unverified-attribution',
    statement:'Billy Meier Contact Report 213 attributes a 13,200-year comet and a spacecraft over Bethlehem to alleged extraterrestrial sources.',
    limitation:'No independent physical evidence corroborates the spacecraft or this identification. The numerical period is a claim to test, not an observation.',
    source:'Billy Meier, Contact Report 213',
    url:'https://www.futureofmankind.co.uk/Billy_Meier/Contact_Report_213'
  }),
  Object.freeze({
    id:'identification',
    category:'historical-interpretation',
    status:'unconfirmed',
    statement:'The 5 BCE Chinese comet was the astronomical object behind Matthew’s Bethlehem account.',
    limitation:'No contemporaneous record independently links the two; competing astronomical and literary explanations remain possible.',
    source:'Research question, not an established observation',
    url:'https://britastro.org/journal_contents_ite/the-star-that-stopped-the-star-of-bethlehem-the-comet-of-5-bce'
  })
]);

function positive(value, name) {
  if(typeof value!=='number' || !Number.isFinite(value) || value<=0)
    throw new RangeError(name+' must be a finite positive number.');
  return value;
}
function nonnegative(value,name){
  if(typeof value!=='number'||!Number.isFinite(value)||value<0)
    throw new RangeError(name+' must be a finite nonnegative number.');
  return value;
}
export function toKm(au){return positive(au,'AU')*AU_KM;}
export function requiredTransverseSpeed(distanceKm, angularRateDegPerHour){
  positive(distanceKm,'Distance');
  nonnegative(angularRateDegPerHour,'Angular rate');
  return distanceKm*angularRateDegPerHour*Math.PI/(180*3600);
}
export function angularRateDegPerHour(distanceKm, transverseKmPerSecond){
  positive(distanceKm,'Distance');
  nonnegative(transverseKmPerSecond,'Transverse speed');
  return transverseKmPerSecond/distanceKm*(180/Math.PI)*3600;
}
export function parallaxArcseconds(distanceKm, baselineKm){
  positive(distanceKm,'Distance');
  nonnegative(baselineKm,'Baseline');
  return Math.atan2(baselineKm,distanceKm)*(180/Math.PI)*3600;
}
export function keplerPeriodOrbit(periodYears,perihelionAu=PAPER_BENCHMARK.perihelionAu){
  positive(periodYears,'Period');
  positive(perihelionAu,'Perihelion');
  const semimajorAxisAu=Math.cbrt(periodYears**2);
  if(perihelionAu>=semimajorAxisAu)throw new RangeError('Perihelion must be smaller than semimajor axis.');
  return {
    semimajorAxisAu,
    eccentricity:1-perihelionAu/semimajorAxisAu,
    aphelionAu:2*semimajorAxisAu-perihelionAu
  };
}
export function brightnessRatioForMagnitudeDecrease(magnitudeDecrease){
  nonnegative(magnitudeDecrease,'Magnitude decrease');
  return 10**(0.4*magnitudeDecrease);
}
export const DEFAULT_SCENARIO=Object.freeze({
  distanceAu:PAPER_BENCHMARK.closestApproachAu,
  transverseSpeedKmS:24.5,
  periodYears:13200,
  perihelionAu:PAPER_BENCHMARK.perihelionAu,
  baselineKm:10,
  magnitudeDecrease:5,
  benchmarkRateDegHour:PAPER_BENCHMARK.referenceAngularRateDegPerHour
});
export function evaluateScenario(input=DEFAULT_SCENARIO){
  if(!input||typeof input!=='object'||Array.isArray(input))
    throw new TypeError('Scenario must be an object.');
  const scenario={...DEFAULT_SCENARIO,...input};
  const distanceKm=toKm(scenario.distanceAu);
  const actualRateDegHour=angularRateDegPerHour(distanceKm,scenario.transverseSpeedKmS);
  nonnegative(scenario.benchmarkRateDegHour,'Benchmark rate');
  const requiredSpeedKmS=requiredTransverseSpeed(distanceKm,scenario.benchmarkRateDegHour);
  const orbit=keplerPeriodOrbit(scenario.periodYears,scenario.perihelionAu);
  return {
    inputs:scenario,
    calculated:{
      distanceKm,
      actualRateDegHour,
      requiredSpeedKmS,
      residualRateDegHour:actualRateDegHour-scenario.benchmarkRateDegHour,
      parallaxArcseconds:parallaxArcseconds(distanceKm,scenario.baselineKm),
      ...orbit,
      brightnessFactor:brightnessRatioForMagnitudeDecrease(scenario.magnitudeDecrease)
    },
    boundaries:[
      'Angular-rate comparison uses v_perp/d small-angle geometry; it is not a topocentric sky track.',
      '13 deg/hour is a rounded benchmark from the paper, not a universal criterion for apparent stationarity.',
      'Kepler calculation assumes a Sun-dominated two-body elliptical orbit; it does not fit the historical comet.',
      'Parallax is the angular difference for an idealized transverse baseline, not a device for locating a building.',
      'Five magnitudes is a brightness factor only; daytime visual detectability requires coma, sky-background and solar-angle modeling.',
      'No ephemeris, ancient ΔT propagation, atmosphere, positional Monte Carlo or historical likelihood calculation is implemented.'
    ]
  };
}
export function researchReceipt(input=DEFAULT_SCENARIO,{generatedAt=new Date().toISOString()}={}){
  if(!Number.isFinite(Date.parse(generatedAt)))throw new TypeError('Invalid receipt time.');
  const evaluation=evaluateScenario(input);
  return {
    schema:'gmed-startrace-5:research-receipt:v1',
    lab:'STARTRACE-5',
    verdict:'ILLUSTRATIVE_PHYSICS_ONLY',
    generatedAt,
    model:'analytic two-body/instantaneous angular-geometry sensitivity checks',
    paperBenchmark:PAPER_BENCHMARK,
    ...evaluation,
    evidence:EVIDENCE_LEDGER.map(({id,category,status,statement,limitation,source,url})=>({id,category,status,statement,limitation,source,url})),
    historicalIdentificationConfirmed:false,
    skyPathReproduced:false,
    independentVerification:false
  };
}
