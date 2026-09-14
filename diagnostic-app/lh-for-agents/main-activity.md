this file details what I want the main activity to look like.

it should display a map, which is `arena-second-floor-plan.jpg`. The map can be zoomed and panned. Code it in such a way that it's easy to switch out the image used for the map.

Set a specific pair of pixel x-y coordinates on the map image (`arena-second-floor-plan.jpg` in the same dir as this file) as the `origin` of our navigation coordinate system. Make this `origin` pixel coordinates a variable that developers can later change. for now set it to (940.1506036675864, 3219.948911199548) (these coords are relative to the top-left corner of the image). also allow develoeprs to change calibration settings, which allows devs to pick two points that align horizontally and define their distance in the navigation coordinate system, to effectively define the scale of the navigation coordinate system. heres the calibration data you are to set:

```
"calibration": {
    "x": {
      "scale": "linear",
      "p1": {
        "px": 940.1506036675864,
        "py": 3219.948911199548,
        "val": 0
      },
      "p2": {
        "px": 3834.4108206636756,
        "py": 3219.948911199548,
        "val": 170.971185
      }
    },
    "y": {
      "scale": "linear",
      "p1": {
        "px": 940.1506036675864,
        "py": 3219.948911199548,
        "val": 0
      },
      "p2": {
        "px": 940.1506036675864,
        "py": 2362.782970940217,
        "val": 50.63209269
      }
    }
}
```
  
x-value increases to the right, and y-value increases going up the map. The x and y coordinates of known AP positions, as well as other general nodes, will be based on this coordinate system.

the map also shows a dot signifying the user position on the map based on estimated location obtained from the positioning engine.

show statuses indicating to the user whether the app is in the process of loading known AP positions, has finished loading them, is in the process of scanning WiFi RSSI, has finished scanning, is in the process of estimating user location, has finished estimation, etc. Show the last time the user position has been updated.

on the top of the screen you can toggle on or off "Debug" mode. Once in debug mode, the map not only shows user position but also all known AP positions, the dots labelled with the AP's BSSID. Tapping on an AP dot shows detailed data of the AP and the current RSSI scan for it. around the AP dots are also dotted-line circles with the radii being the estimated distance between the user and the AP based on the detected RSSI. 

Auto rescan WiFi RSSI every 5 seconds. Make it easy for developers to change this duration later on.

Below the map is a button saying "Pause WiFi scanning", which does what it says. If the process of pausing is not instantaneous, code it in such a way that when it is in the process of pausing, the button becomes disabled and says "Pausing WiFi scanning...", and only when WiFi scanning has truly been paused, does the button become enabled again and say "Resume WiFi scanning". Same goes for when the user clicks on "Resume WiFi scanning" -- when it's in the process of resuming, disable and change its label to "Resuming WiFi scanning..." and only re-enable the button and change it to "Pause WiFi scanning" when WiFi scanning has truly been resumed.

