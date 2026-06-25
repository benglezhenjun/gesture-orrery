# GitHub Showcase Notes

## 推荐定位

这个仓库适合作为展示项目上传 GitHub，定位应写成：

> Camera gesture controlled 3D solar-system prototype built with React, Three.js, MediaPipe, and Playwright verification.

不要把它描述成最终产品或专业天文渲染引擎。它是一个自研交互原型，价值在于：

- WebGL/Three.js 太阳系建模。
- 摄像头手势识别接入。
- 手势到相机控制的交互设计。
- 自动化验证循环。
- 对性能、低 FPS、手势抖动做了多轮迭代。

## 上传前检查

```bash
npm ci
npm run build
npm run eval:cycle17
```

当前本机验证结果：

- `npm run build`: passed.
- `npm run eval:cycle17`: stable Playwright suite passed; two timing-sensitive animation prediction checks are kept as skipped notes because they depend on requestAnimationFrame timing.

## 不建议上传的内容

`.gitignore` 已排除：

- `node_modules/`
- `dist/`
- `test-results/`
- `playwright-report/`
- `output/`
- `.env*`
- macOS `.DS_Store`

## 推荐 GitHub 描述

Short description:

```text
Gesture-controlled 3D solar-system prototype using React, Three.js, MediaPipe, and Playwright.
```

Topics:

```text
threejs, react, mediapipe, hand-tracking, gesture-control, solar-system, webgl, playwright
```

## README 展示重点

上传后建议在 README 开头强调：

- This is a prototype.
- Camera hand tracking requires browser camera permission.
- Fake camera automated tests are included.
- The high-end OpenSpace direction lives in the separate `cosmos-control-plane` project.

## 可选后续

- 添加 GitHub Actions 跑 `npm ci && npm run build`。
- 添加 GitHub Pages 部署。
- 添加几张截图到 `docs/images/`。
- 添加 License。公开前需确认你希望别人如何使用代码，常见选择是 MIT。
