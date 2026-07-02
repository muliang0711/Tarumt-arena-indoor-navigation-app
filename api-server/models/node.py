from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Tuple
from enum import Enum

class Node(BaseModel):
    nodeId: str
    floorId: str
    x: float
    y: float
    type: NodeType
    name: Optional[str] = None
    enabled: bool = True
    metadata: Dict[str, str] = Field(default_factory=dict)

class NodeType(Enum):
    ELEVATOR = 1
    DESTINATION = 2
    JUNCTION = 3
