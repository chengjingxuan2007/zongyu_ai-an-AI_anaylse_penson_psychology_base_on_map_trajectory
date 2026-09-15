const API_BASE = window.location.protocol === 'https:' ? '/api' : 'http://' + window.location.hostname + ':8000/api';
let currentMode = 'normal';

// 左侧模式切换：点谁亮谁
document.querySelectorAll('.mode-item').forEach(btn => {
    btn.addEventListener('click', function () {
        document.querySelectorAll('.mode-item').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentMode = this.dataset.mode;
    });
});

// 往聊天区追加一条消息气泡
function addMsg(text, who) {
    const div = document.createElement('div');
    div.className = 'msg ' + who;
    div.innerText = text;
    document.getElementById('chat-body').appendChild(div);
    document.getElementById('chat-body').scrollTop = 99999; // 滚到最新
}

// 发送消息：调后端接口，带模式和多轮会话
async function sendMsg() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;

    const token = localStorage.getItem('access_token');
    if (!token) { addMsg('请先登录后再使用 AI 咨询', 'ai'); return; }

    addMsg(message, 'user');
    input.value = '';
    addMsg('踪语正在聆听，请稍候...', 'ai');
    const loading = document.getElementById('chat-body').lastChild;

    try {
        const res = await fetch(`${API_BASE}/ai_app/chat/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                message,
                session_id: localStorage.getItem('ai_session_id') || null,
                mode: currentMode
            })
        });
        const data = await res.json();
        if (res.ok && data.code === 200) {
            loading.innerText = data.data.reply;
            localStorage.setItem('ai_session_id', data.data.session_id);
        } else if (res.status === 401) {
            loading.innerText = '登录已过期，请重新登录';
        } else {
            loading.innerText = data.msg || '出错了，请稍后再试';
        }
    } catch (err) {
        loading.innerText = '网络异常，请检查后端服务是否启动';
    }
}

// 回车发送
document.getElementById('chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') sendMsg();
});

// 从主页带过来的咨询内容：直接自动发送
const pending = sessionStorage.getItem('pending_chat');
if (pending) {
    sessionStorage.removeItem('pending_chat');
    document.getElementById('chat-input').value = pending;
    sendMsg();
}
