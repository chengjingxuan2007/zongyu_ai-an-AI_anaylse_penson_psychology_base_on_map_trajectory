from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import TrackPoint, TrackSession


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

    返回 coords（[[lng,lat],...] 供前端画线）。
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        session = TrackSession.objects.filter(id=session_id, user=request.user).first()
        if session is None:
            return Response({'code': 404, 'msg': '出行记录不存在'},
                            status=status.HTTP_404_NOT_FOUND)

        coords = [[p.lng, p.lat] for p in session.points.all()]

        return Response({'code': 200, 'msg': 'success', 'data': {
            'session_id': session.id,
            'coords': coords,
        }}, status=status.HTTP_200_OK)
