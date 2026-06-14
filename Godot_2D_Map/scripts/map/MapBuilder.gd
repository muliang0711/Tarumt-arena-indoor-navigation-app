extends Node2D

const TILE_SIZE := 32
const MAP_WIDTH := 28
const MAP_HEIGHT := 16

const TILE_PATHS := {
	"floor": "res://assets/tiles/floor.png",
	"floor_alt": "res://assets/tiles/floor_alt.png",
	"path": "res://assets/tiles/path.png",
	"building": "res://assets/tiles/building.png",
	"wall": "res://assets/tiles/wall.png",
	"shoji": "res://assets/tiles/shoji.png",
	"table": "res://assets/tiles/table.png",
	"chair": "res://assets/tiles/chair.png",
	"bed": "res://assets/tiles/bed.png",
	"shelf": "res://assets/tiles/shelf.png",
	"plant": "res://assets/tiles/plant.png",
	"art": "res://assets/tiles/art.png",
	"marker_a": "res://assets/tiles/marker_a.png",
	"marker_b": "res://assets/tiles/marker_b.png",
}

@onready var ground_layer: TileMapLayer = $GroundLayer
@onready var path_layer: TileMapLayer = $PathLayer
@onready var building_layer: TileMapLayer = $BuildingLayer
@onready var furniture_layer: TileMapLayer = $FurnitureLayer
@onready var decoration_layer: TileMapLayer = $DecorationLayer
@onready var collision_layer: TileMapLayer = $CollisionLayer
@onready var collision_bodies: Node2D = $CollisionBodies

var source_ids: Dictionary = {}


func _ready() -> void:
	var tile_set := _create_tile_set()
	for layer in [ground_layer, path_layer, building_layer, furniture_layer, decoration_layer, collision_layer]:
		layer.tile_set = tile_set

	_build_ground()
	_build_shell()
	_build_room_dividers()
	_build_path()
	_build_destinations()
	_build_furniture()
	_build_decorations()


func _create_tile_set() -> TileSet:
	var tile_set := TileSet.new()
	tile_set.tile_size = Vector2i(TILE_SIZE, TILE_SIZE)

	for tile_name in TILE_PATHS.keys():
		var texture := _load_tile_texture(TILE_PATHS[tile_name])
		var source := TileSetAtlasSource.new()
		source.texture = texture
		source.texture_region_size = Vector2i(TILE_SIZE, TILE_SIZE)
		source.create_tile(Vector2i.ZERO)
		var source_id := tile_set.add_source(source)
		source_ids[tile_name] = source_id

	return tile_set


func _load_tile_texture(resource_path: String) -> Texture2D:
	var image := Image.new()
	var error := image.load(ProjectSettings.globalize_path(resource_path))
	if error != OK:
		push_error("Could not load tile image: %s" % resource_path)
		return ImageTexture.new()

	return ImageTexture.create_from_image(image)


func _build_ground() -> void:
	for y in range(MAP_HEIGHT):
		for x in range(MAP_WIDTH):
			var tile_name := "floor_alt" if (x + y) % 5 == 0 else "floor"
			_set_tile(ground_layer, Vector2i(x, y), tile_name)


func _build_shell() -> void:
	for x in range(MAP_WIDTH):
		_place_wall(Vector2i(x, 0))
		_place_wall(Vector2i(x, MAP_HEIGHT - 1))
	for y in range(MAP_HEIGHT):
		_place_wall(Vector2i(0, y))
		_place_wall(Vector2i(MAP_WIDTH - 1, y))


func _build_room_dividers() -> void:
	for x in range(3, 12):
		if x not in [6, 7]:
			_place_shoji(Vector2i(x, 4))
	for x in range(15, 25):
		if x not in [19, 20]:
			_place_shoji(Vector2i(x, 4))
	for x in range(4, 12):
		if x not in [7, 8]:
			_place_shoji(Vector2i(x, 11))
	for x in range(17, 26):
		if x not in [21, 22]:
			_place_shoji(Vector2i(x, 11))

	for y in range(5, 11):
		if y != 8:
			_place_wall(Vector2i(14, y))


func _build_path() -> void:
	for x in range(3, 25):
		_set_tile(path_layer, Vector2i(x, 8), "path")
	for y in range(5, 12):
		_set_tile(path_layer, Vector2i(7, y), "path")
	for y in range(5, 12):
		_set_tile(path_layer, Vector2i(21, y), "path")


func _build_destinations() -> void:
	_set_tile(building_layer, Vector2i(4, 8), "marker_a")
	_set_tile(building_layer, Vector2i(24, 8), "marker_b")


func _build_furniture() -> void:
	var furniture := {
		Vector2i(3, 2): "shelf",
		Vector2i(5, 2): "table",
		Vector2i(8, 2): "chair",
		Vector2i(18, 2): "shelf",
		Vector2i(22, 2): "plant",
		Vector2i(24, 2): "table",
		Vector2i(3, 13): "table",
		Vector2i(4, 13): "chair",
		Vector2i(10, 13): "table",
		Vector2i(11, 13): "chair",
		Vector2i(18, 13): "shelf",
		Vector2i(20, 13): "table",
		Vector2i(23, 13): "chair",
		Vector2i(24, 6): "bed",
		Vector2i(23, 9): "shelf",
		Vector2i(5, 6): "table",
		Vector2i(9, 7): "plant",
	}

	for cell in furniture.keys():
		_set_tile(furniture_layer, cell, furniture[cell])
		if furniture[cell] in ["table", "shelf", "bed"]:
			_add_blocking_cell(cell)


func _build_decorations() -> void:
	for cell in [Vector2i(2, 2), Vector2i(12, 2), Vector2i(16, 2), Vector2i(25, 2), Vector2i(2, 14), Vector2i(13, 13), Vector2i(25, 14)]:
		_set_tile(decoration_layer, cell, "plant")
	for cell in [Vector2i(11, 1), Vector2i(17, 1), Vector2i(25, 5), Vector2i(16, 10)]:
		_set_tile(decoration_layer, cell, "art")


func _place_wall(cell: Vector2i) -> void:
	_set_tile(collision_layer, cell, "wall")
	_add_blocking_cell(cell)


func _place_shoji(cell: Vector2i) -> void:
	_set_tile(building_layer, cell, "shoji")
	_add_blocking_cell(cell)


func _set_tile(layer: TileMapLayer, cell: Vector2i, tile_name: String) -> void:
	layer.set_cell(cell, source_ids[tile_name], Vector2i.ZERO, 0)


func _add_blocking_cell(cell: Vector2i) -> void:
	var body := StaticBody2D.new()
	body.name = "Wall_%d_%d" % [cell.x, cell.y]
	var half_tile := float(TILE_SIZE) * 0.5
	body.position = Vector2(cell.x * TILE_SIZE + half_tile, cell.y * TILE_SIZE + half_tile)

	var shape := RectangleShape2D.new()
	shape.size = Vector2(TILE_SIZE, TILE_SIZE)

	var collision_shape := CollisionShape2D.new()
	collision_shape.shape = shape

	body.add_child(collision_shape)
	collision_bodies.add_child(body)
