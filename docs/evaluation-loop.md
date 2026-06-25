# 可循环评估过程

## 循环格式

每个开发循环固定使用 6 个步骤：

1. 选择一个小目标。
2. 写出可验证标准。
3. 实现最小版本。
4. 运行自动化和手动测试。
5. 记录指标和失败现象。
6. 通过则进入下一轮，未通过则只调整当前目标。

## Cycle 01: MVP 1 太阳系可视化

目标：没有摄像头也能操作太阳系，建立后续手势识别的交互基线。

验收标准：

| 编号 | 标准 | 证据 |
| --- | --- | --- |
| C01-1 | 页面渲染太阳、八大行星和轨道 | Playwright 检查 WebGL canvas 非空 |
| C01-2 | 行星持续运动 | 模拟天数递增，暂停后停止 |
| C01-3 | 鼠标或指针可以选择行星 | Playwright 点击行星屏幕坐标后检查信息面板 |
| C01-4 | 暂停和速度控制可用 | Playwright 点击按钮并检查状态 |
| C01-5 | 构建通过 | `npm run build` |

运行命令：

```bash
npm run eval:mvp1
```

## 指标定义

| 指标 | MVP 1 目标 | 后续手势目标 |
| --- | --- | --- |
| FPS | 大于 50，低于时记录原因 | 大于 45 |
| 首次画面时间 | 3 秒内可见 | 摄像头版 5 秒内可操作 |
| 选择反馈 | 500ms 内面板更新 | 手势选择 1 秒内确认 |
| 连续运行 | 10 分钟无崩溃 | 10 分钟无崩溃 |

## 下一轮候选

## Cycle 02: 精细建模和手部追踪准备

目标：把太阳系从基础示意图升级成精细的观测仪式模型，并把摄像头手部追踪推进到需要真实手势测试的位置。

验收标准：

| 编号 | 标准 | 证据 |
| --- | --- | --- |
| C02-1 | 行星有程序化表面纹理、云层、环系统、主要卫星或小天体层 | Playwright 截图和 canvas 彩色像素检查 |
| C02-2 | 椭圆轨道、偏心率和轨道倾角进入渲染模型 | `Planet` 数据和 `SolarSystemScene` 轨道计算 |
| C02-3 | 本地 MediaPipe wasm 和手部模型可由应用服务 | `tests/cycle2.spec.ts` fetch 检查 |
| C02-4 | 页面有摄像头启动入口和手部状态反馈 | Playwright UI 检查 |
| C02-5 | fake camera 环境可启动 HandLandmarker 到 lost/tracking 状态 | `npm run eval:cycle2` |
| C02-6 | 真实手势控制进入手测前状态 | 用户在摄像头前验证 open palm / pinch / fist |

运行命令：

```bash
npm run eval:cycle2
```

真实手测前的自动化边界：

- 自动化可以证明模型、wasm、摄像头启动链路和状态 UI 可用。
- 自动化不能证明真实手在你的光线、摄像头角度和背景下的识别稳定性。
- 下一步需要真实手测：张手移动旋转、捏合缩放、握拳暂停或恢复。

## Cycle 03: 手势导航手感和视觉重构

目标：降低摄像头控制卡顿，让手势输入更接近“抓住空间并自由移动”的感觉，同时改善默认视觉效果。

验收标准：

| 编号 | 标准 | 证据 |
| --- | --- | --- |
| C03-1 | 手势命令不再每帧触发 React 重渲染 | `App.tsx` 使用命令队列，`SolarSystemScene` 动画循环消费 |
| C03-2 | MediaPipe 优先在 worker 中运行，worker 使用 CPU 避免抢 Three.js GPU | `src/workers/handLandmarker.worker.ts` |
| C03-3 | 双手空间控制、张手旋转、捏合缩放/平移、握拳暂停都进入命令链路 | `HandTrackingPanel.tsx` 手势映射 |
| C03-4 | 场景支持惯性旋转、缩放和平移 | `tests/navigation.spec.ts` |
| C03-5 | 正常模式关闭 WebGL 保留缓冲，capture 模式用于像素验证 | `SolarSystemScene.tsx` 和 `tests/mvp1.spec.ts` |
| C03-6 | 手势开启时自动进入交互渲染档，降低内部分辨率 | `tests/cycle2.spec.ts` |
| C03-7 | 桌面和移动无主要 UI 重叠，画面非空且有彩色内容 | Playwright 截图与 capture 像素检查 |

