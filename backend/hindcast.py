"""Evaluate supplied historical population observations; never fabricate missing truth."""
import argparse,json
from pathlib import Path
import numpy as np,pandas as pd

def evaluate(observations,predictions):
    obs=pd.read_csv(observations);pred=pd.read_csv(predictions)
    required={'date_utc','group','observed_count','minimum_fragment_size_m','source_url','coverage_notes'}
    if not required.issubset(obs):raise ValueError('Use the observations template with threshold, provenance and coverage notes.')
    if obs.empty:raise ValueError('No empirical observations supplied. A model run alone is not historical validation.')
    if obs[list(required)].isna().any().any():raise ValueError('Observation provenance and size/coverage definitions must be complete.')
    keys=['date_utc','group','minimum_fragment_size_m']
    if not (set(keys)|{'predicted_count'}).issubset(pred):raise ValueError('Predictions require matching keys and predicted_count.')
    for frame,columns in [(obs,['observed_count','minimum_fragment_size_m']),(pred,['predicted_count','minimum_fragment_size_m'])]:
        for column in columns:
            values=pd.to_numeric(frame[column],errors='coerce')
            if not np.isfinite(values).all() or (values<0).any():raise ValueError('Counts and size thresholds must be finite and nonnegative.')
            frame[column]=values
    if obs.duplicated(keys).any() or pred.duplicated(keys).any():raise ValueError('Duplicate observation/prediction keys.')
    joined=obs.merge(pred,on=keys,how='inner',validate='one_to_one')
    if len(joined)<3:raise ValueError('At least three matched observations are required.')
    error=joined.predicted_count-joined.observed_count
    result={'matched_observations':len(joined),'mae':float(np.abs(error).mean()),'rmse':float(np.sqrt((error**2).mean())),'bias':float(error.mean()),'scope':'Comparison of supplied, definition-matched historical population counts; not validation of individual conjunction probabilities.'}
    if {'low','high'}.issubset(joined):result['interval_coverage']=float(((joined.observed_count>=joined.low)&(joined.observed_count<=joined.high)).mean())
    return result
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('observations');p.add_argument('predictions');a=p.parse_args();print(json.dumps(evaluate(a.observations,a.predictions),indent=2))
