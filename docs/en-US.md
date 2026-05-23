# iOS Perf Monitor

**English** · [简体中文](zh-CN.md)

A modern web dashboard for real-time iOS device performance monitoring. It consumes live metrics and stack traces streamed over WebSocket from the `ios_perf` backend services.

## Features

### Overview

- Real-time system CPU and memory utilization
- GPU utilization and memory usage
- FPS and jank frame detection
- Network throughput and cumulative traffic
- Multi-metric comparison line charts

### Process Focus

- Per-process CPU distribution (stacked area chart)
- Per-process memory distribution (stacked area chart)
- Per-process energy score distribution (stacked area chart)
- Process leaderboard (sortable by CPU, memory, or energy)
- Per-process network and disk I/O metrics

### Stack Analysis

> Enable the **Stack Analysis** toggle in the connection panel (Stackshot) before using this tab.

- Live call-stack flame graph
- Thread CPU distribution
- FPS trends and jank statistics
- Detailed GPU utilization

## Tech Stack

| Category | Choice |
|----------|--------|
| Framework | React 18 + TypeScript |
| Build | Vite |
| State | Zustand |
| Charts | ECharts |
| Styling | Tailwind CSS |
| Icons | Lucide React |

## Quick Start

### Prerequisites

1. Extract `ios_perf.zip`. It contains two standalone executables:
   - **`ios-perf-monitor`** — iOS device connection and tunnel management
   - **`ios-perf-service`** — performance data collection and WebSocket streaming

2. Start both services in separate terminals:

```bash
# Terminal 1: device connection service
./ios-perf-monitor
```

```bash
# Terminal 2: metrics collection (default ws://localhost:8766)
./ios-perf-service
```

3. Verify the device is ready:

   After `ios-perf-monitor` starts, it writes `config/device_tunnels` with connected devices and their activation status. When the target device is **active**, you can click **Start Monitoring** in the web UI to begin collecting metrics from `ios-perf-service`.

### Install and Run

```bash
git clone <repo-url>
cd perf_monitor
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm run preview
```

## Usage

### Connect to WebSocket

1. Enter the WebSocket URL in the **Connection** panel on the left
   - Local: `ws://localhost:8766`
   - Remote: `ws://<IP>:8766` (e.g. `ws://192.168.1.100:8766`)
2. Use preset buttons for common addresses
3. Connection history is saved automatically; click the clock icon to browse
4. Click **Connect**
5. After a successful connection, the status bar shows **Local** or **Remote**

### Remote Connection

Typical use cases:

- Run the collector on a test server and view data locally
- Share one collector across a team
- Attach an iOS device to a remote Mac and monitor from your machine

Requirements:

1. Both `ios-perf-monitor` and `ios-perf-service` are running remotely, with the service bound to `0.0.0.0:8766`
2. Port 8766 is allowed through the firewall
3. The client can reach the server over the network

### Start Monitoring

1. Enter or select the target device UDID
2. (Optional) Filter by process name
3. (Optional) Enable **Stack Analysis** for flame graph data
4. Click **Start Monitoring**

### View Data

| Tab | Content |
|-----|---------|
| Overview | System CPU, memory, GPU, FPS, network |
| Process Focus | Per-process resource distribution and rankings |
| Stack Analysis | Flame graph and thread CPU (requires Stackshot) |

### UI Notes

- **Theme toggle**: switch between dark and light mode in the top-right corner
- **Info panel**: click the ℹ️ icon for the current mode description and service parameters
- **Refresh rate**: metrics ~10 Hz (100 ms); flame graph updates ~every 10 seconds

## Project Structure

```
perf_monitor/
├── configs/
│   └── ios_perf_process_monitor.json   # Sample focused-process config
├── docs/
│   ├── zh-CN.md                        # 简体中文文档
│   └── en-US.md                        # This file
├── public/
├── src/
│   ├── components/
│   │   ├── charts/                     # Chart components
│   │   │   ├── LineChart.tsx
│   │   │   ├── MultiLineChart.tsx
│   │   │   ├── StackedAreaChart.tsx
│   │   │   ├── BidirectionalChart.tsx
│   │   │   └── FlameGraph.tsx
│   │   ├── panels/                     # Panel components
│   │   │   ├── ConnectionPanel.tsx
│   │   │   ├── OverviewPanel.tsx
│   │   │   ├── DetailedPanel.tsx
│   │   │   └── ProcessPanel.tsx
│   │   └── ui/                         # Base UI components
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

## Configuration

### Custom WebSocket URL

Set it in the connection panel, or change the default in `src/stores/perfStore.ts`:

```typescript
wsUrl: 'ws://your-server:8766',
```

### Data Retention

The UI keeps the latest 300 data points (~30 seconds at 10 Hz). Adjust in `src/stores/perfStore.ts`:

```typescript
const MAX_DATA_POINTS = 300;
```

### Process Monitor Config

`configs/ios_perf_process_monitor.json` is a sample focused-process configuration for the backend: process name patterns, memory metrics, and I/O thresholds.

## Development

### Add a New Chart

1. Create a component under `src/components/charts/`
2. Export it from `src/components/charts/index.ts`
3. Use it in the relevant panel

### Add a New Protocol Message

1. Add types in `src/types/index.ts`
2. Add type guards in `src/services/websocket.ts`
3. Handle the message in `src/hooks/useWebSocket.ts`
4. Add state and updaters in `src/stores/perfStore.ts`

### Scripts

```bash
npm run dev      # Dev server (port 3000)
npm run build    # Type-check + production build
npm run preview  # Preview production build
npm run lint     # ESLint
```

## License

MIT
