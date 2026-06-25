# 架构说明

## 分层

```text
Camera Input
  -> Hand Tracking
  -> Gesture Recognition
  -> Interaction State
  -> Solar System Renderer
  -> UI Feedback / Metrics
```

当前版本实现了 Interaction State、Solar System Renderer、UI Feedback / Metrics，并接入 Camera Input、Hand Tracking 和基础 Gesture Recognition。真实手势阈值仍需要在摄像头前手测调参。

## 性能策略

- MediaPipe 推理不跟随 `requestAnimationFrame` 满帧运行，而是自适应采样：搜索手时 180ms 间隔，追踪到手后按上一帧推理延迟在 58ms 到 96ms 之间调整。
- worker 路径会在 `createImageBitmap` 阶段按上一帧推理延迟缩放检测帧：低延迟保留 392x220，常规延迟使用 360x202，高延迟降到 320x180 或 288x162。
- 手部状态 UI 约 120ms 提交一次，避免每个识别结果触发 React 重渲染。
- 连续导航命令进入 `sceneCommandQueueRef`，由 `SolarSystemScene` 在 Three.js 动画循环里消费。
- 正常运行关闭 `preserveDrawingBuffer`，仅在 `?capture=1` 验证模式下打开，兼顾性能和自动化像素检查。
- HandLandmarker 优先在 Web Worker 中初始化。worker 强制使用 CPU delegate，避免和 Three.js WebGL 渲染抢 GPU；如果 worker 初始化失败，则自动回退主线程动态导入版本。
- 单手手势仍采用“立即位移 + 少量惯性”的模式；双手手势改为锚点式 `spaceControl`，用双手中心、距离和角度计算目标点、镜头距离和太阳系平面旋转，再由 Three.js 动画循环高响应插值追踪，避免识别回调帧之间视觉跳变。双手映射使用更强的缩放指数、平移比例和 42Hz 级跟随响应，强化“抓住空间”的手感。
- 场景端会保存最近两次双手空间信号的速度，在 MediaPipe 识别帧之间对中心、缩放和旋转做短窗口预测；预测有独立上限，并在没有新结果后衰减，避免无限惯性。
- 双手空间控制支持软重锚：当手势中心、缩放或旋转偏离初始锚点过大时，识别层发送 `spaceControl` `rebase`，渲染层先应用当前目标，再把该目标设为新的基线，保持连续控制。
- 单手捏合使用独立的 `pinchControl`：识别层在进入 pinch 时创建 session，场景层保存相机/目标基线，后续 pinch 开合和平移直接计算相机距离和目标点，再由动画循环平滑追踪。
- 手势滤波独立在 `gestureFilters.ts` 中：自适应平滑根据动作幅度调整新输入权重，双手控制使用短时预测弥补识别帧间延迟，并用中心、距离和角度上限避免过冲。
- 双手控制会显示一个场景内空间锚点环，帮助用户看见当前抓取目标点。
- 摄像头开启时进入交互渲染档：降低 WebGL 内部像素比、隐藏远端小天体层、非选中标签以及非选中透明云壳/大气层；关闭摄像头后恢复观测质量。
- 交互渲染档使用动态清晰度：根据 FPS 和渲染耗时在固定上下限内调节内部像素比，避免手控模式长期停留在过低分辨率。
- 太阳系模型分为基础天体、表面细节层、选中参考导引、轨道标记、主要卫星和命名小行星；手控模式只保留当前交互需要的细节，避免模型复杂度拖慢输入。

## 目录

```text
src/
  App.tsx
  components/
    HandTrackingPanel.tsx
    SolarSystemScene.tsx
  data/
    planets.ts
  gesture/
    gestureFilters.ts
    gestureTypes.ts
  scene/
    proceduralTextures.ts
  main.tsx
  styles.css
tests/
  mvp1.spec.ts
  cycle2.spec.ts
  gestureFilters.spec.ts
  modelDetail.spec.ts
  navigation.spec.ts
```

## 设计约束

- 太阳系渲染不直接依赖摄像头。
- 手势识别只输出领域命令，例如 rotate、zoom、spaceControl、pause、select。
- UI 状态和渲染状态保持单向传递，便于测试和回放。
- 自动化测试优先验证行为，不依赖截图审美判断。
