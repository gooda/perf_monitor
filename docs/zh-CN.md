# iOS Perf Monitor

[English](en-US.md) · **简体中文**

一个现代化的 iOS 设备性能监控 Web 应用，通过 WebSocket 实时消费 `ios_perf` 服务推送的性能指标与调用栈数据。

## 功能特性

### 系统概览

- 系统级 CPU、内存使用率实时监控
- GPU 使用率和显存占用
- FPS 帧率与卡顿帧（Jank）检测
- 网络收发速率与累计流量
- 多指标对比折线图

### 应用专项

- 各进程 CPU 使用分布（堆叠面积图）
- 各进程内存占用分布（堆叠面积图）
- 各进程能耗评分分布（堆叠面积图）
- 进程排行榜（可按 CPU / 内存 / 能耗排序）
- 进程级网络与磁盘 I/O 指标

### 调用栈分析

> 需在左侧连接面板启用「调用栈分析」开关（Stackshot）。

- 实时调用栈火焰图
- 线程 CPU 分布
- FPS 趋势与卡顿统计
- GPU 详细使用率

## 技术栈

| 类别 | 选型 |
|------|------|
| 框架 | React 18 + TypeScript |
| 构建 | Vite |
| 状态管理 | Zustand |
| 图表 | ECharts |
| 样式 | Tailwind CSS |
| 图标 | Lucide React |

## 快速开始

### 前置条件

1. 解压 `ios_perf.zip`，其中包含两个独立可执行程序：
   - **`ios-perf-monitor`** — 负责 iOS 设备连接与隧道管理
   - **`ios-perf-service`** — 负责性能数据采集并通过 WebSocket 推送

2. 分别在两个终端中启动：

```bash
# 终端 1：设备连接监控服务
./ios-perf-monitor
```

```bash
# 终端 2：性能采集服务（默认 ws://localhost:8766）
./ios-perf-service
```

3. 确认设备已就绪：

   `ios-perf-monitor` 启动后会在 `config/` 目录下生成 `device_tunnels` 文件，记录已连接设备的信息及激活状态。当目标设备状态为 **active（激活）** 时，Web 端即可通过「开始监控」触发性能采集。

### 安装与运行

```bash
git clone <repo-url>
cd perf_monitor
npm install
npm run dev
```

浏览器访问 [http://localhost:3000](http://localhost:3000)

### 构建生产版本

```bash
npm run build
npm run preview
```

## 使用说明

### 连接 WebSocket 服务

1. 在左侧「连接配置」面板输入 WebSocket 地址
   - 本地：`ws://localhost:8766`
   - 远端：`ws://<IP>:8766`（如 `ws://192.168.1.100:8766`）
2. 使用快捷预设按钮选择常用地址
3. 历史记录自动保存，点击时钟图标可查看
4. 点击「连接」建立连接
5. 连接成功后状态栏显示「本地」或「远端」标识

### 远端连接

适用于以下场景：

- 在测试服务器上运行采集服务，本地查看数据
- 团队共享同一个采集服务
- iOS 设备连接远程 Mac，本地查看性能数据

请确保：

1. 远端已启动 `ios-perf-monitor` 与 `ios-perf-service`，且服务监听 `0.0.0.0:8766`
2. 防火墙放行 8766 端口
3. 客户端与服务端网络可达

### 开始监控

1. 输入或从列表选择目标设备 UDID
2. （可选）输入目标进程名进行过滤
3. （可选）启用「调用栈分析」以获取火焰图数据
4. 点击「开始监控」

### 查看数据

| 标签页 | 内容 |
|--------|------|
| 系统概览 | 系统级 CPU、内存、GPU、FPS、网络 |
| 应用专项 | 各进程资源分布与排行榜 |
| 调用栈分析 | 火焰图、线程 CPU（需启用 Stackshot） |

### 界面说明

- **主题切换**：右上角可在深色 / 浅色主题间切换
- **信息面板**：点击右上角 ℹ️ 查看当前模式说明与服务参数
- **数据频率**：指标约 10 Hz（100 ms），火焰图约每 10 秒更新

## 项目结构

```
perf_monitor/
├── configs/
│   └── ios_perf_process_monitor.json   # 进程监控配置示例
├── docs/
│   ├── zh-CN.md                        # 中文文档（本文件）
│   └── en-US.md                        # English documentation
├── public/
├── src/
│   ├── components/
│   │   ├── charts/                     # 图表组件
│   │   │   ├── LineChart.tsx
│   │   │   ├── MultiLineChart.tsx
│   │   │   ├── StackedAreaChart.tsx
│   │   │   ├── BidirectionalChart.tsx
│   │   │   └── FlameGraph.tsx
│   │   ├── panels/                     # 面板组件
│   │   │   ├── ConnectionPanel.tsx
│   │   │   ├── OverviewPanel.tsx
│   │   │   ├── DetailedPanel.tsx
│   │   │   └── ProcessPanel.tsx
│   │   └── ui/                         # 基础 UI 组件
│   ├── hooks/
│   │   └── useWebSocket.ts
│   ├── services/
│   │   └── websocket.ts
│   ├── stores/
│   │   ├── perfStore.ts
│   │   └── themeStore.ts
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## 配置说明

### 自定义 WebSocket 地址

在连接配置面板输入，或修改 `src/stores/perfStore.ts` 中的默认值：

```typescript
wsUrl: 'ws://your-server:8766',
```

### 数据保留点数

默认保留最近 300 个数据点（约 30 秒 @ 10 Hz）。可在 `src/stores/perfStore.ts` 修改：

```typescript
const MAX_DATA_POINTS = 300;
```

### 进程监控配置

`configs/ios_perf_process_monitor.json` 提供了 focused process 配置示例，可用于后端进程监控的进程匹配、内存指标与 I/O 阈值设置。

## 开发指南

### 添加新图表

1. 在 `src/components/charts/` 创建组件
2. 在 `src/components/charts/index.ts` 导出
3. 在对应面板组件中使用

### 添加新协议支持

1. 在 `src/types/index.ts` 添加类型定义
2. 在 `src/services/websocket.ts` 添加类型守卫
3. 在 `src/hooks/useWebSocket.ts` 处理新消息类型
4. 在 `src/stores/perfStore.ts` 添加状态与更新方法

### 常用命令

```bash
npm run dev      # 开发服务器（端口 3000）
npm run build    # 类型检查 + 生产构建
npm run preview  # 预览生产构建
npm run lint     # ESLint 检查
```

## License

MIT
