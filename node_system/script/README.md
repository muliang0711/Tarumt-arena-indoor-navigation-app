# Node Map Visualizer

A simple tool to visualize node maps from JSON files as 2D layouts.

## Quick Start

1. **Edit your map data** in `map_data.json`
2. **Run the visualizer**:
   ```bash
   python map_visualizer.py map_data.json output.png
   ```
3. **Check the output** image to verify your map

## File Structure

### map_data.json

```json
{
  "nodes": [
    {"id": "N-1", "x": 0, "y": 0, "label": "Corridor"},
    {"id": "N-2", "x": 1, "y": 0, "label": "Room 101"}
  ],
  "connections": [
    ["N-1", "N-2"]
  ]
}
```

**Nodes:**
- `id`: Unique identifier (string)
- `x`: X coordinate (number)
- `y`: Y coordinate (number)
- `label`: Description (string)
  - Use "Corridor" for corridors
  - Use "Elevator" for elevators
  - Use "Room ..." for rooms
  - Use "Toilet" for toilets

**Connections:**
- Array of [node1_id, node2_id] pairs
- Both nodes must exist in the nodes list

## Usage Examples

### Basic usage (output to default file):
```bash
python map_visualizer.py map_data.json
```
Output: `map_output.png`

### Specify output filename:
```bash
python map_visualizer.py map_data.json my_map.png
```

### Quick verification workflow:
```bash
# 1. Edit map_data.json
# 2. Generate visualization
python map_visualizer.py map_data.json version1.png

# 3. Make corrections to map_data.json
# 4. Generate new version
python map_visualizer.py map_data.json version2.png

# 5. Compare version1.png and version2.png
```

## Color Coding

The visualizer automatically color-codes nodes based on their labels:

- **Blue** (Light): Corridors
- **Yellow**: Elevators  
- **Green**: Rooms
- **Orange**: Toilets

## Tips for Editing map_data.json

1. **Use a text editor** with JSON syntax highlighting (VS Code, Sublime, Notepad++)
2. **Validate your JSON** online at https://jsonlint.com if you get errors
3. **Keep node IDs consistent** - they must match exactly in connections
4. **Use simple coordinates** - integers work best for clean layouts
5. **Test incrementally** - add a few nodes, test, then add more

## Common Errors

**"File not found"**
- Check that map_data.json exists in the same directory
- Use the full path if file is elsewhere

**"Invalid JSON format"**
- Check for missing commas between items
- Ensure all brackets and braces are closed
- Use https://jsonlint.com to find syntax errors

**"Connection references non-existent node"**
- Verify both node IDs in the connection exist in the nodes list
- Check for typos in node IDs (case-sensitive!)

**"Node missing required fields"**
- Every node needs: id, x, y, and label
- Check for typos in field names

## Workflow for Verification

1. ✏️ Start with your hand-drawn map
2. 📝 Create/edit `map_data.json` with your nodes and connections
3. 🖼️ Run `python map_visualizer.py map_data.json`
4. 👁️ Compare output image with your hand-drawn map
5. ✅ If correct → done!
6. ❌ If incorrect → edit `map_data.json` and repeat from step 3

## Example: Adding a New Node

To add a new room "N-20" at position (2, 3):

1. Add to nodes array:
```json
{"id": "N-20", "x": 2, "y": 3, "label": "Room 301"}
```

2. Add connection(s):
```json
["N-19", "N-20"]
```

3. Run visualizer again to see the update

## Getting Help

Run without arguments to see usage:
```bash
python map_visualizer.py
```
