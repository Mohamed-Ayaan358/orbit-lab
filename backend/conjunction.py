"""2D Gaussian encounter-plane disk probability; covariance must be supplied."""
import math
from scipy.integrate import quad
from scipy.special import ndtr

def disk_probability(miss_x_m,miss_y_m,cov_xx_m2,cov_xy_m2,cov_yy_m2,radius_m):
    values=[miss_x_m,miss_y_m,cov_xx_m2,cov_xy_m2,cov_yy_m2,radius_m]
    if not all(math.isfinite(x) for x in values):raise ValueError('Inputs must be finite.')
    if cov_xx_m2<=0 or cov_yy_m2<=0 or cov_xx_m2*cov_yy_m2-cov_xy_m2**2<=0 or radius_m<=0:raise ValueError('Covariance must be positive definite and combined radius positive.')
    sx=math.sqrt(cov_xx_m2);conditional_sigma=math.sqrt(cov_yy_m2-cov_xy_m2**2/cov_xx_m2)
    def integrand(u):
        x=miss_x_m+sx*u
        upper=math.sqrt(max(0,radius_m**2-x**2));mean=miss_y_m+cov_xy_m2/cov_xx_m2*(x-miss_x_m)
        return math.exp(-.5*u*u)/math.sqrt(2*math.pi)*(ndtr((upper-mean)/conditional_sigma)-ndtr((-upper-mean)/conditional_sigma))
    lower=max(-12.,(-radius_m-miss_x_m)/sx);upper=min(12.,(radius_m-miss_x_m)/sx)
    value,error=quad(integrand,lower,upper,epsabs=1e-12,epsrel=1e-8,limit=100) if lower<upper else (0.,0.)
    return {'probability':min(1,max(0,float(value))),'quadrature_error_estimate':float(error),
      'scope':'Encounter-plane Gaussian disk integral with supplied miss vector/covariance and hard-body radius. Not a full CDM pipeline or actual risk without validated inputs.'}
