extends Node2D

const TILE_SIZE := 32
const MAP_WIDTH := 28
const MAP_HEIGHT := 16

const TILE_PATHS := {
	"floor": "res://assets/tiles/floor.png",
	"path": "res://assets/tiles/path.png",
	"building": "res://assets/tiles/building.png",
	"wall": "res://assets/tiles/wall.png",
	"marker_a": "res://assets/tiles/marker_a.png",
	"marker_b": "res://assets/tiles/marker_b.png",
}

@onready var ground_layer: TileMapLayer = $GroundLayer
@onready var path_layer: TileMapLayer = $PathLayer
@onready var building_layer: TileMapLayer = $BuildingLayer
@onready var collision_layer: TileMapLayer = $CollisionLayer
@onready var collision_bodies: Node2D = $CollisionBodies

var source_ids: Dictionary = {}


func _ready() -> void:
	var tile_set := _create_tile_set()
	for layer in [ground_layer, path_layer, building_layer, collision_layer]:
		layer.tile_set = tile_set

	_build_ground()
	_build_building(Rect2i(2, 4, 6, 7), Vector2i(7, 7), "marker_a")
	_build_building(Rect2i(20, 4, 6, 7), Vector2i(20, 7), "marker_b")
	_build_path()


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
			_set_tile(ground_layer, Vector2i(x, y), "floor")


func _build_path() -> void:
	for x in range(7, 21):
		_set_tile(path_layer, Vector2i(x, 7), "path")
	for y in range(6, 9):
		_set_tile(path_layer, Vector2i(13, y), "path")


func _build_building(rect: Rect2i, door_cell: Vector2i, marker_name: String) -> void:
	var marker_cell := Vector2i(
		rect.position.x + floori(rect.size.x * 0.5),
		rect.position.y + floori(rect.size.y * 0.5)
	)

	for y in range(rect.position.y, rect.position.y + rect.size.y):
		for x in range(rect.position.x, rect.position.x + rect.size.x):
			var cell := Vector2i(x, y)
			var is_boundary := (
				x == rect.position.x
				or x == rect.position.x + rect.size.x - 1
				or y == rect.position.y
				or y == rect.position.y + rect.size.y - 1
			)

			if is_boundary and cell != door_cell:
				_set_tile(collision_layer, cell, "wall")
				_add_blocking_cell(cell)
			else:
				_set_tile(building_layer, cell, "building")

	_set_tile(building_layer, marker_cell, marker_name)


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
