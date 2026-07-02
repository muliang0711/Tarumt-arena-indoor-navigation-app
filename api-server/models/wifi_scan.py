from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Tuple

class WifiScanReading(BaseModel):
    bssid: str
    rssi: int
    timestamp: int  # Long in Kotlin maps to int in Python
    frequency: Optional[int] = None
    ssid: Optional[str] = None
    metadata: Dict[str, str] = Field(default_factory=dict)

class WifiScanSnapshot(BaseModel):
    timestamp: int
    readings: List[WifiScanReading]
    metadata: Dict[str, str] = Field(default_factory=dict)
