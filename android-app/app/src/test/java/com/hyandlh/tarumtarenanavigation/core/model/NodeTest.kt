package com.hyandlh.tarumtarenanavigation.core.model

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NodeTest {

    private val gson = Gson()

    @Test
    fun `gson parses nested coordinates and node accessors use lh frame`() {
        val node = gson.fromJson(
            """
            {
              "nodeId": "node-1",
              "floorId": "floor-2",
              "coordinates": {
                "lh": {"x": 11.0, "y": 12.0},
                "xy": {"x": 101.0, "y": 102.0}
              },
              "type": "JUNCTION"
            }
            """.trimIndent(),
            Node::class.java
        )

        assertEquals(11.0, node.x, 0.0)
        assertEquals(12.0, node.y, 0.0)
        assertEquals(101.0, node.coordinates.xy.x, 0.0)
        assertEquals(102.0, node.coordinates.xy.y, 0.0)
    }

    @Test
    fun `gson serializes nested coordinates without legacy top-level fields`() {
        val json = gson.toJson(
            Node(
                nodeId = "node-1",
                floorId = "floor-2",
                coordinates = NodeCoordinates(
                    lh = NodeCoordinate(11.0, 12.0),
                    xy = NodeCoordinate(101.0, 102.0)
                ),
                type = NodeType.JUNCTION
            )
        )

        val document = gson.fromJson(json, Map::class.java)
        assertTrue(document.containsKey("coordinates"))
        assertFalse(document.containsKey("x"))
        assertFalse(document.containsKey("y"))
    }
}
