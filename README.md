# 踪语AI - 基于地图轨迹的心理分析平台

> 个人国创项目（大创训练计划）· 概念验证原型（已完成手机真机联调）

一个以 **Python Web 全栈** 为基础、以 **GIS 轨迹跟踪** 为核心卖点的心理分析平台原型。用户可通过 AI 心理咨询对话获得情绪陪伴；系统通过浏览器定位实时采集用户的真实出行轨迹（经纬度打点入库），结合距离 / 速度 / 时长统计，交由 AI 做行为层面的情绪分析。

---

## 项目结构

```
├── 个人项目-前端/            # 原生 HTML/CSS/JS 前端
│   ├── index.html            # 登录页
│   ├── register.html         # 注册页
│   ├── main.html             # 主页面（AI 咨询 + 地图 + 日记入口）
│   ├── map.js                # OpenLayers 地图 + 轨迹绘制（高德底图）
│   ├── ai_chat/              # AI 聊天页（四模式切换，独立对话界面）
│   │   ├── chat.html
│   │   └── chat.js
│   ├── track_analysis/       # 轨迹分析页（实时打点采集 + 统计 + AI 分析）
│   │   ├── track.html
│   │   ├── track.css
│   │   └── track.js
│   └── mood_diary/           # 心情日记页（前端页面）
├── 个人项目-后端/            # Django REST Framework 后端
│   └── zongyu_ai/
│       ├── zongyu_ai/        # 项目配置（settings / urls）
│       ├── user_app/         # 用户注册 / 登录（JWT 认证）
│       ├── ai_app/           # AI 心理咨询（DeepSeek 接入，四模式提示词 + 医学红线）
│       ├── map_app/          # 地图轨迹（出行会话 / 定位点采集 / 轨迹回读）
│       └── mood_diary/       # 心情日记（后端待实现）
└── dev_proxy.py              # 本地联调反向代理（8080 同源入口）
```

---

## 技术栈

| 层次 | 技术 | 用途 |
|---|---|---|
| 后端框架 | Django 5.2 + Django REST Framework | API 服务 |
| 认证 | JWT（simplejwt） | 无状态登录认证 |
| 数据库 | MySQL（PyMySQL 驱动） | 用户 / 会话 / 消息 / 轨迹存储 |
| AI 能力 | DeepSeek API（OpenAI 兼容） | 心理陪伴对话 + 轨迹情绪分析 |
| 前端 | 原生 HTML/CSS/JS + Fetch | 前后端分离交互 |
| GIS | OpenLayers + 高德底图 + Geolocation API | 地图可视化与实时轨迹采集 |
| 联调 | cloudflared 快速隧道 + 反向代理 | 手机真机接入（HTTPS 安全上下文） |

---

## 已实现功能

- ✅ 用户注册 / 登录（JWT 无状态认证，Token 存前端 localStorage）
- ✅ AI 心理咨询对话
  - 四模式切换（普通 / 伴侣 / 同学 / 老师，独立聊天页，共享医学红线）
  - 多轮记忆（session_id 关联会话，历史消息回传大模型）
  - 医学红线拦截（关键词过滤 + 系统提示词双重防护，不提供诊断/用药建议）
  - 请求长度限制与上下文截断（防刷与成本控制）
- ✅ 真实轨迹采集与分析（核心链路，已真机验证）
  - 浏览器 Geolocation 实时定位，每 20 秒自动打点上报入库
  - 出行会话管理（创建出行 → 打点 → 结束回读，全程 JWT 鉴权 + 越权校验）
  - OpenLayers 绘制真实轨迹（LineString 画线 + 起终点标记）
  - 前端统计：Haversine 球面距离逐段累加、平均速度、出行时长（按开始/结束点击时刻相减）
  - 统计摘要拼入提示词，交由 AI 输出轨迹情绪分析
- ✅ 接口安全
  - 医学咨询关键词过滤
  - DRF 全局节流（防暴力破解 / 防 API 刷费）
  - 密码强度校验（Django validate_password）
  - 密钥外置（.env 环境变量，不进 git）
- ✅ 手机真机联调方案
  - dev_proxy.py 反向代理：8080 端口统一入口，`/api/` 转发后端、其余返回静态页面，实现同源免 CORS
  - cloudflared 快速隧道：公网 HTTPS 接入（浏览器定位要求安全上下文）
  - 前端 API 地址按协议自适应（HTTPS 走相对路径 `/api`，HTTP 直连 8000）

## 规划中功能

- [ ] 轨迹情绪关联分析深化（活动范围 / 停留热点 → AI 行为分析）
- [ ] 心情日记完整 CRUD 与情绪曲线
- [ ] 轨迹数据清洗（GPS 抖动过滤 / 停留点识别）

---

## 本地运行

```bash
# 1. 后端
cd 个人项目-后端/zongyu_ai
pip install -r requirements.txt
cp .env.example .env      # 填入 SECRET_KEY / DB_PASSWORD / DEEPSEEK_API_KEY
python manage.py migrate
python manage.py runserver

# 2. 前端（静态服务器，如 VS Code Live Server）
# 打开 个人项目-前端/index.html，端口需为 5500（CORS 白名单）
```

> 前端通过 `http://127.0.0.1:8000/api` 与后端交互，CORS 白名单已放宽为正则匹配，支持局域网与隧道域名接入。
> 浏览器定位功能在正式部署时需 HTTPS 环境。

### 手机真机联调（可选）

```bash
# 1. 启动反向代理（前后端统一入口，8080 端口）
python dev_proxy.py

# 2. 启动 cloudflared 快速隧道，获得公网 HTTPS 地址
cloudflared tunnel --url http://localhost:8080
```

手机浏览器打开隧道地址即可使用（首次使用需授权定位权限）。

---

## 项目状态

当前为**概念验证（MVP）阶段**：核心链路（登录 → AI 对话 → 多轮记忆 → 安全红线 → 真实轨迹采集 → 统计 → AI 轨迹分析）已全部跑通，并完成手机真机测试。下一阶段重点：轨迹数据清洗与情绪关联分析深化。
