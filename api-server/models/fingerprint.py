from pydantic import BaseModel, Field
from typing import List, Optional

class FingerprintAP(BaseModel):
    bssid: str
    rssi: int
    channel: Optional[int] = None

class FingerprintEntry(BaseModel):
    locationId: str
    timestamp: int
    scanId: int
    apList: List[FingerprintAP]