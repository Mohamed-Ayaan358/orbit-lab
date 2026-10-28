from typing import Literal
from pydantic import BaseModel, Field, model_validator

class Scenario(BaseModel):
    initial_satellites:int=Field(default=600,ge=0,le=10_000_000)
    initial_debris:int=Field(default=1400,ge=0,le=10_000_000)
    annual_launches:float=Field(default=120,ge=0,le=100_000)
    disposal:float=Field(default=.9,ge=0,le=1)
    collision_coefficient:float=Field(default=.4,ge=0,le=2)
    fragment_mean:float=Field(default=60,ge=1,le=10000)
    distribution:Literal['poisson','negative_binomial','lognormal']='poisson'
    dispersion:float=Field(default=5,ge=.5,le=1000)
    cv:float=Field(default=.8,ge=.1,le=2)
    years:int=Field(default=30,ge=1,le=100)
    runs:int=Field(default=500,ge=20,le=20000)
    seed:int=Field(default=20261027,ge=0,le=2**32-1)
    event_type:Literal['none','satellite_launch','abstract_asat']='none'
    event_year:int=Field(default=5,ge=1,le=100)
    @model_validator(mode='after')
    def bounded_work(self):
        if self.runs*self.years>1_000_000:raise ValueError('Use at most one million run-year transitions per request.')
        if self.event_type!='none' and self.event_year>self.years:raise ValueError('Event year must be within the simulated horizon.')
        return self
