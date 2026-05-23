# iOS Perf Monitor

[English](docs/en-US.md) · [简体中文](docs/zh-CN.md)

A modern web dashboard for real-time iOS device performance monitoring. It consumes live metrics and stack traces streamed over WebSocket from the [`ios_perf`](https://github.com) backend services.

现代化的 iOS 设备性能监控前端，通过 WebSocket 实时消费 `ios_perf` 后端推送的性能数据与调用栈。

---

## Quick Start · 快速开始

```bash
# 1. Start ios_perf backend (two terminals)
./ios-perf-monitor    # device & tunnel management
./ios-perf-service    # metrics collection, ws://localhost:8766

# 2. Start this frontend
npm install
npm run dev           # http://localhost:3000
```

See the full guides for setup, remote connection, and development:

| Language | Document |
|----------|----------|
| English | [docs/en-US.md](docs/en-US.md) |
| 简体中文 | [docs/zh-CN.md](docs/zh-CN.md) |

## Features · 功能概览

| Mode | Description |
|------|-------------|
| **Overview** · 系统概览 | System CPU, memory, GPU, FPS, network |
| **Process** · 应用专项 | Per-process CPU / memory / energy distribution |
| **Stack Analysis** · 调用栈分析 | Live flame graph & thread CPU (requires Stackshot) |

## Tech Stack · 技术栈

React 18 · TypeScript · Vite · Zustand · ECharts · Tailwind CSS

## License

MIT
