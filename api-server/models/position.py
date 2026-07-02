from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Tuple

class PositionEstimate(BaseModel):
    x: float
    y: float
    floorId: str
    confidence: float
    timestamp: int
    diagnostics: Dict[str, str] = Field(default_factory=dict)

class PositioningResponse(BaseModel):
    estimate: PositionEstimate
    nodeDistances: Dict[str, float]