运行命令：

```bash
npm run eval:cycle3
```

真实手测标准：

- 双手拉开时应放大，合拢时应缩小；双手一起移动时，视角目标点应跟随移动。
- 张手移动时，星图应连续旋转，不应明显一顿一顿跳。
- 单手捏合开合时，缩放方向应可预测；捏合移动时，视角目标点应跟随移动。
- 握拳触发暂停或恢复后，不应短时间连续触发多次。
- 若光线或背景导致识别抖动，下一轮只调阈值和平滑参数，不新增大功能。

## Cycle 04: 锚点式双手空间控制和精细太阳系

目标：把双手控制从逐帧增量改成“抓住空间”的直接映射，同时提升太阳、行星、卫星和环带细节，并守住手控模式性能预算。

验收标准：

| 编号 | 标准 | 证据 |
| --- | --- | --- |
| C04-1 | 双手进入时建立空间锚点，离开时释放锚点 | `spaceControl` start / move / end 命令 |
| C04-2 | 双手中心控制平移，双手距离控制缩放，双手连线角控制旋转 | `tests/navigation.spec.ts` 直接注入 `spaceControl` |
| C04-3 | 太阳有日珥和更细表面，行星有高分辨率程序纹理，卫星有撞击坑，环系统有多层带和暗缝 | `proceduralTextures.ts` 与 `SolarSystemScene.tsx` |
| C04-4 | 手控模式隐藏非选中透明云壳/大气层，并降低内部分辨率 | `SolarSystemScene.tsx` 交互渲染档 |
| C04-5 | 完整自动化回归通过，截图非空且手控假摄像头模式保持可交互 FPS | `npm run eval:cycle3` 与 `output/playwright/*.png` |

本轮记录指标：

| 场景 | 指标 |
| --- | --- |
| 桌面截图验证 | 24 FPS，canvas 835x522，彩色抽样像素 2443 |
| 手控假摄像头 | 27 FPS，canvas 518x324，MediaPipe CPU/adaptive，延迟约 57ms |
| 自动化回归 | 7 passed |

下一步真实手测标准：

- 双手拉开/合拢时，缩放应像直接抓住星图，不应需要连续小幅抖动才能改变距离。
- 双手一起移动时，视角目标点应跟着手移动，停止后不应继续漂移。
- 双手旋转时，太阳系平面应跟随手部角度变化，不应累计过冲。
- 若真实手测仍卡，下一轮优先调摄像头分辨率、推理间隔和平滑参数；若方向不顺，下一轮只调手势坐标映射。

## Cycle 05: 高频手势追踪和空间锚点反馈

目标：继续降低真实手势的视觉卡顿感，让双手控制在低频识别结果之间仍保持连续运动，并给用户明确的“抓住空间”反馈。

验收标准：

| 编号 | 标准 | 证据 |
| --- | --- | --- |
| C05-1 | 追踪到手后推理间隔从 96ms 收紧到 72ms，搜索间隔从 250ms 收紧到 180ms | `HandTrackingPanel.tsx` |
| C05-2 | 摄像头输入分辨率降到 424x240，减少 MediaPipe 单帧负担 | `getUserMedia` 约束 |
| C05-3 | 单手和双手平滑参数提高新输入权重，降低动作滞后 | `centerSmoothing` / `pinchSmoothing` / `twoHandSmoothing` |
| C05-4 | 双手 `spaceControl` 的目标变换由动画循环高响应插值追踪，不再只在识别回调帧跳变 | `SolarSystemScene.tsx` |
| C05-5 | 双手控制开始后出现场景内空间锚点环，随目标点移动，结束后隐藏 | `orrery-space-anchor.png` |
| C05-6 | 连续更新同一双手会话的目标时，场景继续追踪最后一次 move 命令 | `tests/navigation.spec.ts` |

