#!/usr/bin/env python3
"""
iOS 性能自动分析脚本
分析 final.json 和 thread_cpu_analysis.json，输出问题清单与根因建议。
用法: python analyze_perf.py <run_dir>
"""

import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# 阈值（与 reference.md 一致）
THRESHOLDS = {
    "cpu_avg": (60, 80),
    "cpu_max": (90, 95),
    "rss_avg": (300, 500),
    "rss_max": (500, 800),
    "heap_delta": (50, 100),
    "fps_avg": (58, 55),
    "fps_min": (50, 30),
    "jank_count": (5, 10),
}


def load_json(path: Path) -> Optional[Dict[str, Any]]:
    if not path.exists():
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"⚠️ 读取失败 {path}: {e}")
        return None


def check_metric(value: float, low: float, high: float, higher_is_worse: bool = True) -> str:
    """返回 正常/警告/严重"""
    if higher_is_worse:
        if value <= low:
            return "🟢"
        if value <= high:
            return "🟡"
        return "🔴"
    else:
        if value >= low:
            return "🟢"
        if value >= high:
            return "🟡"
        return "🔴"


def analyze_metrics(run_dir: Path) -> Tuple[List[Dict], Dict[str, Any]]:
    """分析 final.json 指标"""
    final_path = run_dir / "metrics" / "final.json"
    data = load_json(final_path)
    if not data:
        return [], {}

    stats = data.get("target_process_stats", {})
    issues = []
    summary = {}

    # CPU
    cpu = stats.get("cpu", {})
    avg = cpu.get("avg_pct") or 0
    mx = cpu.get("max_pct") or 0
    summary["cpu_avg"] = avg
    summary["cpu_max"] = mx
    s = check_metric(avg, 60, 80)
    if s != "🟢":
        issues.append({"type": "CPU", "severity": s, "metric": f"avg_pct={avg:.1f}%", "threshold": "≤80%"})
    s = check_metric(mx, 90, 95)
    if s != "🟢":
        issues.append({"type": "CPU", "severity": s, "metric": f"max_pct={mx:.1f}%", "threshold": "≤95%"})

    # Memory
    mem = stats.get("memory", {})
    rss_avg = mem.get("rss_mb_avg") or 0
    rss_max = mem.get("rss_mb_max") or 0
    heap_delta = mem.get("heap_mb_delta") or 0
    summary["rss_avg"] = rss_avg
    summary["rss_max"] = rss_max
    summary["heap_delta"] = heap_delta
    for name, val, (lo, hi) in [
        ("RSS 平均", rss_avg, (300, 500)),
        ("RSS 最大", rss_max, (500, 800)),
        ("堆增长", heap_delta, (50, 100)),
    ]:
        s = check_metric(val, lo, hi)
        if s != "🟢":
            issues.append({"type": "内存", "severity": s, "metric": f"{name}={val:.1f}MB", "threshold": f"≤{hi}"})

    # FPS
    fps = stats.get("fps", {})
    fps_avg = fps.get("avg") or 0
    fps_min = fps.get("min") or 999
    jank = fps.get("jank_count_total") or 0
    summary["fps_avg"] = fps_avg
    summary["fps_min"] = fps_min
    summary["jank_count"] = jank
    if fps_avg > 0 and fps_avg < 58:
        s = "🟡" if fps_avg >= 55 else "🔴"
        issues.append({"type": "帧率", "severity": s, "metric": f"fps_avg={fps_avg:.1f}", "threshold": "≥55"})
    if fps_min < 999 and fps_min < 50:
        s = "🟡" if fps_min >= 30 else "🔴"
        issues.append({"type": "帧率", "severity": s, "metric": f"fps_min={fps_min:.1f}", "threshold": "≥30"})
    if jank > 0:
        s = "🟡" if jank <= 5 else "🔴"
        issues.append({"type": "卡顿", "severity": s, "metric": f"jank_count={jank}", "threshold": "0"})

    return issues, summary


def analyze_callstack(run_dir: Path, issues: List[Dict]) -> List[Dict]:
    """根据 thread_cpu_analysis.json 分析根因"""
    tc_path = run_dir / "thread_cpu_analysis.json"
    data = load_json(tc_path)
    if not data:
        return []

    thread_stats = data.get("thread_stats", {})
    root_causes = []

    # 按 sample_count 排序取 Top 5
    threads = sorted(
        thread_stats.items(),
        key=lambda x: x[1].get("sample_count", 0),
        reverse=True,
    )[:5]

    hot_patterns = {
        "objc_msgSend": "消息发送频繁，考虑缓存或减少调用",
        "_xzm_xzone_malloc": "内存分配频繁，考虑对象池/复用",
        "malloc": "内存分配频繁",
        "objc_retain": "引用计数操作多，检查循环引用",
        "objc_release": "引用计数操作多",
        "dispatch_": "主线程调度，考虑移到后台",
    }

    for thread_key, stats in threads:
        top_funcs = stats.get("top_functions", {})
        if not top_funcs:
            continue

        is_main = "main" in thread_key.lower() or "Main Thread" in thread_key
        sample_count = stats.get("sample_count", 0)
        if sample_count < 50:
            continue

        suggestions = []
        for func, count in sorted(top_funcs.items(), key=lambda x: -x[1])[:5]:
            for pattern, hint in hot_patterns.items():
                if pattern in func:
                    suggestions.append(f"{func}({count}次): {hint}")
                    break
            if func.startswith("0x"):
                suggestions.append(f"{func}({count}次): 未符号化，需配置 symbolication.json")

        if suggestions:
            root_causes.append({
                "thread": thread_key,
                "sample_count": sample_count,
                "is_main": is_main,
                "suggestions": suggestions,
            })

    return root_causes


def main():
    if len(sys.argv) < 2:
        print("用法: python analyze_perf.py <run_dir>")
        print("示例: python analyze_perf.py logs/cases/xxx/case1_abc123")
        sys.exit(1)

    run_dir = Path(sys.argv[1]).resolve()
    if not run_dir.is_dir():
        print(f"❌ 目录不存在: {run_dir}")
        sys.exit(1)

    print("=" * 60)
    print("iOS 性能分析报告")
    print("=" * 60)
    print(f"数据目录: {run_dir}\n")

    issues, summary = analyze_metrics(run_dir)
    root_causes = analyze_callstack(run_dir, issues)

    # 一、指标概览
    print("## 一、指标概览")
    print("-" * 50)
    for k, v in summary.items():
        if isinstance(v, float):
            print(f"  {k}: {v:.2f}")
        else:
            print(f"  {k}: {v}")

    # 二、发现的问题
    print("\n## 二、发现的问题")
    print("-" * 50)
    if not issues:
        print("  🟢 未发现明显性能问题")
    else:
        for i, iss in enumerate(issues, 1):
            print(f"  {i}. {iss['severity']} [{iss['type']}] {iss['metric']} (阈值: {iss['threshold']})")

    # 三、调用栈根因
    print("\n## 三、调用栈根因分析")
    print("-" * 50)
    if not root_causes:
        print("  (无 thread_cpu_analysis.json 或无可分析热点)")
    else:
        for rc in root_causes:
            tag = " [主线程]" if rc["is_main"] else ""
            print(f"\n  线程: {rc['thread']}{tag} (采样: {rc['sample_count']})")
            for s in rc["suggestions"]:
                print(f"    → {s}")

    print("\n" + "=" * 60)


if __name__ == "__main__":
    main()
