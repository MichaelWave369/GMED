/**
 * STARTRACE-5 R8: fail-closed cross-language comparison verdict.
 * Python SciPy DOP853 is an externally maintained numerical solver.
 * This STILL compares the same simplified physical equations and inputs.
 */
export const R8_CASE_SCHEMA='gmed-startrace-5:r8-cross-language-input:v1';
export const R8_RESULT_SCHEMA='gmed-startrace-5:r8-external-numerical-result:v1';
export const R8_VERDICT='CROSS_LANGUAGE_NUMERICAL_AGREEMENT_ONLY';
const must=(ok,message)=>{if(!ok)throw new Error(message);};
const validHash=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const sameNumbers=(xs,ys)=>Array.isArray(xs)&&Array.isArray(ys)&&
  xs.length===ys.length&&xs.every((x,i)=>finite(x)&&finite(ys[i])&&Math.abs(x-ys[i])<1e-9);
export function verifySciPyReport(testCase,report,{
 maximumPositionDisagreementKm=5,
 maximumVelocityDisagreementKmS=.001
}={}){
 must(testCase?.schema===R8_CASE_SCHEMA,'R8_INPUT_SCHEMA_MISMATCH');
 must(report?.schema===R8_RESULT_SCHEMA,'R8_RESULT_SCHEMA_MISMATCH');
 must(report.verdict===R8_VERDICT,'R8_VERDICT_MISMATCH');
 must(report.referenceMethod==='SciPy solve_ivp DOP853 (8th-order adaptive Runge-Kutta)',
   'REFERENCE_SOLVER_NOT_DOP853');
 must(report.scipyVersion==='1.18.1','SCIPY_VERSION_NOT_PINNED_1_18_1');
 for(const flag of ['historicalCometOrbitConfirmed','independentPhysicalValidation',
   'sourceCryptographicAuthenticity','exactClosestApproachDetermined']){
   must(report[flag]===false,'UNSUPPORTED_SCIENTIFIC_CERTIFICATION_'+flag);
 }
 must(testCase.historicalCometOrbitConfirmed===false&&
   testCase.sourceAuthenticityVerified===false&&
   testCase.physicalModelIndependentlyValidated===false,
   'INVALID_INPUT_CERTIFICATION_FLAGS');
 must(sameNumbers(testCase.outputJD,report.outputJD),'R8_OUTPUT_EPOCHS_MISMATCH');
 must(finite(testCase.epochJD)&&finite(report.anchorJD)&&
   Math.abs(testCase.epochJD-report.anchorJD)<1e-10,'R8_ANCHOR_MISMATCH');
 for(const body of ['earth','moon']){
   must(validHash(testCase.sourceNormalizedSha256?.[body])&&
     testCase.sourceNormalizedSha256[body]===report.sourceNormalizedSha256?.[body],
     'R8_SOURCE_HASH_MISMATCH_'+body);
 }
 const data=report.statistics;
 must(data&&typeof data==='object','R8_STATISTICS_MISSING');
 const names=['maxPositionDifferenceKm','rmsPositionDifferenceKm',
 'maxVelocityDifferenceKmS','rmsVelocityDifferenceKmS',
 'minDerivativeStageEarthDistanceKm','minDerivativeStageMoonDistanceKm'];
 must(names.every(k=>finite(data[k])&&data[k]>=0),'R8_NONFINITE_OR_NEGATIVE_STATISTICS');
 must(Number.isInteger(data.scipyFunctionEvaluations)&&data.scipyFunctionEvaluations>0,
   'R8_NO_EXTERNAL_SOLVER_WORK');
 must(Number.isInteger(data.sampleCount)&&data.sampleCount===testCase.outputJD.length,
   'R8_SAMPLE_COUNT_MISMATCH');
 must(data.maxPositionDifferenceKm<=maximumPositionDisagreementKm,
   'R8_POSITION_SOLVER_DISAGREEMENT_EXCEEDS_GATE');
 must(data.maxVelocityDifferenceKmS<=maximumVelocityDisagreementKmS,
   'R8_VELOCITY_SOLVER_DISAGREEMENT_EXCEEDS_GATE');
 must(data.rmsPositionDifferenceKm<=data.maxPositionDifferenceKm+1e-12&&
   data.rmsVelocityDifferenceKmS<=data.maxVelocityDifferenceKmS+1e-12,
   'R8_INCONSISTENT_RMS_AND_MAX');
 must(data.minDerivativeStageEarthDistanceKm>testCase.earthCutoffKm&&
   data.minDerivativeStageMoonDistanceKm>testCase.moonCutoffKm,
   'R8_CLOSE_APPROACH_GUARD_VIOLATED');
 must(Array.isArray(report.samples)&&report.samples.length===data.sampleCount,
   'R8_SAMPLE_ROWS_MISSING');
 for(let i=0;i<report.samples.length;i++){
   const item=report.samples[i];
   must(finite(item.jd)&&Math.abs(item.jd-testCase.outputJD[i])<1e-9,
     'R8_ROW_EPOCH_MISMATCH');
   must(finite(item.hour)&&Math.abs(item.hour-testCase.localSolarHours[i])<1e-9,
     'R8_ROW_HOUR_MISMATCH');
   must(finite(item.positionDifferenceKm)&&item.positionDifferenceKm>=0&&
     item.positionDifferenceKm<=data.maxPositionDifferenceKm+1e-12,
     'R8_ROW_POSITION_ERROR_INVALID');
   must(finite(item.velocityDifferenceKmS)&&item.velocityDifferenceKmS>=0&&
     item.velocityDifferenceKmS<=data.maxVelocityDifferenceKmS+1e-12,
     'R8_ROW_VELOCITY_ERROR_INVALID');
 }
 must(Array.isArray(report.scientificLimitations)&&report.scientificLimitations.length>=4,
  'R8_RESEARCH_LIMITS_MISSING');
 return {
   schema:'gmed-startrace-5:public-cross-language-report:v8',
   verdict:R8_VERDICT,
   comparedModel:report.model,
   referenceMethod:report.referenceMethod,
   scipyVersion:report.scipyVersion,
   sourceProvenance:'NASA Horizons-derived normalized vectors; provider-declared DE441, source authenticity not independently verified',
   sourceNormalizedSha256:report.sourceNormalizedSha256,
   anchorJD:report.anchorJD,
   outputJD:report.outputJD,
   statistics:report.statistics,
   samples:report.samples,
   verificationGate:{
     passed:true,maximumPositionDisagreementKm,maximumVelocityDisagreementKmS,
     meaning:'Numerical cross-language agreement under the same conditional force model only'
   },
   scientificLimitations:report.scientificLimitations,
   historicalCometOrbitConfirmed:false,
   independentPhysicalValidation:false,
   sourceCryptographicAuthenticity:false,
   exactClosestApproachDetermined:false
 };
}