本轮记录指标：

| 场景 | 指标 |
| --- | --- |
| 桌面截图验证 | 23 FPS，canvas 835x522，彩色抽样像素 2404 |
| 手控假摄像头 | 28 FPS，canvas 518x324，MediaPipe CPU/adaptive，延迟约 54.5ms |
| 自动化回归 | 8 passed |

下一步真实手测标准：

- 双手移动时锚点环应跟随目标点，不应每 0.1 秒跳一下。
- 双手连续拉开再合拢时，镜头应跟随最后一次手势目标，不应停留在第一次缩放位置。
- 若视觉仍显糊，下一轮优先做手控模式分层渲染或动态清晰度，而不是继续牺牲帧率。

## Cycle 06: 手控动态清晰度

目标：解决手控模式为了流畅而过度降低内部分辨率的问题，在帧率可接受时自动提高清晰度，掉帧时再受控回落。

验收标准：

| 编号 | 标准 | 证据 |
| --- | --- | --- |
| C06-1 | 手控模式根据 FPS 和渲染耗时动态调整内部像素比 | `getNextAdaptiveInteractionQuality` |
| C06-2 | 手控模式有硬下限，不能在压力下跌到过低清晰度 | `getRenderPixelRatio` 最低比例 |
| C06-3 | fake camera 手控测试验证 canvas 宽高仍低于 CSS 尺寸但不低于 37% | `tests/cycle2.spec.ts` |
| C06-4 | 完整回归通过 | `npm run eval:cycle3` |
| C06-5 | 手控截图刷新后仍无明显 UI 重叠，画面比上一轮更清楚 | `orrery-hand-engaged-desktop.png` |

本轮记录指标：

| 场景 | 指标 |
| --- | --- |
| 桌面截图验证 | 23 FPS，canvas 1035x647，彩色抽样像素 3682 |
| 手控假摄像头 | 27 FPS，canvas 678x424，内部/CSS 比例 0.471，MediaPipe CPU/adaptive，延迟约 51.3ms |
| 自动化回归 | 8 passed |

下一步真实手测标准：

- 手控时行星和轨道线应比上一轮更清楚，不能因为动态质量造成突然闪糊。
- 如果真实手势仍卡，下一轮优先优化推理调度和输入事件预测；如果卡顿可接受但不够随心，继续调 `spaceControl` 坐标映射曲线。

## Cycle 07: 自适应手势预测和精细太阳系模型

目标：在不增加真实手势卡顿的前提下，让输入响应更接近“随手抓住空间”，并把太阳系模型从基础示意进一步推进到可观察细节模型。

验收标准：

| 编号 | 标准 | 证据 |
| --- | --- | --- |
| C07-1 | 单手中心、捏合距离和双手空间控制使用自适应平滑，小动作稳、大动作快 | `src/gesture/gestureFilters.ts` 与 `HandTrackingPanel.tsx` |
| C07-2 | 双手控制做短时预测，并对中心、距离、角度设置防过冲上限 | `tests/gestureFilters.spec.ts` |
| C07-3 | 行星模型包含表面细节层、选中态自转轴/赤道参考、轨道标记、月球标签和命名小行星 | `tests/modelDetail.spec.ts` |
| C07-4 | 手控模式仍隐藏远端小天体层和非选中细节，保持交互画面清晰 | `orrery-hand-engaged-desktop.png` |
| C07-5 | 完整回归通过 | `npm run eval:cycle7` |

本轮记录指标：

| 场景 | 指标 |
| --- | --- |
| 模型结构统计 | 8 颗行星，12 个主要卫星，8 个表面细节层，48 个轨道标记，4 个命名小行星 |
| 手控假摄像头 | 28 FPS，canvas 689x430，MediaPipe CPU/adaptive，延迟约 50.1ms |
| 自动化回归 | 11 passed |

下一步真实手测标准：

