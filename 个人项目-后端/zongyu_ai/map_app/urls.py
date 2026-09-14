from django.urls import path
from . import views

urlpatterns = [
    # 开始一次出行，返回 session_id
    path('sessions/', views.TrackSessionView.as_view()),
    # 每 20 秒上报一个定位点
    path('points/', views.TrackPointView.as_view()),
    # 取回一条轨迹（画线 + 统计）
    path('sessions/<int:session_id>/', views.TrackDetailView.as_view()),
]
