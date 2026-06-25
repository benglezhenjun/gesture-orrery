# Gesture Orrery

[![CI](https://github.com/benglezhenjun/gesture-orrery/actions/workflows/ci.yml/badge.svg)](https://github.com/benglezhenjun/gesture-orrery/actions/workflows/ci.yml)

Gesture Orrery 是一个摄像头手势驱动的 3D 太阳系星图原型。当前版本推进到 Cycle 17：手控响应和严重低 FPS 降载。

> 项目定位：这是一个自研交互原型，适合展示 Three.js 太阳系建模、MediaPipe 手势识别、手势相机控制和自动化验证循环。它不是最终的高端宇宙渲染方案；后续专业宇宙画面方向已转到 OpenSpace + `cosmos-control-plane` 控制层。

## 本轮目标

用户打开 Web 应用后，可以看到程序化纹理的太阳、八大行星、椭圆轨道、轨道倾角、小行星带、柯伊伯带、主要卫星、环系统、轨道标记、轨道刻度、命名小行星/矮行星、选中行星参考导引、近景地貌/大气特征标签、表面微细点层、地球城市光点和部分行星磁层场线；选中行星会平滑靠近方便检查细节，并可通过鼠标或摄像头手势控制视角、缩放、选择行星、暂停或调整模拟速度。

## 快速开始

```bash
npm install
npm run dev
```

打开 `http://127.0.0.1:5173`。

## 验证

```bash
npm run build
npm run test:e2e
```

完整 MVP 1 评估：

```bash
npm run eval:mvp1
```

最新循环评估：

```bash
npm run eval:cycle17
```

## 当前手势映射

- 双手拉开/合拢：连续缩放。
- 双手一起移动：平移视角目标点。
- 双手轻微旋转：旋转太阳系。
- 张开单手移动：旋转太阳系。
- 单手捏合并开合：连续缩放。
- 单手捏合并移动：平移视角目标点。
- 握拳：暂停或恢复模拟。

手势识别为了降低卡顿，优先在 Web Worker 中运行 MediaPipe，并强制 worker 使用 CPU，避免和 Three.js 抢 GPU。追踪到手后会按实际推理延迟和当前渲染 FPS 自适应采样，并按延迟/FPS 缩放送入 MediaPipe 的检测帧。UI 状态约 8Hz 更新，场景导航由 Three.js 动画循环消费命令队列。单手捏合和双手输入都使用锚点式直接控制；双手空间控制带短时预测、防过冲上限、更快的目标追踪、场景端识别帧间目标预测、连续控制的软重锚，以及直接控制命令去陈旧化。Cycle 14 起，单手捏合也支持连续软重锚和短时预测，减少手到边缘必须松开重抓的情况。Cycle 15 起，低 FPS 时会主动降低手部检测尺寸、拉长推理间隔并缩小摄像头预览，减少手控时对太阳系画面的干扰。Cycle 16 起，近景模型增加可验证的表面微地貌点、城市光、轨道刻度和磁层/场线，让放大后的太阳系更像精密星图。Cycle 17 起，严重低 FPS 且推理延迟较高时检测帧会降到 192x108，单手/双手直接控制会按目标误差自适应加速追随，减少大幅缩放移动后的拖滞感。

## 项目文档

- [项目目标](./docs/project-goal.md)
- [评估循环](./docs/evaluation-loop.md)
- [架构说明](./docs/architecture.md)
- [GitHub 展示说明](./README-GITHUB-SHOWCASE.md)