- 双手拉开/合拢时应直接放大/缩小，不应有明显“等识别帧”的迟滞。
- 双手一起移动时，空间锚点和视角目标应跟随手移动，停止后不应继续漂移。
- 近景观察地球、木星、土星、火星时，应能看出参考导引、表面细节、环或卫星信息，而不是只看到彩色球。
- 若真实手势仍卡，下一轮只调预测上限、推理间隔和像素比，不再增加模型复杂度。

## Cycle 08: 高响应双手空间控制

目标：进一步降低“双手已经动了但镜头还没跟上”的感觉，让拉开/合拢和平移更像直接抓住太阳系空间。

验收标准：

| 编号 | 标准 | 证据 |
| --- | --- | --- |
| C08-1 | 双手缩放使用更强响应曲线，拉开/合拢后镜头距离变化更明显 | `spaceControlZoomExponent` |
| C08-2 | 双手中心平移使用更高世界空间比例，目标点更跟手 | `spaceControlPanScale` |
| C08-3 | 空间控制目标追踪速率提高，减少识别帧之间的迟滞 | `spaceControlFollowRate` |
| C08-4 | 调试接口能读取当前空间控制目标误差 | `window.__orreryDebug.getSpaceControlState()` |
| C08-5 | 自动化验证双手目标出现后 160ms 内基本追上目标 | `tests/navigation.spec.ts` |
| C08-6 | 追踪采样间隔根据 MediaPipe 延迟在上下限内自适应 | `tests/gestureFilters.spec.ts` |
| C08-7 | 完整回归通过 | `npm run eval:cycle8` |

下一步真实手测标准：

- 双手拉开和合拢时，镜头距离变化应比 Cycle 07 更明显，但不能有明显过冲。
- 双手平移时，空间锚点应更贴近手的方向，不能有“拖着走”的迟钝感。
- 如果真实手测仍卡，下一轮优先减少 `createImageBitmap` 传输成本或进一步分离摄像头预览绘制，而不是继续提高映射倍率。

## Cycle 09: 识别帧间双手目标预测

目标：在 MediaPipe 两次识别结果之间继续推进双手空间控制目标，减少低频识别造成的停顿感，同时设置预测上限和衰减，避免手停后继续漂移。

验收标准：

| 编号 | 标准 | 证据 |
| --- | --- | --- |
| C09-1 | 场景端保存最近双手 `spaceControl` 信号及速度 | `SpaceGestureSignal` |
| C09-2 | 两次识别结果之间短时预测中心、缩放和旋转目标 | `updatePredictedSpaceTarget` |
| C09-3 | 预测中心、缩放和旋转都有独立上限，并在无新结果后衰减 | `spaceControlMaxPredicted*` 与 fade 参数 |
| C09-4 | 调试接口能读到当前预测窗口 | `getSpaceControlState().predictedMs` |
| C09-5 | 自动化验证无第三次 move 时目标仍继续沿手势方向推进 | `tests/navigation.spec.ts` |
| C09-6 | 完整回归通过 | `npm run eval:cycle9` |

本轮记录指标：

| 场景 | 指标 |
| --- | --- |
| 预测锚点截图 | `predictedMs` 约 63ms，目标误差约 0.54 |
| 手控假摄像头 | 28 FPS，canvas 689x430，MediaPipe CPU/adaptive，延迟约 54.6ms |
| 自动化回归 | 14 passed |

下一步真实手测标准：

- 双手持续拉开时，不应每个识别帧之间明显停顿。
- 双手突然停下时，星图应快速停住，不应继续漂移。
- 如果仍有卡顿，下一轮优先优化摄像头帧复制和 worker 传输，而不是再增加预测窗口。

## Cycle 10: 自适应检测帧尺寸

目标：降低 MediaPipe worker 的单帧负担，让真实摄像头控制在延迟升高时自动牺牲少量检测输入分辨率，优先守住手势响应。

验收标准：

