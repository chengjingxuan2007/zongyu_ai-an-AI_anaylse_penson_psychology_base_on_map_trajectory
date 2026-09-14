const API_BASE = 'http://10.199.166.126:8000/api';
// 打点间隔：每 20 秒记录一个定位点
const TRACK_INTERVAL_MS = 20000;

// 采集状态
let trackSessionId = null;    // 后端返回的出行会话 ID
let trackTimer = null;        // setInterval 句柄
let trackMinutes = 60;        // 展示用出行时长（demo 默认 1 小时，真实结束会更新）

// 两点间距离（米），Haversine 公式
function segDist(a, b) {
    const R = 6371000, rad = x => x * Math.PI / 180;
    const dLat = rad(b[1] - a[1]), dLon = rad(b[0] - a[0]);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
}

// 更新三个统计卡片：出行时间 / 总距离 / 平均速度
function updateStats(totalMeters, minutes) {
    const km = totalMeters / 1000;
    const hours = minutes / 60;
    document.getElementById('stat-time').innerText = minutes ? fmtMinutes(minutes) : '--';
    document.getElementById('stat-dist').innerText = km.toFixed(2) + ' km';
    document.getElementById('stat-speed').innerText = hours > 0 ? (km / hours).toFixed(1) + ' km/h' : '--';
}

// 分钟数转成"x小时y分 / y分钟"的显示文本
function fmtMinutes(min) {
    if (min >= 60) {
        const h = Math.floor(min / 60), m = Math.round(min % 60);
        return m ? h + '小时' + m + '分' : h + '小时';
    }
    return Math.round(min) + '分钟';
}

// 地图画好后（map.js 先执行），先按 demo 轨迹算一次统计
document.addEventListener("DOMContentLoaded", function () {
    const coords = window.trackCoords || [];
    let meters = 0;
    for (let i = 1; i < coords.length; i++) meters += segDist(coords[i - 1], coords[i]);
    updateStats(meters, trackMinutes);
});

// ============ 真实轨迹采集：每 20 秒打点 ============

function setStatus(txt) {
    const el = document.getElementById('track-status');
    if (el) el.textContent = txt;
}

function setButtons(recording) {
    document.getElementById('btn-start').disabled = recording;
    document.getElementById('btn-stop').disabled = !recording;
}

function getToken() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        setStatus('请先登录后再记录轨迹');
        setTimeout(() => { window.location.href = '../index.html'; }, 1500);
        return null;
    }
    return token;
}

// ① 开始记录：通知后端创建一次"出行"，随后每 20 秒打一个点
async function startTrack() {
    const token = getToken();
    if (!token) return;

    setButtons(true);
    setStatus('正在创建出行记录...');
    try {
        const res = await fetch(`${API_BASE}/map_app/sessions/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json();
        if (!res.ok || data.code !== 200) throw new Error(data.msg || '创建失败');

        trackSessionId = data.data.session_id;
        setStatus(`开始记录中（会话 ${trackSessionId}），每 20 秒打点一次…`);
        reportOnce();                                     // 立即打第一个点
        trackTimer = setInterval(reportOnce, TRACK_INTERVAL_MS);
    } catch (err) {
        setButtons(false);
        setStatus('创建出行失败：' + err.message);
    }
}

// ② 获取一次定位并上报给后端
function reportOnce() {
    if (!navigator.geolocation) {
        setStatus('当前浏览器不支持定位（手机需使用 HTTPS 或 localhost）');
        return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const { longitude: lng, latitude: lat, accuracy } = pos.coords;
        try {
            const res = await fetch(`${API_BASE}/map_app/points/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                },
                body: JSON.stringify({ session_id: trackSessionId, lng, lat, accuracy })
            });
            if (res.ok) {
                setStatus(`正在记录…（会话 ${trackSessionId}）✓ 最近定位已入库`);
            } else {
                setStatus('打点上报失败，请检查后端是否启动');
            }
        } catch (err) {
            setStatus('网络异常，打点上报失败');
        }
    }, (err) => {
        setStatus('获取定位失败：' + (err.message || '请检查定位权限'));
    }, { enableHighAccuracy: true, timeout: 10000 });
}

// ③ 结束记录：拉回真实轨迹并画到地图上
async function stopTrack() {
    clearInterval(trackTimer);
    trackTimer = null;
    setButtons(false);

    const token = localStorage.getItem('access_token');
    setStatus('正在拉取真实轨迹...');
    try {
        const res = await fetch(`${API_BASE}/map_app/sessions/${trackSessionId}/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok || data.code !== 200) throw new Error(data.msg || '拉取失败');

        const coords = data.data.coords || [];
        // 按 20 秒打点间隔估算出行时长（分钟）
        trackMinutes = Math.max(1, Math.round((coords.length - 1) * TRACK_INTERVAL_MS / 60000));

        // 交给 map.js 重绘真实轨迹
        if (coords.length >= 2) {
            window.trackCoords = coords;
            if (window.drawTrack) {
                window.drawTrack(coords);
            }
            let meters = 0;
            for (let i = 1; i < coords.length; i++) meters += segDist(coords[i - 1], coords[i]);
            updateStats(meters, trackMinutes);
            setStatus(`✅ 已加载真实轨迹：${coords.length} 个点`);
        } else {
            setStatus('轨迹点不足 2 个，无法成线（记录时间太短？）');
        }
    } catch (err) {
        setStatus('拉取真实轨迹失败：' + err.message);
    }
}

// ============ AI 轨迹情绪分析 ============

// 调后端 AI 接口，根据轨迹统计做情绪分析
async function analyzeTrack() {
    const output = document.getElementById('track-output');
    const token = localStorage.getItem('access_token');
    if (!token) { output.innerText = '请先登录后再使用轨迹分析'; return; }

    const dist = document.getElementById('stat-dist').innerText;
    const speed = document.getElementById('stat-speed').innerText;
    const message = `我今天的轨迹：总距离${dist}，出行时间${fmtMinutes(trackMinutes)}，平均速度${speed}，共经过${(window.trackCoords || []).length}个位置点。请结合这些数据，分析我今天可能的情绪状态，并给我一些温暖的建议。`;

    output.innerText = 'AI 正在分析你的轨迹，请稍候...';
    try {
        const res = await fetch(`${API_BASE}/ai_app/chat/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ message, session_id: null, mode: 'normal' })
        });
        const data = await res.json();
        if (res.ok && data.code === 200) {
            output.innerText = data.data.reply;
        } else if (res.status === 401) {
            output.innerText = '登录已过期，请重新登录';
        } else {
            output.innerText = data.msg || '出错了，请稍后再试';
        }
    } catch (err) {
        output.innerText = '网络异常，请检查后端服务是否启动';
    }
}
