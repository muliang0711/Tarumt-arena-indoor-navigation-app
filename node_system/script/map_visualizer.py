#!/usr/bin/env python3
"""
Node Map Visualizer
-------------------
This program reads node map data from a JSON file and generates a 2D visualization.

Usage:
    python map_visualizer.py <input_file.json> [output_file.png]
    
    If output file is not specified, it will be saved as 'map_output.png'

JSON File Structure:
{
  "nodes": [
    {"id": "N-1", "x": 0, "y": 0, "label": "Corridor"},
    ...
  ],
  "connections": [
    ["N-1", "N-2"],
    ...
  ]
}
"""

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch
import json
import sys
import os

def load_map_data(filename):
    """Load node map data from JSON file."""
    try:
        with open(filename, 'r') as f:
            data = json.load(f)
        
        # Validate required fields
        if 'nodes' not in data or 'connections' not in data:
            raise ValueError("JSON must contain 'nodes' and 'connections' fields")
        
        # Convert nodes list to dictionary for easier access
        nodes = {}
        for node in data['nodes']:
            if 'id' not in node or 'x' not in node or 'y' not in node or 'label' not in node:
                raise ValueError(f"Node missing required fields: {node}")
            nodes[node['id']] = (node['x'], node['y'], node['label'])
        
        connections = data['connections']
        
        # Validate connections reference valid nodes
        for conn in connections:
            if len(conn) != 2:
                raise ValueError(f"Connection must have exactly 2 nodes: {conn}")
            if conn[0] not in nodes or conn[1] not in nodes:
                raise ValueError(f"Connection references non-existent node: {conn}")
        
        return nodes, connections
    
    except FileNotFoundError:
        print(f"Error: File '{filename}' not found")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON format in '{filename}'")
        print(f"Details: {e}")
        sys.exit(1)
    except ValueError as e:
        print(f"Error: {e}")
        sys.exit(1)

def get_node_color(label):
    """Determine node color based on label."""
    colors = {
        'Corridor': '#E3F2FD',
        'Elevator': '#FFE082',
        'Room': '#C8E6C9',
        'Toilet': '#FFCCBC',
    }
    
    if 'Elevator' in label:
        return colors['Elevator']
    elif 'Room' in label:
        return colors['Room']
    elif 'Toilet' in label:
        return colors['Toilet']
    else:
        return colors['Corridor']

def visualize_map(nodes, connections, output_file='map_output.png'):
    """Generate 2D visualization of the node map."""
    
    # Create figure
    fig, ax = plt.subplots(1, 1, figsize=(16, 20))
    
    # Draw connections first (so they appear behind nodes)
    for conn in connections:
        node1, node2 = conn
        x1, y1, _ = nodes[node1]
        x2, y2, _ = nodes[node2]
        
        ax.plot([x1, x2], [y1, y2], 'b-', linewidth=2, alpha=0.6, zorder=1)
    
    # Draw nodes
    for node_id, (x, y, label) in nodes.items():
        color = get_node_color(label)
        
        # Draw node box
        box = FancyBboxPatch((x-0.35, y-0.25), 0.7, 0.5,
                              boxstyle="round,pad=0.05",
                              edgecolor='black',
                              facecolor=color,
                              linewidth=2,
                              zorder=2)
        ax.add_patch(box)
        
        # Add node ID (bold)
        ax.text(x, y+0.08, node_id, 
                ha='center', va='center', 
                fontsize=10, fontweight='bold',
                zorder=3)
        
        # Add label (smaller, below ID)
        ax.text(x, y-0.08, label, 
                ha='center', va='center', 
                fontsize=7,
                zorder=3)
        
        # Add coordinate (even smaller, at bottom)
        ax.text(x, y-0.18, f'({x},{y})', 
                ha='center', va='center', 
                fontsize=6, style='italic', color='gray',
                zorder=3)
    
    # Set axis properties
    ax.set_aspect('equal')
    ax.grid(True, alpha=0.3, linestyle='--')
    ax.set_xlabel('X Coordinate', fontsize=12, fontweight='bold')
    ax.set_ylabel('Y Coordinate', fontsize=12, fontweight='bold')
    ax.set_title('Node Map Visualization - 2D Layout', fontsize=16, fontweight='bold', pad=20)
    
    # Set axis limits with some padding
    all_x = [coord[0] for coord in nodes.values()]
    all_y = [coord[1] for coord in nodes.values()]
    ax.set_xlim(min(all_x)-1, max(all_x)+1)
    ax.set_ylim(min(all_y)-1, max(all_y)+1)
    
    # Add legend
    colors = {
        'Corridor': '#E3F2FD',
        'Elevator': '#FFE082',
        'Room': '#C8E6C9',
        'Toilet': '#FFCCBC',
    }
    legend_elements = [
        mpatches.Patch(facecolor=colors['Corridor'], edgecolor='black', label='Corridor'),
        mpatches.Patch(facecolor=colors['Elevator'], edgecolor='black', label='Elevator'),
        mpatches.Patch(facecolor=colors['Room'], edgecolor='black', label='Room'),
        mpatches.Patch(facecolor=colors['Toilet'], edgecolor='black', label='Toilet'),
    ]
    ax.legend(handles=legend_elements, loc='upper right', fontsize=10)
    
    # Add grid lines at integer positions
    ax.set_xticks(range(int(min(all_x)-1), int(max(all_x)+2)))
    ax.set_yticks(range(int(min(all_y)-1), int(max(all_y)+2)))
    
    plt.tight_layout()
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    print(f"✓ Map visualization saved to '{output_file}'")
    
    return fig

def print_summary(nodes, connections):
    """Print summary statistics of the map."""
    print("\n" + "="*50)
    print("MAP SUMMARY")
    print("="*50)
    print(f"Total nodes: {len(nodes)}")
    print(f"Total connections: {len(connections)}")
    
    # Count by type
    type_counts = {}
    for _, (_, _, label) in nodes.items():
        node_type = 'Corridor'
        if 'Elevator' in label:
            node_type = 'Elevator'
        elif 'Room' in label:
            node_type = 'Room'
        elif 'Toilet' in label:
            node_type = 'Toilet'
        
        type_counts[node_type] = type_counts.get(node_type, 0) + 1
    
    print("\nNodes by type:")
    for node_type, count in sorted(type_counts.items()):
        print(f"  - {node_type}: {count}")
    
    print("\n" + "="*50)
    print("VERIFICATION CHECKLIST")
    print("="*50)
    print("☐ All node positions match your hand-drawn map")
    print("☐ All connections are correct")
    print("☐ All labels are accurate")
    print("☐ No missing nodes")
    print("☐ No missing connections")
    print("="*50)

def main():
    """Main program entry point."""
    # Parse command line arguments
    if len(sys.argv) < 2:
        print(__doc__)
        print(f"\nError: Missing input file")
        print(f"Usage: python {sys.argv[0]} <input_file.json> [output_file.png]")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else 'map_output.png'
    
    # Check if input file exists
    if not os.path.exists(input_file):
        print(f"Error: Input file '{input_file}' not found")
        sys.exit(1)
    
    print(f"Loading map data from '{input_file}'...")
    nodes, connections = load_map_data(input_file)
    
    print(f"Generating visualization...")
    visualize_map(nodes, connections, output_file)
    
    print_summary(nodes, connections)
    
    print(f"\n✓ Done! You can now verify the map in '{output_file}'")

if __name__ == '__main__':
    main()