| 编号 | 标准 | 证据 |
| --- | --- | --- |
| C10-1 | 检测帧尺寸根据上一帧推理延迟分档 | `getAdaptiveDetectionFrameSize` |
| C10-2 | worker 路径通过 `createImageBitmap` resize 发送缩放后的帧 | `HandTrackingPanel.tsx` |
| C10-3 | 摄像头约束更偏向轻量输入，上限保持 424x240 | `getUserMedia` video constraints |
| C10-4 | 自动化覆盖低延迟保清晰、高延迟降尺寸的分档 | `tests/gestureFilters.spec.ts` |
| C10-5 | fake camera 启动链路仍可进入 lost/tracking 状态 | `tests/cycle2.spec.ts` |
| C10-6 | 完整回归通过 | `npm run eval:cycle10` |

本轮记录指标：

| 场景 | 指标 |
| --- | --- |
| 手控假摄像头 | 28 FPS，video 392x220，canvas 689x430，MediaPipe CPU/adaptive，延迟约 49.1ms |
| 预测锚点截图 | `predictedMs` 约 62.5ms，目标误差约 0.54 |
| 自动化回归 | 15 passed |

下一步真实手测标准：

- 如果设备在真实摄像头下延迟升高，手势响应应优先保持连续，而不是持续卡顿。
- 如果检测尺寸降低导致误识别明显增加，下一轮需要把 288x162 档位抬高或只在连续高延迟后启用。

## Cycle 11: 双手空间控制软重锚

目标：解决双手控制范围有限的问题。用户把双手移动到边缘或拉开到较大幅度后，系统自动把当前视角作为新的抓取基线，让连续放大、缩小和平移不需要松手重抓。

验收标准：

| 编号 | 标准 | 证据 |
| --- | --- | --- |
| C11-1 | `spaceControl` 支持 `rebase` 命令 | `gestureTypes.ts` |
| C11-2 | 双手平移、缩放或旋转超过阈值时发送重锚命令 | `HandTrackingPanel.tsx` |
| C11-3 | 场景应用当前目标后把它设为新的空间基线 | `rebaseSpaceControl` |
| C11-4 | 自动化验证重锚后继续小幅双手移动不会弹回旧锚点 | `tests/navigation.spec.ts` |
| C11-5 | 完整回归通过 | `npm run eval:cycle11` |

本轮记录指标：

| 场景 | 指标 |
| --- | --- |
| 重锚注入测试 | 距离 27.4 -> 9.5，继续小幅移动后 9.5 -> 7.5，未弹回旧锚点 |
| 手控假摄像头 | 28 FPS，video 392x220，canvas 656x410，MediaPipe CPU/adaptive，延迟本次抽样约 85.6ms |
| 自动化回归 | 16 passed |

下一步真实手测标准：

- 双手持续拉开时，可以连续放大，不应因为手到边缘而必须明显松开重抓。
- 大幅平移后继续小幅移动，目标点应继续沿当前方向走，不应突然回到第一次抓取的位置。
- 如果出现轻微跳变，下一轮应调高重锚阈值或只在动作速度下降时重锚。

## Cycle 12: 单手捏合锚点控制

目标：让单手捏合也接近“抓住空间”的直接控制，而不是逐帧累计 zoom/pan，减少单手缩放和平移时的迟钝和不确定感。

验收标准：

| 编号 | 标准 | 证据 |
| --- | --- | --- |
| C12-1 | `pinchControl` 支持 start / move / end 命令 | `gestureTypes.ts` |
| C12-2 | 单手进入 pinch 时建立锚点 session，离开 pinch 时结束 session | `HandTrackingPanel.tsx` |
| C12-3 | pinch 开合映射为直接缩放，手掌中心映射为直接平移 | `applyPinchControlMove` |
| C12-4 | 场景循环平滑追踪 pinch 目标，而不是通过普通 zoom/pan impulse 累计 | `updatePinchControl` |
| C12-5 | 自动化验证单手 pinch 可直接缩放/平移，并能在同一 session 内继续更新目标 | `tests/navigation.spec.ts` |
| C12-6 | 完整回归通过 | `npm run eval:cycle12` |

本轮记录指标：

