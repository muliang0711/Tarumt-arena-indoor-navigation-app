extends CharacterBody2D

@export var speed := 150.0


func _physics_process(_delta: float) -> void:
	var direction := Vector2.ZERO

	if _action_pressed("ui_right") or _action_pressed("move_right") or Input.is_key_pressed(KEY_D):
		direction.x += 1.0
	if _action_pressed("ui_left") or _action_pressed("move_left") or Input.is_key_pressed(KEY_A):
		direction.x -= 1.0
	if _action_pressed("ui_down") or _action_pressed("move_down") or Input.is_key_pressed(KEY_S):
		direction.y += 1.0
	if _action_pressed("ui_up") or _action_pressed("move_up") or Input.is_key_pressed(KEY_W):
		direction.y -= 1.0

	velocity = direction.normalized() * speed
	move_and_slide()


func _action_pressed(action_name: StringName) -> bool:
	return InputMap.has_action(action_name) and Input.is_action_pressed(action_name)

