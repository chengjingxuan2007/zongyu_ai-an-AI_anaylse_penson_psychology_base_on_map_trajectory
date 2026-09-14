from django.db import models
from django.conf import settings


class TrackSession(models.Model):
    """一次出行轨迹：把一段连续打点归组。表建在现有 MySQL 库（zongyu_ai_db）。"""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='track_sessions',
        verbose_name='用户',
    )
    start_at = models.DateTimeField(auto_now_add=True, verbose_name='开始时间')
    end_at = models.DateTimeField(null=True, blank=True, verbose_name='结束时间')

    class Meta:
        db_table = 'map_track_session'
        ordering = ['-start_at']
        verbose_name = '出行轨迹'
        verbose_name_plural = verbose_name

    def __str__(self):
        return f'{self.user.username} - {self.id} ({self.start_at:%m-%d %H:%M})'


class TrackPoint(models.Model):
    """单个轨迹点：前端每 20 秒上报一次定位。
    当前用普通经纬度字段存储（未启用 PostGIS/GeoDjango），
    未来切换 PostGIS 时改为 PointField(srid=4326) 即可。
    """
    session = models.ForeignKey(
        TrackSession,
        on_delete=models.CASCADE,
        related_name='points',
        verbose_name='所属轨迹',
    )
    lng = models.FloatField(verbose_name='经度')   # 范围 -180 ~ 180
    lat = models.FloatField(verbose_name='纬度')   # 范围 -90 ~ 90
    accuracy = models.FloatField(default=0, verbose_name='定位精度(米)')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='记录时间')

    class Meta:
        db_table = 'map_track_point'
        ordering = ['created_at', 'id']          # 画线顺序依赖此排序
        verbose_name = '轨迹点'
        verbose_name_plural = verbose_name

    def __str__(self):
        return f'{self.session_id}: ({self.lng}, {self.lat})'