| 场景 | 指标 |
| --- | --- |
| 单手 pinch 注入测试 | 距离 27.4 -> 15.5，目标点明显平移 |
| 手控假摄像头 | 29 FPS，video 392x220，canvas 689x430，MediaPipe CPU/adaptive，延迟约 49.6ms |
| 自动化回归 | 18 passed |

下一步真实手测标准：

- 单手捏住后开合手指时，缩放应比旧的逐帧增量更直接。
- 捏住并移动手时，视角目标应跟手移动，不应只产生很小的累计位移。
- 如果单手 pinch 太敏感，下一轮调低 `pinchControlZoomExponent` 或 `pinchControlPanScale`。

## Cycle 13: 精细太阳系和直接控制去陈旧化

目标：提高放大近景时的太阳系精细度，并减少同一渲染帧内积压的旧手势目标造成的滞后。

验收标准：

| 编号 | 标准 | 证据 |
| --- | --- | --- |
| C13-1 | 程序纹理分辨率和地貌/风暴细节提高，近景不只依赖基础色块 | `proceduralTextures.ts` |
| C13-2 | 每颗行星有可计数的近景地貌或大气特征标签 | `createSurfaceFeatureLabels` |
| C13-3 | 命名小天体从小行星扩展到外太阳系矮行星，并带偏心/倾角轨道 | `createNamedMinorBodies` |
| C13-4 | 场景调试统计暴露特征线、特征标签、小天体和环系统数量 | `getModelStats()` |
| C13-5 | 同一帧内积压的 `pinchControl` / `spaceControl` 旧 move 只保留最新目标 | `coalesceDirectControlCommands` |
| C13-6 | 选中行星后相机会平滑靠近，方便检查近景模型细节 | `queuePlanetFocus`, `tests/navigation.spec.ts` |
| C13-7 | 自动化验证模型精细度门槛、近景聚焦和命令去陈旧化统计 | `tests/modelDetail.spec.ts`, `tests/navigation.spec.ts` |
| C13-8 | 完整回归通过 | `npm run eval:cycle13` |

本轮记录指标：

| 场景 | 指标 |
| --- | --- |
| 模型结构 | 8 planets, 12 major moons, 91 surface feature lines, 19 feature labels, 48 orbit markers, 8 named minor/dwarf bodies, 2 ring systems |
| 命令去陈旧化注入测试 | 15 raw commands -> 2 coalesced commands，丢弃 13 个旧 direct-control move，近景目标误差约 0.00005 以下 |
| 手控假摄像头 | 19 FPS，render 约 0.3ms，video 392x220，canvas 547x342，MediaPipe CPU/adaptive，延迟约 66.4ms |
| 自动化回归 | 20 passed |

下一步真实手测标准：

- 放大到任意行星附近时，应能明显分辨该行星的独有特征，而不是只有颜色差异。
- 双手或单手连续快速移动时，画面应优先跟随最新手势位置，不应慢慢播放旧输入。
- 如果 Cycle 13 的纹理分辨率让真实手控帧率明显下降，下一轮需要把贴图分辨率按设备性能分档。

## Cycle 14: 单手捏合连续重锚和预测

目标：让单手捏合缩放/平移更接近“抓住空间”，补齐双手已有的软重锚和识别帧间预测，减少单手控制时的边缘限制和停顿感。

验收标准：

| 编号 | 标准 | 证据 |
| --- | --- | --- |
| C14-1 | `pinchControl` 支持 `rebase` 命令 | `gestureTypes.ts` |
| C14-2 | 单手捏合移动或缩放幅度超过阈值时发送重锚命令并更新手势基线 | `HandTrackingPanel.tsx` |
| C14-3 | 场景应用当前 pinch 目标后把它设为新的单手控制基线 | `rebasePinchControl` |
| C14-4 | 单手 pinch 在两次识别结果之间使用短窗口预测，并设置防过冲上限 | `updatePredictedPinchTarget` |
| C14-5 | 调试接口可读取单手 pinch 目标误差和预测窗口 | `getPinchControlState()` |
| C14-6 | 自动化验证单手 pinch 预测和重锚后继续移动不会弹回旧锚点 | `tests/navigation.spec.ts` |
| C14-7 | 完整回归通过 | `npm run eval:cycle14` |

