import base64

import cv2
import numpy as np

_DETECTOR = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)
_ORB = cv2.ORB_create(nfeatures=256, fastThreshold=12)


def _extraer_bytes(data):
    if not data:
        raise ValueError("No se recibio ninguna imagen.")

    if "," in data:
        _, data = data.split(",", 1)

    return base64.b64decode(data)


def _detectar_rostro(gris):
    faces = _DETECTOR.detectMultiScale(
        gris,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(90, 90),
    )
    if len(faces) == 0:
        height, width = gris.shape
        side = min(width, height)
        left = max((width - side) // 2, 0)
        top = max((height - side) // 2, 0)
        return gris[top:top + side, left:left + side]

    x, y, w, h = max(faces, key=lambda item: item[2] * item[3])
    side = int(max(w, h) * 1.28)
    center_x = x + (w // 2)
    center_y = y + (h // 2)
    x0 = max(center_x - (side // 2), 0)
    y0 = max(center_y - (side // 2), 0)
    x1 = min(x0 + side, gris.shape[1])
    y1 = min(y0 + side, gris.shape[0])

    recorte = gris[y0:y1, x0:x1]
    if recorte.shape[0] != recorte.shape[1]:
        lado = min(recorte.shape[0], recorte.shape[1])
        recorte = recorte[:lado, :lado]
    return recorte


def _crear_mascara_eliptica(shape):
    height, width = shape
    mascara = np.zeros((height, width), dtype=np.uint8)
    centro = (width // 2, height // 2)
    ejes = (max(int(width * 0.34), 1), max(int(height * 0.44), 1))
    cv2.ellipse(mascara, centro, ejes, 0, 0, 360, 255, -1)
    return mascara


def _aplicar_mascara(rostro, mascara):
    base = cv2.bitwise_and(rostro, rostro, mask=mascara)
    fondo = np.full_like(rostro, int(np.mean(rostro)))
    fondo = cv2.bitwise_and(fondo, fondo, mask=cv2.bitwise_not(mascara))
    return cv2.add(base, fondo)


def _preparar_rostro(data_url):
    image = np.frombuffer(_extraer_bytes(data_url), dtype=np.uint8)
    frame = cv2.imdecode(image, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("No se pudo leer la imagen enviada.")

    gris = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    rostro = _detectar_rostro(gris)
    rostro = cv2.resize(rostro, (180, 180))
    rostro = cv2.GaussianBlur(rostro, (3, 3), 0)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    rostro = clahe.apply(rostro)
    mascara = _crear_mascara_eliptica(rostro.shape)
    rostro = _aplicar_mascara(rostro, mascara)
    return rostro, mascara


def _calcular_similitud_coseno(rostro_guardado, rostro_nuevo, mascara):
    pixeles = mascara > 0
    vector_guardado = rostro_guardado[pixeles].astype(np.float32).flatten() / 255.0
    vector_nuevo = rostro_nuevo[pixeles].astype(np.float32).flatten() / 255.0

    norm_guardado = np.linalg.norm(vector_guardado)
    norm_nuevo = np.linalg.norm(vector_nuevo)
    if norm_guardado == 0 or norm_nuevo == 0:
        raise ValueError("La imagen no contiene informacion suficiente.")

    return float(np.dot(vector_guardado / norm_guardado, vector_nuevo / norm_nuevo))


def _calcular_histograma_score(rostro_guardado, rostro_nuevo, mascara):
    hist_guardado = cv2.calcHist([rostro_guardado], [0], mascara, [64], [0, 256])
    hist_nuevo = cv2.calcHist([rostro_nuevo], [0], mascara, [64], [0, 256])
    cv2.normalize(hist_guardado, hist_guardado)
    cv2.normalize(hist_nuevo, hist_nuevo)
    correlacion = cv2.compareHist(hist_guardado, hist_nuevo, cv2.HISTCMP_CORREL)
    return float(max(0.0, min(1.0, correlacion)))


def _calcular_lbph_score(rostro_guardado, rostro_nuevo):
    recognizer = cv2.face.LBPHFaceRecognizer_create(radius=2, neighbors=12, grid_x=8, grid_y=8)
    recognizer.train([rostro_guardado], np.array([0], dtype=np.int32))
    _, confidence = recognizer.predict(rostro_nuevo)
    return float(max(0.0, min(1.0, 1.0 - (confidence / 120.0))))


def _calcular_orb_score(rostro_guardado, rostro_nuevo):
    keypoints_a, descriptors_a = _ORB.detectAndCompute(rostro_guardado, None)
    keypoints_b, descriptors_b = _ORB.detectAndCompute(rostro_nuevo, None)

    if descriptors_a is None or descriptors_b is None or not keypoints_a or not keypoints_b:
        return 0.0

    matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    matches = matcher.match(descriptors_a, descriptors_b)
    if not matches:
        return 0.0

    matches = sorted(matches, key=lambda item: item.distance)
    buenos = [match for match in matches if match.distance < 55]
    base = max(min(len(keypoints_a), len(keypoints_b)), 1)
    return float(max(0.0, min(1.0, len(buenos) / base)))


def _evaluar_rostros(rostro_guardado, rostro_nuevo, mascara):
    similitud_coseno = _calcular_similitud_coseno(rostro_guardado, rostro_nuevo, mascara)
    similitud_histograma = _calcular_histograma_score(rostro_guardado, rostro_nuevo, mascara)
    similitud_lbph = _calcular_lbph_score(rostro_guardado, rostro_nuevo)
    similitud_orb = _calcular_orb_score(rostro_guardado, rostro_nuevo)

    similitud = (
        (similitud_coseno * 0.62) +
        (similitud_histograma * 0.05) +
        (similitud_lbph * 0.18) +
        (similitud_orb * 0.15)
    )

    coincide = similitud >= 0.735 or (
        similitud_coseno >= 0.94 and similitud_lbph >= 0.25
    ) or (
        similitud_coseno >= 0.955 and similitud_orb >= 0.06
    ) or (
        similitud_coseno >= 0.92 and similitud_lbph >= 0.28
    ) or (
        similitud_coseno >= 0.905 and similitud_lbph >= 0.26 and similitud_orb >= 0.10
    )

    return {
        "similitud": round(similitud, 4),
        "similitud_coseno": round(similitud_coseno, 4),
        "similitud_histograma": round(similitud_histograma, 4),
        "similitud_lbph": round(similitud_lbph, 4),
        "similitud_orb": round(similitud_orb, 4),
        "coincide": coincide,
    }


def comparar_fotos_local(data_url_guardada, data_url_nueva):
    rostro_guardado, mascara = _preparar_rostro(data_url_guardada)
    rostro_nuevo, _ = _preparar_rostro(data_url_nueva)

    evaluacion_normal = _evaluar_rostros(rostro_guardado, rostro_nuevo, mascara)
    evaluacion_normal["orientacion"] = "normal"

    rostro_nuevo_espejo = cv2.flip(rostro_nuevo, 1)
    evaluacion_espejo = _evaluar_rostros(rostro_guardado, rostro_nuevo_espejo, mascara)
    evaluacion_espejo["orientacion"] = "espejo"

    return max(
        [evaluacion_normal, evaluacion_espejo],
        key=lambda item: (item["coincide"], item["similitud"])
    )
