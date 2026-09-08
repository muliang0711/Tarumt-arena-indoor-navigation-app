# 本机管理台与 100 人模拟

需要 Docker Desktop 正常运行。管理台、Presence Gateway、Redis、Trajectory Worker、ClickHouse、Analytics API 和模拟器均在独立的 `arena-admin-local` Compose 项目中运行。

从 `tarumt-nav-app` 目录执行：

```sh
bash dev/admin-local.sh up
```

- Dashboard: http://localhost:3100/
- 实时地图: http://localhost:3100/live
- Gateway: http://127.0.0.1:18080
- Analytics API: http://127.0.0.1:19092

实时地图选择 **10 / 20 / 30 / All** 只改变屏幕显示数量，后台始终接收所有模拟用户。按名称稳定排序，刷新不会随机换一批人。同一位置的标记可能重叠，可缩放查看。用户停止上报后从活跃地图移除。

模拟器创建 100 个独立匿名会话，每秒通过 WebSocket 上报位置；使用真实地图图结构规划路线，并发送 `journey_start` / `location_update` / `journey_end`。导航事件通过 Redis 流进入 ClickHouse，网页没有伪造数据或断线自动切换示例数据。首次启动只有今天的数据，以前日期显示 0。统计显示导航次数，不是去重人数；地点排名只显示至少 5 次导航的地点。

```sh
# 修改实际模拟人数（不同于网页的显示数量）
bash dev/admin-local.sh simulate 100
# 查看状态与模拟日志
bash dev/admin-local.sh status
bash dev/admin-local.sh logs
# 验证 100 个用户、位置变化、统计入库、地点名称和统计总数
node dev/verify-admin-local.mjs
# 停止模拟，仍可看统计
bash dev/admin-local.sh stop-simulation
# 停止整个本机环境（保留统计数据卷）
bash dev/admin-local.sh down
```

模拟 Go 命令位于 `services/presence-gateway/cmd/admin-simulator`，支持 `--users`、`--interval` 和 `--duration`。也可以从该服务目录直接运行：

```sh
go run ./cmd/admin-simulator --base-url http://127.0.0.1:18080 --users 100 --duration 10m
```

不要同时启动两份模拟器，除非确实希望叠加人数。测试服务仅绑定回环地址，Compose 中的固定测试密码仅用于本机；此配置不用于线上部署。

地图与地点名称从 Flutter 地点目录和 contracts 地图同步：`node admin-web/scripts/sync-campus.mjs`。共享文件修改后运行启动脚本会自动同步并重建网页。
