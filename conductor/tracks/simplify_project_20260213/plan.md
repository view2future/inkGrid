# 实施计划：项目瘦身与功能简化

## 第一阶段：清理冗余物理文件与后端逻辑
- [ ] Task: 删除根目录下的历史备份文件夹 (`inkGrid_backup`, `inkGrid_clean_backup`, `inkGrid_clean`)
- [ ] Task: 移除后端上传目录 `backend/uploads/` 及相关占位文件
- [ ] Task: 清理后端代码中与 OCR、CV、分割相关的 Service 层逻辑
- [ ] Task: 移除 Celery 与 Redis 异步任务配置
- [ ] Task: Conductor - User Manual Verification '第一阶段：清理物理文件' (Protocol in workflow.md)

## 第二阶段：依赖优化与环境重塑
- [ ] Task: 更新后端依赖文件 `backend/requirements.txt`
- [ ] Task: 验证后端在移除冗余库后的启动情况，确保不再加载大型模型
- [ ] Task: Conductor - User Manual Verification '第二阶段：依赖优化' (Protocol in workflow.md)

## 第三阶段：功能验证与启动项精简
- [ ] Task: 修改启动脚本 `start.sh`，仅启动前端 Vite 服务和极简后端 API
- [ ] Task: 修改停止脚本 `stop.sh`，移除对相关进程的清理逻辑
- [ ] Task: 整体功能冒烟测试：首页、墨廊、峄山刻石、墨流
- [ ] Task: Conductor - User Manual Verification '第三阶段：功能验证' (Protocol in workflow.md)
