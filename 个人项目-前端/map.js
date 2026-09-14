document.addEventListener("DOMContentLoaded", function () {
    // 检查页面上是否存在id为'map'的元素
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.warn("未找到ID为'map'的容器，地图未初始化。");
        return;
    }

    // 初始化地图
    const map = new ol.Map({
        target: 'map',
        layers: [
            new ol.layer.Tile({
                source: new ol.source.XYZ({
                    // 高德地图矢量图层（国内访问速度快，风格简洁）
                    url: 'https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}'
                })
            })
        ],
        view: new ol.View({
                    center: ol.proj.fromLonLat([106.96, 33.21]), //汉中市位置
                    zoom: 14, // 初始缩放级别稍微调小一点，以便看到全貌，你可以按需调整
                    minZoom: 3,  // 最小缩放级别，防止缩得太小没有瓦片
                    maxZoom: 18  // 最大缩放级别，高德瓦片最多支持到18
                })
    });

    // 将map对象挂载到window上，方便在其他脚本中调用地图实例（例如添加轨迹点）
    window.myMapInstance = map;

    // ===== 轨迹绘制（先画 demo，等真实轨迹拉回后可用 drawTrack 重绘）=====

    let currentTrackLayer = null;   // 当前轨迹图层，重绘前先移除旧的

    // 通用轨迹绘制函数：输入 [[经度,纬度], ...] 坐标数组，画线 + 起终点 + 视野缩放
    window.drawTrack = function (coords) {
        if (!coords || coords.length < 2) {
            console.warn("轨迹点数不足，无法绘制");
            return;
        }

        // 移除上一次画的轨迹（demo 或真实轨迹）
        if (currentTrackLayer) {
            map.removeLayer(currentTrackLayer);
            currentTrackLayer = null;
        }

        // 画成一条线
        const trackLine = new ol.Feature({
            geometry: new ol.geom.LineString(
                coords.map(coord => ol.proj.fromLonLat(coord))
            )
        });
        trackLine.setStyle(new ol.style.Style({
            stroke: new ol.style.Stroke({ color: '#11998e', width: 2 })
        }));

        // 起点和终点圆点标记
        function makePoint(coord, color) {
            const p = new ol.Feature({
                geometry: new ol.geom.Point(ol.proj.fromLonLat(coord))
            });
            p.setStyle(new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 6,
                    fill: new ol.style.Fill({ color: color })
                })
            }));
            return p;
        }
        const startPoint = makePoint(coords[0], '#e8463a');                      // 起点红色
        const endPoint   = makePoint(coords[coords.length - 1], '#38ef7d');      // 终点绿色

        currentTrackLayer = new ol.layer.Vector({
            source: new ol.source.Vector({
                features: [trackLine, startPoint, endPoint]
            })
        });
        map.addLayer(currentTrackLayer);

        // 同步给统计/AI 分析使用的全局坐标
        window.trackCoords = coords;

        // 自动缩放视野，让整条轨迹刚好完整显示
        map.getView().fit(
            trackLine.getGeometry().getExtent(),
            { padding: [80, 80, 80, 80], duration: 500 }
        );
    };
});