本轮记录指标：

| 场景 | 指标 |
| --- | --- |
| 单手 pinch 预测注入测试 | `predictedMs` 约 76.9ms，预测目标距离约 17.9，未预测目标距离约 21.7 |
| 单手 pinch 重锚注入测试 | 距离 27.4 -> 11.8，继续小幅移动后 11.8 -> 9.7，目标继续平移约 0.71 |
| 手控假摄像头 | 19 FPS，render 约 0.5ms，video 392x220，canvas 547x342，MediaPipe CPU/adaptive，延迟约 69.1ms |
| 自动化回归 | 22 passed |

下一步真实手测标准：

- 单手捏住并持续放大时，手指到达舒适范围边缘后仍可继续放大，不应明显必须松开重抓。
- 单手捏住并移动手掌时，目标点应持续跟随，不应在重锚后跳回第一次捏住的位置。
- 如果单手预测造成轻微漂移，下一轮应降低 `pinchControlPredictionWindowSeconds` 或预测上限。

## Cycle 15: FPS 反馈式推理降载和手控预览降干扰

目标：当手控模式下渲染 FPS 偏低时，主动降低 MediaPipe 输入和推理频率，减少 CPU 抢占；同时缩小摄像头预览，让太阳系画面保持主视觉。

验收标准：

| 编号 | 标准 | 证据 |
| --- | --- | --- |
| C15-1 | 手部追踪面板接收当前场景 FPS 作为推理预算输入 | `HandTrackingPanel` props |
| C15-2 | 低 FPS 时追踪间隔自动拉长，避免 CPU 推理持续抢占渲染 | `getAdaptiveTrackingInterval(..., renderFps)` |
| C15-3 | 低 FPS 且高延迟时检测帧降到 224x126 轻量档 | `getAdaptiveDetectionFrameSize(..., renderFps)` |
| C15-4 | 无手搜索状态在低 FPS 时降低搜索频率，减少空转负担 | `getInferenceInterval` |
| C15-5 | 手控预览在低 FPS 时缩小并降低视频层不透明度，减少画面遮挡和合成负担 | `styles.css`, `.low-fps` |
| C15-6 | 自动化覆盖 FPS 预算下的推理间隔和检测尺寸分档 | `tests/gestureFilters.spec.ts` |
| C15-7 | 完整回归通过 | `npm run eval:cycle15` |

本轮记录指标：

| 场景 | 指标 |
| --- | --- |
| FPS 预算单元测试 | 72ms 延迟下 20 FPS 预算约 100ms 间隔，16 FPS 预算约 116ms 间隔；低 FPS 高延迟检测帧降到 224x126 |
| 手控假摄像头 | 19-20 FPS，render 约 0.4-0.6ms，canvas 547x342，摄像头面板 164x147，video 162x86，`.low-fps` 生效，MediaPipe CPU/adaptive，延迟约 68-70ms |
| 自动化回归 | 22 passed via `npm run eval:cycle16` |

下一步真实手测标准：

- 手控时摄像头预览不应抢占主要视觉，太阳系仍应是第一视觉焦点。
- 真实手进入 tracking 后，如果 FPS 掉到 24 以下，应优先保持画面平滑，不应持续卡成跳帧。
- 如果降载后手势识别明显变迟钝，下一轮应分开处理 lost 搜索档和 tracking 控制档。

## Cycle 16: 精密太阳系模型层

目标：补足放大近景时“模型太粗糙”的问题，让太阳系从彩色球体升级为可观察的精密星图：行星表面有微细点层，地球有城市光点，轨道有刻度，重点行星有磁层/场线。

验收标准：

