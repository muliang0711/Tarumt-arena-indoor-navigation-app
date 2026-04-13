# Presentation Layer

This layer owns everything the user can see or touch.

Responsibilities:

- render screens, map canvas, controls, and page chrome
- convert application state into visual state
- handle visual-only interactions such as pan and pinch viewport behavior

Rules:

- do not load raw map assets directly here
- do not define route-building logic here
- do not hide business flow state inside large visual components

Main folders:

- `components/`: reusable UI pieces
- `hooks/`: presentation-only hooks such as viewport control
- `screens/`: page assembly and screen switching
