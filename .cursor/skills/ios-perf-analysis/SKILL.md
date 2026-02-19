---
name: ios-perf-analysis
description: 自动分析 iOS 应用性能数据，发现 CPU 耗时过高导致掉帧、内存占用过高、能耗过高等问题，并通过调用栈定位根因。适用于 dist 打包后 ios_perf 采集的性能数据（指标 + 调用栈序列）。
---

# iOS 性能自动分析

## 适用场景

当用户需要分析 ios_perf 采集的性能数据时使用本 skill。数据来源：
- **dist 目录**：打包后的 ios_perf 运行根目录
- **指标数据**：`final.json`、`*_perf_metrics.jsonl`
- **调用栈数据**：`thread_cpu_analysis.json`

## 分析流程

### 阶段一：指标性能分析

1. **定位数据目录**
   - MCP/本地采集：`logs/cases/{device_udid}/{case_id}_{run_id}/`
   - 或用户指定的 `out_dir` / `run_dir`
   - 关键文件：`metrics/final.json`、`thread_cpu_analysis.json`

2. **读取并解析 final.json**
   - 路径：`{run_dir}/metrics/final.json`
   - 结构：`target_process_stats` 含 cpu、memory、energy、fps 等

3. **应用阈值判断**（详见 [reference.md](reference.md)）
   - CPU 过高：`avg_pct > 80` 或 `max_pct > 95` → 可能导致掉帧
   - 内存过高：`rss_mb_avg > 500` 或 `rss_mb_max > 800` 或 `heap_mb_delta` 持续增长
   - 能耗过高：`avg_score` 或 `energy_score_total` 异常偏高
   - 掉帧：`fps.avg < 55` 或 `fps.min < 30` 或 `jank_count_total > 0`

4. **输出问题清单**
   - 按严重程度标记：🔴 严重 / 🟡 警告 / 🟢 正常
   - 列出具体指标值与阈值对比

### 阶段二：调用栈根因分析

针对阶段一发现的问题，结合 `thread_cpu_analysis.json` 进行根因分析：

1. **CPU 耗时问题**
   - 按 `thread_stats` 中 `total_time` 或 `sample_count` 排序，找出 Top 5 高耗时线程
   - 读取每个线程的 `top_functions`，识别热点函数
   - 常见热点模式：
     - `objc_msgSend` 占比高 → 考虑减少消息发送、缓存
     - `malloc`/`_xzm_xzone_malloc` 多 → 内存分配频繁，考虑对象池/复用
     - `dispatch_*` → 主线程调度过多
     - 地址 `0x...` 未符号化 → 提示配置 symbolication

2. **主线程卡顿（掉帧）**
   - 重点分析名称含 `Main Thread` 或 `main` 的线程
   - 若 Main Thread 的 `top_functions` 含耗时操作（IO、网络、复杂计算）→ 建议移到后台线程

3. **内存问题**
   - 若 `top_functions` 中 `malloc`、`objc_retain`、`objc_autorelease` 占比高 → 可能存在过度分配或循环引用

4. **输出根因报告**
   - 问题类型 → 相关线程 → 热点函数 → 优化建议

## 报告模板

```markdown
# iOS 性能分析报告

## 一、指标概览
| 指标 | 当前值 | 阈值 | 状态 |
|------|--------|------|------|
| CPU 平均 | X% | ≤80% | 🔴/🟡/🟢 |
| 内存 RSS | X MB | ≤500MB | ... |
| FPS 平均 | X | ≥55 | ... |
| 能耗评分 | X | - | ... |

## 二、发现的问题
1. [问题描述] - 严重程度
   - 指标：...
   - 可能影响：...

## 三、调用栈根因分析
### 问题 1: [问题类型]
- **相关线程**：Main Thread (sample_count: 2844)
- **热点函数**：
  - objc_msgSend: 396 次
  - _xzm_xzone_malloc: 31 次
- **根因推断**：主线程消息发送与内存分配较多，可能导致卡顿
- **优化建议**：考虑减少主线程对象创建，使用对象池

## 四、总结与建议
...
```

## 数据路径速查

| 数据类型 | 路径 |
|----------|------|
| 最终指标 | `{run_dir}/metrics/final.json` |
| 线程 CPU 分析 | `{run_dir}/thread_cpu_analysis.json` |
| 时序指标 | `logs/coreprofile_cache/{device_id}/sessions/{session_id}_perf_metrics.jsonl` |
| 元数据 | `{run_dir}/stackshot_metadata.json` |

## 自动化脚本

可执行 `scripts/analyze_perf.py` 进行一键分析：

```bash
python .cursor/skills/ios-perf-analysis/scripts/analyze_perf.py <run_dir>
```

示例：`python .cursor/skills/ios-perf-analysis/scripts/analyze_perf.py logs/cases/DEVICE_UDID/case1_abc123`

## 注意事项

- 若 `thread_cpu_analysis.json` 中函数显示为 `0x...` 地址，需配置 `config/symbolication.json` 进行符号化
- 打包后根目录为 `dist/ios_perf`，logs 等路径相对于该目录
- 详细阈值与数据结构见 [reference.md](reference.md)
