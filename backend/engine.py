"""Uncalibrated population teaching model. No weapon or intercept dynamics."""
import numpy as np
from scipy import stats
LIMIT=100_000_000

def fragment_draw(rng, model, mean, size, dispersion=5.0, cv=.8, events=None):
    """Integer counts. For lognormal sums, use explicitly approximate moment matching."""
    k=np.ones(size) if events is None else np.asarray(events,dtype=float)
    mu=k*mean
    if model=='poisson':return rng.poisson(mu)
    if model=='negative_binomial':
        shape=np.maximum(k*dispersion,1e-9)
        return rng.negative_binomial(shape,dispersion/(dispersion+mean))* (k>0)
    # Match the first two moments of the sum, then round to a nonnegative count.
    variance=k*(mean*cv)**2
    sigma2=np.log1p(np.divide(variance,mu**2,out=np.zeros_like(mu),where=mu>0))
    location=np.log(np.maximum(mu,1e-12))-.5*sigma2
    return np.rint(rng.lognormal(location,np.sqrt(sigma2))).astype(np.int64)*(k>0)

def collision_proxy(history, coefficient, start_year=0):
    hazard=np.zeros(history.shape[1]);rows=[]
    for year in range(history.shape[0]):
        if year>start_year:hazard+=coefficient*history[year-1]/1e6
        p=-np.expm1(-hazard)
        rows.append({'year':year,'mean':float(p.mean()),'low':float(np.quantile(p,.025)),'high':float(np.quantile(p,.975))})
    return {'label':'Hypothetical debris-collision probability proxy','start_year':start_year,
      'formula':'1 - exp(-sum(kappa * D_previous_year / 1e6))',
      'scope':'Test satellite held in orbit; no geometry, cross-section, covariance, avoidance or actual mission-specific probability.',
      'trajectory':rows}

def run_scenario(cfg, include_runs=False, comparison=True):
    rng=np.random.default_rng(cfg['seed']);r=cfg['runs'];years=cfg['years']
    S=np.full(r,cfg['initial_satellites'],dtype=np.int64)
    D=np.full(r,cfg['initial_debris'],dtype=np.int64)
    history=[D.copy()];sat_history=[S.copy()];new=[];collisions=[];event_counts=np.zeros(r,dtype=np.int64)
    event_applied=False
    for year in range(1,years+1):
        launch=rng.poisson(cfg['annual_launches'],r)
        retired=rng.binomial(S,.08);failed=rng.binomial(retired,1-cfg['disposal'])
        removed=rng.binomial(D,.02)
        S=S+launch-retired;D=D-removed+failed
        collision=np.minimum(rng.poisson(cfg['collision_coefficient']*S.astype(float)*D/1e6),np.minimum(S,D))
        fragments=fragment_draw(rng,cfg['distribution'],cfg['fragment_mean'],r,cfg['dispersion'],cfg['cv'],collision)
        S=S-collision;D=D-collision+fragments
        if year==cfg['event_year'] and cfg['event_type']!='none':
            event_applied=True
            if cfg['event_type']=='satellite_launch':S+=1
            else:
                # Aggregate breakup consequence only. No target, missile, or orbit is calculated.
                event_counts=fragment_draw(rng,cfg['distribution'],cfg['fragment_mean'],r,cfg['dispersion'],cfg['cv'])*(S>0)
                S-= (S>0).astype(np.int64);D+=event_counts
                fragments+=event_counts
        if np.any(D+S>LIMIT):raise ValueError('Population exceeded the 100-million-object teaching-model limit. Reduce scale or fragmentation assumptions.')
        history.append(D.copy());sat_history.append(S.copy());new.append(fragments.copy());collisions.append(collision.copy())
    H=np.array(history);SH=np.array(sat_history);final=H[-1]
    quant=np.quantile(H,[.025,.5,.975],axis=1)
    counts,edges=np.histogram(final,bins=min(30,max(1,int(np.sqrt(r)))))
    demo=fragment_draw(rng,cfg['distribution'],cfg['fragment_mean'],2000,cfg['dispersion'],cfg['cv'])
    dh,de=np.histogram(demo,bins=30)
    result={'config':cfg,'engine':'Python / NumPy','data_kind':'synthetic conditional scenario',
      'assumptions':['Homogeneous mixing; constant retirement 8% and debris removal 2% per year.','No orbital collision geometry, weapon dynamics, or mass/size fragmentation physics.','Rounded lognormal counts; sums use moment matching, an approximation.'] if cfg['distribution']=='lognormal' else ['Homogeneous mixing; retirement 8% and debris removal 2% per year.','No orbital collision geometry, weapon dynamics, or mass/size fragmentation physics.'],
      'trajectory':[{'year':i,'low':float(quant[0,i]),'median':float(quant[1,i]),'high':float(quant[2,i]),'satellites':float(np.median(SH[i]))} for i in range(years+1)],
      'final':{'mean':float(final.mean()),'median':float(np.median(final)),'std':float(final.std(ddof=1)),'low':float(np.quantile(final,.025)),'high':float(np.quantile(final,.975))},
      'histogram':[{'x0':float(a),'x1':float(b),'count':int(n)} for a,b,n in zip(edges[:-1],edges[1:],counts)],
      'fragment_histogram':[{'x0':float(a),'x1':float(b),'count':int(n)} for a,b,n in zip(de[:-1],de[1:],dh)],
      'fragment_summary':{'sample_mean':float(demo.mean()),'sample_variance':float(demo.var(ddof=1)), 'model_mean':cfg['fragment_mean'],'model_variance':cfg['fragment_mean'] if cfg['distribution']=='poisson' else cfg['fragment_mean']+cfg['fragment_mean']**2/cfg['dispersion'] if cfg['distribution']=='negative_binomial' else (cfg['fragment_mean']*cfg['cv'])**2},
      'event':{'type':cfg['event_type'],'applied':event_applied,'year':cfg['event_year'],'mean_new_debris':float(event_counts.mean()),'low':float(np.quantile(event_counts,.025)),'high':float(np.quantile(event_counts,.975))},
      'run_count':r,'row_count':r*(years+1),'seed':cfg['seed'],
      'annual_fragments':[float(x.mean()) for x in new],
      'annual_collisions':[float(x.mean()) for x in collisions]}

    result['collision_proxy']=collision_proxy(H,cfg['collision_coefficient'],cfg['event_year'] if cfg['event_type']=='satellite_launch' else 0)
    if comparison and cfg['event_type']=='abstract_asat':
        baseline=run_scenario(cfg|{'event_type':'none'},comparison=False)
        result['counterfactual']={'label':'Same assumptions, no extra breakup',
          'trajectory':baseline['trajectory'],'collision_proxy':baseline['collision_proxy'],
          'final_debris_mean':baseline['final']['mean'],'mean_final_delta':result['final']['mean']-baseline['final']['mean'],
          'secondary_collisions_delta':sum(result['annual_collisions'])-sum(baseline['annual_collisions']),
          'secondary_fragments_delta':sum(result['annual_fragments'])-result['event']['mean_new_debris']-sum(baseline['annual_fragments'])}
    if include_runs:result['final_runs']=[{'run':i,'satellites':int(S[i]),'debris':int(D[i])} for i in range(r)]
    return result
