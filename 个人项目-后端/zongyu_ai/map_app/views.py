import math

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import TrackPoint, TrackSession


def _distance_m(a, b):
    """两坐标点 [lng, lat] 之间的球面距离（米），Haversine 公式"""
    R = 6371000
    lat1, lon1 = math.radians(a[1]), math.radians(a[0])
    lat2, lon2 = math.radians(b[1]), math.radians(b[0])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


class TrackSessionView(APIView):
    """开始一次出行：POST /api/map_app/sessions/

    请求体为空即可，登录用户由 JWT 识别。
    返回 data.session_id，前端后续打点都要带上它。
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        session = TrackSession.objects.create(user=request.user)
        return Response(
            {'code': 200, 'msg': 'ok', 'data': {'session_id': session.id}},
            status=status.HTTP_200_OK,
        )


class TrackPointView(APIView):
    """接收一个定位点：POST /api/map_app/points/

    请求体：session_id, lng, lat, accuracy(可选)
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data
        session_id = data.get('session_id')
        try:
            lng = float(data.get('lng'))
            lat = float(data.get('lat'))
        except (TypeError, ValueError):
            return Response({'code': 400, 'msg': '经纬度格式不正确'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not (-180 <= lng <= 180) or not (-90 <= lat <= 90):
            return Response({'code': 400, 'msg': '经纬度超出有效范围'},
                            status=status.HTTP_400_BAD_REQUEST)

        # 轨迹必须属于当前用户，防止串改他人 session_id
        session = TrackSession.objects.filter(id=session_id, user=request.user).first()
        if session is None:
            return Response({'code': 404, 'msg': '出行记录不存在'},
                            status=status.HTTP_404_NOT_FOUND)

        TrackPoint.objects.create(
            session=session,
            lng=lng,
            lat=lat,
            accuracy=float(data.get('accuracy', 0) or 0),
        )
        return Response({'code': 200, 'msg': 'ok'}, status=status.HTTP_200_OK)


class TrackDetailView(APIView):
    """取回一条轨迹：GET /api/map_app/sessions/<session_id>/

    返回 coords（[[lng,lat],...] 供前端画线）、总距离、点数与各点时刻。
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        session = TrackSession.objects.filter(id=session_id, user=request.user).first()
        if session is None:
            return Response({'code': 404, 'msg': '出行记录不存在'},
                            status=status.HTTP_404_NOT_FOUND)

        points = list(session.points.all())
        coords = [[p.lng, p.lat] for p in points]
        total_m = 0.0
        for i in range(1, len(coords)):
            total_m += _distance_m(coords[i - 1], coords[i])

        return Response({'code': 200, 'msg': 'success', 'data': {
            'session_id': session.id,
            'start_at': session.start_at.strftime('%Y-%m-%d %H:%M:%S'),
            'point_count': len(points),
            'distance_m': round(total_m, 1),
            'coords': coords,
            'times': [p.created_at.strftime('%H:%M:%S') for p in points],
        }}, status=status.HTTP_200_OK)
