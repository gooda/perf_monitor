# iOS 性能分析参考

## 一、阈值定义

### CPU

| 指标 | 正常 | 警告 | 严重 |
|------|------|------|------|
| avg_pct（平均 CPU%） | ≤60% | 60–80% | >80% |
| max_pct（最大 CPU%） | ≤90% | 90–95% | >95% |
| 说明 | 主线程 CPU 高易导致掉帧 | 需关注 | 明显卡顿风险 |

### 内存

| 指标 | 正常 | 警告 | 严重 |
|------|------|------|------|
| rss_mb_avg（平均 RSS MB） | ≤300 | 300–500 | >500 |
| rss_mb_max（最大 RSS MB） | ≤500 | 500–800 | >800 |
| heap_mb_delta（堆增长 MB） | ≤50 | 50–100 | >100 |
| 说明 | 普通应用 | 需关注泄漏 | 可能内存泄漏 |

### 帧率 / 流畅度

| 指标 | 正常 | 警告 | 严重 |
|------|------|------|------|
| fps.avg | ≥58 | 55–58 | <55 |
| fps.min | ≥50 | 30–50 | <30 |
| jank_count_total | 0 | 1–5 | >5 |
| big_jank_count_total | 0 | 1–2 | >2 |

### 能耗

| 指标 | 说明 |
|------|------|
| avg_power_score | 即时功耗，无固定阈值，需与同场景基线对比 |
| energy_score_total | 累计能耗，异常偏高时需排查 |

---

## 二、final.json 结构

```json
{
  "target_process_stats": {
    "cpu": {
      "avg_pct": 15.2,
      "max_pct": 88.5,
      "cpu_time_ms_total": 12345
    },
    "memory": {
      "rss_mb_avg": 256.3,
      "rss_mb_max": 320.1,
      "rss_mb_delta": 45.2,
      "heap_mb_avg": 180.5,
      "heap_mb_max": 220.0,
      "heap_mb_delta": 38.0
    },
    "energy": {
      "avg_score": 12.5,
      "max_score": 25.0,
      "energy_score_total": 1250.0
    },
    "fps": {
      "max": 60,
      "min": 45,
      "avg": 58.2,
      "jank_count_total": 2,
      "big_jank_count_total": 0,
      "frame_count_total": 1200
    }
  },
  "performanceData": {
    "topThreadsCpu": [...],
    "threadCount": 25
  }
}
```

---

## 三、thread_cpu_analysis.json 结构

```json
{
  "summary": {
    "total_samples": 12323,
    "total_time": 0.012,
    "thread_count": 183
  },
  "thread_stats": {
    "Main Thread 0xc7336c (AppName)": {
      "total_time": 0.00284,
      "sample_count": 2844,
      "process_name": "AppName",
      "cores_used": [0, 1, 2, 3],
      "top_functions": {
        "objc_msgSend": 396,
        "_xzm_xzone_malloc": 31,
        "0x114e0bcec": 22
      }
    }
  },
  "process_stats": [...],
  "flamegraph": {...}
}
```

- `sample_count`：采样次数，约等于 CPU 耗时（ms）
- `top_functions`：函数名 → 采样次数，用于定位热点

---

## 四、热点函数与根因映射

| 热点函数模式 | 可能根因 | 优化方向 |
|--------------|----------|----------|
| objc_msgSend 占比高 | 消息发送频繁 | 缓存、减少调用、内联 |
| malloc / _xzm_xzone_malloc | 内存分配多 | 对象池、复用、懒加载 |
| objc_retain / objc_release | 引用计数操作多 | 弱引用、减少强引用 |
| dispatch_* 在主线程 | 主线程调度过多 | 移到后台队列 |
| 网络/IO 相关（recv、read） | 主线程阻塞 IO | 异步 IO、后台线程 |
| 0x... 未符号化 | 需符号化 | 配置 symbolication.json |

---

## 五、perf_metrics.jsonl 结构（时序分析）

每行一条 JSON：

```json
{"timestamp":1733648400123,"type":"sysmontap","metrics":{"pid":12345,"name":"MyApp","cpu":15.2,"mem_mb":256.5,"power_score":12}}
{"timestamp":1733648400223,"type":"graphics.opengl","metrics":{"fps":60,"gpu_util":45.2}}
{"timestamp":1733648400323,"type":"coreprofilesessiontap","metrics":{"fps":59.8,"jank":2,"big_jank":0}}
```

用于分析指标随时间变化，定位瞬时峰值。
