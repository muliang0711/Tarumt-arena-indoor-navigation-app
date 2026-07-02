import json
import os
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from typing import List, Dict, Optional, Tuple
from collections import defaultdict

from models.wifi_scan import *
from models.position import *
from models.fingerprint import *
from models.node import *
from services.positioning_service import PositioningService

# ==========================================
# 3. Application (FastAPI Setup & Routing)
# ==========================================

positioning_service: Optional[PositioningService] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load node_id (i.e. location_id)-to-node mappings
    node_registry = {
        "elev-west": Node(nodeId="elev-west", floorId="floor-2", x=55.756, y=33.909, type=NodeType.ELEVATOR, name="West Elevator"),
        "TA244-door": Node(nodeId="TA244-door", floorId="floor-2", x=45.361, y=53.354, type=NodeType.DESTINATION, name="TA/244 door"),
        "TA245-door": Node(nodeId="TA245-door", floorId="floor-2", x=37.419, y=53.354, type=NodeType.DESTINATION, name="TA/245 door"),
        "TA246-door": Node(nodeId="TA246-door", floorId="floor-2", x=32.572, y=53.354, type=NodeType.DESTINATION, name="TA/246 door"),
        "TA254-door": Node(nodeId="TA254-door", floorId="floor-2", x=22.469, y=35.544, type=NodeType.DESTINATION, name="TA/254 door"),
        "TA255-door": Node(nodeId="TA255-door", floorId="floor-2", x=30.762, y=35.544, type=NodeType.DESTINATION, name="TA/255 door"),
        "TA256-door": Node(nodeId="TA256-door", floorId="floor-2", x=39.054, y=35.544, type=NodeType.DESTINATION, name="TA/256 door"),
        "TA257-door": Node(nodeId="TA257-door", floorId="floor-2", x=47.347, y=35.544, type=NodeType.DESTINATION, name="TA/257 door"),
        "center-of-road-north-of-elevwest": Node(nodeId="center-of-road-north-of-elevwest", floorId="floor-2", x=55.814, y=44.887, type=NodeType.JUNCTION, name="Center of road north of West Elevator"),
        "junc-TA244-246corr-east": Node(nodeId="junc-TA244-246corr-east", floorId="floor-2", x=55.814, y=52.186, type=NodeType.JUNCTION, name="East end of corridor along TA/244-246"),
        "junc-TA244-246corr-west": Node(nodeId="junc-TA244-246corr-west", floorId="floor-2", x=16.396, y=52.186, type=NodeType.JUNCTION, name="West end of corridor along TA/244-246"),
        "junc-TA254-257corr-west": Node(nodeId="junc-TA254-257corr-west", floorId="floor-2", x=16.396, y=36.945, type=NodeType.JUNCTION, name="West end of corridor along TA/254-257"),
        "west-of-TA246door-opp-TA254": Node(nodeId="west-of-TA246door-opp-TA254", floorId="floor-2", x=22.586, y=53.354, type=NodeType.JUNCTION, name="Slightly west of TA/246 door, opposite TA/254 door")
    }

    # Load fingerprints from JSON file
    filepath = "resources/wifiscans-25Jun2026-rssi-neg90-or-above.json"
    fingerprints = []
    
    if not os.path.exists(filepath):
        print(f"WARNING: File {filepath} not found. Starting with empty fingerprints.")
    
    with open(filepath, 'r') as f:
        raw_fingerprints = json.load(f)
        for item in raw_fingerprints:
            ap_list = [
                FingerprintAP(
                    bssid=ap["bssid"], 
                    rssi=ap["rssi"], 
                    channel=ap.get("channel")
                ) for ap in item.get("AP_list", [])
            ]
            
            fingerprints.append(
                FingerprintEntry(
                    locationId=item["location_id"],
                    timestamp=item["timestamp"],
                    scanId=item["scan_id"],
                    apList=ap_list
                )
            )

    global positioning_service
    positioning_service = PositioningService(fingerprints, node_registry)
    
    yield # Let FastAPI start up and run

app = FastAPI(lifespan=lifespan)

@app.post("/calcPosition", response_model=PositioningResponse)
async def calculate_position(snapshot: WifiScanSnapshot):
    if positioning_service is None:
        raise HTTPException(status_code=500, detail="Service not initialized")
        
    try:
        response = positioning_service.calculate_position(snapshot)
        return response
    except Exception as e:
        print(f"Failed to calculate position: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # Start the server
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)