| 编号 | 标准 | 证据 |
| --- | --- | --- |
| C16-1 | 八大行星都有可计数的表面微细点层，近景不再只依赖贴图色块 | `createSurfaceMicroDetails`, `getModelStats()` |
| C16-2 | 地球近景包含城市光点，用于增强夜面和文明尺度感 | `createNightLights` |
| C16-3 | 地球、木星、土星、天王星、海王星有磁层/场线，选中时显示精密观测层 | `createPlanetFieldLines` |
| C16-4 | 每条大行星轨道有 24 个刻度，增强星图读数感 | `createOrbitTicks` |
| C16-5 | 手控模式下仅保留选中目标的高密度细节层，避免精细化拖慢交互 | `updateSelection` |
| C16-6 | 自动化验证微细点、城市光、轨道刻度和场线数量 | `tests/modelDetail.spec.ts` |
| C16-7 | 完整回归通过 | `npm run eval:cycle16` |

本轮记录指标：

| 场景 | 指标 |
| --- | --- |
| 模型结构 | 8 planets, 12 major moons, 91 surface feature lines, 2460 surface micro points, 19 feature labels, 48 orbit markers, 192 orbit ticks, 50 field lines, 99 night light points, 8 named minor/dwarf bodies, 2 ring systems |
| 手控假摄像头 | 19-20 FPS，render 约 0.4-0.6ms，canvas 547x342，低 FPS 摄像头预览 164px 宽，MediaPipe CPU/adaptive，延迟约 68-70ms |
| 自动化回归 | 22 passed via `npm run eval:cycle16` |

下一步真实手测标准：

- 放大到地球、火星、木星、土星附近时，画面应明显比 Cycle 15 更精细，不应只像彩色球体。
- 手控模式下选中行星时，细节层应增强目标识别，但不应因为高密度点层导致明显更卡。
- 如果真实手控帧率仍低于 24 FPS，下一轮应把精细模型按距离和选中状态进一步分级渲染。

## Cycle 17: 手控响应和严重低 FPS 降载

目标：继续针对“手能控制但很卡、缩放移动不随心”推进。严重低 FPS 且推理延迟高时进一步减轻 MediaPipe 输入负担；大幅手势变化时让场景目标更快贴近最新手势目标。

验收标准：

| 编号 | 标准 | 证据 |
| --- | --- | --- |
| C17-1 | 低于 21 FPS 且推理延迟不低于 64ms 时，检测帧降到 192x108 | `getAdaptiveDetectionFrameSize` |
| C17-2 | 低于 18 FPS 且推理延迟不低于 42ms 时，检测帧降到 192x108 | `getAdaptiveDetectionFrameSize` |
| C17-3 | 单手 pinch 直接控制按目标误差自适应提高追随速率 | `updatePinchControl`, `getAdaptiveDirectControlAlpha` |
| C17-4 | 双手 space 直接控制按相机、目标点和旋转误差自适应提高追随速率 | `updateSpaceControl`, `getAdaptiveDirectControlAlpha` |
| C17-5 | 自动化覆盖严重低 FPS 下 192x108 检测帧分档，并保持导航控制回归通过 | `tests/gestureFilters.spec.ts`, `tests/navigation.spec.ts` |
| C17-6 | 完整回归通过 | `npm run eval:cycle17` |

本轮记录指标：

| 场景 | 指标 |
| --- | --- |
| 严重低 FPS 检测分档 | 20 FPS / 68ms 和 16 FPS / 44ms 均降到 192x108；常规高延迟 72ms 仍为 256x144 |
| 手控假摄像头 | 19-20 FPS，render 约 0.3-0.5ms，canvas 547x342，低 FPS 预览 164px 宽，MediaPipe CPU/adaptive；延迟抽样约 71.6-119.6ms，仍有明显波动 |
| 自动化回归 | 22 passed via `npm run eval:cycle17` |

下一步真实手测标准：

- 大幅单手捏合缩放后，画面应更快贴近手势目标，不应明显慢半拍。
- 双手拉开、平移、旋转时，快速动作后画面应优先追最新目标，而不是拖着旧位置。
- 如果真实手控仍卡，下一轮应考虑把 MediaPipe 推理与渲染帧完全解耦成更严格的时间预算模式。
